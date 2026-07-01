import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  ensureArtifactRoot,
  writeJsonArtifact,
  writeTextArtifact
} from './artifacts.js';
import { normalizeTimeout, performPageAction, validateUrl } from './observe.js';
import {
  attachPageObservers,
  createPageEventBuffers,
  waitForNetworkIdle,
  writePageObservation,
  writePageScreenshotEvidence
} from './page-evidence.js';
import { redact, redactUrl, truncateText } from './redaction.js';

const POLL_MS = 100;
const MAX_CONSOLE_MESSAGES = 80;
const MAX_FAILED_REQUESTS = 80;

const options = parseWorkerArgs(process.argv.slice(2));
const startedAt = new Date();
let root;
let browser;
let browserContext;
let page;
let pageEvents;
let latestMetadata;
let stopping = false;
let lastResponse = null;

try {
  await main();
} catch (error) {
  await writeError(error).catch(() => {});
  process.exitCode = 1;
}

async function main() {
  process.chdir(options.cwd);
  root = await ensureArtifactRoot(options.cwd, options.artifactRoot);
  pageEvents = createPageEventBuffers();
  await writeMetadata({
    status: 'starting',
    process_status: 'alive',
    current_url: options.url ?? 'about:blank'
  });

  const headless = !options.headed && !options.devtools;
  browser = await chromium.launch({
    headless,
    devtools: Boolean(options.devtools)
  });
  browserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: options.storageState ?? undefined
  });
  page = await browserContext.newPage();
  attachPageObservers(page, pageEvents, {
    maxConsoleMessages: MAX_CONSOLE_MESSAGES,
    maxFailedRequests: MAX_FAILED_REQUESTS
  });

  const warnings = [];
  if (options.url) {
    assertAllowedOrigin(options.url);
    lastResponse = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeout });
    await waitForNetworkIdle(page, options.timeout, warnings, {
      message: 'The page did not reach networkidle before the session startup wait ended.'
    });
  }

  const initialObservation = await writeObservation({
    id: `${options.id}-initial`,
    inputUrl: options.url ?? page.url(),
    response: lastResponse,
    actionResults: [],
    description: 'Structured persistent session startup observation JSON.'
  });
  await writeMetadata({
    status: 'running',
    process_status: 'alive',
    current_url: page.url(),
    title: initialObservation.data.title,
    warnings,
    observations: [observationRef(initialObservation)],
    lifecycle: { last_activity_at: new Date().toISOString() }
  });

  process.once('SIGTERM', () => {
    void stopSession('stopped', 'signal');
  });
  process.once('SIGINT', () => {
    void stopSession('stopped', 'signal');
  });

  void scheduleLifecycleGuards();
  await commandLoop();
}

async function commandLoop() {
  while (!stopping) {
    const command = await nextCommand();
    if (!command) {
      await sleep(POLL_MS);
      continue;
    }
    await handleCommand(command).catch(async (error) => {
      await writeCommandResult(command.id, runtimeError(error.code ?? 'SESSION_COMMAND_FAILED', error.message, {
        session: options.id,
        command: command.type
      }));
    });
  }
}

async function nextCommand() {
  const commandDir = path.join(root, 'session-commands', options.id);
  const entries = await readdir(commandDir).catch(() => []);
  const names = entries.filter((name) => name.endsWith('.json')).sort();
  if (names.length === 0) {
    return null;
  }
  const name = names[0];
  const file = path.join(commandDir, name);
  const command = JSON.parse(await readFile(file, 'utf8'));
  await rm(file, { force: true }).catch(() => {});
  return command;
}

async function handleCommand(command) {
  let result;
  if (command.type === 'stop') {
    result = await stopSession('stopped', 'client_request');
  } else if (command.type === 'act') {
    result = await act(command.payload?.action ?? {}, command.payload ?? {});
  } else if (command.type === 'observe') {
    result = await observe(command.payload ?? {});
  } else if (command.type === 'checkpoint') {
    result = await checkpoint(command.payload ?? {});
  } else if (command.type === 'review') {
    result = await review(command.payload ?? {});
  } else {
    result = runtimeError('UNKNOWN_SESSION_COMMAND', `Unknown persistent session command: ${command.type}`, {
      command: command.type
    });
  }
  await writeCommandResult(command.id, result);
}

