import { spawn as defaultSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  readJsonArtifact,
  resolveArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import { parseDurationMs } from './durations.js';
import { normalizeTimeout, validateUrl } from './observe.js';
import { redact, redactUrl, truncateText } from './redaction.js';

const SESSION_READY_TIMEOUT_MS = 10000;
const SESSION_RESULT_POLL_MS = 100;
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SESSION_IDLE_MS = 10 * 60 * 1000;

export async function startPersistentBrowserSession(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRoot = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('session', now) ?? createArtifactId(now, 'session');

  let timeout;
  let ttlMs;
  let idleTimeoutMs;
  try {
    timeout = normalizeTimeout(options.timeout);
    ttlMs = parseDurationMs(options.ttl, {
      name: 'ttl',
      defaultMs: DEFAULT_SESSION_TTL_MS,
      minMs: 1000,
      maxMs: 24 * 60 * 60 * 1000
    });
    idleTimeoutMs = parseDurationMs(options['idle-timeout'], {
      name: 'idle-timeout',
      defaultMs: Math.min(DEFAULT_SESSION_IDLE_MS, ttlMs),
      minMs: 1000,
      maxMs: ttlMs
    });
  } catch (error) {
    return sessionError('INVALID_SESSION_LIFECYCLE', error.message, {
      ttl: options.ttl,
      idle_timeout: options['idle-timeout'],
      timeout: options.timeout
    });
  }

  if (options['manual-checkpoint'] && !options.headed && !options.devtools) {
    return sessionError('MANUAL_CHECKPOINT_REQUIRES_HEADED', 'Manual checkpoints require a headed or devtools browser session.', {
      manual_checkpoint: options['manual-checkpoint']
    });
  }

  if (!options.url && !options['storage-state']) {
    return sessionError('SESSION_URL_REQUIRED', 'Persistent session start requires --url unless --storage-state is supplied.', {
      option: 'url'
    });
  }
  if (options.url) {
    const urlError = validateUrl(options.url);
    if (urlError) {
      return sessionError(urlError.code, urlError.message, urlError.details);
    }
  }

  let root;
  let storageStatePath = null;
  try {
    root = await ensureArtifactRoot(cwd, artifactRoot);
    if (options['storage-state']) {
      storageStatePath = resolveStorageStatePath(cwd, artifactRoot, options['storage-state']);
    }
  } catch (error) {
    return sessionError('SESSION_ARTIFACT_ROOT_INVALID', error.message, {
      artifact_root: artifactRoot,
      storage_state: options['storage-state'] ? '[path]' : null
    });
  }

  const allowedOrigins = buildAllowedOrigins(options);
  const warnings = [];
  if (storageStatePath) {
    warnings.push({
      code: 'STORAGE_STATE_IMPORT_OPT_IN',
      message: 'A storageState file was supplied explicitly. Cookie and token values are not printed and the file must remain local.',
      details: { storage_state_path: storageStatePath.relative }
    });
  }
  if (!options.url && allowedOrigins.length === 0) {
    warnings.push({
      code: 'SESSION_NAVIGATION_REQUIRES_ORIGIN_ALLOWLIST',
      message: 'This imported session starts at about:blank; later navigation requires an explicit origin allowlist.',
      details: {}
    });
  }

  const metadata = sessionMetadata({
    id,
    status: 'starting',
    processStatus: 'starting',
    pid: null,
    artifactRoot,
    now,
    url: options.url ?? 'about:blank',
    ttlMs,
    idleTimeoutMs,
    timeout,
    headed: Boolean(options.headed),
    devtools: Boolean(options.devtools),
    manualCheckpoint: options['manual-checkpoint'] ?? null,
    allowedOrigins,
    storageStateImported: Boolean(storageStatePath)
  });
  await writeJsonArtifact(root, ['sessions', `${id}.json`], metadata);
  await mkdir(path.join(root, 'session-commands', id), { recursive: true });

  const workerPath = fileURLToPath(new URL('./browser-session-worker.js', import.meta.url));
  const args = [
    workerPath,
    '--id',
    id,
    '--cwd',
    cwd,
    '--artifact-root',
    artifactRoot,
    '--timeout',
    String(timeout),
    '--ttl',
    String(ttlMs),
    '--idle-timeout',
    String(idleTimeoutMs),
    '--allowed-origins',
    allowedOrigins.join(',')
  ];
  if (options.url) {
    args.push('--url', options.url);
  }
  if (options.headed) {
    args.push('--headed');
  }
  if (options.devtools) {
    args.push('--devtools');
  }
  if (options['manual-checkpoint']) {
    args.push('--manual-checkpoint', String(options['manual-checkpoint']));
  }
  if (storageStatePath) {
    args.push('--storage-state', storageStatePath.absolute);
  }

  const spawn = context.spawn ?? defaultSpawn;
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      TRACE_CUE_SESSION_WORKER: '1'
    }
  });
  child.unref?.();
  metadata.pid = child.pid ?? null;
  metadata.process_status = 'alive';
  metadata.updated_at = materializeNow(context.now).toISOString();
  await writeJsonArtifact(root, ['sessions', `${id}.json`], redact(metadata));

  const ready = await waitForSessionState(root, id, ['running', 'error', 'stopped'], SESSION_READY_TIMEOUT_MS);
  if (!ready || ready.status !== 'running') {
    const latest = ready ?? await readSessionMetadata(root, id).catch(() => metadata);
    return sessionError('SESSION_START_FAILED', 'The persistent browser session did not become ready.', {
      session: id,
      status: latest.status,
      process_status: latest.process_status,
      pid: latest.pid,
      error: latest.error ?? null
    }, [sessionArtifact(artifactRoot, id)]);
  }

  return {
    status: 'ok',
    data: { session: redact(ready) },
    warnings,
    errors: [],
    artifacts: [sessionArtifact(artifactRoot, id)]
  };
}

