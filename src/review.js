import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  writeJsonArtifact,
  writeTextArtifact
} from './artifacts.js';
import {
  attachPageObservers,
  createPageEventBuffers,
  waitForNetworkIdle,
  writePageObservation
} from './page-evidence.js';
import { normalizeTimeout, validateUrl } from './observe.js';
import { resolveJsonInput } from './input.js';
import { redact, redactUrl, truncateText } from './redaction.js';

const DEFAULT_VIEWPORT = Object.freeze({ name: 'laptop', width: 1280, height: 720 });
const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ name: 'desktop', width: 1440, height: 980 }),
  laptop: DEFAULT_VIEWPORT,
  mobile: Object.freeze({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true })
});

const SAFE_ROUTE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const DEFAULT_ROUTE_BUDGET = 20;
const DEFAULT_FINDINGS_LIMIT = 200;

export async function runReview(options = {}, context = {}) {
  if (options.target || options.input) {
    return runTargetReview(options, context);
  }
  return runSingleUrlReview(options, context);
}

export async function runSingleUrlReview(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('review', now) ?? createArtifactId(now, 'review');
  const viewport = parseViewport(options.viewport);
  let timeout;
  try {
    timeout = normalizeTimeout(options.timeout);
  } catch (error) {
    return failure({
      code: 'INVALID_TIMEOUT',
      message: error.message,
      details: { timeout: options.timeout }
    });
  }

  const urlError = validateUrl(options.url);
  if (urlError) {
    return failure(urlError);
  }

  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return failure({
      code: 'ARTIFACT_ROOT_INVALID',
      message: error.message,
      details: { artifact_root: artifactRootInput }
    });
  }

  const warnings = [];
  const artifacts = [];
  let browser;
  let browserContext;

  try {
    const browserType = context.browserType ?? (await import('playwright')).chromium;
    const headless = !options.headed && !options.devtools;
    browser = await browserType.launch({
      headless,
      devtools: Boolean(options.devtools)
    });
    browserContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: Boolean(viewport.isMobile),
      hasTouch: Boolean(viewport.hasTouch)
    });
    const page = await browserContext.newPage();
    const pageEvents = createPageEventBuffers();
    attachPageObservers(page, pageEvents, {
      maxConsoleMessages: 80,
      maxFailedRequests: 80
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout });
    await waitForNetworkIdle(page, timeout, warnings, {
      message: 'The page did not reach networkidle before the short review wait ended.'
    });

    const observationResult = await writePageObservation({
      root,
      artifactRoot: artifactRootInput,
      id: `${id}-observation`,
      now,
      page,
      inputUrl: options.url,
      response,
      browser: {
        engine: 'chromium',
        headless,
        devtools: Boolean(options.devtools),
        ephemeral_context: true,
        review: true
      },
      consoleMessages: pageEvents.consoleMessages,
      failedRequests: pageEvents.failedRequests,
      actionResults: [],
      description: 'Structured review page observation JSON.'
    });
    artifacts.push(observationResult.artifact);

    const layout = await collectLayoutEvidence(page, observationResult.data.page.action_candidates, options.url);
    const layoutRel = artifactRelPath(artifactRootInput, 'layouts', `${id}.json`);
    await writeJsonArtifact(root, ['layouts', `${id}.json`], redact(layout));
    artifacts.push(artifactObject({
      type: 'layout',
      path: layoutRel,
      description: 'Structured layout and review evidence JSON.'
    }));

    let screenshotArtifact = null;
    let screenshotPath = null;
    if (options.screenshot || options.mock) {
      const screenshotRel = artifactRelPath(artifactRootInput, 'screenshots', `${id}.png`);
      screenshotPath = path.join(root, 'screenshots', `${id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshotArtifact = artifactObject({
        type: 'screenshot',
        path: screenshotRel,
        description: 'Full-page screenshot captured for local review evidence.'
      });
      artifacts.push(screenshotArtifact);
    }

    const findings = createFindings({
      id,
      url: page.url(),
      viewport,
      observation: observationResult.data,
      layout,
      screenshotArtifact
    });

    const mockResult = options.mock
      ? await compareMock({
          id,
          cwd,
          root,
          artifactRoot: artifactRootInput,
          actualPath: screenshotPath,
          mockPath: options.mock,
          threshold: options.threshold
        })
      : null;
    if (mockResult) {
      artifacts.push(...mockResult.artifacts);
      findings.push(...mockResult.findings.map((finding, index) => withFindingId(id, finding, findings.length + index + 1)));
      warnings.push(...mockResult.warnings);
    }
    const qualitySignals = buildQualitySignals({
      findings,
      layout,
      viewport,
      screenshotArtifact,
      mockMetrics: mockResult?.metrics ?? null
    });
    const actionPlan = buildActionPlan(findings);
    const reviewAdvisory = buildReviewAdvisory({
      findings,
      layout,
      screenshotArtifact,
      mockMetrics: mockResult?.metrics ?? null,
      qualitySignals
    });

    const review = redact({
      schema_version: SCHEMA_VERSION,
      id,
      mode: 'single_url',
      status: 'completed',
      labels: ['deterministic', 'local_first'],
      input_url: redactUrl(options.url),
      final_url: redactUrl(page.url()),
      viewport,
      created_at: now.toISOString(),
      limitations: reviewLimitations({ screenshot: Boolean(screenshotArtifact), mock: Boolean(options.mock) })
    });
    const metrics = reviewMetrics(findings, {
      console_messages: observationResult.data.console.messages.length,
      failed_requests: observationResult.data.network.failed_requests.length,
      action_candidates: layout.actions.length,
      horizontal_overflow: layout.page.horizontal_overflow,
      mock: mockResult?.metrics ?? null
    });
    const data = redact({
      review,
      findings: findings.slice(0, DEFAULT_FINDINGS_LIMIT),
      metrics,
      action_plan: actionPlan,
      review_advisory: reviewAdvisory,
      quality_signals: qualitySignals,
      environment: {
        browser: {
          engine: 'chromium',
          headless,
          devtools: Boolean(options.devtools),
          ephemeral_context: true
        },
        viewport,
        artifact_root: artifactRootInput
      },
      evidence_summary: buildEvidenceSummary({
        observation: observationResult.data,
        layout,
        screenshotArtifact
      }),
      discovery: {
        routes: layout.routes
      }
    });

    const reviewRel = artifactRelPath(artifactRootInput, 'reviews', `${id}.json`);
    await writeJsonArtifact(root, ['reviews', `${id}.json`], data);
    artifacts.push(artifactObject({
      type: 'review',
      path: reviewRel,
      description: 'Structured browser review JSON.'
    }));

    if (options.report) {
      const reportRel = artifactRelPath(artifactRootInput, 'reports', `${id}.md`);
      await writeTextArtifact(root, ['reports', `${id}.md`], renderReviewReport(data, artifacts));
      artifacts.push(artifactObject({
        type: 'report',
        path: reportRel,
        description: 'Markdown browser review report.'
      }));
    }

    const artifactIndex = await writeReviewArtifactIndex({
      id,
      mode: 'single_url',
      root,
      artifactRoot: artifactRootInput,
      artifacts,
      qualitySignals,
      coverage: null,
      rerun: {
        command: reviewRerunCommand({
          url: options.url,
          viewport,
          screenshot: Boolean(options.screenshot || options.mock),
          report: Boolean(options.report),
          mock: options.mock
        }),
        guidance: ['Rerun the same command after fixes to compare findings and quality signals.']
      }
    });
    data.artifact_index = artifactIndex.data;
    artifacts.push(artifactIndex.artifact);
    await writeJsonArtifact(root, ['reviews', `${id}.json`], data);

    return {
      status: 'ok',
      data,
      warnings,
      errors: [],
      artifacts
    };
  } catch (error) {
    return failure({
      code: classifyReviewError(error),
      message: truncateText(error.message, 1000),
      details: {
        browser_launched: Boolean(browser),
        artifact_root: artifactRootInput
      }
    }, { warnings, artifacts });
  } finally {
    await browserContext?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

export async function runTargetReview(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('site-review', now) ?? createArtifactId(now, 'site-review');
  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return failure({
      code: 'ARTIFACT_ROOT_INVALID',
      message: error.message,
      details: { artifact_root: artifactRootInput }
    });
  }

  const manifestResult = await loadTargetManifest(options, context);
  if (!manifestResult.ok) {
    return failure(manifestResult.error);
  }
  const targetResult = normalizeTargetManifest(manifestResult.value);
  if (!targetResult.ok) {
    return failure(targetResult.error);
  }
  const target = targetResult.target;
  const discovered = new Map();
  const visited = [];
  const failed = [];
  const skipped = [];
  const pageChecks = [];
  const findings = [];
  const artifacts = [];
  const warnings = [];
  const queue = [];
  const routeBudget = target.budgets.maxRoutes;

  for (const page of target.pages) {
    enqueueRoute(queue, discovered, page.url, 'expected_page', target, { manifestPage: page });
  }
  for (const seed of target.seeds) {
    enqueueRoute(queue, discovered, seed, 'seed', target);
  }
  for (const expectedRoute of target.expectedRoutes) {
    enqueueRoute(queue, discovered, expectedRoute, 'expected_route', target);
  }

  let processedRoutes = 0;
  while (queue.length > 0 && processedRoutes < routeBudget) {
    const route = queue.shift();
    processedRoutes += 1;
    const viewports = viewportsForRoute(route, target.viewportMatrix);
    for (const viewport of viewports) {
      const childId = `${id}-r${processedRoutes}-${viewport.name}`;
      const result = await runSingleUrlReview({
        ...options,
        target: undefined,
        input: undefined,
        url: route.url,
        viewport: `${viewport.width}x${viewport.height}`,
        screenshot: target.artifacts.screenshots,
        report: false,
        mock: route.manifest_page?.mock ?? undefined,
        threshold: route.manifest_page?.threshold ?? options.threshold
      }, {
        ...context,
        cwd,
        createId: () => childId
      });
      artifacts.push(...result.artifacts);
      warnings.push(...result.warnings);
      if (result.status !== 'ok') {
        failed.push({ ...route, viewport, errors: result.errors });
        continue;
      }
      visited.push({ ...route, viewport, review_id: result.data.review.id });
      findings.push(...result.data.findings);
      if (route.manifest_page) {
        const pageEvaluation = evaluateManifestPage({
          reviewId: id,
          page: route.manifest_page,
          route,
          viewport,
          evidenceSummary: result.data.evidence_summary,
          mockMetrics: result.data.metrics?.mock ?? null,
          screenshotArtifact: result.artifacts.find((artifact) => artifact.type === 'screenshot') ?? null,
          findingOffset: findings.length
        });
        pageChecks.push(pageEvaluation.check);
        findings.push(...pageEvaluation.findings);
      }
      for (const next of result.data.discovery.routes) {
        if (!enqueueRoute(queue, discovered, next.url, next.source, target)) {
          skipped.push({ url: next.url, source: next.source, reason: 'out_of_scope_or_duplicate' });
        }
      }
    }
  }
  while (queue.length > 0) {
    const route = queue.shift();
    skipped.push({ ...route, reason: 'route_budget_exceeded' });
    if (route.manifest_page) {
      pageChecks.push(skippedPageCheck(route.manifest_page, route, 'route_budget_exceeded'));
    }
  }

  const expectedMissing = target.expectedRoutes
    .filter((url) => ![...discovered.keys()].includes(normalizeUrlKey(url)))
    .map((url) => ({ url, reason: 'expected_route_not_discovered' }));
  const expectedRoutes = target.expectedRoutes.map((url) => normalizeRoute(url, 'expected_route'));
  const coverage = redact({
    schema_version: SCHEMA_VERSION,
    id,
    base_url: target.baseUrl,
    route_budget: routeBudget,
    routes: {
      expected: expectedRoutes,
      discovered: [...discovered.values()],
      visited,
      skipped: dedupeByUrl(skipped),
      failed,
      expected_missing: expectedMissing
    },
    pages: {
      expected: target.pages.map(coveragePage),
      checked: pageChecks,
      failed: pageChecks.filter((check) => check.status === 'needs_attention'),
      skipped: pageChecks.filter((check) => check.status === 'skipped')
    },
    viewports: target.viewportMatrix,
    action_policy: target.actionPolicy
  });
  const coverageRel = artifactRelPath(artifactRootInput, 'coverage', `${id}.json`);
  await writeJsonArtifact(root, ['coverage', `${id}.json`], coverage);
  artifacts.push(artifactObject({
    type: 'coverage',
    path: coverageRel,
    description: 'Structured site review coverage JSON.'
  }));

  const qualitySignals = buildTargetQualitySignals({ findings, coverage });
  const actionPlan = buildActionPlan(findings, { coverage });
  const reviewAdvisory = buildTargetReviewAdvisory({ findings, coverage, qualitySignals });
  const manifestSuggestions = buildManifestSuggestions({ target, coverage, qualitySignals });
  const data = redact({
    review: {
      schema_version: SCHEMA_VERSION,
      id,
      mode: 'target_manifest',
      status: failed.length > 0 ? 'completed_with_failures' : 'completed',
      labels: ['deterministic', 'local_first', 'manifest_driven'],
      target: {
        base_url: target.baseUrl,
        manifest_source: manifestResult.source
      },
      created_at: now.toISOString(),
      limitations: reviewLimitations({ screenshot: target.artifacts.screenshots, mock: false })
    },
    findings: findings.slice(0, DEFAULT_FINDINGS_LIMIT),
    metrics: reviewMetrics(findings, {
      discovered_routes: discovered.size,
      visited_routes: visited.length,
      failed_routes: failed.length,
      expected_missing_routes: expectedMissing.length,
      expected_pages: target.pages.length,
      failed_page_expectations: pageChecks.filter((check) => check.status === 'needs_attention').length
    }),
    action_plan: actionPlan,
    review_advisory: reviewAdvisory,
    manifest_suggestions: manifestSuggestions,
    quality_signals: qualitySignals,
    environment: {
      artifact_root: artifactRootInput,
      viewports: target.viewportMatrix
    },
    coverage
  });
  const reviewRel = artifactRelPath(artifactRootInput, 'reviews', `${id}.json`);
  await writeJsonArtifact(root, ['reviews', `${id}.json`], data);
  artifacts.push(artifactObject({
    type: 'review',
    path: reviewRel,
    description: 'Structured site review JSON.'
  }));

  if (options.report) {
    const reportRel = artifactRelPath(artifactRootInput, 'reports', `${id}.md`);
    await writeTextArtifact(root, ['reports', `${id}.md`], renderReviewReport(data, artifacts));
    artifacts.push(artifactObject({
      type: 'report',
      path: reportRel,
      description: 'Markdown site review report.'
    }));
  }

  const artifactIndex = await writeReviewArtifactIndex({
    id,
    mode: 'target_manifest',
    root,
    artifactRoot: artifactRootInput,
    artifacts,
    qualitySignals,
    coverage,
    rerun: {
      command: targetRerunCommand({ manifestResult, report: Boolean(options.report) }),
      guidance: [
        'Rerun the same target manifest after fixes.',
        'Keep expected pages, expected routes, and the viewport matrix stable when verifying regressions.'
      ]
    }
  });
  data.artifact_index = artifactIndex.data;
  artifacts.push(artifactIndex.artifact);
  await writeJsonArtifact(root, ['reviews', `${id}.json`], data);

  return {
    status: 'ok',
    data,
    warnings,
    errors: [],
    artifacts
  };
}

export function parseViewport(value) {
  if (!value) {
    return { ...DEFAULT_VIEWPORT };
  }
  if (VIEWPORTS[value]) {
    return { ...VIEWPORTS[value] };
  }
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(String(value));
  if (!match) {
    return { ...DEFAULT_VIEWPORT, requested: String(value), warning: 'unsupported_viewport_defaulted' };
  }
  return {
    name: String(value),
    width: Number(match[1]),
    height: Number(match[2])
  };
}

export function classifyActionCandidate(candidate, baseUrl) {
  const text = String(candidate.text ?? '').toLowerCase();
  const tag = String(candidate.tag ?? '').toLowerCase();
  if (candidate.href) {
    try {
      const href = new URL(candidate.href, baseUrl);
      const base = new URL(baseUrl);
      return href.origin === base.origin || href.protocol === 'file:' ? 'navigation' : 'external';
    } catch {
      return 'external';
    }
  }
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    return 'input_required';
  }
  if (/\b(delete|remove|reset|clear|destroy|publish|deploy|send|submit)\b/.test(text)) {
    return 'destructive';
  }
  if (/\b(save|apply|create|update|start|stop|run|generate)\b/.test(text)) {
    return 'mutating';
  }
  return 'state_revealing';
}

export function normalizeTargetManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, error: { code: 'INVALID_TARGET_MANIFEST', message: 'Target manifest must be a JSON object.', details: {} } };
  }
  if (!manifest.baseUrl) {
    return { ok: false, error: { code: 'TARGET_BASE_URL_REQUIRED', message: 'Target manifest requires baseUrl.', details: {} } };
  }
  const urlError = validateUrl(manifest.baseUrl);
  if (urlError) {
    return { ok: false, error: urlError };
  }
  const baseUrl = new URL(manifest.baseUrl).toString();
  const pages = normalizeManifestPages(manifest.pages ?? manifest.expectedPages ?? [], baseUrl);
  const viewportMatrix = mergeViewportMatrix(
    normalizeViewportMatrix(manifest.viewportMatrix),
    pages.flatMap((page) => page.viewports)
  );
  return {
    ok: true,
    target: {
      baseUrl,
      scope: {
        sameOrigin: manifest.scope?.sameOrigin !== false,
        include: Array.isArray(manifest.scope?.include) ? manifest.scope.include : [],
        exclude: Array.isArray(manifest.scope?.exclude) ? manifest.scope.exclude : []
      },
      seeds: normalizeRouteList(manifest.seeds?.length ? manifest.seeds : [baseUrl], baseUrl),
      expectedRoutes: normalizeRouteList(manifest.expectedRoutes ?? [], baseUrl),
      pages,
      viewportMatrix,
      actionPolicy: {
        allow: Array.isArray(manifest.actionPolicy?.allow) ? manifest.actionPolicy.allow : ['navigation', 'state_revealing']
      },
      budgets: {
        maxRoutes: clampNumber(manifest.budgets?.maxRoutes, 1, 200, DEFAULT_ROUTE_BUDGET)
      },
      artifacts: {
        screenshots: manifest.artifacts?.screenshots !== false
      },
      masks: Array.isArray(manifest.masks) ? manifest.masks : [],
      regions: Array.isArray(manifest.regions) ? manifest.regions : [],
      appHints: manifest.appHints && typeof manifest.appHints === 'object' ? manifest.appHints : {}
    }
  };
}

async function loadTargetManifest(options, context) {
  const value = options.input ?? options.target;
  if (typeof value === 'string' && !value.trim().startsWith('{') && !value.trim().startsWith('[') && value !== '-' && !value.startsWith('@')) {
    return resolveJsonInput(`@${value}`, context, 'target manifest');
  }
  return resolveJsonInput(value, context, 'target manifest');
}

function normalizeViewportMatrix(value) {
  const entries = Array.isArray(value) && value.length > 0 ? value : ['desktop', 'mobile'];
  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return parseViewport(entry);
    }
    if (entry && typeof entry === 'object') {
      return {
        name: entry.name ?? `${entry.width}x${entry.height}`,
        width: Number(entry.width ?? DEFAULT_VIEWPORT.width),
        height: Number(entry.height ?? DEFAULT_VIEWPORT.height),
        isMobile: Boolean(entry.isMobile),
        hasTouch: Boolean(entry.hasTouch)
      };
    }
    return { ...DEFAULT_VIEWPORT };
  });
}

function normalizeOptionalViewportMatrix(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  return value.map((entry) => {
    if (typeof entry === 'string') {
      return parseViewport(entry);
    }
    if (entry && typeof entry === 'object') {
      return {
        name: entry.name ?? `${entry.width}x${entry.height}`,
        width: Number(entry.width ?? DEFAULT_VIEWPORT.width),
        height: Number(entry.height ?? DEFAULT_VIEWPORT.height),
        isMobile: Boolean(entry.isMobile),
        hasTouch: Boolean(entry.hasTouch)
      };
    }
    return null;
  }).filter(Boolean);
}

function mergeViewportMatrix(base, extra) {
  const byKey = new Map();
  for (const viewport of [...base, ...extra]) {
    byKey.set(viewportKey(viewport), viewport);
  }
  return [...byKey.values()];
}

function viewportKey(viewport) {
  return `${viewport.name}:${viewport.width}x${viewport.height}:${Boolean(viewport.isMobile)}:${Boolean(viewport.hasTouch)}`;
}

function viewportMatches(candidate, allowed) {
  return allowed.some((viewport) => (
    viewportKey(viewport) === viewportKey(candidate)
    || viewport.name === candidate.name
    || `${viewport.width}x${viewport.height}` === `${candidate.width}x${candidate.height}`
  ));
}

function viewportsForRoute(route, viewportMatrix) {
  const pageViewports = route.manifest_page?.viewports ?? [];
  if (pageViewports.length === 0) {
    return viewportMatrix;
  }
  const matched = viewportMatrix.filter((viewport) => viewportMatches(viewport, pageViewports));
  return matched.length > 0 ? matched : viewportMatrix;
}

function normalizeManifestPages(value, baseUrl) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry, index) => normalizeManifestPage(entry, index, baseUrl))
    .filter(Boolean);
}

function normalizeManifestPage(entry, index, baseUrl) {
  const raw = typeof entry === 'string' ? { url: entry } : entry;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const routeValue = raw.url ?? raw.route ?? raw.path;
  if (!routeValue) {
    return null;
  }
  let url;
  try {
    url = new URL(routeValue, baseUrl).toString();
  } catch {
    return null;
  }
  const id = String(raw.id ?? raw.name ?? `page-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `page-${index + 1}`;
  const expectations = raw.expectations ?? raw.expect ?? {};
  return {
    id,
    name: raw.name ? String(raw.name) : id,
    url,
    priority: normalizePagePriority(raw.priority),
    viewports: normalizeOptionalViewportMatrix(raw.viewports ?? raw.viewportMatrix ?? (raw.viewport ? [raw.viewport] : [])),
    expectations: {
      text: normalizeExpectationList(expectations.text ?? raw.expectedText ?? []),
      selectors: normalizeExpectationList(expectations.selectors ?? raw.expectedSelectors ?? [])
    },
    mock: typeof raw.mock === 'string' && raw.mock ? raw.mock : null,
    threshold: raw.threshold,
    notes: Array.isArray(raw.notes) ? raw.notes.map((note) => truncateText(note, 300)) : []
  };
}

function normalizePagePriority(value) {
  const normalized = String(value ?? 'medium').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
    return normalized;
  }
  if (normalized === 'p0') {
    return 'critical';
  }
  if (normalized === 'p1') {
    return 'high';
  }
  if (normalized === 'p3' || normalized === 'p4') {
    return 'low';
  }
  return 'medium';
}

