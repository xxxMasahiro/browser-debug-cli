import { SCHEMA_VERSION } from './constants.js';
import {
  AGENT_EXECUTION_PROVIDERS,
  API_PROVIDER_CREDENTIAL_ENV,
  API_PROVIDER_ENDPOINT_ENV
} from './agent-execution-providers.js';
import {
  buildOperationAdminReadinessReport,
  operationAdminReadinessBoundary
} from './operation-admin-readiness.js';
import {
  MCP_TOOL_TAGS,
  getMcpToolsByTag
} from './mcp-profiles.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_PROVIDER_READINESS_VERSION = '1.0.0';

export const OPERATION_PROVIDER_READINESS_SCOPE_IDS = Object.freeze([
  'provider_mcp_plan',
  'disclosure_contract',
  'env_credential_guard',
  'provider_mcp_fake_execution',
  'provider_mcp_local_runner_execution',
  'provider_mcp_api_execution',
  'provider_mcp_status_list'
]);

const READINESS = Object.freeze([
  readiness({
    id: 'provider_mcp_plan',
    phase: 71,
    label: 'Provider MCP plan readiness',
    status: 'admin_plan_available',
    purpose: 'Record provider MCP planning prerequisites now that admin-only agent execution planning is exposed.',
    checks: ['provider_catalog_available', 'admin_plan_tool_enabled', 'provider_calls_disabled_by_plan'],
    boundary: {
      provider_mcp_plan_available: true,
      provider_mcp_execution_enabled: true,
      provider_call_performed: false
    }
  }),
  readiness({
    id: 'disclosure_contract',
    phase: 72,
    label: 'Provider disclosure contract readiness',
    status: 'read_only_contract_available',
    purpose: 'Record bounded disclosure defaults for the approved admin-only provider MCP execution path.',
    checks: ['metadata_only_default', 'raw_artifact_content_excluded', 'owner_review_required_for_external_transfer'],
    boundary: {
      disclosure_contract_recorded: true,
      external_evidence_transfer_authorized: true,
      raw_artifact_content_included: false
    }
  }),
  readiness({
    id: 'env_credential_guard',
    phase: 73,
    label: 'Provider environment credential guard readiness',
    status: 'read_only_guard_available',
    purpose: 'Record credential environment variable names without reading, storing, printing, or validating credential values.',
    checks: ['credential_values_not_read', 'credential_values_not_recorded', 'credential_names_only'],
    boundary: {
      env_credential_guard_recorded: true,
      credential_values_read: false,
      credential_values_recorded: false
    }
  }),
  readiness({
    id: 'provider_mcp_fake_execution',
    phase: 74,
    label: 'Provider MCP deterministic fake execution',
    status: 'admin_execution_available',
    purpose: 'Expose deterministic fake agent execution through MCP admin using the existing plan/run receipt path.',
    checks: ['admin_profile_only', 'plan_required', 'explicit_execute_intent', 'receipt_required'],
    boundary: {
      provider_mcp_execution_enabled: true,
      fake_provider_execution_enabled: true,
      provider_call_performed: false,
      api_call_performed: false,
      external_evidence_transfer_performed: false
    }
  }),
  readiness({
    id: 'provider_mcp_local_runner_execution',
    phase: 75,
    label: 'Provider MCP configured local runner execution',
    status: 'admin_execution_available',
    purpose: 'Expose configured local runner execution through MCP admin without shell execution or free-form command input.',
    checks: ['admin_profile_only', 'configured_callback_required', 'shell_disabled', 'receipt_required'],
    boundary: {
      provider_mcp_execution_enabled: true,
      local_runner_execution_enabled: true,
      provider_call_performed: false,
      shell_used: false,
      free_form_shell_input_accepted: false
    }
  }),
  readiness({
    id: 'provider_mcp_api_execution',
    phase: 76,
    label: 'Provider MCP generic API execution',
    status: 'admin_execution_available',
    purpose: 'Expose env-only generic API provider execution through MCP admin with bounded package and prompt disclosure.',
    checks: ['admin_profile_only', 'env_only_credentials', 'bounded_disclosure', 'no_raw_provider_response_storage'],
    boundary: {
      provider_mcp_execution_enabled: true,
      provider_api_execution_enabled: true,
      api_call_performed: false,
      external_evidence_transfer_authorized: true,
      external_evidence_transfer_performed: false,
      credential_values_read: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false
    }
  }),
  readiness({
    id: 'provider_mcp_status_list',
    phase: 77,
    label: 'Provider MCP status/list readiness',
    status: 'read_only_status_list_available',
    purpose: 'Record existing safe MCP status and list inspection surfaces separately from admin provider execution.',
    checks: ['safe_mcp_status_tool_available', 'safe_mcp_list_tool_available', 'status_list_read_only'],
    boundary: {
      provider_mcp_status_list_available: true,
      provider_mcp_status_list_read_only: true,
      provider_mcp_execution_enabled: true,
      provider_call_performed: false
    }
  })
]);