async function act(action, payload) {
  const timeout = normalizeCommandTimeout(payload.timeout);
  const beforeUrl = page.url();
  const startedAtAction = new Date();
  if (action.type === 'navigate') {
    const urlError = validateUrl(action.url);
    if (urlError) {
      return runtimeError(urlError.code, urlError.message, urlError.details);
    }
    assertAllowedOrigin(action.url);
    lastResponse = await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout });
    await waitForNetworkIdle(page, timeout, [], { optional: true });
  } else if (action.type !== 'observe' && action.type !== 'screenshot') {
    await performPageAction(page, action, timeout);
    await waitForNetworkIdle(page, timeout, [], { optional: true });
  }
  const observation = await writeObservation({
    id: `${options.id}-action-${Date.now()}`,
    inputUrl: page.url(),
    response: lastResponse,
    actionResults: [safeActionResult(action, 'applied', beforeUrl, page.url())],
    description: 'Structured persistent session action observation JSON.'
  });
  const artifacts = [observation.artifact];
  if (payload.screenshot || action.type === 'screenshot' || action.screenshot) {
    artifacts.push(...(await writeScreenshot(`${options.id}-action-${Date.now()}`, 'Full-page screenshot captured from a persistent session action.')).artifacts);
  }
  const actionEntry = {
    at: startedAtAction.toISOString(),
    before_url: redactUrl(beforeUrl),
    after_url: redactUrl(page.url()),
    action: safeActionForLog(action),
    observation_id: observation.id,
    status: 'applied'
  };
  const session = await appendSessionMetadata({
    current_url: page.url(),
    title: observation.data.title,
    observations: [observationRef(observation)],
    action_history: [actionEntry],
    lifecycle: { last_activity_at: new Date().toISOString() }
  });
  return ok({
    session,
    action_result: {
      type: action.type,
      before_url: redactUrl(beforeUrl),
      final_url: redactUrl(page.url()),
      observation_id: observation.id,
      status: 'applied'
    }
  }, artifacts);
}

async function observe(payload) {
  const observation = await writeObservation({
    id: `${options.id}-observe-${Date.now()}`,
    inputUrl: page.url(),
    response: lastResponse,
    actionResults: [],
    description: 'Structured persistent session observation JSON.'
  });
  const artifacts = [observation.artifact];
  if (payload.screenshot) {
    artifacts.push(...(await writeScreenshot(`${options.id}-observe-${Date.now()}`, 'Full-page screenshot captured from a persistent session observation.')).artifacts);
  }
  const session = await appendSessionMetadata({
    current_url: page.url(),
    title: observation.data.title,
    observations: [observationRef(observation)],
    lifecycle: { last_activity_at: new Date().toISOString() }
  });
  return ok({ session, observation: observation.data }, artifacts);
}