function normalizeExpectationList(value) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  return entries
    .map((entry) => {
      if (typeof entry === 'string') {
        return { value: entry, match: 'contains' };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const value = entry.value ?? entry.text ?? entry.selector;
      if (!value) {
        return null;
      }
      return {
        value: String(value),
        match: ['contains', 'exact'].includes(entry.match) ? entry.match : 'contains'
      };
    })
    .filter(Boolean);
}

function normalizeRouteList(routes, baseUrl) {
  return routes
    .map((route) => {
      try {
        const url = new URL(route, baseUrl);
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function enqueueRoute(queue, discovered, url, source, target, metadata = {}) {
  if (!isRouteInScope(url, target)) {
    return false;
  }
  const key = normalizeUrlKey(url);
  if (discovered.has(key)) {
    const existing = discovered.get(key);
    if (metadata.manifestPage && !existing.manifest_page) {
      existing.manifest_page = metadata.manifestPage;
      existing.sources = [...new Set([existing.source, ...(existing.sources ?? []), source])];
      return true;
    }
    return false;
  }
  const route = {
    ...normalizeRoute(url, source),
    ...(metadata.manifestPage ? { manifest_page: metadata.manifestPage } : {})
  };
  discovered.set(key, route);
  queue.push(route);
  return true;
}

function isRouteInScope(value, target) {
  try {
    const url = new URL(value);
    const base = new URL(target.baseUrl);
    if (!SAFE_ROUTE_PROTOCOLS.has(url.protocol)) {
      return false;
    }
    if (target.scope.sameOrigin && url.origin !== base.origin && !(url.protocol === 'file:' && base.protocol === 'file:')) {
      return false;
    }
    const routeText = url.toString();
    if (target.scope.include.length > 0 && !target.scope.include.some((pattern) => routeText.includes(pattern))) {
      return false;
    }
    if (target.scope.exclude.some((pattern) => routeText.includes(pattern))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeRoute(value, source) {
  const url = new URL(value);
  return {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    source
  };
}

function normalizeUrlKey(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return String(value);
  }
}

async function collectLayoutEvidence(page, actionCandidates, baseUrl) {
  const evidence = await page.evaluate(() => {
    const trim = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const cssEscape = (value) => {
      if (window.CSS?.escape) {
        return window.CSS.escape(value);
      }
      return String(value).replace(/["\\]/g, '\\$&');
    };
    const selectorFor = (element) => {
      if (element.id) {
        return `#${cssEscape(element.id)}`;
      }
      const testId = element.getAttribute('data-testid');
      if (testId) {
        return `[data-testid="${cssEscape(testId)}"]`;
      }
      const name = element.getAttribute('name');
      if (name) {
        return `${element.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
      }
      const segments = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
        let segment = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (!parent) {
          segments.unshift(segment);
          break;
        }
        const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) {
          segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        segments.unshift(segment);
        current = parent;
      }
      return segments.join(' > ');
    };
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const accessibleName = (element) => {
      if (element.tagName.toLowerCase() === 'img') {
        return trim(element.getAttribute('alt') || '');
      }
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        return labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText || document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim();
      }
      if (element.getAttribute('aria-label')) {
        return element.getAttribute('aria-label');
      }
      if (element.id) {
        const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
        if (label) {
          return trim(label.innerText || label.textContent || '');
        }
      }
      return trim(element.innerText || element.textContent || element.getAttribute('title') || element.getAttribute('placeholder') || '');
    };
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const duplicateIds = Object.entries(
      [...document.querySelectorAll('[id]')].reduce((accumulator, element) => {
        accumulator[element.id] = (accumulator[element.id] ?? 0) + 1;
        return accumulator;
      }, {})
    ).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
    const elementSelector = 'a, button, input, select, textarea, [role], h1, h2, h3, h4, h5, h6, p, label, main, nav, header, footer, aside, section, article, img, [tabindex], [data-testid]';
    const nodes = [...document.querySelectorAll(elementSelector)]
      .filter(isVisible)
      .slice(0, 180);
    const elements = nodes.map((element) => {
        const style = window.getComputedStyle(element);
        return {
          selector: selectorFor(element),
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute('role') || null,
          text: trim(element.innerText || element.textContent || ''),
          accessible_name: trim(accessibleName(element), 300),
          rect: rectFor(element),
          focusable: element.matches('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
          overflow: {
            clipped_x: element.scrollWidth > element.clientWidth + 1,
            clipped_y: element.scrollHeight > element.clientHeight + 1,
            scroll_width: element.scrollWidth,
            client_width: element.clientWidth,
            scroll_height: element.scrollHeight,
            client_height: element.clientHeight
          },
          computed: {
            color: style.color,
            background_color: style.backgroundColor,
            display: style.display,
            visibility: style.visibility,
            overflow_x: style.overflowX,
            overflow_y: style.overflowY,
            position: style.position,
            z_index: style.zIndex,
            font_size: style.fontSize,
            font_weight: style.fontWeight,
            line_height: style.lineHeight,
            white_space: style.whiteSpace,
            outline_style: style.outlineStyle,
            cursor: style.cursor,
            opacity: style.opacity
          }
        };
      });
    const headings = nodes
      .filter((element) => /^H[1-6]$/.test(element.tagName))
      .map((element) => ({
        level: Number(element.tagName.slice(1)),
        selector: selectorFor(element),
        text: trim(element.innerText || element.textContent || '', 200),
        rect: rectFor(element)
      }));
    const landmarks = [...document.querySelectorAll('main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]')]
      .filter(isVisible)
      .slice(0, 80)
      .map((element) => ({
        selector: selectorFor(element),
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || null,
        rect: rectFor(element)
      }));
    const images = [...document.querySelectorAll('img')]
      .filter(isVisible)
      .slice(0, 80)
      .map((element) => ({
        selector: selectorFor(element),
        src: element.getAttribute('src') || null,
        current_src: element.currentSrc || null,
        alt: trim(element.getAttribute('alt') || '', 300),
        decorative: element.getAttribute('role') === 'presentation' || element.getAttribute('aria-hidden') === 'true',
        complete: element.complete,
        natural_width: element.naturalWidth,
        natural_height: element.naturalHeight,
        loading: element.getAttribute('loading') || null,
        rect: rectFor(element)
      }));
    const loadingIndicatorSelector = [
      '[aria-busy="true"]',
      '[role="progressbar"]',
      '[role="status"]',
      '[data-loading]',
      '[data-testid*="loading" i]',
      '[data-testid*="loader" i]',
      '[data-testid*="spinner" i]',
      '[data-testid*="skeleton" i]',
      '[data-testid*="progress" i]',
      '[class*="loading" i]',
      '[class*="loader" i]',
      '[class*="spinner" i]',
      '[class*="skeleton" i]',
      '[class*="progress" i]',
      '[id*="loading" i]',
      '[id*="loader" i]',
      '[id*="spinner" i]',
      '[id*="skeleton" i]',
      '[id*="progress" i]'
    ].join(', ');
    const loadingAttributePattern = /\b(aria-busy|loading|loader|spinner|skeleton|progress|progressbar|progress-bar|busy|pending)\b/i;
    const loadingTextPattern = /\b(loading|loader|spinner|skeleton|please wait|waiting|fetching|processing|initializing)\b/i;
    const textNodeContent = (element) => trim(
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join(' '),
      160
    );
    const isLoadingIndicator = (element) => {
      const role = element.getAttribute('role') || '';
      const ariaBusy = element.getAttribute('aria-busy') || '';
      const dataLoading = element.getAttribute('data-loading');
      const className = typeof element.className === 'string' ? element.className : element.getAttribute('class') || '';
      const identityDescriptor = [
        element.id,
        className,
        element.getAttribute('data-testid'),
        role,
        ariaBusy,
        dataLoading
      ].join(' ');
      const labelDescriptor = element.getAttribute('aria-label') || '';
      if (ariaBusy === 'true' || role === 'progressbar') return true;
      if (dataLoading !== null && dataLoading !== 'false') return true;
      if (loadingAttributePattern.test(identityDescriptor)) return true;
      if (loadingTextPattern.test(labelDescriptor)) return true;
      const directText = textNodeContent(element);
      const visibleText = trim(element.innerText || element.textContent || '', 160);
      const textCandidate = directText || visibleText;
      if (role === 'status' && loadingTextPattern.test(textCandidate)) return true;
      return element.childElementCount <= 2 && textCandidate.length <= 140 && loadingTextPattern.test(textCandidate);
    };
    const loadingIndicators = [...document.querySelectorAll(loadingIndicatorSelector)]
      .filter(isVisible)
      .filter(isLoadingIndicator)
      .slice(0, 30)
      .map((element) => ({
        selector: selectorFor(element),
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || null,
        aria_busy: element.getAttribute('aria-busy') || null,
        text: trim(element.innerText || element.textContent || '', 160),
        rect: rectFor(element)
      }));
    const emptyStatePattern = /\b(no\s+(items|results|data|records|rows|entries)|empty|nothing\s+to\s+show|not\s+found|create\s+your\s+first)\b/i;
    const dataContainers = [...document.querySelectorAll('table, ul, ol, [role="table"], [role="grid"], [role="list"], [role="listbox"], [data-empty-check]')]
      .filter(isVisible)
      .slice(0, 80)
      .map((element) => {
        const role = element.getAttribute('role') || null;
        const tag = element.tagName.toLowerCase();
        const rows = tag === 'table' || role === 'table' || role === 'grid'
          ? [...element.querySelectorAll('tbody tr, [role="row"]')].filter((row) => row.closest('thead') === null).length
          : 0;
        const items = role === 'list' || role === 'listbox' || tag === 'ul' || tag === 'ol'
          ? [...element.querySelectorAll('li, [role="listitem"], [role="option"]')].filter(isVisible).length
          : 0;
        const text = trim(element.innerText || element.textContent || '', 300);
        return {
          selector: selectorFor(element),
          tag,
          role,
          rect: rectFor(element),
          text,
          row_count: rows,
          item_count: items,
          has_empty_state_text: emptyStatePattern.test(text)
        };
      })
      .filter((element) => {
        const isTableLike = element.tag === 'table' || element.role === 'table' || element.role === 'grid';
        const isListLike = element.role === 'list' || element.role === 'listbox';
        return ((isTableLike && element.row_count === 0) || (isListLike && element.item_count === 0))
          && !element.has_empty_state_text;
      });
    const overlaps = [];
    const overlapNodes = nodes.slice(0, 80);
    for (let leftIndex = 0; leftIndex < overlapNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < overlapNodes.length; rightIndex += 1) {
        const left = overlapNodes[leftIndex];
        const right = overlapNodes[rightIndex];
        if (left.contains(right) || right.contains(left)) {
          continue;
        }
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        const width = Math.max(0, Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left));
        const height = Math.max(0, Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top));
        const area = width * height;
        const leftArea = leftRect.width * leftRect.height;
        const rightArea = rightRect.width * rightRect.height;
        const ratio = area / Math.max(Math.min(leftArea, rightArea), 1);
        if (area > 16 && ratio >= 0.35) {
          overlaps.push({
            left: { selector: selectorFor(left), rect: rectFor(left), text: trim(left.innerText || left.textContent || '', 120) },
            right: { selector: selectorFor(right), rect: rectFor(right), text: trim(right.innerText || right.textContent || '', 120) },
            overlap: {
              width: Math.round(width),
              height: Math.round(height),
              area: Math.round(area),
              ratio: Number(ratio.toFixed(3))
            }
          });
        }
      }
    }
    return {
      page: {
        url: window.location.href,
        title: document.title,
        visible_text_length: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().length,
        horizontal_overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) > window.innerWidth + 1,
        scroll_width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
        scroll_height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      duplicate_ids: duplicateIds,
      headings,
      landmarks,
      images,
      loading_indicators: loadingIndicators,
      empty_containers: dataContainers,
      overlaps: overlaps.slice(0, 40),
      elements,
      anchors: [...document.querySelectorAll('a[href]')].slice(0, 120).map((anchor) => ({
        url: anchor.href,
        text: trim(anchor.innerText || anchor.textContent || '', 300),
        selector: selectorFor(anchor)
      }))
    };
  });

  const actions = (actionCandidates ?? []).map((candidate, index) => ({
    id: `candidate-${index + 1}`,
    ...candidate,
    risk: classifyActionCandidate(candidate, baseUrl),
    confidence: candidate.selector ? 'high' : 'medium',
    preconditions: []
  }));
  return redact({
    ...evidence,
    actions,
    routes: discoverRoutes(evidence, actions, baseUrl)
  });
}

function discoverRoutes(layout, actions, baseUrl) {
  const byUrl = new Map();
  for (const anchor of layout.anchors ?? []) {
    addDiscoveredRoute(byUrl, anchor.url, 'anchor', anchor);
  }
  for (const action of actions) {
    if (action.risk === 'navigation' && action.href) {
      addDiscoveredRoute(byUrl, action.href, 'action_candidate', action);
    }
  }
  return [...byUrl.values()].filter((route) => {
    try {
      const url = new URL(route.url);
      const base = new URL(baseUrl);
      return url.origin === base.origin || (url.protocol === 'file:' && base.protocol === 'file:');
    } catch {
      return false;
    }
  });
}

function addDiscoveredRoute(byUrl, value, source, evidence) {
  try {
    const url = new URL(value);
    const key = normalizeUrlKey(url.toString());
    if (!byUrl.has(key)) {
      byUrl.set(key, {
        url: url.toString(),
        source,
        text: truncateText(evidence.text ?? '', 300),
        selector: evidence.selector ?? null
      });
    }
  } catch {
    // Ignore malformed page-provided route data.
  }
}

function createFindings({ id, url, viewport, observation, layout, screenshotArtifact }) {
  const findings = [];
  const add = (finding) => findings.push(withFindingId(id, finding, findings.length + 1));
  const route = redactUrl(url);

  for (const [index, message] of observation.console.messages.entries()) {
    if (message.type === 'error') {
      add({
        category: 'browser_health',
        severity: 'high',
        confidence: 'high',
        source: 'deterministic',
        selector: null,
        rect: null,
        route,
        viewport,
        message: `Console error observed: ${truncateText(message.text, 200)}`,
        evidence: { console_index: index, console: message },
        artifacts: [],
        repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, 'Inspect console messages.'],
        owner_decision_required: false
      });
    }
  }

  for (const [index, request] of observation.network.failed_requests.entries()) {
    add({
      category: 'browser_health',
      severity: 'high',
      confidence: 'high',
      source: 'deterministic',
      selector: null,
      rect: null,
      route,
      viewport,
      message: `Failed network request: ${truncateText(request.url, 200)}`,
      evidence: { failed_request_index: index, request },
      artifacts: [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, 'Inspect failed network requests.'],
      owner_decision_required: false
    });
  }

  if (observation.response && observation.response.status >= 400) {
    add({
      category: 'browser_health',
      severity: 'critical',
      confidence: 'high',
      source: 'deterministic',
      selector: null,
      rect: null,
      route,
      viewport,
      message: `Page response returned HTTP ${observation.response.status}.`,
      evidence: { response: observation.response },
      artifacts: [],
      repro: [`Open ${route}.`],
      owner_decision_required: false
    });
  }

  if (layout.page.visible_text_length === 0 && layout.elements.length === 0) {
    add({
      category: 'layout_integrity',
      severity: 'high',
      confidence: 'high',
      source: 'deterministic',
      selector: 'body',
      rect: null,
      route,
      viewport,
      message: 'The page rendered without visible text or visible reviewable elements.',
      evidence: { visible_text_length: layout.page.visible_text_length, element_count: layout.elements.length },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`],
      owner_decision_required: false
    });
  }

  if (layout.page.horizontal_overflow) {
    add({
      category: 'layout_integrity',
      severity: 'medium',
      confidence: 'high',
      source: 'deterministic',
      selector: 'document',
      rect: null,
      route,
      viewport,
      message: 'The page creates horizontal overflow at the reviewed viewport.',
      evidence: { scroll_width: layout.page.scroll_width, viewport_width: layout.page.viewport.width },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, 'Check document horizontal scrolling.'],
      owner_decision_required: false
    });
  }

  for (const element of layout.elements) {
    const clipped = element.overflow.clipped_x || element.overflow.clipped_y;
    if (clipped && element.text) {
      add({
        category: 'layout_integrity',
        severity: 'medium',
        confidence: 'medium',
        source: 'heuristic',
        selector: element.selector,
        rect: element.rect,
        route,
        viewport,
        message: `Visible text may be clipped in ${element.selector}.`,
        evidence: { overflow: element.overflow, text: truncateText(element.text, 160) },
        artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
        repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect ${element.selector}.`],
        owner_decision_required: true
      });
    }

    const needsName = ['button', 'input', 'select', 'textarea'].includes(element.tag) || ['button', 'link'].includes(element.role);
    if (needsName && !element.accessible_name && !element.text) {
      add({
        category: 'accessibility_basics',
        severity: 'medium',
        confidence: 'high',
        source: 'deterministic',
        selector: element.selector,
        rect: element.rect,
        route,
        viewport,
        message: `Interactive element ${element.selector} has no accessible name.`,
        evidence: { tag: element.tag, role: element.role },
        artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
        repro: [`Open ${route}.`, `Inspect accessible name for ${element.selector}.`],
        owner_decision_required: false
      });
    }

    if (element.focusable && (element.rect.width < 24 || element.rect.height < 24)) {
      add({
        category: 'interaction_quality',
        severity: 'low',
        confidence: 'medium',
        source: 'heuristic',
        selector: element.selector,
        rect: element.rect,
        route,
        viewport,
        message: `Focusable target ${element.selector} is smaller than 24px in at least one dimension.`,
        evidence: { rect: element.rect },
        artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
        repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect target size for ${element.selector}.`],
        owner_decision_required: true
      });
    }

    if (
      viewport.width <= 480
      && element.focusable
      && !element.disabled
      && (element.rect.width < 44 || element.rect.height < 44)
      && element.rect.width >= 24
      && element.rect.height >= 24
    ) {
      add({
        category: 'interaction_quality',
        severity: 'low',
        confidence: 'medium',
        source: 'heuristic',
        selector: element.selector,
        rect: element.rect,
        route,
        viewport,
        message: `Focusable target ${element.selector} is smaller than the 44px mobile touch-target guideline.`,
        evidence: { rect: element.rect, guideline: { min_width: 44, min_height: 44 } },
        artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
        repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect mobile hit area for ${element.selector}.`],
        owner_decision_required: true
      });
    }

    const contrast = contrastForElement(element);
    if (contrast && contrast.ratio < contrast.threshold && element.text) {
      add({
        category: 'accessibility_basics',
        severity: 'medium',
        confidence: 'medium',
        source: 'heuristic',
        selector: element.selector,
        rect: element.rect,
        route,
        viewport,
        message: `Text contrast may be too low in ${element.selector}.`,
        evidence: contrast,
        artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
        repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect foreground and background colors for ${element.selector}.`],
        owner_decision_required: true
      });
    }
  }

  for (const duplicate of layout.duplicate_ids) {
    add({
      category: 'accessibility_basics',
      severity: 'medium',
      confidence: 'high',
      source: 'deterministic',
      selector: `#${duplicate.id}`,
      rect: null,
      route,
      viewport,
      message: `Duplicate id "${duplicate.id}" appears ${duplicate.count} times.`,
      evidence: duplicate,
      artifacts: [],
      repro: [`Open ${route}.`, `Search DOM for id="${duplicate.id}".`],
      owner_decision_required: false
    });
  }

  const headings = layout.headings ?? [];
  const h1Count = headings.filter((heading) => heading.level === 1).length;
  if (layout.page.visible_text_length > 0 && h1Count === 0) {
    add({
      category: 'accessibility_basics',
      severity: 'low',
      confidence: 'medium',
      source: 'heuristic',
      selector: null,
      rect: null,
      route,
      viewport,
      message: 'No visible h1 heading was found for this route.',
      evidence: { heading_count: headings.length, h1_count: h1Count },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route}.`, 'Inspect the page heading hierarchy.'],
      owner_decision_required: true
    });
  }
  if (h1Count > 1) {
    add({
      category: 'accessibility_basics',
      severity: 'low',
      confidence: 'medium',
      source: 'heuristic',
      selector: headings.find((heading) => heading.level === 1)?.selector ?? null,
      rect: null,
      route,
      viewport,
      message: 'Multiple visible h1 headings were found for this route.',
      evidence: { h1_count: h1Count, headings: headings.filter((heading) => heading.level === 1).slice(0, 5) },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route}.`, 'Confirm whether the visual hierarchy should have one primary page heading.'],
      owner_decision_required: true
    });
  }
  for (const skip of headingOrderSkips(headings).slice(0, 5)) {
    add({
      category: 'accessibility_basics',
      severity: 'low',
      confidence: 'medium',
      source: 'heuristic',
      selector: skip.current.selector,
      rect: skip.current.rect,
      route,
      viewport,
      message: `Heading order skips from h${skip.previous.level} to h${skip.current.level}.`,
      evidence: skip,
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route}.`, `Inspect heading ${skip.current.selector}.`],
      owner_decision_required: true
    });
  }

  const hasMainLandmark = (layout.landmarks ?? []).some((landmark) => landmark.tag === 'main' || landmark.role === 'main');
  if (layout.page.visible_text_length > 80 && !hasMainLandmark) {
    add({
      category: 'accessibility_basics',
      severity: 'low',
      confidence: 'medium',
      source: 'heuristic',
      selector: null,
      rect: null,
      route,
      viewport,
      message: 'No visible main landmark was found for this route.',
      evidence: { landmarks: layout.landmarks ?? [] },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route}.`, 'Inspect document landmarks and main content semantics.'],
      owner_decision_required: true
    });
  }

  for (const image of (layout.images ?? []).filter((candidate) => !candidate.decorative && !candidate.alt).slice(0, 10)) {
    add({
      category: 'accessibility_basics',
      severity: 'medium',
      confidence: 'high',
      source: 'deterministic',
      selector: image.selector,
      rect: image.rect,
      route,
      viewport,
      message: `Image ${image.selector} has no alt text or decorative marker.`,
      evidence: image,
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route}.`, `Inspect image semantics for ${image.selector}.`],
      owner_decision_required: false
    });
  }

  for (const image of brokenImages(layout).slice(0, 10)) {
    add({
      category: 'browser_health',
      severity: 'medium',
      confidence: 'high',
      source: 'deterministic',
      selector: image.selector,
      rect: image.rect,
      route,
      viewport,
      message: `Image ${image.selector} appears broken or unfinished after page load.`,
      evidence: {
        selector: image.selector,
        src: image.current_src || image.src,
        complete: image.complete,
        natural_width: image.natural_width,
        natural_height: image.natural_height
      },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect image load state for ${image.selector}.`],
      owner_decision_required: false
    });
  }

  for (const indicator of (layout.loading_indicators ?? []).slice(0, 8)) {
    add({
      category: 'layout_integrity',
      severity: 'medium',
      confidence: 'medium',
      source: 'heuristic',
      selector: indicator.selector,
      rect: indicator.rect,
      route,
      viewport,
      message: `Visible loading indicator ${indicator.selector} remained after the review wait.`,
      evidence: indicator,
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect whether ${indicator.selector} is intentionally still loading.`],
      owner_decision_required: true
    });
  }

  for (const container of (layout.empty_containers ?? []).slice(0, 8)) {
    add({
      category: 'layout_integrity',
      severity: 'low',
      confidence: 'medium',
      source: 'heuristic',
      selector: container.selector,
      rect: container.rect,
      route,
      viewport,
      message: `Data container ${container.selector} appears empty without a visible empty-state message.`,
      evidence: container,
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect empty-state rendering for ${container.selector}.`],
      owner_decision_required: true
    });
  }

  for (const overlap of (layout.overlaps ?? []).slice(0, 10)) {
    add({
      category: 'layout_integrity',
      severity: 'medium',
      confidence: 'medium',
      source: 'heuristic',
      selector: overlap.left.selector,
      rect: overlap.left.rect,
      route,
      viewport,
      message: `Visible elements may overlap: ${overlap.left.selector} and ${overlap.right.selector}.`,
      evidence: overlap,
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${route} at ${viewport.width}x${viewport.height}.`, `Inspect ${overlap.left.selector} and ${overlap.right.selector}.`],
      owner_decision_required: true
    });
  }

  if (!screenshotArtifact) {
    add({
      category: 'evidence_quality',
      severity: 'info',
      confidence: 'high',
      source: 'deterministic',
      selector: null,
      rect: null,
      route,
      viewport,
      message: 'No screenshot artifact was requested for this review.',
      evidence: { screenshot_requested: false },
      artifacts: [],
      repro: ['Run review with --screenshot when visual evidence is needed.'],
      owner_decision_required: false
    });
  }

  return findings;
}

function headingOrderSkips(headings) {
  const skips = [];
  let previous = null;
  for (const current of headings) {
    if (previous && current.level > previous.level + 1) {
      skips.push({ previous, current });
    }
    previous = current;
  }
  return skips;
}

function contrastForElement(element) {
  if (!element.text || !element.computed?.color || !element.computed?.background_color) {
    return null;
  }
  const foreground = parseCssColor(element.computed.color);
  const background = parseCssColor(element.computed.background_color);
  if (!foreground || !background || background.alpha < 1) {
    return null;
  }
  const fontSize = parseCssPx(element.computed.font_size);
  const fontWeight = Number.parseInt(element.computed.font_weight, 10);
  const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
  const ratio = contrastRatio(foreground, background);
  return {
    ratio: Number(ratio.toFixed(2)),
    threshold: largeText ? 3 : 4.5,
    large_text: largeText,
    foreground: element.computed.color,
    background: element.computed.background_color,
    font_size: element.computed.font_size,
    font_weight: element.computed.font_weight
  };
}

function parseCssPx(value) {
  const match = /^([0-9.]+)px$/.exec(String(value ?? ''));
  return match ? Number(match[1]) : 0;
}

function parseCssColor(value) {
  const match = /^rgba?\(([^)]+)\)$/.exec(String(value ?? '').trim());
  if (!match) {
    return null;
  }
  const parts = match[1].split(',').map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) {
    return null;
  }
  return {
    red: parts[0],
    green: parts[1],
    blue: parts[2],
    alpha: Number.isFinite(parts[3]) ? parts[3] : 1
  };
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
}

function brokenImages(layout) {
  return (layout.images ?? []).filter((image) => (
    !image.decorative
    && (image.src || image.current_src)
    && (image.complete === false || image.natural_width === 0 || image.natural_height === 0)
  ));
}

function buildEvidenceSummary({ observation, layout, screenshotArtifact }) {
  return redact({
    url: observation.final_url,
    title: observation.title,
    visible_text: truncateText(observation.page?.visible_text ?? '', 4000),
    visible_text_length: layout.page.visible_text_length,
    selectors: [...new Set((layout.elements ?? []).map((element) => element.selector).filter(Boolean))].slice(0, 240),
    headings: layout.headings ?? [],
    landmarks: layout.landmarks ?? [],
    images: layout.images ?? [],
    loading_indicators: layout.loading_indicators ?? [],
    empty_containers: layout.empty_containers ?? [],
    actions: (layout.actions ?? []).map((action) => ({
      id: action.id,
      selector: action.selector,
      risk: action.risk,
      confidence: action.confidence,
      text: truncateText(action.text ?? '', 160)
    })),
    console_error_count: (observation.console?.messages ?? []).filter((message) => message.type === 'error').length,
    failed_request_count: observation.network?.failed_requests?.length ?? 0,
    screenshot_captured: Boolean(screenshotArtifact)
  });
}

function evaluateManifestPage({
  reviewId,
  page,
  route,
  viewport,
  evidenceSummary,
  mockMetrics,
  screenshotArtifact,
  findingOffset
}) {
  const missingText = page.expectations.text.filter((expectation) => !textExpectationMatched(evidenceSummary.visible_text, expectation));
  const selectorSet = new Set(evidenceSummary.selectors ?? []);
  const missingSelectors = page.expectations.selectors.filter((expectation) => !selectorExpectationMatched(selectorSet, expectation));
  const status = missingText.length > 0 || missingSelectors.length > 0 ? 'needs_attention' : 'passed';
  const check = redact({
    page: coveragePage(page),
    route: normalizeRoute(route.url, route.source),
    viewport,
    status,
    expectations: {
      expected_text_count: page.expectations.text.length,
      missing_text: missingText,
      expected_selector_count: page.expectations.selectors.length,
      missing_selectors: missingSelectors
    },
    mock_status: mockMetrics?.status ?? (page.mock ? 'not_evaluated' : 'not_provided'),
    evidence: {
      title: evidenceSummary.title,
      visible_text_length: evidenceSummary.visible_text_length,
      selector_count: evidenceSummary.selectors?.length ?? 0,
      screenshot_captured: evidenceSummary.screenshot_captured
    }
  });
  const findings = [];
  const severity = severityForPagePriority(page.priority);
  for (const expectation of missingText) {
    findings.push(withFindingId(reviewId, {
      category: 'layout_integrity',
      severity,
      confidence: 'high',
      source: 'deterministic',
      selector: null,
      rect: null,
      route: redactUrl(route.url),
      viewport,
      message: `Expected text was not visible for manifest page "${page.name}".`,
      evidence: { page: coveragePage(page), expectation, evidence_title: evidenceSummary.title },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${redactUrl(route.url)} at ${viewport.width}x${viewport.height}.`, `Verify expected page text "${expectation.value}".`],
      owner_decision_required: false
    }, findingOffset + findings.length + 1));
  }
  for (const expectation of missingSelectors) {
    findings.push(withFindingId(reviewId, {
      category: 'layout_integrity',
      severity,
      confidence: 'high',
      source: 'deterministic',
      selector: expectation.value,
      rect: null,
      route: redactUrl(route.url),
      viewport,
      message: `Expected selector ${expectation.value} was not visible for manifest page "${page.name}".`,
      evidence: { page: coveragePage(page), expectation, selector_count: evidenceSummary.selectors?.length ?? 0 },
      artifacts: screenshotArtifact ? [screenshotArtifact.path] : [],
      repro: [`Open ${redactUrl(route.url)} at ${viewport.width}x${viewport.height}.`, `Inspect expected selector ${expectation.value}.`],
      owner_decision_required: false
    }, findingOffset + findings.length + 1));
  }
  return { check, findings };
}

