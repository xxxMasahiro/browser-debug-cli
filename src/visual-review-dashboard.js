import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { artifactRelPath, resolveArtifactRoot } from './artifacts.js';
import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import { resolveLanguageSettings } from './language-settings.js';
import { redact, truncateText } from './redaction.js';

const DEFAULT_DASHBOARD_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_DASHBOARD_LIMIT = 50;

export async function runVisualReviewDashboard(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = currentDate(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const maxBytes = parsePositiveInteger(options['max-bytes'], DEFAULT_DASHBOARD_MAX_BYTES, 'visual review dashboard --max-bytes');
  if (!maxBytes.ok) {
    return errorResult('VISUAL_REVIEW_DASHBOARD_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const limit = parsePositiveInteger(options.limit, DEFAULT_DASHBOARD_LIMIT, 'visual review dashboard --limit');
  if (!limit.ok) {
    return errorResult('VISUAL_REVIEW_DASHBOARD_INVALID_LIMIT', limit.message, { limit: options.limit });
  }

  let root;
  try {
    root = resolveArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return errorResult('ARTIFACT_ROOT_INVALID', error.message, { artifact_root: artifactRootInput });
  }

  const scan = await readVisualReviewArtifactSets({
    root,
    artifactRootInput,
    maxBytes: maxBytes.value,
    limit: limit.value
  });
  const language = await resolveLanguageSettings({}, context);
  if (!language.ok) {
    return errorResult(language.code, language.message, language.details);
  }
  const dashboard = buildDashboard({
    now,
    artifactRootInput,
    artifactSets: scan.artifactSets,
    limit: limit.value,
    languageSettings: language.settings
  });

  return {
    status: 'ok',
    data: {
      visual_review_dashboard: dashboard,
      boundary: dashboard.boundary
    },
    warnings: [...scan.warnings, ...language.warnings],
    errors: [],
    artifacts: []
  };
}

export function visualReviewDashboardBoundary() {
  return {
    local_only: true,
    read_only: true,
    browser_launched: false,
    writes_artifacts: false,
    deletes_files: false,
    provider_call_performed: false,
    api_call_performed: false,
    automatic_upload: false,
    external_evidence_transfer: false,
    raw_pixels_included: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    raw_artifact_content_included: false,
    raw_provider_response_stored: false,
    credential_values_recorded: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false,
    mcp_write_execute_exposed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

async function readVisualReviewArtifactSets({ root, artifactRootInput, maxBytes, limit }) {
  const artifactSets = [];
  const warnings = [];
  let entries;
  try {
    entries = await readdir(path.join(root, 'visual-review-results'), { withFileTypes: true });
  } catch {
    return { artifactSets, warnings };
  }

  for (const entry of entries.filter((item) => item.isDirectory()).slice(0, limit)) {
    const dirPath = path.join(root, 'visual-review-results', entry.name);
    const relBase = artifactRelPath(artifactRootInput, 'visual-review-results', entry.name);
    const [preparation, execution, result] = await Promise.all([
      readOptionalJson(path.join(dirPath, 'preparation.json'), `${relBase}/preparation.json`, 'visual_review_preparation', maxBytes),
      readOptionalJson(path.join(dirPath, 'execution.json'), `${relBase}/execution.json`, 'visual_review_execution', maxBytes),
      readOptionalJson(path.join(dirPath, 'result.json'), `${relBase}/result.json`, 'visual_review_result', maxBytes)
    ]);
    for (const item of [preparation, execution, result]) {
      if (item.warning) {
        warnings.push(item.warning);
      }
    }
    if (preparation.record || execution.record || result.record) {
      artifactSets.push({
        id: entry.name,
        path: relBase,
        preparation: preparation.record,
        execution: execution.record,
        result: result.record
      });
    }
  }
  return { artifactSets, warnings };
}

async function readOptionalJson(filePath, relPath, kind, maxBytes) {
  try {
    const stat = await lstat(filePath);
    if (!stat.isFile()) {
      return {
        record: null,
        warning: {
          code: 'VISUAL_REVIEW_DASHBOARD_ARTIFACT_NOT_FILE',
          message: 'A visual review dashboard artifact path is not a regular file and was skipped.',
          details: { path: relPath, kind }
        }
      };
    }
    if (stat.size > maxBytes) {
      return {
        record: null,
        warning: {
          code: 'VISUAL_REVIEW_DASHBOARD_ARTIFACT_TOO_LARGE',
          message: 'A visual review dashboard artifact exceeded the configured byte limit and was skipped.',
          details: { path: relPath, kind, bytes: stat.size, max_bytes: maxBytes }
        }
      };
    }
    const text = await readFile(filePath, 'utf8');
    return { record: summarizeRecord(JSON.parse(text), relPath, kind), warning: null };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { record: null, warning: null };
    }
    return {
      record: null,
      warning: {
        code: 'VISUAL_REVIEW_DASHBOARD_ARTIFACT_READ_FAILED',
        message: 'A visual review dashboard artifact could not be read and was skipped.',
        details: { path: relPath, kind, reason: error.message }
      }
    };
  }
}

function summarizeRecord(record, relPath, kind) {
  if (kind === 'visual_review_preparation') {
    return {
      kind,
      path: relPath,
      id: stringOrNull(record.id),
      status: stringOrNull(record.status),
      created_at: stringOrNull(record.created_at),
      visual_evidence: {
        status: stringOrNull(record.visual_evidence?.status),
        readable_count: numberOrZero(record.visual_evidence?.readable_count),
        unreadable_count: numberOrZero(record.visual_evidence?.unreadable_count),
        metadata_only: record.visual_evidence?.metadata_only !== false
      },
      provider: {
        id: stringOrNull(record.provider_policy?.provider?.id),
        model_id: stringOrNull(record.provider_policy?.model?.id),
        surface_id: stringOrNull(record.provider_policy?.surface?.id)
      },
      boundary: safeBoundarySummary(record.boundary)
    };
  }
  if (kind === 'visual_review_execution') {
    return {
      kind,
      path: relPath,
      id: stringOrNull(record.id),
      status: stringOrNull(record.status),
      created_at: stringOrNull(record.created_at),
      completed_at: stringOrNull(record.completed_at),
      preparation_id: stringOrNull(record.preparation_id),
      preparation_path: stringOrNull(record.preparation_path),
      result_path: stringOrNull(record.result_path),
      provider: {
        id: stringOrNull(record.provider?.id),
        kind: stringOrNull(record.provider?.kind),
        model_id: stringOrNull(record.model?.id),
        surface_id: stringOrNull(record.surface?.id)
      },
      effects: {
        provider_call_performed: Boolean(record.provider_call_performed),
        api_call_performed: Boolean(record.api_call_performed),
        external_evidence_transfer: Boolean(record.external_evidence_transfer),
        raw_pixels_included: Boolean(record.raw_pixels_included),
        raw_provider_response_stored: Boolean(record.raw_provider_response_stored),
        existing_review_mutated: Boolean(record.existing_review_mutated),
        mcp_execution_exposed: Boolean(record.mcp_execution_exposed)
      },
      boundary: safeBoundarySummary(record.boundary)
    };
  }
  return {
    kind,
    path: relPath,
    id: stringOrNull(record.id),
    status: stringOrNull(record.status),
    preparation_id: stringOrNull(record.preparation_id),
    execution_id: stringOrNull(record.execution_id),
    provider: {
      id: stringOrNull(record.provider?.id),
      model_id: stringOrNull(record.model?.id)
    },
    advisory: {
      finding_count: Array.isArray(record.advisory_findings) ? record.advisory_findings.length : 0,
      owner_decision_requests: Array.isArray(record.owner_decision_requests) ? record.owner_decision_requests.length : 0,
      summary: truncateText(record.visual_review_result?.summary ?? '', 500),
      gate_effect: record.gate_effect ?? 'none'
    },
    boundary: safeBoundarySummary(record.boundary)
  };
}

function buildDashboard({ now, artifactRootInput, artifactSets, limit, languageSettings }) {
  const preparations = artifactSets.map((item) => item.preparation).filter(Boolean);
  const executions = artifactSets.map((item) => item.execution).filter(Boolean);
  const results = artifactSets.map((item) => item.result).filter(Boolean);
  const latestExecution = latestByTime(executions);
  const latestPreparation = latestByTime(preparations);
  const latestResult = latestByTime(results);
  const advisoryFindingCount = results.reduce((total, result) => total + numberOrZero(result.advisory?.finding_count), 0);
  const ownerDecisionCount = results.reduce((total, result) => total + numberOrZero(result.advisory?.owner_decision_requests), 0);
  const summary = {
    artifact_root: artifactRootInput,
    set_count: artifactSets.length,
    preparation_count: preparations.length,
    prepared: preparations.filter((item) => item.status === 'prepared').length,
    blocked_preparations: preparations.filter((item) => item.status && item.status !== 'prepared').length,
    execution_count: executions.length,
    completed_executions: executions.filter((item) => item.status === 'completed').length,
    blocked_executions: executions.filter((item) => item.status === 'blocked').length,
    failed_executions: executions.filter((item) => item.status === 'failed').length,
    result_count: results.length,
    advisory_findings: advisoryFindingCount,
    owner_decision_requests: ownerDecisionCount,
    provider_call_performed: executions.some((item) => item.effects.provider_call_performed),
    api_call_performed: executions.some((item) => item.effects.api_call_performed),
    external_evidence_transfer: executions.some((item) => item.effects.external_evidence_transfer),
    raw_pixels_included: executions.some((item) => item.effects.raw_pixels_included),
    raw_provider_response_stored: executions.some((item) => item.effects.raw_provider_response_stored),
    existing_review_mutated: executions.some((item) => item.effects.existing_review_mutated),
    mcp_execution_exposed: executions.some((item) => item.effects.mcp_execution_exposed)
  };
  return redact({
    schema_version: SCHEMA_VERSION,
    generated_at: now.toISOString(),
    status: dashboardStatus(summary),
    summary,
    latest: {
      preparation_path: latestPreparation?.path ?? null,
      execution_path: latestExecution?.path ?? null,
      result_path: latestResult?.path ?? null,
      result_status: latestResult?.status ?? null
    },
    language_settings: languageSettings,
    preparations,
    executions,
    results,
    control_center_handoff: {
      dashboard_command: `${CLI_NAME} visual review dashboard --json`,
      language_settings_command: `${CLI_NAME} settings language --json`,
      prepare_command: `${CLI_NAME} visual review prepare --review-index <review-artifact-index> --json`,
      run_command: latestPreparation?.status === 'prepared'
        ? `${CLI_NAME} visual review run --preparation ${latestPreparation.path} --surface local-subscription-agent --provider fake-agent --model fake-model --execute --json`
        : null,
      mcp_tool: 'browser_debug_visual_review_dashboard',
      next_safe_action: summary.result_count > 0
        ? 'Review visual review results and owner decision requests before acting on advisory findings.'
        : 'Create a visual review preparation from a review artifact index, then run explicit CLI visual review execution when needed.'
    },
    query: {
      limit,
      artifact_root: artifactRootInput
    },
    gate_effect: 'none',
    boundary: visualReviewDashboardBoundary()
  });
}

function dashboardStatus(summary) {
  if (summary.owner_decision_requests > 0 || summary.advisory_findings > 0) {
    return 'owner_review_recommended';
  }
  if (summary.completed_executions > 0) {
    return 'ready';
  }
  if (summary.prepared > 0) {
    return 'prepared';
  }
  return 'empty';
}

function latestByTime(items) {
  return [...items].sort((a, b) => timestampOf(b) - timestampOf(a))[0] ?? null;
}

function timestampOf(item) {
  return Date.parse(item.completed_at ?? item.created_at ?? '') || 0;
}

function safeBoundarySummary(boundary = {}) {
  return {
    browser_launched: Boolean(boundary.browser_launched),
    provider_call_performed: Boolean(boundary.provider_call_performed),
    api_call_performed: Boolean(boundary.api_call_performed),
    external_evidence_transfer: Boolean(boundary.external_evidence_transfer),
    raw_pixels_included: Boolean(boundary.raw_pixels_included),
    raw_provider_response_stored: Boolean(boundary.raw_provider_response_stored),
    existing_review_mutated: Boolean(boundary.existing_review_mutated),
    mcp_execution_exposed: Boolean(boundary.mcp_execution_exposed)
  };
}

function parsePositiveInteger(value, defaultValue, label) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: defaultValue };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, message: `${label} must be a positive integer.` };
  }
  return { ok: true, value: parsed };
}

function currentDate(now) {
  const value = typeof now === 'function' ? now() : now;
  if (value instanceof Date) {
    return value;
  }
  if (value) {
    return new Date(value);
  }
  return new Date();
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function errorResult(code, message, details = {}) {
  return {
    status: 'error',
    data: {
      boundary: visualReviewDashboardBoundary()
    },
    warnings: [],
    errors: [{ code, message, details }],
    artifacts: []
  };
}
