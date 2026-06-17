import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
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
    const actionPlan = buildActionPlan(findings);
    const reviewAdvisory = buildReviewAdvisory({
      findings,
      layout,
      screenshotArtifact,
      mockMetrics: mockResult?.metrics ?? null
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
  const findings = [];
  const artifacts = [];
  const warnings = [];
  const queue = [];
  const routeBudget = target.budgets.maxRoutes;

  for (const seed of target.seeds) {
    enqueueRoute(queue, discovered, seed, 'seed', target);
  }

  let processedRoutes = 0;
  while (queue.length > 0 && processedRoutes < routeBudget) {
    const route = queue.shift();
    processedRoutes += 1;
    for (const viewport of target.viewportMatrix) {
      const childId = `${id}-r${processedRoutes}-${viewport.name}`;
      const result = await runSingleUrlReview({
        ...options,
        target: undefined,
        input: undefined,
        url: route.url,
        viewport: `${viewport.width}x${viewport.height}`,
        screenshot: target.artifacts.screenshots,
        report: false
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
      for (const next of result.data.discovery.routes) {
        if (!enqueueRoute(queue, discovered, next.url, next.source, target)) {
          skipped.push({ url: next.url, source: next.source, reason: 'out_of_scope_or_duplicate' });
        }
      }
    }
  }

  const expectedMissing = target.expectedRoutes
    .filter((url) => ![...discovered.keys()].includes(normalizeUrlKey(url)))
    .map((url) => ({ url, reason: 'expected_route_not_discovered' }));
  const coverage = redact({
    schema_version: SCHEMA_VERSION,
    id,
    base_url: target.baseUrl,
    route_budget: routeBudget,
    routes: {
      discovered: [...discovered.values()],
      visited,
      skipped: dedupeByUrl(skipped),
      failed,
      expected_missing: expectedMissing
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

  const actionPlan = buildActionPlan(findings, { coverage });
  const reviewAdvisory = buildTargetReviewAdvisory({ findings, coverage });
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
      expected_missing_routes: expectedMissing.length
    }),
    action_plan: actionPlan,
    review_advisory: reviewAdvisory,
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
      viewportMatrix: normalizeViewportMatrix(manifest.viewportMatrix),
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

function enqueueRoute(queue, discovered, url, source, target) {
  if (!isRouteInScope(url, target)) {
    return false;
  }
  const key = normalizeUrlKey(url);
  if (discovered.has(key)) {
    return false;
  }
  const route = normalizeRoute(url, source);
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
    const elementSelector = 'a, button, input, select, textarea, [role], h1, h2, h3, p, label, main, nav, header, section, article, [data-testid]';
    const elements = [...document.querySelectorAll(elementSelector)]
      .filter(isVisible)
      .slice(0, 180)
      .map((element) => {
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
            display: style.display,
            visibility: style.visibility,
            overflow_x: style.overflowX,
            overflow_y: style.overflowY,
            position: style.position,
            z_index: style.zIndex,
            font_size: style.fontSize,
            outline_style: style.outlineStyle,
            opacity: style.opacity
          }
        };
      });
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
      viewports: coverage.viewports.map((viewport) => viewport.name)
    } : null
  };
}

function buildReviewAdvisory({ findings, layout, screenshotArtifact, mockMetrics }) {
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

function buildTargetReviewAdvisory({ findings, coverage }) {
  const routeFailures = coverage.routes.failed.length;
  const expectedMissing = coverage.routes.expected_missing.length;
  const signals = [];
  if (routeFailures > 0) {
    signals.push(`${routeFailures} route viewport review attempts failed.`);
  }
  if (expectedMissing > 0) {
    signals.push(`${expectedMissing} expected routes were not discovered.`);
  }
  if (findings.length > 0) {
    signals.push('At least one visited route produced review findings.');
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
  if (finding.category === 'accessibility_basics') {
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
  if (data.review_advisory?.visual_assessment?.length) {
    lines.push('## Local Review Advisory', '');
    for (const signal of data.review_advisory.visual_assessment) {
      lines.push(`- ${signal}`);
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