function textExpectationMatched(text, expectation) {
  const haystack = String(text ?? '');
  if (expectation.match === 'exact') {
    return haystack.trim() === expectation.value.trim();
  }
  return haystack.includes(expectation.value);
}

function selectorExpectationMatched(selectors, expectation) {
  if (expectation.match === 'exact') {
    return selectors.has(expectation.value);
  }
  return [...selectors].some((selector) => selector === expectation.value || selector.includes(expectation.value));
}

function severityForPagePriority(priority) {
  return {
    critical: 'high',
    high: 'high',
    medium: 'medium',
    low: 'low'
  }[priority] ?? 'medium';
}

function coveragePage(page) {
  return redact({
    id: page.id,
    name: page.name,
    url: page.url,
    priority: page.priority,
    viewports: page.viewports.map((viewport) => viewport.name),
    expectations: {
      text_count: page.expectations.text.length,
      selector_count: page.expectations.selectors.length
    },
    mock: page.mock ? { provided: true, threshold: page.threshold ?? null } : { provided: false }
  });
}

function skippedPageCheck(page, route, reason) {
  return redact({
    page: coveragePage(page),
    route: normalizeRoute(route.url, route.source),
    viewport: null,
    status: 'skipped',
    reason,
    expectations: {
      expected_text_count: page.expectations.text.length,
      missing_text: page.expectations.text,
      expected_selector_count: page.expectations.selectors.length,
      missing_selectors: page.expectations.selectors
    },
    mock_status: page.mock ? 'not_evaluated' : 'not_provided',
    evidence: {
      title: null,
      visible_text_length: 0,
      selector_count: 0,
      screenshot_captured: false
    }
  });
}

