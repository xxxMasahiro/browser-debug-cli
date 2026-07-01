import path from 'node:path';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  readJsonArtifact,
  writeJsonArtifact,
  writeTextArtifact
} from './artifacts.js';
import { runObserve, validateUrl } from './observe.js';
import { resolveJsonInput } from './input.js';
import { redact, redactUrl, truncateText } from './redaction.js';
import {
  checkpointPersistentBrowserSession,
  isPersistentSessionMetadata,
  observePersistentBrowserSession,
  persistentSessionStatus,
  reviewPersistentBrowserSession,
  runPersistentSessionAction,
  startPersistentBrowserSession,
  stopPersistentBrowserSession
} from './browser-session-manager.js';

export async function startSession(options = {}, context = {}) {
  if (requiresPersistentSession(options)) {
    return startPersistentBrowserSession(options, context);
  }
  const cwd = context.cwd ?? process.cwd();
  const artifactRoot = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('session', now) ?? createArtifactId(now, 'session');
  const root = await ensureArtifactRoot(cwd, artifactRoot);
  const session = {
    schema_version: SCHEMA_VERSION,
    id,
    status: 'open',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    artifact_root: artifactRoot,
    current_url: null,
    observations: [],
    action_history: []
  };

  const artifacts = [];
  const warnings = [];
  if (options.url) {
    const observeRunner = context.observeRunner ?? runObserve;
    const observed = await observeRunner(options, {
      ...context,
      cwd,
      createId: context.createId
    });
    warnings.push(...observed.warnings);
    if (observed.status !== 'ok') {
      return observed;
    }
    session.current_url = observed.data.final_url;
    session.observations.push({
      id: observed.data.id,
      path: observed.artifacts.find((artifact) => artifact.type === 'observation')?.path ?? null
    });
    artifacts.push(...observed.artifacts);
  }

  await writeSession(root, session);
  artifacts.push(sessionArtifact(artifactRoot, id));

  return {
    status: 'ok',
    data: { session },
    warnings,
    errors: [],
    artifacts
  };
}

export async function closeSession(options = {}, context = {}) {
  const { root, artifactRoot, session } = await loadSessionFromOptions(options, context);
  if (isPersistentSessionMetadata(session)) {
    return stopPersistentBrowserSession(options, context);
  }
  session.status = 'closed';
  session.updated_at = materializeNow(context.now).toISOString();
  await writeSession(root, session);
  return {
    status: 'ok',
    data: { session },
    warnings: [],
    errors: [],
    artifacts: [sessionArtifact(artifactRoot, session.id)]
  };
}

export async function statusSession(options = {}, context = {}) {
  return persistentSessionStatus(options, context);
}

export async function stopSession(options = {}, context = {}) {
  return stopPersistentBrowserSession(options, context);
}

export async function runSessionAction(options = {}, context = {}) {
  const { root, artifactRoot, session } = await loadSessionFromOptions(options, context);
  if (isPersistentSessionMetadata(session)) {
    return runPersistentSessionAction(options, context);
  }
  if (session.status !== 'open') {
    return sessionError('SESSION_CLOSED', 'The session is closed.', { session: session.id });
  }

  const action = await parseAction(options.action ?? options.input, context);
  if (!action.ok) {
    return sessionError(action.code, action.message, action.details);
  }

  const now = materializeNow(context.now);
  const actionEntry = {
    at: now.toISOString(),
    action: safeActionForLog(action.value)
  };

  let observed = null;
  if (action.value.type === 'navigate') {
    const urlError = validateUrl(action.value.url);
    if (urlError) {
      return sessionError(urlError.code, urlError.message, urlError.details);
    }
    observed = await observe(options, context, {
      ...options,
      url: action.value.url,
      screenshot: options.screenshot || action.value.screenshot
    });
  } else if (action.value.type === 'observe' || action.value.type === 'screenshot') {
    if (!session.current_url) {
      return sessionError('SESSION_URL_REQUIRED', 'The session has no current URL. Navigate first.', { session: session.id });
    }
    observed = await observe(options, context, {
      ...options,
      url: session.current_url,
      screenshot: options.screenshot || action.value.type === 'screenshot'
    });
  } else {
    if (!session.current_url) {
      return sessionError('SESSION_URL_REQUIRED', 'The session has no current URL. Navigate first.', { session: session.id });
    }
    observed = await observe(options, {
      ...context,
      actions: [action.value]
    }, {
      ...options,
      url: session.current_url,
      screenshot: options.screenshot || action.value.screenshot
    });
  }

  if (observed.status !== 'ok') {
    return observed;
  }

  session.current_url = observed.data.final_url;
  session.updated_at = now.toISOString();
  session.action_history.push(actionEntry);
  session.observations.push({
    id: observed.data.id,
    path: observed.artifacts.find((artifact) => artifact.type === 'observation')?.path ?? null
  });
  await writeSession(root, session);

  return {
    status: 'ok',
    data: {
      session,
      action_result: {
        type: action.value.type,
        final_url: session.current_url,
        observation_id: observed.data.id
      }
    },
    warnings: observed.warnings,
    errors: [],
    artifacts: [...observed.artifacts, sessionArtifact(artifactRoot, session.id)]
  };
}

