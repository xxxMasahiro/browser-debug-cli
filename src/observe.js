import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { DEFAULT_ARTIFACT_ROOT } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot
} from './artifacts.js';
import {
  attachPageObservers,
  collectPageState as collectPageStateFromPage,
  createPageEventBuffers,
  waitForNetworkIdle,
  writePageObservation
} from './page-evidence.js';
import { redact, truncateText } from './redaction.js';

const DEFAULT_TIMEOUT_MS = 15000;
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export async function runObserve(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('observation', now) ?? createArtifactId(now, 'observation');
  let timeout;
  try {
    timeout = normalizeTimeout(options.timeout);
  } catch (error) {
    return failure('observe', {
      code: 'INVALID_TIMEOUT',
      message: error.message,
      details: { timeout: options.timeout }
    });
  }
  const urlError = validateUrl(options.url);
  if (urlError) {
    return failure('observe', urlError, { warnings: [], artifacts: [] });
  }

  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return failure('observe', {
      code: 'ARTIFACT_ROOT_INVALID',
      message: error.message,
      details: { artifact_root: artifactRootInput }
    });
  }

  const warnings = [];
  const artifacts = [];
  let browser;
  let browserContext;
  let traceStarted = false;

  try {
    const browserType = context.browserType ?? (await import('playwright')).chromium;
    const headless = !options.headed && !options.devtools;
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

    const page = await browserContext.newPage();
    const pageEvents = createPageEventBuffers();
    attachPageObservers(page, pageEvents);

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout });
    await waitForNetworkIdle(page, timeout, warnings);

    for (const action of context.actions ?? []) {
      await performPageAction(page, action, timeout);
    }

    const observationResult = await writePageObservation({
      root,
      artifactRoot: artifactRootInput,
      id,
      now,
      page,
      inputUrl: options.url,
      response,
      browser: {
        engine: 'chromium',
        headless,
        devtools: Boolean(options.devtools),
        ephemeral_context: true
      },
      consoleMessages: pageEvents.consoleMessages,
      failedRequests: pageEvents.failedRequests,
      actionResults: (context.actions ?? []).map((action) => ({
        type: action.type,
        selector: action.selector ? truncateText(action.selector, 500) : undefined,
        status: 'applied'
      })),
      description: 'Structured page observation JSON.'
    });
    const observation = observationResult.data;
    artifacts.push(observationResult.artifact);

    if (options.screenshot || context.forceScreenshot) {
      const screenshotRel = artifactRelPath(artifactRootInput, 'screenshots', `${id}.png`);
      await page.screenshot({ path: path.join(root, 'screenshots', `${id}.png`), fullPage: true });
      artifacts.push(artifactObject({
        type: 'screenshot',
        path: screenshotRel,
        description: 'Full-page screenshot captured from an ephemeral context.'
      }));
    }

    if (traceStarted) {
      const traceRel = artifactRelPath(artifactRootInput, 'traces', `${id}.zip`);
      await browserContext.tracing.stop({ path: path.join(root, 'traces', `${id}.zip`) });
      traceStarted = false;
      artifacts.push(artifactObject({
        type: 'trace',
        path: traceRel,
        description: 'Playwright trace captured from an ephemeral context.'
      }));
    }

    return {
      status: 'ok',
      data: observation,
      warnings,
      errors: [],
      artifacts
    };
  } catch (error) {
    if (traceStarted) {
      await browserContext?.tracing.stop().catch(() => {});
      traceStarted = false;
    }
    return failure('observe', {
      code: classifyObserveError(error),
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

export async function writeObserveFixture(filePath, html) {
  await writeFile(filePath, html, 'utf8');
  return `file://${filePath}`;
}

export function validateUrl(value) {
  if (!value) {
    return {
      code: 'MISSING_REQUIRED_OPTION',
      message: 'A URL is required.',
      details: { option: 'url' }
    };
  }
  try {
    const url = new URL(value);
    if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
      return {
        code: 'UNSUPPORTED_URL_PROTOCOL',
        message: `Unsupported URL protocol: ${url.protocol}`,
        details: { protocol: url.protocol, supported_protocols: [...SUPPORTED_PROTOCOLS] }
      };
    }
    return null;
  } catch {
    return {
      code: 'INVALID_URL',
      message: 'The URL must be absolute.',
      details: { option: 'url' }
    };
  }
}

export function normalizeTimeout(value) {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 120000) {
    throw new Error('Timeout must be an integer from 1000 to 120000 milliseconds.');
  }
  return parsed;
}

function materializeNow(now) {
  if (!now) {
    return new Date();
  }
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value : new Date(value);
}

function failure(command, error, { warnings = [], artifacts = [] } = {}) {
  return {
    status: 'error',
    data: {},
    warnings,
    errors: [{ ...error, details: redact(error.details ?? {}) }],
    artifacts,
    command
  };
}

function classifyObserveError(error) {
  if (error.message?.includes('Executable doesn') || error.message?.includes('browserType.launch')) {
    return 'BROWSER_LAUNCH_FAILED';
  }
  if (error.message?.includes('Timeout')) {
    return 'OBSERVE_TIMEOUT';
  }
  return 'OBSERVE_FAILED';
}

export async function performPageAction(page, action, timeout) {
  switch (action.type) {
    case 'click':
      await page.locator(required(action.selector, 'selector')).first().click({ timeout });
      break;
    case 'fill':
      await page.locator(required(action.selector, 'selector')).first().fill(String(action.value ?? ''), { timeout });
      break;
    case 'select':
      await page.locator(required(action.selector, 'selector')).first().selectOption(String(required(action.value, 'value')), { timeout });
      break;
    case 'press':
      await page.locator(required(action.selector, 'selector')).first().press(String(required(action.key, 'key')), { timeout });
      break;
    case 'scroll':
      await page.evaluate(
        ({ deltaX, deltaY }) => window.scrollBy(deltaX, deltaY),
        {
          deltaX: Number(action.deltaX ?? 0),
          deltaY: Number(action.deltaY ?? 600)
        }
      );
      break;
    case 'wait':
      await page.waitForTimeout(Math.min(Number(action.ms ?? 1000), 10000));
      break;
    case 'screenshot':
    case 'observe':
      break;
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

function required(value, key) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Action requires ${key}.`);
  }
  return value;
}

export const collectPageState = collectPageStateFromPage;