function buildQualitySignals({ findings, layout, viewport, screenshotArtifact, mockMetrics }) {
  const h1Count = (layout.headings ?? []).filter((heading) => heading.level === 1).length;
  const headingSkips = headingOrderSkips(layout.headings ?? []);
  const clippedElements = (layout.elements ?? []).filter((element) => element.text && (element.overflow.clipped_x || element.overflow.clipped_y));
  const focusableElements = (layout.elements ?? []).filter((element) => element.focusable && !element.disabled);
  const smallTargets = focusableElements.filter((element) => element.rect.width < 24 || element.rect.height < 24);
  const mobileTargets = viewport.width <= 480
    ? focusableElements.filter((element) => element.rect.width < 44 || element.rect.height < 44)
    : [];
  const missingNames = (layout.elements ?? []).filter((element) => {
    const needsName = ['button', 'input', 'select', 'textarea'].includes(element.tag) || ['button', 'link'].includes(element.role);
    return needsName && !element.accessible_name && !element.text;
  });
  const missingImageAlt = (layout.images ?? []).filter((image) => !image.decorative && !image.alt);
  const imageLoadFailures = brokenImages(layout);
  const loadingIndicators = layout.loading_indicators ?? [];
  const emptyContainers = layout.empty_containers ?? [];
  const contrastFindings = findings.filter((finding) => /contrast/i.test(finding.message ?? ''));
  const actionable = actionableFindings(findings);
  const gate = releaseGateForFindings(actionable);
  return {
    reviewer: 'local_quality_signals',
    status: gate.status === 'pass' ? 'passed' : 'needs_attention',
    visual_hierarchy: {
      status: h1Count === 1 && headingSkips.length === 0 ? 'passed' : 'needs_attention',
      h1_count: h1Count,
      heading_count: (layout.headings ?? []).length,
      heading_order_skip_count: headingSkips.length,
      signals: [
        ...(h1Count === 0 ? ['missing_primary_heading'] : []),
        ...(h1Count > 1 ? ['multiple_primary_headings'] : []),
        ...(headingSkips.length > 0 ? ['heading_order_skip'] : [])
      ]
    },
    responsive_layout: {
      status: layout.page.horizontal_overflow || clippedElements.length > 0 || (layout.overlaps ?? []).length > 0 || emptyContainers.length > 0 ? 'needs_attention' : 'passed',
      horizontal_overflow: Boolean(layout.page.horizontal_overflow),
      clipped_element_count: clippedElements.length,
      overlap_pair_count: (layout.overlaps ?? []).length,
      empty_container_warning_count: emptyContainers.length,
      mobile_touch_target_warning_count: mobileTargets.length
    },
    rendered_state: {
      status: imageLoadFailures.length > 0 || loadingIndicators.length > 0 || emptyContainers.length > 0 ? 'needs_attention' : 'passed',
      visible_text_length: layout.page.visible_text_length,
      broken_image_count: imageLoadFailures.length,
      loading_indicator_count: loadingIndicators.length,
      empty_container_warning_count: emptyContainers.length,
      signals: [
        ...(imageLoadFailures.length > 0 ? ['broken_or_unfinished_images'] : []),
        ...(loadingIndicators.length > 0 ? ['visible_loading_indicators_after_wait'] : []),
        ...(emptyContainers.length > 0 ? ['empty_data_containers_without_empty_state'] : [])
      ]
    },
    interaction_affordance: {
      status: smallTargets.length > 0 || mobileTargets.length > 0 ? 'needs_attention' : 'passed',
      action_candidate_count: (layout.actions ?? []).length,
      action_risk_counts: countBy(layout.actions ?? [], 'risk'),
      small_focus_target_count: smallTargets.length,
      mobile_touch_target_warning_count: mobileTargets.length
    },
    accessibility_structure: {
      status: missingNames.length > 0 || missingImageAlt.length > 0 || contrastFindings.length > 0 || (layout.duplicate_ids ?? []).length > 0 ? 'needs_attention' : 'passed',
      missing_accessible_name_count: missingNames.length,
      duplicate_id_count: (layout.duplicate_ids ?? []).length,
      missing_image_alt_count: missingImageAlt.length,
      image_load_failure_count: imageLoadFailures.length,
      low_contrast_text_count: contrastFindings.length,
      main_landmark_count: (layout.landmarks ?? []).filter((landmark) => landmark.tag === 'main' || landmark.role === 'main').length
    },
    evidence_completeness: {
      status: screenshotArtifact ? 'visual_evidence_captured' : 'limited_without_screenshot',
      screenshot_captured: Boolean(screenshotArtifact),
      mock_status: mockMetrics?.status ?? 'not_provided',
      local_artifacts_only: true
    },
    developer_handoff: developerHandoff(findings),
    release_readiness: localReleaseReadiness(findings),
    model_review_boundary: modelReviewBoundary()
  };
}