export function buildOperationProviderReadinessReport(options = {}, context = {}) {
  const scopeSelection = normalizeScopeSelection(options.scope);
  if (!scopeSelection.ok) {
    return scopeSelection;
  }

  const adminReadiness = buildOperationAdminReadinessReport({ scope: 'all', operation: options.operation }, context);
  if (!adminReadiness.ok) {
    return {
      ok: false,
      code: adminReadiness.code,
      message: adminReadiness.message
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
      provider_readiness_version: OPERATION_PROVIDER_READINESS_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      scope_selection: scopeSelection.value,
      operation_selection: adminReadiness.report.operation_selection,
      selected_operations: adminReadiness.report.selected_operations,
      admin_policy: adminReadiness.report.admin_policy,
      requirements: adminReadiness.report.requirements,
      provider_catalog: providerCatalog(),
      disclosure_contract: disclosureContract(),
      credential_guard: credentialGuard(),
      status_list_contract: statusListContract(),
      readiness: readinessItems,
      summary: summarizeProviderReadiness(readinessItems),
      boundary: operationProviderReadinessBoundary(),
      notes: [
        'This report records Slice 4 / Phase 71-73 provider MCP readiness, Phase 74-76 approved admin provider execution exposure, and Slice 5a / Phase 77-78 provider status/list readiness.',
        'It does not call providers, execute local runners, read credential values, or transfer evidence from this readiness report.',
        'Provider MCP execution is limited to the stdio admin profile agent execution plan/run tools; safe, full, HTTP, cleanup, capture, translation, and shell execution remain excluded.'
      ]
    }
  };
}

export function operationProviderReadinessBoundary() {
  return {
    ...operationAdminReadinessBoundary(),
    provider_readiness_report_only: true,
    slice_index: 5,
    phase_provider_readiness_recorded: [71, 72, 73, 74, 75, 76, 77, 78],
    phase_provider_execution_implemented: [74, 75, 76],
    phase_provider_execution_approval_bound: [],
    provider_mcp_plan_available: true,
    provider_disclosure_contract_recorded: true,
    env_credential_guard_recorded: true,
    provider_mcp_status_list_available: true,
    provider_mcp_status_list_read_only: true,
    provider_mcp_execution_enabled: true,
    safe_mcp_provider_execution_enabled: false,
    full_mcp_provider_execution_enabled: false,
    admin_mcp_provider_execution_enabled: true,
    provider_call_performed: false,
    api_call_performed: false,
    external_evidence_transfer_authorized: true,
    external_evidence_transfer_performed: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    mcp_write_execute_exposed: true
  };
}

export function getOperationProviderReadiness() {
  return READINESS;
}

function providerCatalog() {
  return AGENT_EXECUTION_PROVIDERS.map((provider) => ({
    id: provider.id,
    kind: provider.kind,
    transport: provider.transport,
    implemented: provider.implemented === true,
    surface_kinds: [...provider.surface_kinds],
    model_policy: provider.model_policy,
    credential_mode: provider.credential_mode,
    endpoint_env_name: provider.endpoint_env ?? null,
    credential_env_name: provider.credential_env ?? null,
    provider_has_api_capability: provider.transport === 'provider_api',
    provider_mcp_execution_enabled: true,
    provider_call_planned: false,
    provider_call_performed: false,
    external_evidence_transfer_authorized: provider.external_evidence_transfer === true,
    external_evidence_transfer_performed: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false
  }));
}