async function checkpoint(payload) {
  const timeout = normalizeCommandTimeout(payload.timeout);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const urlOk = payload.untilUrl ? wildcardMatches(payload.untilUrl, page.url()) : true;
    const selectorOk = payload.untilSelector
      ? await page.locator(payload.untilSelector).first().isVisible({ timeout: 250 }).catch(() => false)
      : true;
    if (urlOk && selectorOk) {
      break;
    }
    await sleep(250);
  }
  if (payload.untilUrl && !wildcardMatches(payload.untilUrl, page.url())) {
    return runtimeError('CHECKPOINT_URL_NOT_REACHED', 'The checkpoint URL condition was not reached before timeout.', {
      until_url: payload.untilUrl,
      current_url: page.url()
    });
  }
  if (payload.untilSelector && !(await page.locator(payload.untilSelector).first().isVisible({ timeout: 250 }).catch(() => false))) {
    return runtimeError('CHECKPOINT_SELECTOR_NOT_VISIBLE', 'The checkpoint selector condition was not reached before timeout.', {
      until_selector: payload.untilSelector
    });
  }

  const observation = await writeObservation({
    id: `${options.id}-checkpoint-${payload.name}-${Date.now()}`,
    inputUrl: page.url(),
    response: lastResponse,
    actionResults: [],
    description: 'Structured persistent session checkpoint observation JSON.'
  });
  const checkpointData = {
    schema_version: SCHEMA_VERSION,
    id: `${options.id}-${payload.name}`,
    session: options.id,
    name: payload.name,
    created_at: new Date().toISOString(),
    current_url: redactUrl(page.url()),
    title: observation.data.title,
    conditions: {
      until_url: payload.untilUrl ?? null,
      until_selector: payload.untilSelector ?? null,
      satisfied: true
    },
    observation: {
      id: observation.id,
      path: observation.artifact.path
    },
    boundary: sessionBoundary()
  };
  const checkpointRel = artifactRelPath(options.artifactRoot, 'checkpoints', `${options.id}-${payload.name}.json`);
  await writeJsonArtifact(root, ['checkpoints', `${options.id}-${payload.name}.json`], checkpointData);
  const artifacts = [
    observation.artifact,
    artifactObject({
      type: 'session_checkpoint',
      path: checkpointRel,
      description: 'Manual persistent session checkpoint metadata.'
    })
  ];
  let storageState = null;
  if (payload.exportStorageState) {
    storageState = await exportStorageState(payload.name);
    artifacts.push(storageState.artifact, storageState.receiptArtifact);
  }
  const session = await appendSessionMetadata({
    current_url: page.url(),
    title: observation.data.title,
    observations: [observationRef(observation)],
    checkpoints: [{
      name: payload.name,
      path: checkpointRel,
      observation_id: observation.id,
      storage_state_exported: Boolean(storageState)
    }],
    storage_state: storageState ? { exported: true, last_export_path: storageState.path, values_recorded: false } : null,
    lifecycle: { last_activity_at: new Date().toISOString() }
  });
  return ok({
    session,
    checkpoint: checkpointData,
    storage_state: storageState ? {
      exported: true,
      path: storageState.path,
      values_recorded: false
    } : { exported: false }
  }, artifacts, storageState ? [{
    code: 'STORAGE_STATE_EXPORTED',
    message: 'Storage state was exported only because the explicit flag was supplied. Cookie and token values are not printed.',
    details: { path: storageState.path }
  }] : []);
}

async function review(payload) {
  const observation = await writeObservation({
    id: `${options.id}-review-${Date.now()}`,
    inputUrl: page.url(),
    response: lastResponse,
    actionResults: [],
    description: 'Structured persistent session review observation JSON.'
  });
  const artifacts = [observation.artifact];
  if (payload.screenshot) {
    artifacts.push(...(await writeScreenshot(`${options.id}-review-${Date.now()}`, 'Full-page screenshot captured for persistent session review handoff.')).artifacts);
  }
  const indexId = `${options.id}-session-review`;
  const indexRel = artifactRelPath(options.artifactRoot, 'review-artifacts', `${indexId}.json`);
  const index = {
    schema_version: SCHEMA_VERSION,
    id: indexId,
    mode: 'session_review_handoff',
    local_only: true,
    external_upload: false,
    session: options.id,
    artifact_root: options.artifactRoot,
    evidence_classes: evidenceClasses(artifacts),
    artifacts: artifacts.map((artifact) => ({
      type: artifact.type,
      path: artifact.path,
      description: artifact.description
    })),
    session_context: {
      current_url: redactUrl(page.url()),
      title: observation.data.title,
      manual_checkpoint: options.manualCheckpoint ?? null,
      storage_state_values_recorded: false
    },
    rerun: {
      command: null,
      reason: 'Persistent session review handoff is bound to a live local session state.'
    },
    boundaries: {
      deterministic_review_mutated: false,
      advisory_review_mutated: false,
      visual_review_prepare_compatible: artifacts.some((artifact) => artifact.type === 'visual_evidence'),
      agentic_human_review_input_compatible: true,
      external_upload: false,
      credential_storage: false,
      storage_state_values_recorded: false
    }
  };
  await writeJsonArtifact(root, ['review-artifacts', `${indexId}.json`], index);
  artifacts.push(artifactObject({
    type: 'review_artifact_index',
    path: indexRel,
    description: 'Local persistent session review handoff artifact index.'
  }));
  let report = null;
  if (payload.report) {
    const reportRel = artifactRelPath(options.artifactRoot, 'reports', `${indexId}.md`);
    report = { path: reportRel };
    await writeTextArtifact(root, ['reports', `${indexId}.md`], [
      `# Persistent Session Review Handoff: ${options.id}`,
      '',
      `- Current URL: ${redactUrl(page.url())}`,
      `- Title: ${truncateText(observation.data.title, 200)}`,
      `- Observation: ${observation.artifact.path}`,
      `- Generated: ${new Date().toISOString()}`,
      '',
      'This report is local handoff evidence and does not approve publication, provider transfer, or credential storage.'
    ].join('\n') + '\n');
    artifacts.push(artifactObject({
      type: 'report',
      path: reportRel,
      description: 'Markdown persistent session review handoff report.'
    }));
  }
  const session = await appendSessionMetadata({
    current_url: page.url(),
    title: observation.data.title,
    observations: [observationRef(observation)],
    lifecycle: { last_activity_at: new Date().toISOString() }
  });
  return ok({
    session,
    review_artifact_index: index,
    report
  }, artifacts);
}