function buildTargetQualitySignals({ findings, coverage }) {
  const expectedVisits = coverage.routes.discovered.length * Math.max(coverage.viewports.length, 1);
  const actionable = actionableFindings(findings);
  const gate = releaseGateForFindings(actionable);
  const routeBudgetExceeded = coverage.routes.skipped.some((route) => route.reason === 'route_budget_exceeded');
  const pageFailures = coverage.pages?.failed?.length ?? 0;
  const pageSkips = coverage.pages?.skipped?.length ?? 0;
  const renderedState = renderedStateFindingCounts(findings);
  return {
    reviewer: 'local_quality_signals',
    status: gate.status === 'pass' && coverage.routes.failed.length === 0 && coverage.routes.expected_missing.length === 0 && !routeBudgetExceeded && pageFailures === 0 && pageSkips === 0
      ? 'passed'
      : 'needs_attention',
    route_coverage: {
      status: coverage.routes.failed.length === 0 && coverage.routes.expected_missing.length === 0 && !routeBudgetExceeded ? 'passed' : 'needs_attention',
      expected_manifest_routes: coverage.routes.expected?.length ?? 0,
      discovered_routes: coverage.routes.discovered.length,
      visited_route_viewports: coverage.routes.visited.length,
      expected_route_viewports: expectedVisits,
      failed_route_viewports: coverage.routes.failed.length,
      expected_missing_routes: coverage.routes.expected_missing.length,
      skipped_routes: coverage.routes.skipped.length,
      route_budget_exceeded_routes: coverage.routes.skipped.filter((route) => route.reason === 'route_budget_exceeded').length
    },
    page_expectations: {
      status: pageFailures === 0 && pageSkips === 0 ? 'passed' : 'needs_attention',
      expected_pages: coverage.pages?.expected?.length ?? 0,
      checked_pages: coverage.pages?.checked?.filter((check) => check.status !== 'skipped').length ?? 0,
      failed_pages: pageFailures,
      skipped_pages: pageSkips,
      missing_text_expectations: (coverage.pages?.failed ?? []).reduce((count, check) => count + (check.expectations?.missing_text?.length ?? 0), 0),
      missing_selector_expectations: (coverage.pages?.failed ?? []).reduce((count, check) => count + (check.expectations?.missing_selectors?.length ?? 0), 0)
    },
    viewport_coverage: {
      status: coverage.viewports.length > 0 ? 'passed' : 'needs_attention',
      viewports: coverage.viewports.map((viewport) => viewport.name),
      viewport_count: coverage.viewports.length
    },
    rendered_state: {
      status: renderedState.total > 0 ? 'needs_attention' : 'passed',
      broken_image_findings: renderedState.broken_images,
      loading_indicator_findings: renderedState.loading_indicators,
      empty_container_findings: renderedState.empty_containers,
      total_findings: renderedState.total
    },
    finding_summary: {
      status: actionable.length > 0 ? 'needs_attention' : 'passed',
      by_category: reviewMetrics(findings).by_category,
      by_severity: reviewMetrics(findings).by_severity
    },
    evidence_completeness: {
      status: 'target_coverage_artifact_captured',
      coverage_captured: true,
      local_artifacts_only: true
    },
    developer_handoff: developerHandoff(findings),
    release_readiness: {
      ...localReleaseReadiness(findings),
      route_blockers: coverage.routes.failed.length + coverage.routes.expected_missing.length,
      page_expectation_blockers: pageFailures + pageSkips
    },
    model_review_boundary: modelReviewBoundary()
  };
}

