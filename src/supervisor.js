import path from 'node:path';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import {
  normalizeTimeout,
  performPageAction,
  validateUrl
} from './observe.js';
import {
  attachPageObservers,
  createPageEventBuffers,
  waitForNetworkIdle,
  writePageObservation
} from './page-evidence.js';
import { redact, truncateText } from './redaction.js';

const MAX_SUPERVISED_CONSOLE_MESSAGES = 60;
const MAX_SUPERVISED_FAILED_REQUESTS = 60;

export async function runSupervisor(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('supervision', now) ?? createArtifactId(now, 'supervision');
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

  const parsedActions = parseActions(options.actions);
  if (!parsedActions.ok) {
    return failure(parsedActions.error);
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
  const observations = [];
  const actionHistory = [];
  const pageEvents = createPageEventBuffers();
  const headless = !options.headed && !options.devtools;
  let browser;
  let browserContext;
  let page;
  let traceStarted = false;
  let response = null;

  try {
    const browserType = context.browserType ?? (await import('playwright')).chromium;
    browser = await browserType.launch({
      headless,
      devtools: Boolean(options.devtools)
    });
    browserContext = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    if (options.trace) {
      await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
      traceStarted = true;
      warnings.push({
        code: 'TRACE_CONTAINS_PAGE_CONTENT',
        message: 'The trace artifact can contain page content and must remain local and ignored.',
        details: { artifact_root: artifactRootInput }
      });
    }

    page = await browserContext.newPage();
    attachPageObservers(page, pageEvents, {
      maxConsoleMessages: MAX_SUPERVISED_CONSOLE_MESSAGES,
      maxFailedRequests: MAX_SUPERVISED_FAILED_REQUESTS
    });

    response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout });
    await waitForNetworkIdle(page, timeout, warnings, {
      message: 'The page did not reach networkidle before the short supervision wait ended.'
    });
    observations.push(await writePageObservation({
      root,
      artifactRoot: artifactRootInput,
      id: `${id}-initial`,
      now,
      page,
      inputUrl: options.url,
      response,
      browser: supervisedBrowserState({ headless, devtools: Boolean(options.devtools) }),
      consoleMessages: pageEvents.consoleMessages,
      failedRequests: pageEvents.failedRequests,
      actionResults: []
    }));

    for (const [index, action] of parsedActions.actions.entries()) {
      const actionStartedAt = materializeNow(context.now).toISOString();
      if (action.type === 'navigate') {
        const nextUrlError = validateUrl(action.url);
        if (nextUrlError) {
          if (traceStarted) {
            await browserContext.tracing.stop().catch(() => {});
            traceStarted = false;
          }
          return failure(nextUrlError, { warnings, artifacts });
        }
        response = await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout });
        await waitForNetworkIdle(page, timeout, warnings, {
          message: 'The page did not reach networkidle before the short supervision wait ended.'
        });
      } else if (action.type !== 'observe' && action.type !== 'screenshot') {
        await performPageAction(page, action, timeout);
        await waitForNetworkIdle(page, timeout, warnings, { optional: true });
      }

      const actionObservation = await writePageObservation({
        root,
        artifactRoot: artifactRootInput,
        id: `${id}-step-${index + 1}`,
        now: materializeNow(context.now),
        page,
        inputUrl: page.url(),
        response,
        browser: supervisedBrowserState({ headless, devtools: Boolean(options.devtools) }),
        consoleMessages: pageEvents.consoleMessages,
        failedRequests: pageEvents.failedRequests,
        actionResults: [{
          type: action.type,
          selector: action.selector ? truncateText(action.selector, 500) : undefined,
          status: 'applied'
        }],
        description: 'Structured supervised page observation JSON.'
      });
      observations.push(actionObservation);
      actionHistory.push(redact({
        at: actionStartedAt,
        action,
        observation_id: actionObservation.id
      }));
    }

    if (options.screenshot || parsedActions.actions.some((action) => action.type === 'screenshot')) {
      const screenshotRel = artifactRelPath(artifactRootInput, 'screenshots', `${id}.png`);
      await page.screenshot({ path: path.join(root, 'screenshots', `${id}.png`), fullPage: true });
      artifacts.push(artifactObject({
        type: 'screenshot',
        path: screenshotRel,
        description: 'Final full-page screenshot captured from a supervised ephemeral context.'
      }));
    }

    if (traceStarted) {
      const traceRel = artifactRelPath(artifactRootInput, 'traces', `${id}.zip`);
      await browserContext.tracing.stop({ path: path.join(root, 'traces', `${id}.zip`) });
      traceStarted = false;
      artifacts.push(artifactObject({
        type: 'trace',
        path: traceRel,
        description: 'Playwright trace captured for one supervised ephemeral context.'
      }));
    }

    const supervision = redact({
      schema_version: SCHEMA_VERSION,
      id,
      status: 'closed',
      mode: 'supervised_ephemeral_context',
      created_at: now.toISOString(),
      updated_at: materializeNow(context.now).toISOString(),
      current_url: page.url(),
      browser: {
        engine: 'chromium',
        headless,
        devtools: Boolean(options.devtools),
        ephemeral_context: true,
        existing_profile_reused: false,
        persistent_storage: false
      },
      observations: observations.map((observation) => ({
        id: observation.id,
        path: observation.artifact.path
      })),
      action_history: actionHistory
    });
    const supervisionRel = artifactRelPath(artifactRootInput, 'sessions', `${id}.json`);
    await writeJsonArtifact(root, ['sessions', `${id}.json`], supervision);
    artifacts.unshift(...observations.map((observation) => observation.artifact));
    artifacts.push(artifactObject({
      type: 'supervision',
      path: supervisionRel,
      description: 'Local supervised browser run metadata.'
    }));

    return {
      status: 'ok',
      data: {
        supervision,
        final_observation: observations.at(-1)?.data ?? null
      },
      warnings,
      errors: [],
      artifacts
    };
  } catch (error) {
    if (traceStarted) {
      await browserContext?.tracing.stop().catch(() => {});
      traceStarted = false;
    }
    return failure({
      code: classifySupervisorError(error),
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

function parseActions(value) {
  if (value === undefined) {
    return { ok: true, actions: [] };
  }
  try {
    const parsed = JSON.parse(value);
    const actions = Array.isArray(parsed) ? parsed : [parsed];
    if (!actions.every((action) => action && typeof action === 'object' && !Array.isArray(action))) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ACTIONS',
          message: 'Actions must be a JSON object or array of JSON objects.',
          details: {}
        }
      };
    }
    for (const action of actions) {
      if (!action.type || typeof action.type !== 'string') {
        return {
          ok: false,
          error: {
            code: 'INVALID_ACTION_TYPE',
            message: 'Each action requires a string type.',
            details: {}
          }
        };
      }
    }
    return { ok: true, actions };
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_ACTIONS_JSON',
        message: 'The --actions value must be valid JSON.',
        details: {}
      }
    };
  }
}

function supervisedBrowserState({ headless, devtools }) {
  return {
    engine: 'chromium',
    headless,
    devtools,
    ephemeral_context: true,
    supervised: true
  };
}

function classifySupervisorError(error) {
  if (error.message?.includes('Executable doesn') || error.message?.includes('browserType.launch')) {
    return 'BROWSER_LAUNCH_FAILED';
  }
  if (error.message?.includes('Timeout')) {
    return 'SUPERVISION_TIMEOUT';
  }
  return 'SUPERVISION_FAILED';
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

function materializeNow(now) {
  if (!now) {
    return new Date();
  }
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value : new Date(value);
}
