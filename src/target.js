import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  writeJsonArtifact
} from './artifacts.js';
import { resolveJsonInput } from './input.js';
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
        'Add pages[].expectations.userQuestions for decisions the intended user must be able to make.',
        'Add pages[].expectations.dataBindings and bounded inline sourceData for important source-to-screen facts.',
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

export async function runTargetValidate(options = {}, context = {}) {
  const manifestResult = await loadTargetManifestForValidation(options, context);
  if (!manifestResult.ok) {
    return failure(manifestResult.error);
  }

  const normalized = normalizeTargetManifest(manifestResult.value);
  if (!normalized.ok) {
    return failure(normalized.error);
  }

  const target = normalized.target;
  const counts = buildTargetValidationCounts(target);
  const authoring = buildManifestAuthoringGuidance(target, counts);
  const targetReference = targetReferenceForCommand(options);
  return {
    status: 'ok',
    data: redact({
      target_manifest: {
        status: 'valid',
        schema_version: SCHEMA_VERSION,
        input_source: manifestResult.source,
        base_url: target.baseUrl,
        route_budget: target.budgets.maxRoutes,
        content_ux_enabled: target.localContentUxAdvisory.enabled,
        counts
      },
      manifest_authoring: authoring,
      next_commands: {
        review_json: `${CLI_NAME} review --target ${targetReference} --json`,
        review_report: `${CLI_NAME} review --target ${targetReference} --report --json`
      },
      boundary: {
        local_first: true,
        browser_launched: false,
        external_upload: false,
        profile_reuse: false,
        source_data_values_exposed: false,
        manifest_mutated: false,
        schema_version: SCHEMA_VERSION
      }
    }),
    warnings: [],
    errors: [],
    artifacts: []
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
        'status_clarity',
        'information_architecture',
        'user_journey',
        'action_clarity',
        'navigation_clarity',
        'decision_support',
        'explanation_clarity'
      ],
      requiredUserQuestions: [],
      reviewBrief: {
        summary: null,
        userRoles: [],
        decisionNeeds: []
      },
      rubric: []
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

async function loadTargetManifestForValidation(options, context) {
  const value = options.input ?? options.target;
  if (
    typeof value === 'string'
    && !value.trim().startsWith('{')
    && !value.trim().startsWith('[')
    && value !== '-'
    && !value.startsWith('@')
  ) {
    return resolveJsonInput(`@${value}`, context, 'target manifest');
  }
  return resolveJsonInput(value, context, 'target manifest');
}

function buildTargetValidationCounts(target) {
  const pages = target.pages ?? [];
  const dataBindings = pages.flatMap((page) => page.expectations?.dataBindings ?? []);
  const pageUserQuestions = pages.flatMap((page) => page.expectations?.userQuestions ?? []);
  const pageTextExpectations = pages.flatMap((page) => page.expectations?.text ?? []);
  const pageSelectorExpectations = pages.flatMap((page) => page.expectations?.selectors ?? []);
  const advisory = target.localContentUxAdvisory;
  return {
    seeds: target.seeds.length,
    expected_routes: target.expectedRoutes.length,
    pages: pages.length,
    viewport_profiles: target.viewportMatrix.length,
    page_text_expectations: pageTextExpectations.length,
    page_selector_expectations: pageSelectorExpectations.length,
    data_bindings: dataBindings.length,
    page_user_questions: pageUserQuestions.length,
    source_data_declared: advisory.sourceData.length,
    source_data_available: advisory.sourceData.filter((source) => source.available).length,
    source_data_external_references_ignored: advisory.sourceData.filter((source) => source.externalReference).length,
    required_user_questions: advisory.requiredUserQuestions.length,
    review_brief_decision_needs: advisory.reviewBrief.decisionNeeds.length,
    rubric_criteria: advisory.rubric.length,
    masks: target.masks.length,
    regions: target.regions.length
  };
}

function buildManifestAuthoringGuidance(target, counts) {
  const suggestions = [];
  if (counts.expected_routes === 0) {
    addSuggestion(suggestions, 'pin_expected_routes', 'info', 'Add expectedRoutes for known important routes that route discovery may not find.');
  }
  if (counts.pages === 0) {
    addSuggestion(suggestions, 'add_named_pages', 'medium', 'Add pages entries for high-value routes that need page-specific expectations.');
  }
  if (counts.page_text_expectations === 0 && counts.page_selector_expectations === 0) {
    addSuggestion(suggestions, 'add_page_expectations', 'info', 'Add page text or selector expectations when reviewed screens have required visible state.');
  }
  if (target.localContentUxAdvisory.enabled) {
    if (target.localContentUxAdvisory.audience.length === 0) {
      addSuggestion(suggestions, 'declare_audience', 'low', 'Declare the intended audience so content UX advisory output has a clear review context.');
    }
    if (!target.localContentUxAdvisory.goal) {
      addSuggestion(suggestions, 'declare_goal', 'low', 'Declare the intended communication goal so advisory output can evaluate user understanding.');
    }
    if (counts.source_data_declared === 0) {
      addSuggestion(suggestions, 'add_source_data', 'medium', 'Add bounded inline sourceData entries before relying on source-to-screen advisory checks.');
    }
    if (counts.source_data_external_references_ignored > 0) {
      addSuggestion(suggestions, 'replace_external_source_references', 'medium', 'Replace external source references with bounded inline sourceData unless a separate approved loader exists.');
    }
    if (counts.data_bindings === 0) {
      addSuggestion(suggestions, 'add_data_bindings', 'medium', 'Add pages[].expectations.dataBindings for source facts that must be represented on screen.');
    }
    if (counts.page_user_questions + counts.required_user_questions === 0) {
      addSuggestion(suggestions, 'add_user_questions', 'medium', 'Add page or advisory user questions for decisions the target user must be able to make.');
    }
    if (counts.review_brief_decision_needs === 0) {
      addSuggestion(suggestions, 'add_review_brief_decision_needs', 'info', 'Add reviewBrief.decisionNeeds when the manifest should evaluate user decision support.');
    }
    if (counts.rubric_criteria === 0) {
      addSuggestion(suggestions, 'add_rubric_criteria', 'info', 'Add rubric criteria when content UX review needs explicit acceptance criteria.');
    }
  } else {
    addSuggestion(suggestions, 'enable_content_ux_advisory_if_needed', 'info', 'Keep localContentUxAdvisory disabled unless this target needs content UX handoff output.');
  }

  return {
    status: suggestions.length > 0 ? 'advisory_notes' : 'ready',
    suggestion_count: suggestions.length,
    suggestions
  };
}

function addSuggestion(suggestions, type, severity, message) {
  suggestions.push({ type, severity, message });
}

function targetReferenceForCommand(options) {
  const value = options.target ?? options.input;
  if (options.input) {
    return '<manifest>';
  }
  if (typeof value !== 'string') {
    return '<manifest>';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return '<manifest>';
  }
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  return `@${trimmed}`;
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
