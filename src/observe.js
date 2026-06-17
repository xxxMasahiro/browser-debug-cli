import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { DEFAULT_ARTIFACT_ROOT } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import { redact, redactUrl, truncateText } from './redaction.js';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_CONSOLE_MESSAGES = 30;
const MAX_FAILED_REQUESTS = 30;
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
    const consoleMessages = [];
    const failedRequests = [];

    page.on('console', (message) => {
      if (consoleMessages.length >= MAX_CONSOLE_MESSAGES) {
        return;
      }
      consoleMessages.push({
        type: message.type(),
        text: truncateText(message.text(), 1000),
        location: redact(message.location())
      });
    });

    page.on('requestfailed', (request) => {
      if (failedRequests.length >= MAX_FAILED_REQUESTS) {
        return;
      }
      failedRequests.push({
        url: redactUrl(request.url()),
        method: request.method(),
        failure: truncateText(request.failure()?.errorText ?? 'request failed', 500)
      });
    });

    const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout });
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(3000, timeout) });
    } catch {
      warnings.push({
        code: 'NETWORK_IDLE_TIMEOUT',
        message: 'The page did not reach networkidle before the short observation wait ended.',
        details: { timeout_ms: Math.min(3000, timeout) }
      });
    }

    for (const action of context.actions ?? []) {
      await performPageAction(page, action, timeout);
    }

    const pageState = await collectPageState(page);
    const finalUrl = page.url();
    const observation = redact({
      id,
      observed_at: now.toISOString(),
      input_url: redactUrl(options.url),
      final_url: redactUrl(finalUrl),
      title: pageState.title,
      response: response
        ? {
            status: response.status(),
            ok: response.ok(),
            url: redactUrl(response.url())
          }
        : null,
      browser: {
        engine: 'chromium',
        headless,
        devtools: Boolean(options.devtools),
        ephemeral_context: true
      },
      page: pageState,
      console: { messages: consoleMessages },
      network: { failed_requests: failedRequests },
      action_results: (context.actions ?? []).map((action) => ({
        type: action.type,
        selector: action.selector ? truncateText(action.selector, 500) : undefined,
        status: 'applied'
      }))
    });

    const observationRel = artifactRelPath(artifactRootInput, 'observations', `${id}.json`);
    await writeJsonArtifact(root, ['observations', `${id}.json`], observation);
    artifacts.push(artifactObject({
      type: 'observation',
      path: observationRel,
      description: 'Structured page observation JSON.'
    }));

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

function normalizeTimeout(value) {
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

async function performPageAction(page, action, timeout) {
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
      await page.mouse.wheel(Number(action.deltaX ?? 0), Number(action.deltaY ?? 600));
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

async function collectPageState(page) {
  const state = await page.evaluate(() => {
    const trim = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
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
      const dataTest = element.getAttribute('data-test');
      if (dataTest) {
        return `[data-test="${cssEscape(dataTest)}"]`;
      }
      const aria = element.getAttribute('aria-label');
      if (aria) {
        return `${element.tagName.toLowerCase()}[aria-label="${cssEscape(aria)}"]`;
      }
      const name = element.getAttribute('name');
      if (name) {
        return `${element.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
      }
      const segments = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
        let segment = current.tagName.toLowerCase();
        if (current.id) {
          segment += `#${cssEscape(current.id)}`;
          segments.unshift(segment);
          break;
        }
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
    const candidates = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"]')]
      .filter(isVisible)
      .slice(0, 60)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || null,
        text: trim(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || ''),
        selector: selectorFor(element),
        href: element instanceof HTMLAnchorElement ? element.href : null,
        input_type: element instanceof HTMLInputElement ? element.type : null,
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true')
      }));
    const headings = [...document.querySelectorAll('h1, h2, h3')]
      .filter(isVisible)
      .slice(0, 30)
      .map((element) => ({
        level: Number(element.tagName.slice(1)),
        text: trim(element.innerText || element.textContent || '', 300),
        selector: selectorFor(element)
      }));
    const forms = [...document.querySelectorAll('form')]
      .slice(0, 20)
      .map((form) => ({
        selector: selectorFor(form),
        controls: [...form.querySelectorAll('input, select, textarea, button')]
          .filter(isVisible)
          .slice(0, 40)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            selector: selectorFor(element),
            name: element.getAttribute('name') || null,
            type: element instanceof HTMLInputElement ? element.type : null,
            label: trim(element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.innerText || '', 300)
          }))
      }));
    return {
      url: window.location.href,
      title: document.title,
      ready_state: document.readyState,
      language: document.documentElement.lang || null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      visible_text: trim(document.body?.innerText || '', 4000),
      headings,
      action_candidates: candidates,
      forms
    };
  });

  return redact({
    ...state,
    url: redactUrl(state.url),
    visible_text: truncateText(state.visible_text, 4000)
  });
}
