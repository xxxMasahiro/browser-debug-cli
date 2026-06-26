import { SCHEMA_VERSION } from './constants.js';
import { productIdentitySummary } from './product-identity.js';

export const FINAL_HARDENING_READINESS_VERSION = '1.0.0';

const MATRIX_AREAS = Object.freeze([
  area('operation_governance', 'operation registry, roadmap, contracts, policy, admin readiness, provider readiness'),
  area('provider_execution', 'agent execution plan/run/status/list and bounded provider disclosure'),
  area('cleanup', 'artifact cleanup planning, candidate locks, CLI-only cleanup execution, MCP plan-only exposure'),
  area('capture', 'capture readiness, plan, handoff, and fail-closed run boundaries'),
  area('localization_translation', 'locale resources, report templates, translation readiness, dry-run, and fail-closed run boundaries'),
  area('release_identity', 'release readiness, artifact-root policy/migration fixtures, legacy alias audit/removal readiness'),
  area('constrained_shell', 'shell readiness, plan-only contracts, and fail-closed execution boundary'),
  area('mcp_profiles', 'safe/full/admin profile exposure, HTTP safe-only transport, and excluded operations'),
  area('browser_smoke', 'local browser smoke rebaseline remains an explicit local verification action'),
  area('security_docs', 'secrets, credential, external upload, shell, capture, and publication boundaries')
]);

export async function runFinalHardeningReadiness(options = {}, context = {}) {
  const readiness = buildFinalHardeningReadiness(options, context);
  return {
    status: 'ok',
    data: {
      final_hardening_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: readiness.warnings,
    errors: [],
    artifacts: []
  };
}

export function buildFinalHardeningReadiness(_options = {}, context = {}) {
  const now = materializeNow(context.now);
  return {
    schema_version: SCHEMA_VERSION,
    readiness_version: FINAL_HARDENING_READINESS_VERSION,
    generated_at: now.toISOString(),
    status: 'local_readiness_plan',
    product_identity: productIdentitySummary(),
    phase_range: {
      start: 149,
      end: 155,
      promoted_to_product_docs: false
    },
    regression_matrix: MATRIX_AREAS.map((item) => ({
      ...item,
      status: 'covered_by_local_readiness_or_existing_targeted_tests',
      remote_required: false
    })),
    local_gate_plan: [
      check('unit_architecture', 'npm test', 'targeted or aggregate local tests for changed files'),
      check('browser_smoke', 'npm run test:browser', 'local browser smoke rebaseline when browser validation is explicitly selected'),
      check('pack_smoke', 'npm run test:pack && npm run test:pack-install', 'local package file-set and packed-install smoke'),
      check('product_security', './tools/check_product_security.sh', 'local security invariant sweep'),
      check('product_structure', './tools/check_product_structure.sh', 'local scaffold and manifest structure'),
      check('product_gate', './tools/product-gate', 'final local product gate')
    ],
    smoke_rebaseline: {
      browser_smoke_executed_by_report: false,
      mcp_smoke_executed_by_report: false,
      remote_ci_triggered: false,
      local_only: true,
      readiness_only: true
    },
    security_sweep: {
      secrets_committed: false,
      credential_values_read: false,
      provider_boundary_changed: false,
      external_upload_added: false,
      shell_execution_added: false,
      capture_execution_added: false,
      publication_added: false,
      destructive_operation_added: false
    },
    docs_english_scan: {
      repository_documentation_language: 'en',
      product_docs_promoted: false,
      scan_executed_by_report: false,
      changed_workflow_docs_should_remain_english: true
    },
    release_boundary: {
      npm_publication_performed: false,
      remote_ci_triggered: false,
      git_push_performed: false,
      package_visibility_changed: false,
      license_changed: false,
      legacy_alias_removed: false,
      real_artifact_root_migration_performed: false
    },
    next_steps: [
      'Run the selected local gates after implementation changes settle.',
      'Keep remote CI, push, npm publication, alias removal, and real migration approval-bound.',
      'Use this report as local readiness evidence, not as release publication permission.'
    ],
    warnings: [],
    boundary: finalHardeningBoundary()
  };
}

export function finalHardeningBoundary() {
  return {
    local_only: true,
    read_only: true,
    artifacts_written: false,
    files_mutated: false,
    browser_launched: false,
    browser_smoke_executed: false,
    mcp_smoke_executed: false,
    remote_ci_triggered: false,
    git_mutation_performed: false,
    npm_publish_performed: false,
    npm_publish_dry_run_performed: false,
    package_metadata_mutated: false,
    product_docs_promoted: false,
    provider_call_performed: false,
    api_call_performed: false,
    external_upload: false,
    credential_values_read: false,
    credential_values_recorded: false,
    capture_performed: false,
    translation_execution_performed: false,
    artifact_root_migration_performed: false,
    legacy_alias_removed: false,
    shell_used: false,
    mcp_execution_exposed: false,
    gate_effect: 'none'
  };
}

function area(id, coverage) {
  return Object.freeze({ id, coverage });
}

function check(id, command, purpose) {
  return Object.freeze({ id, command, purpose, local_only: true, executed_by_report: false });
}

function materializeNow(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'function') {
    return materializeNow(value());
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}