function developerHandoff(findings) {
  return {
    implementation_focus: summarizeImplementationFocus(findings),
    fix_queue: actionableFindings(findings).sort(compareFindingPriority).slice(0, 8).map((finding) => ({
      priority: finding.priority,
      severity: finding.severity,
      category: finding.category,
      route: finding.route,
      selector: finding.selector,
      recommendation: finding.recommendation,
      implementation_notes: finding.implementation_notes
    })),
    rerun_guidance: [
      'Rerun the same review command after fixes.',
      'Keep the same target manifest and viewport matrix when verifying regression fixes.',
      'Use --report and --screenshot when handing visual evidence to developers.'
    ]
  };
}

function localReleaseReadiness(findings) {
  const actionable = actionableFindings(findings);
  const gate = releaseGateForFindings(actionable);
  const bySeverity = reviewMetrics(actionable).by_severity;
  return {
    local_gate: gate.status,
    reason: gate.reason,
    blocker_counts: {
      critical: bySeverity.critical ?? 0,
      high: bySeverity.high ?? 0,
      medium: bySeverity.medium ?? 0
    },
    owner_review_required: actionable.some((finding) => finding.owner_decision_required),
    publication_scope: 'not_evaluated',
    approval_boundaries: [
      'package name',
      'license',
      'npm publication',
      'plugin marketplace registration',
      'external evidence transfer'
    ]
  };
}

function modelReviewBoundary() {
  return {
    status: 'not_enabled',
    external_evidence_transfer: false,
    approval_required: true,
    evidence_classes: ['screenshots', 'DOM', 'console logs', 'network data', 'trace archives', 'reports'],
    local_alternative: 'deterministic and heuristic quality signals'
  };
}

function actionableFindings(findings) {
  return findings.filter((finding) => finding.category !== 'evidence_quality' || finding.severity !== 'info');
}