async function exportStorageState(name) {
  const safeName = safeIdSegment(name);
  const rel = artifactRelPath(options.artifactRoot, 'auth', `${options.id}-${safeName}.json`);
  const absolute = path.join(root, 'auth', `${options.id}-${safeName}.json`);
  await browserContext.storageState({ path: absolute });
  const receiptRel = artifactRelPath(options.artifactRoot, 'receipts', `${options.id}-${safeName}-storage-state-export.json`);
  const receipt = {
    schema_version: SCHEMA_VERSION,
    id: `${options.id}-${safeName}-storage-state-export`,
    type: 'storage_state_export',
    session: options.id,
    created_at: new Date().toISOString(),
    storage_state_path: rel,
    values_recorded: false,
    boundary: sessionBoundary()
  };
  await writeJsonArtifact(root, ['receipts', `${options.id}-${safeName}-storage-state-export.json`], receipt);
  return {
    path: rel,
    artifact: artifactObject({
      type: 'storage_state',
      path: rel,
      description: 'Local opt-in Playwright storageState file. Cookie and token values are not printed.'
    }),
    receiptArtifact: artifactObject({
      type: 'receipt',
      path: receiptRel,
      description: 'Local storageState export receipt without cookie or token values.'
    })
  };
}

async function writeObservation({ id, inputUrl, response, actionResults, description }) {
  return writePageObservation({
    root,
    artifactRoot: options.artifactRoot,
    id: safeIdSegment(id),
    now: new Date(),
    page,
    inputUrl,
    response,
    browser: {
      engine: 'chromium',
      headless: !options.headed && !options.devtools,
      devtools: Boolean(options.devtools),
      retained_context: true,
      ephemeral_context: true,
      existing_profile_reused: false,
      persistent_storage: false
    },
    consoleMessages: pageEvents.consoleMessages,
    failedRequests: pageEvents.failedRequests,
    actionResults,
    description
  });
}

async function writeScreenshot(id, description) {
  return writePageScreenshotEvidence({
    root,
    artifactRoot: options.artifactRoot,
    id: safeIdSegment(id),
    now: new Date(),
    page,
    description,
    route: page.url(),
    viewport: { width: 1280, height: 720 },
    capture: { persistent_session: true, session: options.id }
  });
}

async function appendSessionMetadata(partial) {
  const current = latestMetadata ?? {};
  const next = redact({
    ...current,
    status: current.status ?? 'running',
    process_status: 'alive',
    updated_at: new Date().toISOString(),
    current_url: redactUrl(partial.current_url ?? current.current_url ?? page.url()),
    title: partial.title ?? current.title ?? null,
    observations: [
      ...(current.observations ?? []),
      ...(partial.observations ?? [])
    ],
    action_history: [
      ...(current.action_history ?? []),
      ...(partial.action_history ?? [])
    ],
    checkpoints: [
      ...(current.checkpoints ?? []),
      ...(partial.checkpoints ?? [])
    ],
    storage_state: partial.storage_state
      ? { ...(current.storage_state ?? {}), ...partial.storage_state }
      : current.storage_state,
    lifecycle: {
      ...(current.lifecycle ?? {}),
      ...(partial.lifecycle ?? {})
    }
  });
  latestMetadata = next;
  await writeJsonArtifact(root, ['sessions', `${options.id}.json`], next);
  return next;
}