export async function observeSession(options = {}, context = {}) {
  return observePersistentBrowserSession(options, context);
}

export async function checkpointSession(options = {}, context = {}) {
  return checkpointPersistentBrowserSession(options, context);
}

export async function reviewSession(options = {}, context = {}) {
  return reviewPersistentBrowserSession(options, context);
}

export async function buildReport(options = {}, context = {}) {
  const { root, artifactRoot, session } = await loadSessionFromOptions(options, context);
  const now = materializeNow(context.now);
  const reportRel = artifactRelPath(artifactRoot, 'reports', `${session.id}.md`);
  const content = [
    `# TraceCue Report: ${session.id}`,
    '',
    `- Status: ${session.status}`,
    `- Current URL: ${session.current_url ?? 'none'}`,
    `- Observations: ${session.observations.length}`,
    `- Actions: ${session.action_history.length}`,
    `- Generated: ${now.toISOString()}`,
    '',
    '## Action History',
    '',
    ...session.action_history.map((entry, index) => `${index + 1}. ${entry.at}: ${JSON.stringify(redact(entry.action))}`),
    '',
    '## Observation Artifacts',
    '',
    ...session.observations.map((observation) => `- ${observation.path ?? observation.id}`)
  ].join('\n');
  await writeTextArtifact(root, ['reports', `${session.id}.md`], `${content}\n`);
  return {
    status: 'ok',
    data: { report: { session: session.id, path: reportRel } },
    warnings: [],
    errors: [],
    artifacts: [artifactObject({ type: 'report', path: reportRel, description: 'Markdown browser debug report.' })]
  };
}

function requiresPersistentSession(options = {}) {
  return Boolean(
    options.ttl
    || options['idle-timeout']
    || options['manual-checkpoint']
    || options['storage-state']
    || options['origin-allowlist']
  );
}

export async function exportSpec(options = {}, context = {}) {
  const { root, artifactRoot, session } = await loadSessionFromOptions(options, context);
  const specRel = artifactRelPath(artifactRoot, 'specs', `${session.id}.json`);
  const spec = redact({
    schema_version: SCHEMA_VERSION,
    session: session.id,
    current_url: session.current_url,
    status: session.status,
    generated_at: materializeNow(context.now).toISOString(),
    steps: session.action_history.map((entry) => ({
      at: entry.at,
      action: safeActionForLog(entry.action)
    })),
    observations: session.observations
  });
  await writeJsonArtifact(root, ['specs', `${session.id}.json`], spec);
  return {
    status: 'ok',
    data: { spec },
    warnings: [],
    errors: [],
    artifacts: [artifactObject({ type: 'spec', path: specRel, description: 'JSON action/spec export.' })]
  };
}

function safeActionForLog(action = {}) {
  return redact({
    type: action.type,
    selector: action.selector,
    key: action.key,
    url: action.url ? redactUrl(action.url) : undefined,
    deltaX: action.deltaX,
    deltaY: action.deltaY,
    ms: action.ms,
    value_recorded: false,
    screenshot: Boolean(action.screenshot)
  });
}

async function parseAction(value, context) {
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
  if (!action.type || typeof action.type !== 'string') {
    return {
      ok: false,
      code: 'INVALID_ACTION_TYPE',
      message: 'Action requires a string type.',
      details: {}
    };
  }
  return { ok: true, value: action };
}

function observe(_baseOptions, context, observeOptions) {
  const observeRunner = context.observeRunner ?? runObserve;
  return observeRunner(observeOptions, context);
}

async function loadSessionFromOptions(options, context) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRoot = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const root = await ensureArtifactRoot(cwd, artifactRoot);
  const sessionId = path.basename(options.session);
  const session = await readJsonArtifact(root, ['sessions', `${sessionId}.json`]);
  return { root, artifactRoot, session };
}

async function writeSession(root, session) {
  await writeJsonArtifact(root, ['sessions', `${session.id}.json`], redact(session));
}

function sessionArtifact(artifactRoot, id) {
  return artifactObject({
    type: 'session',
    path: artifactRelPath(artifactRoot, 'sessions', `${id}.json`),
    description: 'Local browser debug session metadata.'
  });
}

function sessionError(code, message, details) {
  return {
    status: 'error',
    data: {},
    warnings: [],
    errors: [{ code, message: truncateText(message, 1000), details: redact(details ?? {}) }],
    artifacts: []
  };
}

function materializeNow(now) {
  if (!now) {
    return new Date();
  }
  const value = typeof now === 'function' ? now() : now;
  return value instanceof Date ? value : new Date(value);
}