function countBy(items, field) {
  const counts = {};
  for (const item of items) {
    const key = item[field] ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function renderedStateFindingCounts(findings) {
  const counts = {
    broken_images: 0,
    loading_indicators: 0,
    empty_containers: 0
  };
  for (const finding of findings) {
    const message = String(finding.message ?? '').toLowerCase();
    if (message.includes('appears broken or unfinished')) {
      counts.broken_images += 1;
    }
    if (message.includes('loading indicator')) {
      counts.loading_indicators += 1;
    }
    if (message.includes('empty without a visible empty-state')) {
      counts.empty_containers += 1;
    }
  }
  return {
    ...counts,
    total: counts.broken_images + counts.loading_indicators + counts.empty_containers
  };
}

function withFindingId(reviewId, finding, index) {
  const enriched = enrichFinding(finding);
  return {
    id: `${reviewId}-finding-${String(index).padStart(3, '0')}`,
    owner_decision_required: false,
    ...enriched
  };
}

function enrichFinding(finding) {
  const guidance = guidanceForFinding(finding);
  return {
    ...finding,
    priority: finding.priority ?? priorityForSeverity(finding.severity),
    impact: finding.impact ?? guidance.impact,
    recommendation: finding.recommendation ?? guidance.recommendation,
    fix_candidates: finding.fix_candidates ?? guidance.fix_candidates,
    implementation_notes: finding.implementation_notes ?? guidance.implementation_notes
  };
}

function priorityForSeverity(severity) {
  return {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3',
    info: 'P4'
  }[severity] ?? 'P4';
}

function buildActionPlan(findings, { coverage = null } = {}) {
  const actionable = [...findings]
    .filter((finding) => finding.category !== 'evidence_quality' || finding.severity !== 'info')
    .sort(compareFindingPriority);
  const highest = actionable[0]?.severity ?? 'info';
  const gate = releaseGateForFindings(actionable);
  return {
    status: gate.status,
    release_gate: gate,
    highest_severity: highest,
    total_actionable_findings: actionable.length,
    next_actions: actionable.slice(0, 10).map((finding) => ({
      priority: finding.priority,
      severity: finding.severity,
      category: finding.category,
      route: finding.route,
      selector: finding.selector,
      message: finding.message,
      recommendation: finding.recommendation,
      fix_candidates: finding.fix_candidates,
      repro: finding.repro
    })),
    coverage: coverage ? {
      discovered_routes: coverage.routes.discovered.length,
      visited_routes: coverage.routes.visited.length,
      failed_routes: coverage.routes.failed.length,
      expected_missing_routes: coverage.routes.expected_missing.length,
      expected_pages: coverage.pages?.expected?.length ?? 0,
      failed_page_expectations: coverage.pages?.failed?.length ?? 0,
      viewports: coverage.viewports.map((viewport) => viewport.name)
    } : null
  };
}

function buildReviewAdvisory({ findings, layout, screenshotArtifact, mockMetrics, qualitySignals }) {
  const categories = new Set(findings.map((finding) => finding.category));
  const signals = [];
  if (categories.has('browser_health')) {
    signals.push('Runtime errors or failed requests should be resolved before judging visual quality.');
  }
  if (categories.has('layout_integrity')) {
    signals.push('Layout evidence indicates visible overflow, clipping, or empty-render risk.');
  }
  if (categories.has('accessibility_basics')) {
    signals.push('Basic accessibility issues are likely to affect both usability and automated navigation.');
  }
  if (categories.has('interaction_quality')) {
    signals.push('Interactive target evidence suggests some controls may be hard to use reliably.');
  }
  if (mockMetrics?.status === 'different') {
    signals.push('The screenshot and mock metrics differ beyond the configured local threshold.');
  }
  if (!screenshotArtifact) {
    signals.push('Visual judgment is limited because no screenshot artifact was captured.');
  }
  if (layout?.page?.visible_text_length < 20) {
    signals.push('The page has very little visible text, so empty-state or loading-state intent should be checked.');
  }
  if (qualitySignals?.visual_hierarchy?.status === 'needs_attention') {
    signals.push('Visual hierarchy signals indicate heading structure should be reviewed.');
  }
  if (qualitySignals?.responsive_layout?.overlap_pair_count > 0) {
    signals.push('Responsive layout signals indicate visible overlap risk.');
  }
  if (qualitySignals?.rendered_state?.broken_image_count > 0) {
    signals.push('Rendered-state signals indicate visible images failed to load.');
  }
  if (qualitySignals?.rendered_state?.loading_indicator_count > 0) {
    signals.push('Rendered-state signals indicate visible loading UI remained after the review wait.');
  }
  if (qualitySignals?.rendered_state?.empty_container_warning_count > 0) {
    signals.push('Rendered-state signals indicate empty data containers may need explicit empty states.');
  }
  if (qualitySignals?.accessibility_structure?.missing_image_alt_count > 0) {
    signals.push('Accessibility structure signals indicate image semantics need attention.');
  }
  return {
    reviewer: 'local_heuristic',
    status: signals.length > 0 ? 'needs_attention' : 'no_local_visual_blockers',
    confidence: 'medium',
    human_like_scope: 'layout, interaction, accessibility, browser health, and mock-metric signals only',
    visual_assessment: signals,
    implementation_focus: summarizeImplementationFocus(findings),
    limitations: [
      'This is not a model or human aesthetic judgment.',
      'Screenshots, DOM, console, and network evidence remain local.',
      'Subjective design approval still requires an approved human or model review layer.'
    ]
  };
}

function buildTargetReviewAdvisory({ findings, coverage, qualitySignals }) {
  const routeFailures = coverage.routes.failed.length;
  const expectedMissing = coverage.routes.expected_missing.length;
  const signals = [];
  if (routeFailures > 0) {
    signals.push(`${routeFailures} route viewport review attempts failed.`);
  }
  if (expectedMissing > 0) {
    signals.push(`${expectedMissing} expected routes were not discovered.`);
  }
  const routeBudgetExceeded = coverage.routes.skipped.filter((route) => route.reason === 'route_budget_exceeded').length;
  if (routeBudgetExceeded > 0) {
    signals.push(`${routeBudgetExceeded} discovered routes were skipped because the route budget was exhausted.`);
  }
  const pageFailures = coverage.pages?.failed?.length ?? 0;
  if (pageFailures > 0) {
    signals.push(`${pageFailures} manifest pages did not satisfy their expected UI state.`);
  }
  const pageSkips = coverage.pages?.skipped?.length ?? 0;
  if (pageSkips > 0) {
    signals.push(`${pageSkips} manifest pages were not checked because coverage stopped before visiting them.`);
  }
  if (findings.length > 0) {
    signals.push('At least one visited route produced review findings.');
  }
  if (qualitySignals?.rendered_state?.total_findings > 0) {
    signals.push(`${qualitySignals.rendered_state.total_findings} rendered-state findings need developer review.`);
  }
  if (qualitySignals?.route_coverage?.visited_route_viewports < qualitySignals?.route_coverage?.expected_route_viewports) {
    signals.push('Route and viewport coverage did not reach every discovered route viewport pair.');
  }
  return {
    reviewer: 'local_heuristic',
    status: signals.length > 0 ? 'needs_attention' : 'coverage_passed_without_local_findings',
    confidence: 'medium',
    human_like_scope: 'route coverage and deterministic local review signals only',
    visual_assessment: signals,
    implementation_focus: summarizeImplementationFocus(findings),
    limitations: [
      'Route discovery depends on same-origin anchors and navigation action candidates.',
      'Mutating, destructive, input-required, and external actions are not executed by default.',
      'Subjective design approval still requires an approved human or model review layer.'
    ]
  };
}

function buildManifestSuggestions({ target, coverage, qualitySignals }) {
  const suggestions = [];
  if (target.pages.length === 0) {
    suggestions.push({
      type: 'add_page_expectations',
      severity: 'info',
      message: 'No manifest pages are defined for named UI-state checks.',
      recommendation: 'Add pages entries for critical routes with expected text, selectors, and page-specific viewports.'
    });
  }
  if (target.expectedRoutes.length === 0 && coverage.routes.discovered.length > 1) {
    suggestions.push({
      type: 'pin_expected_routes',
      severity: 'info',
      message: 'The review discovered multiple routes but no expectedRoutes are pinned in the manifest.',
      recommendation: 'Add important routes to expectedRoutes so regressions are caught even when navigation changes.'
    });
  }
  const budgetSkips = coverage.routes.skipped.filter((route) => route.reason === 'route_budget_exceeded').length;
  if (budgetSkips > 0) {
    suggestions.push({
      type: 'raise_or_split_route_budget',
      severity: 'medium',
      message: `${budgetSkips} routes were skipped because budgets.maxRoutes was exhausted.`,
      recommendation: 'Raise budgets.maxRoutes or split the target into smaller manifests for focused reruns.'
    });
  }
  if ((coverage.pages?.failed?.length ?? 0) > 0) {
    suggestions.push({
      type: 'fix_page_expectations_or_page_state',
      severity: 'medium',
      message: `${coverage.pages.failed.length} manifest page checks failed.`,
      recommendation: 'Fix the rendered page state or update stale expected text and selectors after owner review.'
    });
  }
  if (qualitySignals?.rendered_state?.total_findings > 0) {
    suggestions.push({
      type: 'add_rendered_state_expectations',
      severity: 'low',
      message: 'Rendered-state findings were observed during target review.',
      recommendation: 'Add page expectations or fixtures that cover loaded, empty, and media-rich states for the affected routes.'
    });
  }
  return suggestions;
}

function summarizeImplementationFocus(findings) {
  const focus = new Set();
  for (const finding of findings) {
    for (const key of ['html', 'css', 'javascript', 'test']) {
      if (finding.implementation_notes?.[key]?.length) {
        focus.add(key);
      }
    }
  }
  return [...focus];
}

function compareFindingPriority(left, right) {
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
    || String(left.category).localeCompare(String(right.category));
}

function releaseGateForFindings(findings) {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return {
      status: 'blocked',
      reason: 'critical_findings_present',
      recommendation: 'Fix critical findings before treating the page as review-ready.'
    };
  }
  if (findings.some((finding) => finding.severity === 'high')) {
    return {
      status: 'blocked',
      reason: 'high_severity_findings_present',
      recommendation: 'Resolve high-severity runtime or page-health findings before visual sign-off.'
    };
  }
  if (findings.some((finding) => finding.severity === 'medium')) {
    return {
      status: 'needs_fix_or_owner_review',
      reason: 'medium_findings_present',
      recommendation: 'Fix deterministic issues and ask the owner to judge heuristic findings.'
    };
  }
  if (findings.length > 0) {
    return {
      status: 'pass_with_notes',
      reason: 'low_or_info_findings_present',
      recommendation: 'Review low-severity findings when polishing the experience.'
    };
  }
  return {
    status: 'pass',
    reason: 'no_actionable_local_findings',
    recommendation: 'No configured local review rules found issues in this run.'
  };
}

function guidanceForFinding(finding) {
  const message = String(finding.message ?? '').toLowerCase();
  if (finding.category === 'browser_health') {
    if (message.includes('image') && message.includes('broken')) {
      return {
        impact: 'Broken visible media can make the page look unfinished and can hide important product context.',
        recommendation: 'Fix the image source, bundling path, or fallback rendering and rerun the same review.',
        fix_candidates: [
          'Verify the resolved asset URL and static file configuration.',
          'Add a fallback state for images that may legitimately fail or be unavailable.'
        ],
        implementation_notes: {
          html: ['Confirm the image element has the intended src and alt text.'],
          css: [],
          javascript: ['Check asset import, build output, and runtime path resolution for the image source.'],
          test: ['Add a browser assertion that important images finish loading with non-zero natural dimensions.']
        }
      };
    }
    return {
      impact: 'Runtime or network failures can make the page unreliable before UI quality is judged.',
      recommendation: 'Repair the underlying runtime, response, or network failure and rerun the same review.',
      fix_candidates: [
        'Inspect the console or failed request evidence attached to this finding.',
        'Add or update a focused regression test for the failing route or asset.'
      ],
      implementation_notes: {
        html: [],
        css: [],
        javascript: ['Trace the failing script, route handler, or asset request from the evidence URL.'],
        test: ['Cover the route with a browser smoke or unit-level regression after the fix.']
      }
    };
  }
  if (finding.category === 'layout_integrity' && message.includes('horizontal overflow')) {
    return {
      impact: 'Horizontal overflow often hides content on smaller viewports and causes accidental side scrolling.',
      recommendation: 'Constrain wide elements to their container and verify responsive behavior at the failing viewport.',
      fix_candidates: [
        'Use max-width: 100% or responsive grid constraints on the overflowing element.',
        'Check fixed pixel widths, absolute positioning, and long unbroken text.'
      ],
      implementation_notes: {
        html: [],
        css: ['Audit fixed widths, min-width, grid tracks, and overflow rules near the failing selector.'],
        javascript: [],
        test: ['Keep the failing viewport in the target manifest viewportMatrix.']
      }
    };
  }
  if (finding.category === 'layout_integrity' && message.includes('clipped')) {
    return {
      impact: 'Clipped text makes labels and content hard to read and can hide important state.',
      recommendation: 'Allow text wrapping, resize the container, or intentionally mark the region as scrollable.',
      fix_candidates: [
        'Remove overly small fixed height or width constraints.',
        'Use overflow behavior that matches the intended interaction.'
      ],
      implementation_notes: {
        html: [],
        css: ['Inspect white-space, overflow, line-height, width, and height around the selector.'],
        javascript: [],
        test: ['Add a fixture or visual check for the affected text state.']
      }
    };
  }
  if (finding.category === 'layout_integrity' && message.includes('overlap')) {
    return {
      impact: 'Overlapping visible elements can hide content, block controls, or make a page look broken at the reviewed viewport.',
      recommendation: 'Inspect the overlapping selectors, then adjust layout constraints, stacking, or responsive breakpoints.',
      fix_candidates: [
        'Remove unintended absolute positioning or z-index layering.',
        'Add responsive grid/flex constraints so adjacent content has stable space.'
      ],
      implementation_notes: {
        html: [],
        css: ['Inspect position, z-index, grid/flex sizing, margins, and breakpoint rules for the overlapping selectors.'],
        javascript: [],
        test: ['Keep the failing viewport in the target manifest and rerun review after the layout change.']
      }
    };
  }
  if (finding.category === 'layout_integrity' && message.includes('loading indicator')) {
    return {
      impact: 'A persistent loading state can block users from understanding whether content is ready or stuck.',
      recommendation: 'Confirm the loading indicator is dismissed after data is ready, or add clear loaded/empty/error states.',
      fix_candidates: [
        'Check unresolved promises, pending data fetches, and state transitions for the route.',
        'Render a stable empty or error state when content cannot be loaded.'
      ],
      implementation_notes: {
        html: ['Ensure loading regions expose meaningful status text only while loading is active.'],
        css: ['Avoid leaving skeleton or spinner classes visible after data is ready.'],
        javascript: ['Audit loading state transitions and async error handling for the route.'],
        test: ['Add a browser test that waits for the loading indicator to disappear.']
      }
    };
  }
  if (finding.category === 'layout_integrity' && message.includes('empty-state')) {
    return {
      impact: 'Empty data containers without an explicit state can look broken even when the application is working.',
      recommendation: 'Render a visible empty state or seed the reviewed page with representative data.',
      fix_candidates: [
        'Add empty-state copy or an action for list, table, or grid components.',
        'If the page should contain data, fix the data source or fixture setup before review.'
      ],
      implementation_notes: {
        html: ['Add semantic empty-state content near the empty container.'],
        css: ['Give the empty state stable spacing so the layout does not collapse.'],
        javascript: ['Separate loading, empty, error, and populated states in the owner component.'],
        test: ['Cover empty and populated states for the affected data container.']
      }
    };
  }
  if (finding.category === 'accessibility_basics') {
    if (message.includes('contrast')) {
      return {
        impact: 'Low text contrast can make important labels and content hard to read.',
        recommendation: 'Adjust foreground and background colors to meet the configured contrast threshold.',
        fix_candidates: [
          'Increase foreground/background contrast in the design token or component style.',
          'Check disabled, muted, and secondary text states separately.'
        ],
        implementation_notes: {
          html: [],
          css: ['Update color tokens or component-specific color rules near the failing selector.'],
          javascript: [],
          test: ['Keep a review fixture or target route that renders the same color state.']
        }
      };
    }
    if (message.includes('heading') || message.includes('h1')) {
      return {
        impact: 'Heading hierarchy affects scanning, accessibility navigation, and automated page understanding.',
        recommendation: 'Align the rendered heading structure with the visual information hierarchy.',
        fix_candidates: [
          'Use one primary h1 for the page-level title when applicable.',
          'Avoid skipping heading levels unless the owner intentionally accepts that structure.'
        ],
        implementation_notes: {
          html: ['Adjust semantic heading tags in the owning component.'],
          css: ['Use styling classes for visual size instead of choosing heading tags by appearance.'],
          javascript: [],
          test: ['Assert important route headings in a component or browser-level test.']
        }
      };
    }
    if (message.includes('image')) {
      return {
        impact: 'Images without alt text or decorative markers can leave screen reader and automation users without useful context.',
        recommendation: 'Add meaningful alt text, or explicitly mark decorative images as hidden/presentation.',
        fix_candidates: [
          'Set alt text that describes the image purpose in context.',
          'Use aria-hidden or role="presentation" only for decorative images.'
        ],
        implementation_notes: {
          html: ['Update the image element or image component props.'],
          css: [],
          javascript: [],
          test: ['Add an accessibility assertion for important rendered images.']
        }
      };
    }
    return {
      impact: 'Missing labels or duplicate IDs can break keyboard, screen reader, and agent-driven interaction.',
      recommendation: 'Fix semantic names and DOM identity before relying on automated interaction or review.',
      fix_candidates: [
        'Add visible text, aria-label, aria-labelledby, or a proper label element.',
        'Ensure every id is unique in the rendered document.'
      ],
      implementation_notes: {
        html: ['Prefer semantic labels and unique IDs in the owner component.'],
        css: [],
        javascript: [],
        test: ['Assert accessible names for important controls.']
      }
    };
  }
  if (finding.category === 'interaction_quality') {
    if (message.includes('44px')) {
      return {
        impact: 'Small mobile touch targets make repeated human and automated interaction less reliable.',
        recommendation: 'Increase the interactive hit area while preserving the visual design.',
        fix_candidates: [
          'Increase padding, min-width, or min-height to meet the target size.',
          'Use an invisible hit-area wrapper when the visible icon must remain compact.'
        ],
        implementation_notes: {
          html: ['Confirm the interactive element exposes a stable accessible name.'],
          css: ['Set mobile-safe min-size or padding for the owning control component.'],
          javascript: [],
          test: ['Rerun the mobile viewport review after changing the control dimensions.']
        }
      };
    }
    return {
      impact: 'Small or unclear controls reduce interaction reliability for humans and automation.',
      recommendation: 'Increase target size and verify focus, hover, and touch ergonomics.',
      fix_candidates: [
        'Use a stable minimum control size and padding.',
        'Keep icon-only controls named with aria-label or visible text.'
      ],
      implementation_notes: {
        html: ['Ensure interactive controls expose clear names.'],
        css: ['Increase hit area and preserve visible focus states.'],
        javascript: [],
        test: ['Exercise the control through the action or review workflow.']
      }
    };
  }
  if (finding.category === 'mock_fidelity') {
    return {
      impact: 'Mock drift can indicate an implementation mismatch or an outdated design reference.',
      recommendation: 'Compare the screenshot artifact with the mock and decide whether code or design should change.',
      fix_candidates: [
        'If implementation is wrong, adjust layout, spacing, typography, or state rendering.',
        'If the mock is outdated, update the approved baseline.'
      ],
      implementation_notes: {
        html: [],
        css: ['Check layout, spacing, color, and typography differences manually from artifacts.'],
        javascript: ['Confirm the rendered state matches the intended route and data state.'],
        test: ['Keep the mock path workspace-relative and rerun with the same viewport.']
      }
    };
  }
  return {
    impact: 'Evidence quality affects how confidently this run can guide development decisions.',
    recommendation: 'Capture the missing evidence or rerun with the recommended options when visual review is needed.',
    fix_candidates: [
      'Rerun with --screenshot for visual evidence.',
      'Use a target manifest when multiple routes or viewports matter.'
    ],
    implementation_notes: {
      html: [],
      css: [],
      javascript: [],
      test: ['Preserve review artifacts for developer handoff until the issue is resolved.']
    }
  };
}

async function compareMock({ id, cwd, root, artifactRoot, actualPath, mockPath, threshold }) {
  const warnings = [];
  const artifacts = [];
  const findings = [];
  const numericThreshold = Number.isFinite(Number(threshold)) ? Number(threshold) : 0.01;
  if (!actualPath) {
    return {
      warnings,
      artifacts,
      findings: [{
        category: 'mock_fidelity',
        severity: 'info',
        confidence: 'high',
        source: 'deterministic',
        selector: null,
        rect: null,
        route: null,
        viewport: null,
        message: 'Mock comparison requested but no actual screenshot was available.',
        evidence: { status: 'inconclusive', reason: 'missing_actual_screenshot' },
        artifacts: [],
        repro: ['Run review with screenshot capture enabled.'],
        owner_decision_required: false
      }],
      metrics: { status: 'inconclusive', reason: 'missing_actual_screenshot' }
    };
  }

  const resolvedMock = resolveWorkspacePath(cwd, mockPath);
  if (!resolvedMock.ok) {
    return {
      warnings,
      artifacts,
      findings: [{
        category: 'mock_fidelity',
        severity: 'info',
        confidence: 'high',
        source: 'deterministic',
        selector: null,
        rect: null,
        route: null,
        viewport: null,
        message: resolvedMock.error.message,
        evidence: { status: 'inconclusive', reason: resolvedMock.error.code },
        artifacts: [],
        repro: ['Provide a workspace-relative mock image path.'],
        owner_decision_required: false
      }],
      metrics: { status: 'inconclusive', reason: resolvedMock.error.code }
    };
  }

  const actual = await readFile(actualPath);
  const mock = await readFile(resolvedMock.path);
  const actualPng = pngInfo(actual);
  const mockPng = pngInfo(mock);
  const metrics = {
    status: 'inconclusive',
    threshold: numericThreshold,
    actual: imageMetrics(actual, actualPng),
    mock: imageMetrics(mock, mockPng)
  };
  if (!actualPng || !mockPng) {
    metrics.reason = 'unsupported_or_invalid_png';
  } else if (actualPng.width !== mockPng.width || actualPng.height !== mockPng.height) {
    metrics.reason = 'dimension_mismatch';
  } else {
    const byteDiffRatio = byteDifferenceRatio(actual, mock);
    metrics.status = byteDiffRatio <= numericThreshold ? 'within_threshold' : 'different';
    metrics.byte_diff_ratio = byteDiffRatio;
  }

  const metricsRel = artifactRelPath(artifactRoot, 'diffs', `${id}-mock-metrics.json`);
  await writeJsonArtifact(root, ['diffs', `${id}-mock-metrics.json`], metrics);
  artifacts.push(artifactObject({
    type: 'mock_metrics',
    path: metricsRel,
    description: 'Local mock comparison metrics.'
  }));

  if (metrics.status !== 'within_threshold') {
    findings.push({
      category: 'mock_fidelity',
      severity: metrics.status === 'different' ? 'medium' : 'info',
      confidence: 'medium',
      source: 'heuristic',
      selector: null,
      rect: null,
      route: null,
      viewport: null,
      message: metrics.status === 'different'
        ? 'Actual screenshot differs from the provided mock beyond the configured threshold.'
        : 'Mock comparison is inconclusive.',
      evidence: metrics,
      artifacts: [metricsRel],
      repro: ['Review the actual screenshot and mock comparison metrics.'],
      owner_decision_required: true
    });
  }

  return { warnings, artifacts, findings, metrics };
}

function resolveWorkspacePath(cwd, inputPath) {
  const value = String(inputPath ?? '');
  if (!value || value.startsWith('@') || path.isAbsolute(value)) {
    return {
      ok: false,
      error: {
        code: 'MOCK_PATH_INVALID',
        message: 'Mock path must be a non-empty workspace-relative path without @.'
      }
    };
  }
  const resolved = path.resolve(cwd, value);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return {
      ok: false,
      error: {
        code: 'MOCK_PATH_OUTSIDE_WORKSPACE',
        message: 'Mock path must stay inside the current workspace.'
      }
    };
  }
  return { ok: true, path: resolved };
}