async function writeMetadata(partial) {
  const createdAt = latestMetadata?.created_at ?? startedAt.toISOString();
  latestMetadata = redact({
    schema_version: SCHEMA_VERSION,
    id: options.id,
    status: partial.status ?? latestMetadata?.status ?? 'running',
    process_status: partial.process_status ?? latestMetadata?.process_status ?? 'alive',
    pid: process.pid,
    mode: 'persistent_browser_session',
    created_at: createdAt,
    updated_at: partial.updated_at ?? new Date().toISOString(),
    artifact_root: options.artifactRoot,
    current_url: redactUrl(partial.current_url ?? latestMetadata?.current_url ?? options.url ?? 'about:blank'),
    title: partial.title ?? latestMetadata?.title ?? null,
    browser: {
      engine: 'chromium',
      headless: !options.headed && !options.devtools,
      devtools: Boolean(options.devtools),
      retained_context: true,
      ephemeral_context: true,
      existing_profile_reused: false,
      persistent_storage: false,
      storage_state_imported: Boolean(options.storageState)
    },
    control: {
      type: 'local_file_command_queue',
      external_channel: false
    },
    lifecycle: {
      ttl_ms: options.ttl,
      idle_timeout_ms: options.idleTimeout,
      command_timeout_ms: options.timeout,
      started_at: startedAt.toISOString(),
      last_activity_at: partial.lifecycle?.last_activity_at ?? latestMetadata?.lifecycle?.last_activity_at ?? startedAt.toISOString(),
      expires_at: new Date(startedAt.getTime() + options.ttl).toISOString(),
      stop_reason: partial.lifecycle?.stop_reason ?? latestMetadata?.lifecycle?.stop_reason ?? null
    },
    security: {
      origin_allowlist: options.allowedOrigins,
      manual_checkpoint: options.manualCheckpoint ?? null,
      arbitrary_javascript: false,
      oauth_automation: false,
      external_upload: false,
      credential_values_recorded: false,
      cookie_values_recorded: false
    },
    warnings: partial.warnings ?? latestMetadata?.warnings ?? [],
    observations: partial.observations ?? latestMetadata?.observations ?? [],
    action_history: partial.action_history ?? latestMetadata?.action_history ?? [],
    checkpoints: partial.checkpoints ?? latestMetadata?.checkpoints ?? [],
    storage_state: partial.storage_state ?? latestMetadata?.storage_state ?? {
      imported: Boolean(options.storageState),
      exported: false,
      values_recorded: false
    },
    error: partial.error ?? null,
    artifact: artifactRelPath(options.artifactRoot, 'sessions', `${options.id}.json`)
  });
  await writeJsonArtifact(root, ['sessions', `${options.id}.json`], latestMetadata);
}

async function stopSession(status, reason) {
  if (stopping) {
    return ok({ session: latestMetadata }, [sessionArtifact()]);
  }
  stopping = true;
  await browserContext?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await writeMetadata({
    status,
    process_status: 'not_alive',
    current_url: page?.url?.() ?? latestMetadata?.current_url ?? 'about:blank',
    lifecycle: { stop_reason: reason }
  }).catch(() => {});
  const result = ok({ session: latestMetadata }, [sessionArtifact()]);
  setTimeout(() => process.exit(0), 250);
  return result;
}

async function scheduleLifecycleGuards() {
  while (!stopping) {
    const now = Date.now();
    const expiresAt = startedAt.getTime() + options.ttl;
    const lastActivity = Date.parse(latestMetadata?.lifecycle?.last_activity_at ?? startedAt.toISOString());
    if (now >= expiresAt) {
      await stopSession('stopped', 'ttl_expired');
      return;
    }
    if (now - lastActivity >= options.idleTimeout) {
      await stopSession('stopped', 'idle_timeout');
      return;
    }
    await sleep(1000);
  }
}

