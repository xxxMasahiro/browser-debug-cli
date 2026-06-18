import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import { normalizeTimeout, validateUrl } from './observe.js';
import { normalizeTargetManifest } from './review.js';
import { redact } from './redaction.js';

const DEFAULT_INIT_ROUTE_BUDGET = 50;

export async function runTargetInit(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const now = materializeNow(context.now);
  const id = context.createId?.('target', now) ?? createArtifactId(now, 'target');
  const urlError = validateUrl(options.url);
  if (urlError) {
    return failure(urlError);
  }
  try {
    normalizeTimeout(options.timeout);
  } catch (error) {
    return failure({
      code: 'INVALID_TIMEOUT',
      message: error.message,
      details: { timeout: options.timeout }
    });
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

  const manifest = createTargetManifest(options);
  const normalized = normalizeTargetManifest(manifest);
  if (!normalized.ok) {
    return failure(normalized.error);
  }

  const rel = artifactRelPath(artifactRootInput, 'targets', `${id}.json`);
  await writeJsonArtifact(root, ['targets', `${id}.json`], manifest);
  return {
    status: 'ok',
    data: redact({
      target_manifest: manifest,
      normalized_preview: normalized.target,
      next_commands: {
        review_json: `${CLI_NAME} review --target @${rel} --json`,
        review_report: `${CLI_NAME} review --target @${rel} --report --json`
      },
      usage_notes: [
        'Edit expectedRoutes when the application has known routes that must be covered.',
        'Raise budgets.maxRoutes for larger applications.',
        'Keep credentials, cookies, storage state, and private browser profiles out of manifests.'
      ],
      boundary: {
        local_first: true,
        external_upload: false,
        profile_reuse: false,
        schema_version: SCHEMA_VERSION
      }
    }),
    warnings: [],
    errors: [],
    artifacts: [artifactObject({
      type: 'target_manifest',
      path: rel,
      description: 'Generated local target manifest for review --target.'
    })]
  };
}

export function createTargetManifest(options = {}) {
  const baseUrl = new URL(options.url).toString();
  const maxRoutes = clampNumber(options['max-routes'], 1, 200, DEFAULT_INIT_ROUTE_BUDGET);
  return {
    schemaVersion: SCHEMA_VERSION,
    name: options.name || 'browser-debug-target',
    baseUrl,
    scope: {
      sameOrigin: true,
      include: [],
      exclude: []
    },
    seeds: [baseUrl],
    expectedRoutes: [],
    pages: [],
    sourceData: [],
    localContentUxAdvisory: {
      enabled: false,
      audience: [],
      goal: null,
      checks: [
        'content_contract',
        'source_data_alignment',
        'selector_scoped_state',
        'information_architecture',
        'user_journey'
      ],
      requiredUserQuestions: []
    },
    viewportMatrix: options.viewport ? [options.viewport] : ['desktop', 'mobile'],
    actionPolicy: {
      allow: ['navigation', 'state_revealing']
    },
    budgets: {
      maxRoutes
    },
    artifacts: {
      screenshots: true
    },
    masks: [],
    regions: [],
    appHints: {
      reviewGoal: 'full_app_first_pass',
      notes: []
    }
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function failure(error) {
  return {
    status: 'error',
    data: {},
    warnings: [],
    errors: [{ ...error, details: error.details ?? {} }],
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