function pngInfo(buffer) {
  if (buffer.length < 24) {
    return null;
  }
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function imageMetrics(buffer, info) {
  return {
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    width: info?.width ?? null,
    height: info?.height ?? null
  };
}

function byteDifferenceRatio(actual, mock) {
  const length = Math.max(actual.length, mock.length);
  let different = Math.abs(actual.length - mock.length);
  for (let index = 0; index < Math.min(actual.length, mock.length); index += 1) {
    if (actual[index] !== mock[index]) {
      different += 1;
    }
  }
  return Number((different / Math.max(length, 1)).toFixed(6));
}

function reviewMetrics(findings, extra = {}) {
  const byCategory = {};
  const bySeverity = {};
  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
  }
  return {
    finding_count: findings.length,
    by_category: byCategory,
    by_severity: bySeverity,
    ...extra
  };
}

function reviewLimitations({ screenshot, mock }) {
  const limitations = [
    'Review findings are evidence-backed first-pass signals, not final product approval.',
    'No findings means no configured rule violations were observed.'
  ];
  if (!screenshot) {
    limitations.push('Screenshot evidence was not captured.');
  }
  if (!mock) {
    limitations.push('No mock baseline was provided.');
  }
  return limitations;
}

async function writeReviewArtifactIndex({
  id,
  mode,
  root,
  artifactRoot,
  artifacts,
  qualitySignals,
  coverage,
  rerun
}) {
  const rel = artifactRelPath(artifactRoot, 'review-artifacts', `${id}.json`);
  const data = redact({
    schema_version: SCHEMA_VERSION,
    id,
    mode,
    local_only: true,
    external_upload: false,
    artifact_root: artifactRoot,
    artifact_count: artifacts.length,
    evidence_classes: evidenceClassesForArtifacts(artifacts),
    artifacts: artifacts.map((artifact) => ({
      type: artifact.type,
      path: artifact.path,
      description: artifact.description
    })),
    triage: {
      status: qualitySignals?.status ?? 'unknown',
      local_release_gate: qualitySignals?.release_readiness?.local_gate ?? null,
      route_coverage: qualitySignals?.route_coverage?.status ?? null,
      page_expectations: qualitySignals?.page_expectations?.status ?? null,
      rendered_state: qualitySignals?.rendered_state?.status ?? null,
      model_review_enabled: qualitySignals?.model_review_boundary?.status !== 'not_enabled'
    },
    coverage_summary: coverage ? {
      discovered_routes: coverage.routes.discovered.length,
      visited_routes: coverage.routes.visited.length,
      expected_routes: coverage.routes.expected?.length ?? 0,
      skipped_routes: coverage.routes.skipped.length,
      expected_pages: coverage.pages?.expected?.length ?? 0,
      failed_page_expectations: coverage.pages?.failed?.length ?? 0,
      viewports: coverage.viewports.map((viewport) => viewport.name)
    } : null,
    rerun,
    boundaries: {
      screenshots_may_contain_page_content: artifacts.some((artifact) => artifact.type === 'screenshot'),
      traces_may_contain_page_content: artifacts.some((artifact) => artifact.type === 'trace'),
      profile_reuse: false,
      credential_storage: false
    }
  });
  await writeJsonArtifact(root, ['review-artifacts', `${id}.json`], data);
  return {
    data,
    artifact: artifactObject({
      type: 'review_artifact_index',
      path: rel,
      description: 'Local index of review artifacts, evidence classes, and rerun guidance.'
    })
  };
}

function evidenceClassesForArtifacts(artifacts) {
  const classes = new Set();
  for (const artifact of artifacts) {
    if (artifact.type === 'observation') {
      classes.add('DOM summary');
      classes.add('console');
      classes.add('network');
    } else if (artifact.type === 'layout') {
      classes.add('layout');
      classes.add('accessibility basics');
    } else if (artifact.type === 'screenshot') {
      classes.add('screenshot');
    } else if (artifact.type === 'coverage') {
      classes.add('route coverage');
      classes.add('viewport coverage');
    } else if (artifact.type === 'mock_metrics') {
      classes.add('mock metrics');
    } else if (artifact.type === 'report') {
      classes.add('developer report');
    } else if (artifact.type === 'review') {
      classes.add('review JSON');
    }
  }
  return [...classes].sort();
}

function reviewRerunCommand({ url, viewport, screenshot, report, mock }) {
  const parts = [
    CLI_NAME,
    'review',
    '--url',
    quoteCommandValue(url),
    '--viewport',
    quoteCommandValue(`${viewport.width}x${viewport.height}`)
  ];
  if (screenshot) {
    parts.push('--screenshot');
  }
  if (mock) {
    parts.push('--mock', quoteCommandValue(mock));
  }
  if (report) {
    parts.push('--report');
  }
  parts.push('--json');
  return parts.join(' ');
}

function targetRerunCommand({ manifestResult, report }) {
  const target = manifestResult.path
    ? `@${manifestResult.path}`
    : manifestResult.source === 'stdin'
      ? '-'
      : '<target-manifest>';
  const parts = [CLI_NAME, 'review', '--target', quoteCommandValue(target)];
  if (report) {
    parts.push('--report');
  }
  parts.push('--json');
  return parts.join(' ');
}

function quoteCommandValue(value) {
  const text = String(value ?? '');
  return /^[A-Za-z0-9._~:/@=-]+$/.test(text) ? text : JSON.stringify(text);
}

function renderReviewReport(data, artifacts) {
  const lines = [
    `# Browser Debug Review: ${data.review.id}`,
    '',
    `- Status: ${data.review.status}`,
    `- Mode: ${data.review.mode}`,
    `- Final URL: ${data.review.final_url ?? data.review.target?.base_url ?? 'n/a'}`,
    `- Findings: ${data.findings.length}`,
    '',
    '## Action Plan',
    '',
    `- Gate: ${data.action_plan?.release_gate?.status ?? 'unknown'}`,
    `- Recommendation: ${data.action_plan?.release_gate?.recommendation ?? 'Review structured JSON output.'}`,
    ''
  ];
  if (data.action_plan?.next_actions?.length) {
    for (const action of data.action_plan.next_actions) {
      lines.push(`- ${action.priority} ${action.severity.toUpperCase()} ${action.category}: ${action.recommendation}`);
    }
    lines.push('');
  }
  lines.push('## Developer Triage', '');
  lines.push(`- Actionable findings: ${data.action_plan?.total_actionable_findings ?? data.findings.length}`);
  if (data.metrics?.by_severity) {
    lines.push(`- Severity counts: ${formatCounts(data.metrics.by_severity)}`);
  }
  if (data.metrics?.by_category) {
    lines.push(`- Category counts: ${formatCounts(data.metrics.by_category)}`);
  }
  if (data.coverage) {
    lines.push(`- Route coverage: ${data.coverage.routes.visited.length} visited, ${data.coverage.routes.skipped.length} skipped, ${data.coverage.routes.failed.length} failed`);
    lines.push(`- Page expectations: ${data.coverage.pages?.checked?.length ?? 0} checked, ${data.coverage.pages?.failed?.length ?? 0} failed`);
  }
  if (data.artifact_index?.path) {
    lines.push(`- Artifact index: ${data.artifact_index.path}`);
  }
  lines.push('');
  if (data.review_advisory?.visual_assessment?.length) {
    lines.push('## Local Review Advisory', '');
    for (const signal of data.review_advisory.visual_assessment) {
      lines.push(`- ${signal}`);
    }
    lines.push('');
  }
  if (data.quality_signals) {
    lines.push('## Quality Signals', '');
    lines.push(`- Status: ${data.quality_signals.status ?? 'unknown'}`);
    if (data.quality_signals.visual_hierarchy) {
      lines.push(`- Visual hierarchy: ${data.quality_signals.visual_hierarchy.status}`);
    }
    if (data.quality_signals.responsive_layout) {
      lines.push(`- Responsive layout: ${data.quality_signals.responsive_layout.status}`);
    }
    if (data.quality_signals.rendered_state) {
      lines.push(`- Rendered state: ${data.quality_signals.rendered_state.status}`);
    }
    if (data.quality_signals.interaction_affordance) {
      lines.push(`- Interaction affordance: ${data.quality_signals.interaction_affordance.status}`);
    }
    if (data.quality_signals.accessibility_structure) {
      lines.push(`- Accessibility structure: ${data.quality_signals.accessibility_structure.status}`);
    }
    if (data.quality_signals.route_coverage) {
      lines.push(`- Route coverage: ${data.quality_signals.route_coverage.status}`);
    }
    if (data.quality_signals.page_expectations) {
      lines.push(`- Page expectations: ${data.quality_signals.page_expectations.status}`);
    }
    if (data.quality_signals.release_readiness) {
      lines.push(`- Local release gate: ${data.quality_signals.release_readiness.local_gate}`);
    }
    lines.push('');
  }
  if (data.manifest_suggestions?.length) {
    lines.push('## Manifest Suggestions', '');
    for (const suggestion of data.manifest_suggestions) {
      lines.push(`- ${suggestion.severity.toUpperCase()} ${suggestion.type}: ${suggestion.recommendation}`);
    }
    lines.push('');
  }
  lines.push(
    '## Findings',
    ''
  );
  if (data.findings.length === 0) {
    lines.push('No configured rule violations were observed.', '');
  } else {
    for (const finding of data.findings) {
      lines.push(`- ${finding.severity.toUpperCase()} ${finding.category}: ${finding.message}`);
      if (finding.selector) {
        lines.push(`  Selector: ${finding.selector}`);
      }
      if (finding.repro?.length) {
        lines.push(`  Repro: ${finding.repro.join(' ')}`);
      }
      if (finding.recommendation) {
        lines.push(`  Recommendation: ${finding.recommendation}`);
      }
    }
    lines.push('');
  }
  lines.push('## Artifacts', '');
  for (const artifact of artifacts) {
    lines.push(`- ${artifact.type}: ${artifact.path}`);
  }
  return `${lines.join('\n')}\n`;
}

function formatCounts(counts) {
  const entries = Object.entries(counts ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([key, count]) => `${key}=${count}`).join(', ');
}

function dedupeByUrl(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = `${item.url}:${item.reason}`;
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function failure(error, { warnings = [], artifacts = [] } = {}) {
  return {
    status: 'error',
    data: {},
    warnings,
    errors: [{ ...error, details: redact(error.details ?? {}) }],
    artifacts
  };
}

function classifyReviewError(error) {
  if (error.message?.includes('Executable doesn') || error.message?.includes('browserType.launch')) {
    return 'BROWSER_LAUNCH_FAILED';
  }
  if (error.message?.includes('Timeout')) {
    return 'REVIEW_TIMEOUT';
  }
  return 'REVIEW_FAILED';
}

function materializeNow(now) {
  if (!now) {
    return new Date();
  }
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value : new Date(value);
}