export async function persistentSessionStatus(options = {}, context = {}) {
  const loaded = await loadPersistentSession(options, context);
  if (!loaded.ok) {
    return loaded.error;
  }
  const { root, artifactRoot, id, session } = loaded;
  const alive = isProcessAlive(session.pid);
  const updated = {
    ...session,
    process_status: alive ? 'alive' : 'not_alive',
    status: session.status === 'running' && !alive ? 'exited' : session.status,
    updated_at: materializeNow(context.now).toISOString()
  };
  if (updated.status !== session.status || updated.process_status !== session.process_status) {
    await writeJsonArtifact(root, ['sessions', `${id}.json`], redact(updated));
  }
  return {
    status: 'ok',
    data: { session: redact(updated) },
    warnings: [],
    errors: [],
    artifacts: [sessionArtifact(artifactRoot, id)]
  };
}

export async function stopPersistentBrowserSession(options = {}, context = {}) {
  return sendPersistentSessionCommand('stop', options, context, {});
}

export async function runPersistentSessionAction(options = {}, context = {}) {
  const action = await parseActionInput(options.action ?? options.input, context);
  if (!action.ok) {
    return sessionError(action.code, action.message, action.details);
  }
  return sendPersistentSessionCommand('act', options, context, {
    action: action.value,
    screenshot: Boolean(options.screenshot),
    timeout: options.timeout
  });
}

export async function observePersistentBrowserSession(options = {}, context = {}) {
  return sendPersistentSessionCommand('observe', options, context, {
    screenshot: Boolean(options.screenshot),
    timeout: options.timeout
  });
}

export async function checkpointPersistentBrowserSession(options = {}, context = {}) {
  if (!options.name) {
    return sessionError('CHECKPOINT_NAME_REQUIRED', 'session checkpoint requires --name <name>.', {
      option: 'name'
    });
  }
  return sendPersistentSessionCommand('checkpoint', options, context, {
    name: safeIdSegment(options.name),
    untilUrl: options['until-url'] ?? null,
    untilSelector: options['until-selector'] ?? null,
    exportStorageState: Boolean(options['export-storage-state']),
    timeout: options.timeout
  });
}

export async function reviewPersistentBrowserSession(options = {}, context = {}) {
  return sendPersistentSessionCommand('review', options, context, {
    screenshot: Boolean(options.screenshot),
    report: Boolean(options.report),
    timeout: options.timeout
  });
}