async function writeError(error) {
  if (!root) {
    root = await ensureArtifactRoot(options.cwd, options.artifactRoot);
  }
  await writeMetadata({
    status: 'error',
    process_status: 'not_alive',
    current_url: options.url ?? 'about:blank',
    error: {
      code: 'SESSION_WORKER_ERROR',
      message: truncateText(error.message, 1000)
    }
  });
}

async function writeCommandResult(commandId, result) {
  await writeJsonArtifact(root, ['session-results', `${commandId}.json`], result);
}

function assertAllowedOrigin(value) {
  const origin = originKey(value);
  if (!options.allowedOrigins.includes(origin)) {
    const error = new Error(`URL origin is not allowed for this session: ${origin}`);
    error.code = 'SESSION_ORIGIN_NOT_ALLOWED';
    throw error;
  }
}

function originKey(value) {
  const url = new URL(value);
  return url.protocol === 'file:' ? 'file:' : url.origin;
}

function safeActionResult(action, status, beforeUrl, afterUrl) {
  return redact({
    type: action.type,
    selector: action.selector ? truncateText(action.selector, 500) : undefined,
    before_url: redactUrl(beforeUrl),
    after_url: redactUrl(afterUrl),
    status
  });
}

function safeActionForLog(action = {}) {
  return redact({
    type: action.type,
    selector: action.selector ? truncateText(action.selector, 500) : undefined,
    key: action.key,
    url: action.url ? redactUrl(action.url) : undefined,
    deltaX: action.deltaX,
    deltaY: action.deltaY,
    ms: action.ms,
    value_recorded: false,
    screenshot: Boolean(action.screenshot)
  });
}

function observationRef(observation) {
  return {
    id: observation.id,
    path: observation.artifact.path
  };
}

function sessionArtifact() {
  return artifactObject({
    type: 'session',
    path: artifactRelPath(options.artifactRoot, 'sessions', `${options.id}.json`),
    description: 'Local persistent browser session metadata.'
  });
}

function ok(data, artifacts = [], warnings = []) {
  return {
    status: 'ok',
    data,
    warnings,
    errors: [],
    artifacts: [sessionArtifact(), ...artifacts]
  };
}

function runtimeError(code, message, details = {}) {
  return {
    status: 'error',
    data: {},
    warnings: [],
    errors: [{
      code,
      message: truncateText(message, 1000),
      details: redact(details)
    }],
    artifacts: [sessionArtifact()]
  };
}

function normalizeCommandTimeout(value) {
  try {
    return normalizeTimeout(value);
  } catch {
    return options.timeout;
  }
}

function wildcardMatches(pattern, value) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(String(value));
}

function evidenceClasses(artifacts) {
  const classes = new Set(['DOM summary', 'console', 'network']);
  for (const artifact of artifacts) {
    if (artifact.type === 'screenshot') {
      classes.add('screenshot');
    }
    if (artifact.type === 'visual_evidence') {
      classes.add('visual evidence metadata');
    }
  }
  return [...classes];
}

function sessionBoundary() {
  return {
    local_only: true,
    external_upload: false,
    arbitrary_javascript: false,
    oauth_automation: false,
    existing_profile_reused: false,
    persistent_browser_profile_reused: false,
    credential_values_recorded: false,
    cookie_values_recorded: false
  };
}

function parseWorkerArgs(argv) {
  const parsed = {
    headed: false,
    devtools: false,
    allowedOrigins: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--headed') {
      parsed.headed = true;
      continue;
    }
    if (token === '--devtools') {
      parsed.devtools = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected session worker argument: ${token}`);
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Session worker option requires a value: ${token}`);
    }
    parsed[key] = value;
    index += 1;
  }
  for (const key of ['id', 'cwd', 'artifactRoot', 'timeout', 'ttl', 'idleTimeout']) {
    if (!parsed[key]) {
      throw new Error(`Session worker missing required option: ${key}`);
    }
  }
  parsed.id = path.basename(parsed.id);
  parsed.timeout = Number.parseInt(parsed.timeout, 10);
  parsed.ttl = Number.parseInt(parsed.ttl, 10);
  parsed.idleTimeout = Number.parseInt(parsed.idleTimeout, 10);
  parsed.allowedOrigins = String(parsed.allowedOrigins || '').split(',').filter(Boolean);
  return parsed;
}

function safeIdSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'session-artifact';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
