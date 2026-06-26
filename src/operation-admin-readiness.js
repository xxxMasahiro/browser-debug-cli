import { SCHEMA_VERSION } from './constants.js';
import {
  buildOperationPolicyReport,
  operationPolicyBoundary
} from './operation-policy.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_ADMIN_READINESS_VERSION = '1.0.0';

export const OPERATION_ADMIN_READINESS_SCOPE_IDS = Object.freeze([
  'mcp_admin_token_flow',
  'mcp_admin_harness_bridge'
]);

const READINESS = Object.freeze([
  readiness({
    id: 'mcp_admin_token_flow',
    phase: 69,
    label: 'MCP admin execute token flow readiness',
    status: 'approval_required_not_enabled',
    purpose: 'Record the MCP admin execute-token flow prerequisites without issuing tokens or expanding MCP authority.',
    required_contracts: ['token_contract', 'admin_policy', 'explicit_intent', 'idempotency_key'],
    checks: ['token_contract_available', 'admin_policy_disables_token_issuance', 'approval_required_for_live_execution'],
    boundary: {
      mcp_admin_token_flow_enabled: false,
      token_issuance_enabled: false,
      execution_tokens_issued: false,
      token_storage_enabled: false
    }
  }),
  readiness({
    id: 'mcp_admin_harness_bridge',
    phase: 70,
    label: 'MCP admin execution harness readiness',
    status: 'admin_agent_execution_bridge_available',
    purpose: 'Record MCP admin bridge prerequisites while the approved agent execution plan/run tools are available without enabling the generic harness.',
    required_contracts: ['gate_schema', 'receipt_contract', 'operation_policy', 'mcp_profile_policy'],
    checks: ['execution_harness_disabled', 'safe_full_execution_profiles_disabled', 'admin_agent_execution_tools_enabled'],
    boundary: {
      mcp_admin_harness_enabled: false,
      mcp_admin_execute_calls_enabled: true,
      agent_execution_admin_bridge_enabled: true,
      execution_harness_enabled: false,
      live_execution_enabled: false
    }
  })
]);

export function buildOperationAdminReadinessReport(options = {}, context = {}) {
  const scopeSelection = normalizeScopeSelection(options.scope);
  if (!scopeSelection.ok) {
    return scopeSelection;
  }

  const policy = buildOperationPolicyReport({ scope: 'all', operation: options.operation }, context);
  if (!policy.ok) {
    return {
      ok: false,
      code: policy.code,
      message: policy.message
    };
  }

  const now = materializeNow(context.now ?? options.now);
  const readinessItems = READINESS.filter((item) => (
    scopeSelection.value === 'all' || item.id === scopeSelection.value
  ));

  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      admin_readiness_version: OPERATION_ADMIN_READINESS_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      scope_selection: scopeSelection.value,
      operation_selection: policy.report.operation_selection,
      policy_source: policy.report.policy_source,
      admin_policy: policy.report.admin_policy,
      requirements: policy.report.requirements,
      selected_operations: policy.report.selected_operations,
      readiness: readinessItems,
      approval_boundary: {
        approval_required_for_live_execution: policy.report.requirements.approval_required_for_live_execution,
        explicit_intent_required: policy.report.requirements.explicit_intent_required,
        receipt_required_for_live_execution: policy.report.requirements.receipt_required_for_live_execution,
        idempotency_key_required: policy.report.requirements.idempotency_key_required,
        workspace_confinement_required: policy.report.requirements.workspace_confinement_required
      },
      summary: summarizeAdminReadiness(readinessItems),
      boundary: operationAdminReadinessBoundary(),
      notes: [
        'This report records Slice 3 / Phase 69-70 MCP admin readiness and the approved Phase 74-76 admin agent execution bridge state.',
        'It does not issue execute tokens, store tokens, enable the generic MCP harness, or perform live operations from this report.',
        'Live MCP admin token flow, generic harness execution, cleanup execution, capture execution, shell execution, and HTTP admin remain approval-bound.'
      ]
    }
  };
}

export function operationAdminReadinessBoundary() {
  const adminExecutionEnabled = operationPolicyBoundary().mcp_admin_execution_enabled === true;
  return {
    ...operationPolicyBoundary(),
    admin_readiness_report_only: true,
    slice_index: 3,
    phase_admin_readiness_recorded: [69, 70],
    mcp_admin_token_flow_planned: true,
    mcp_admin_token_flow_enabled: false,
    token_issuance_enabled: false,
    execution_tokens_issued: false,
    token_storage_enabled: false,
    mcp_admin_harness_bridge_planned: true,
    mcp_admin_harness_enabled: false,
    mcp_admin_execute_calls_enabled: adminExecutionEnabled,
    agent_execution_admin_bridge_enabled: adminExecutionEnabled,
    execution_harness_enabled: false,
    fake_fixture_execution_enabled: false,
    live_execution_performed: false,
    artifacts_written: false,
    mcp_write_execute_exposed: adminExecutionEnabled
  };
}

export function getOperationAdminReadiness() {
  return READINESS;
}

function readiness({
  id,
  phase,
  label,
  status,
  purpose,
  required_contracts,
  checks,
  boundary
}) {
  return Object.freeze({
    id,
    phase,
    label,
    status,
    purpose,
    required_contracts: Object.freeze([...required_contracts]),
    checks: Object.freeze([...checks]),
    boundary: Object.freeze({ ...boundary })
  });
}

function summarizeAdminReadiness(readinessItems) {
  return {
    readiness_count: readinessItems.length,
    implemented_phase_min: 69,
    implemented_phase_max: 70,
    approval_required_before_live_execution: true,
    mcp_admin_token_flow_enabled: false,
    token_issuance_enabled: false,
    execution_tokens_issued: false,
    mcp_admin_harness_enabled: false,
    mcp_admin_execute_calls_enabled: true,
    agent_execution_admin_bridge_enabled: true,
    execution_harness_enabled: false,
    live_execution_performed: false,
    mcp_write_execute_exposed: true
  };
}

function normalizeScopeSelection(selection) {
  if (selection === undefined || selection === null || selection === '' || selection === 'all') {
    return { ok: true, value: 'all' };
  }
  const value = String(selection);
  if (OPERATION_ADMIN_READINESS_SCOPE_IDS.includes(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION_ADMIN_READINESS_SCOPE',
    message: `Unsupported operation admin readiness scope: ${value}. Expected one of: all, ${OPERATION_ADMIN_READINESS_SCOPE_IDS.join(', ')}.`
  };
}

function materializeNow(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'function') {
    const resolved = value();
    return resolved instanceof Date ? resolved : new Date(resolved);
  }
  if (value) {
    return new Date(value);
  }
  return new Date();
}