function disclosureContract() {
  return {
    default_scope: 'metadata_only',
    raw_artifact_content_included: false,
    raw_dom_included: false,
    trace_content_included: false,
    screenshot_binary_included: false,
    console_payloads_included: false,
    network_payloads_included: false,
    source_data_values_included: false,
    local_artifact_paths_included: true,
    external_evidence_transfer_authorized: true,
    external_evidence_transfer_performed: false,
    requires_owner_review_before_external_transfer: true,
    redaction_required: true,
    provider_execution_authorized: true,
    future_execute_required: true
  };
}

function credentialGuard() {
  return {
    mode: 'environment_variable_name_only',
    endpoint_env_name: API_PROVIDER_ENDPOINT_ENV,
    credential_env_name: API_PROVIDER_CREDENTIAL_ENV,
    credential_values_read: false,
    credential_values_recorded: false,
    credential_values_printed: false,
    credential_values_persisted: false,
    env_file_loaded: false,
    cli_credential_arguments_allowed: false
  };
}

function statusListContract() {
  const statusListTools = getMcpToolsByTag('safe', MCP_TOOL_TAGS.PROVIDER_STATUS_LIST_READ);
  const statusAvailable = statusListTools.some((tool) => tool.tags.includes(MCP_TOOL_TAGS.AGENT_EXECUTION_STATUS_READ));
  const listAvailable = statusListTools.some((tool) => tool.tags.includes(MCP_TOOL_TAGS.AGENT_EXECUTION_LIST_READ));
  return {
    source: 'mcp_profiles',
    profile: 'safe',
    tool_count: statusListTools.length,
    status_tool_available: statusAvailable,
    list_tool_available: listAvailable,
    read_only: true,
    writes_artifacts: false,
    provider_call_performed: false,
    provider_mcp_execution_enabled: true,
    admin_provider_mcp_execution_available: true,
    credential_values_read: false,
    external_evidence_transfer_performed: false,
    mcp_write_execute_exposed: false,
    tools: statusListTools.map((tool) => ({
      name: tool.name,
      minimum_profile: tool.minimumProfile,
      tags: [...tool.tags],
      effects: tool.effects,
      read_only: true,
      provider_mcp_execution_enabled: false,
      provider_call_performed: false,
      credential_values_read: false
    }))
  };
}

function readiness({ id, phase, label, status, purpose, checks, boundary }) {
  return Object.freeze({
    id,
    phase,
    label,
    status,
    purpose,
    checks: Object.freeze([...checks]),
    boundary: Object.freeze({ ...boundary })
  });
}

function summarizeProviderReadiness(readinessItems) {
  return {
    readiness_count: readinessItems.length,
    implemented_phase_min: 71,
    implemented_phase_max: 78,
    provider_count: AGENT_EXECUTION_PROVIDERS.length,
    provider_mcp_plan_available: readinessItems.some((item) => item.id === 'provider_mcp_plan') || readinessItems.length === READINESS.length,
    disclosure_contract_recorded: readinessItems.some((item) => item.id === 'disclosure_contract') || readinessItems.length === READINESS.length,
    env_credential_guard_recorded: readinessItems.some((item) => item.id === 'env_credential_guard') || readinessItems.length === READINESS.length,
    provider_mcp_fake_execution_enabled: readinessItems.some((item) => item.id === 'provider_mcp_fake_execution') || readinessItems.length === READINESS.length,
    provider_mcp_local_runner_execution_enabled: readinessItems.some((item) => item.id === 'provider_mcp_local_runner_execution') || readinessItems.length === READINESS.length,
    provider_mcp_api_execution_enabled: readinessItems.some((item) => item.id === 'provider_mcp_api_execution') || readinessItems.length === READINESS.length,
    provider_mcp_status_list_available: readinessItems.some((item) => item.id === 'provider_mcp_status_list') || readinessItems.length === READINESS.length,
    status_list_tool_count: statusListContract().tool_count,
    provider_mcp_execution_enabled: true,
    provider_call_performed: false,
    external_evidence_transfer_performed: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    mcp_write_execute_exposed: true
  };
}

function normalizeScopeSelection(selection) {
  if (selection === undefined || selection === null || selection === '' || selection === 'all') {
    return { ok: true, value: 'all' };
  }
  const value = String(selection);
  if (OPERATION_PROVIDER_READINESS_SCOPE_IDS.includes(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION_PROVIDER_READINESS_SCOPE',
    message: `Unsupported operation provider readiness scope: ${value}. Expected one of: all, ${OPERATION_PROVIDER_READINESS_SCOPE_IDS.join(', ')}.`
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