export function isPersistentSessionMetadata(session) {
  return session?.mode === 'persistent_browser_session';
}

async function sendPersistentSessionCommand(type, options, context, payload) {
  const loaded = await loadPersistentSession(options, context);
  if (!loaded.ok) {
    return loaded.error;
  }
  const { root, artifactRoot, id, session } = loaded;
  if (session.status !== 'running') {
    return sessionError('SESSION_NOT_RUNNING', 'The persistent session is not running.', {
      session: id,
      status: session.status
    }, [sessionArtifact(artifactRoot, id)]);
  }
  if (!isProcessAlive(session.pid)) {
    const updated = {
      ...session,
      status: 'exited',
      process_status: 'not_alive',
      updated_at: materializeNow(context.now).toISOString()
    };
    await writeJsonArtifact(root, ['sessions', `${id}.json`], redact(updated));
    return sessionError('SESSION_PROCESS_NOT_ALIVE', 'The persistent session process is no longer alive.', {
      session: id,
      pid: session.pid
    }, [sessionArtifact(artifactRoot, id)]);
  }

  const now = materializeNow(context.now);
  const commandId = context.createId?.('session-command', now) ?? `session-command-${now.toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const command = {
    schema_version: SCHEMA_VERSION,
    id: commandId,
    session: id,
    type,
    created_at: now.toISOString(),
    payload
  };
  const commandDir = path.join(root, 'session-commands', id);
  await mkdir(commandDir, { recursive: true });
  const tmpPath = path.join(commandDir, `${commandId}.tmp`);
  const commandPath = path.join(commandDir, `${commandId}.json`);
  await writeFile(tmpPath, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
  await rename(tmpPath, commandPath);

  const commandTimeout = commandWaitTimeout(payload.timeout);
  const result = await waitForCommandResult(root, commandId, commandTimeout);
  if (!result) {
    await rm(commandPath, { force: true }).catch(() => {});
    return sessionError('SESSION_COMMAND_TIMEOUT', 'The persistent session command did not finish before the timeout.', {
      session: id,
      command: type,
      timeout_ms: commandTimeout
    }, [sessionArtifact(artifactRoot, id)]);
  }
  return result;
}

async function loadPersistentSession(options, context) {
  try {
    const cwd = context.cwd ?? process.cwd();
    const artifactRoot = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
    const root = await ensureArtifactRoot(cwd, artifactRoot);
    const id = path.basename(options.session ?? '');
    if (!id) {
      return {
        ok: false,
        error: sessionError('SESSION_ID_REQUIRED', 'A session id is required.', { option: 'session' })
      };
    }
    const session = await readSessionMetadata(root, id);
    if (!isPersistentSessionMetadata(session)) {
      return {
        ok: false,
        error: sessionError('SESSION_NOT_PERSISTENT', 'The session metadata is not a persistent browser session.', {
          session: id,
          mode: session.mode ?? null
        }, [sessionArtifact(artifactRoot, id)])
      };
    }
    return { ok: true, root, artifactRoot, id, session };
  } catch {
    return {
      ok: false,
      error: sessionError('SESSION_NOT_FOUND', 'Session metadata was not found.', {
        session: options.session
      })
    };
  }
}

async function parseActionInput(value, context) {
  const { resolveJsonInput } = await import('./input.js');
  const resolved = await resolveJsonInput(value, context, 'action');
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.error.code,
      message: resolved.error.message,
      details: resolved.error.details
    };
  }
  const action = resolved.value;
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return {
      ok: false,
      code: 'INVALID_ACTION',
      message: 'Action must be a JSON object.',
      details: {}
    };
  }
  const allowed = new Set(['click', 'fill', 'select', 'press', 'scroll', 'wait', 'observe', 'screenshot', 'navigate']);
  if (!allowed.has(action.type)) {
    return {
      ok: false,
      code: 'INVALID_ACTION_TYPE',
      message: `Unsupported action type: ${action.type}.`,
      details: { supported_types: [...allowed] }
    };
  }
  return { ok: true, value: action };
}

function sessionMetadata({
  id,
  status,
  processStatus,
  pid,
  artifactRoot,
  now,
  url,
  ttlMs,
  idleTimeoutMs,
  timeout,
  headed,
  devtools,
  manualCheckpoint,
  allowedOrigins,
  storageStateImported
}) {
  const startedAt = now.toISOString();
  return redact({
    schema_version: SCHEMA_VERSION,
    id,
    status,
    process_status: processStatus,
    pid,
    mode: 'persistent_browser_session',
    created_at: startedAt,
    updated_at: startedAt,
    artifact_root: artifactRoot,
    current_url: redactUrl(url),
    browser: {
      engine: 'chromium',
      headless: !headed && !devtools,
      devtools,
      retained_context: true,
      ephemeral_context: true,
      existing_profile_reused: false,
      persistent_storage: false,
      storage_state_imported: storageStateImported
    },
    control: {
      type: 'local_file_command_queue',
      external_channel: false
    },
    lifecycle: {
      ttl_ms: ttlMs,
      idle_timeout_ms: idleTimeoutMs,
      command_timeout_ms: timeout,
      started_at: startedAt,
      last_activity_at: startedAt,
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      stop_reason: null
    },
    security: {
      origin_allowlist: allowedOrigins,
      manual_checkpoint: manualCheckpoint,
      arbitrary_javascript: false,
      oauth_automation: false,
      external_upload: false,
      credential_values_recorded: false,
      cookie_values_recorded: false
    },
    observations: [],
    action_history: [],
    checkpoints: [],
    storage_state: {
      imported: storageStateImported,
      exported: false,
      values_recorded: false
    },
    artifact: artifactRelPath(artifactRoot, 'sessions', `${id}.json`)
  });
}

function buildAllowedOrigins(options) {
  const origins = [];
  if (options.url) {
    origins.push(originKey(options.url));
  }
  for (const item of String(options['origin-allowlist'] ?? '').split(',')) {
    const trimmed = item.trim();
    if (!trimmed || trimmed === '*') {
      continue;
    }
    origins.push(originKey(trimmed));
  }
  return [...new Set(origins.filter(Boolean))];
}

function originKey(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'file:' ? 'file:' : url.origin;
  } catch {
    return String(value).trim();
  }
}

function resolveStorageStatePath(cwd, artifactRoot, input) {
  const root = resolveArtifactRoot(cwd, artifactRoot);
  const authRoot = path.join(root, 'auth');
  const absolute = path.resolve(cwd, String(input));
  if (absolute !== authRoot && !absolute.startsWith(`${authRoot}${path.sep}`)) {
    throw new Error('storage-state must point to a file under the configured artifact auth directory.');
  }
  return {
    absolute,
    relative: artifactRelPath(artifactRoot, 'auth', path.relative(authRoot, absolute).replace(/\\/g, '/'))
  };
}

function commandWaitTimeout(value) {
  try {
    return normalizeTimeout(value);
  } catch {
    return 120000;
  }
}

async function waitForSessionState(root, id, states, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const metadata = await readSessionMetadata(root, id).catch(() => null);
    if (metadata && states.includes(metadata.status)) {
      return metadata;
    }
    await sleep(SESSION_RESULT_POLL_MS);
  }
  return null;
}

async function waitForCommandResult(root, commandId, timeoutMs) {
  const resultPath = path.join(root, 'session-results', `${commandId}.json`);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return JSON.parse(await readFile(resultPath, 'utf8'));
    } catch {
      await sleep(SESSION_RESULT_POLL_MS);
    }
  }
  return null;
}

function readSessionMetadata(root, id) {
  return readJsonArtifact(root, ['sessions', `${path.basename(id)}.json`]);
}

function sessionArtifact(artifactRoot, id) {
  return artifactObject({
    type: 'session',
    path: artifactRelPath(artifactRoot, 'sessions', `${id}.json`),
    description: 'Local persistent browser session metadata.'
  });
}

function sessionError(code, message, details = {}, artifacts = []) {
  return {
    status: 'error',
    data: {},
    warnings: [],
    errors: [{
      code,
      message: truncateText(message, 1000),
      details: redact(details)
    }],
    artifacts
  };
}

function safeIdSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'checkpoint';
}

function isProcessAlive(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function materializeNow(now) {
  if (!now) {
    return new Date();
  }
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value : new Date(value);
}
