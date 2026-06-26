import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_VERSION } from './constants.js';
import { buildOperationContractsReport, operationContractsBoundary } from './operation-contracts.js';
import { buildOperationRegistryReport } from './operation-registry.js';
import { getMcpTools } from './mcp-profiles.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_POLICY_VERSION = '1.0.0';
export const OPERATION_POLICY_DEFAULT_PATH = 'ops/OPERATION_POLICY.json';
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OPERATION_POLICY_SCOPE_IDS = Object.freeze([
  'admin_policy',
  'cli_plan',
  'harness_readiness',
  'mcp_readiness'
]);

const READINESS = Object.freeze([
  readiness({
    id: 'admin_policy',
    phase: 65,
    label: 'Admin policy config',
    status: 'read_only_config_available',
    purpose: 'Record local admin policy defaults without granting execution authority.',
    checks: ['policy_config_present', 'write_execute_tools_disabled', 'approval_required_for_live_execution'],
    boundary: {
      config_read: true,
      config_written_by_command: false,
      live_execution_enabled: false
    }
  }),
  readiness({
    id: 'cli_plan',
    phase: 66,
    label: 'CLI operation plan',
    status: 'read_only_plan_available',
    purpose: 'Allow CLI users to inspect policy and operation readiness before execution surfaces exist.',
    checks: ['operation_selection_supported', 'registry_context_available', 'contracts_context_available'],
    boundary: {
      plan_inspection_only: true,
      writes_artifacts: false,
      live_execution_enabled: false
    }
  }),
  readiness({
    id: 'harness_readiness',
    phase: 67,
    label: 'Operation harness readiness',
    status: 'disabled_until_approved',
    purpose: 'Report shared harness prerequisites without enabling the execution dispatcher.',
    checks: ['risk_contract_available', 'gate_contract_available', 'token_contract_available', 'receipt_contract_available'],
    boundary: {
      harness_enabled: false,
      fake_fixture_execution_enabled: false,
      live_execution_enabled: false
    }
  }),
  readiness({
    id: 'mcp_readiness',
    phase: 68,
    label: 'MCP execute gate readiness',
    status: 'admin_agent_execution_available',
    purpose: 'Expose execution-readiness policy through safe MCP inspection while admin-only agent execution tools are available.',
    checks: ['safe_mcp_tool_available', 'safe_full_execution_tools_disabled', 'admin_agent_execution_tools_enabled'],
    boundary: {
      safe_mcp_inspection: true,
      admin_mcp_execution_enabled: true,
      mcp_write_execute_exposed: true
    }
  })
]);

export function buildOperationPolicyReport(options = {}, context = {}) {
  const scopeSelection = normalizeScopeSelection(options.scope);
  if (!scopeSelection.ok) {
    return scopeSelection;
  }

  const registry = buildOperationRegistryReport({ operation: options.operation }, context);
  if (!registry.ok) {
    return {
      ok: false,
      code: registry.code,
      message: registry.message
    };
  }

  const contracts = buildOperationContractsReport({ operation: options.operation }, context);
  if (!contracts.ok) {
    return {
      ok: false,
      code: contracts.code,
      message: contracts.message
    };
  }

  const policy = loadPolicyConfig(context);
  if (!policy.ok) {
    return policy;
  }

  const now = materializeNow(context.now ?? options.now);
  const readinessItems = READINESS.filter((item) => (
    scopeSelection.value === 'all' || item.id === scopeSelection.value
  ));

  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      policy_version: OPERATION_POLICY_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      scope_selection: scopeSelection.value,
      operation_selection: registry.report.operation_selection,
      policy_source: policy.source,
      admin_policy: policy.config.admin_policy,
      requirements: policy.config.requirements,
      selected_operations: contracts.report.selected_operations,
      contracts: contracts.report.contracts.map((contract) => ({
        id: contract.id,
        phase: contract.phase,
        required_fields: contract.required_fields,
        boundary: contract.boundary
      })),
      readiness: readinessItems,
      summary: summarizePolicy(readinessItems, policy.config),
      boundary: operationPolicyBoundary(),
      notes: [
        'This report records Slice 2 / Phase 65-68 local readiness only.',
        'It reads admin policy config and reports CLI/MCP readiness without enabling harnesses.',
        'Live execution, admin MCP token flows, and operation-specific side effects remain approval-bound.'
      ]
    }
  };
}

export function operationPolicyBoundary() {
  const adminExecutionEnabled = adminAgentExecutionToolsEnabled();
  return {
    ...operationContractsBoundary(),
    policy_report_only: true,
    slice_index: 2,
    phase_policy_recorded: [65, 66, 67, 68],
    admin_policy_config_read: true,
    admin_policy_config_written: false,
    cli_operation_plan_available: true,
    execution_harness_enabled: false,
    fake_fixture_execution_enabled: false,
    live_execution_performed: false,
    mcp_readiness_exposed: true,
    mcp_admin_execution_enabled: adminExecutionEnabled,
    mcp_write_execute_exposed: adminExecutionEnabled,
    artifacts_written: false
  };
}

export function getOperationPolicyReadiness() {
  return READINESS;
}

function loadPolicyConfig(context = {}) {
  if (context.operationPolicyConfig) {
    return {
      ok: true,
      config: normalizePolicyConfig(context.operationPolicyConfig),
      source: {
        kind: 'provided',
        configured_path: null,
        loaded: true
      }
    };
  }

  const configuredPath = context.operationPolicyPath ?? OPERATION_POLICY_DEFAULT_PATH;
  const cwd = context.cwd ?? process.cwd();
  const cwdPath = path.resolve(cwd, configuredPath);
  const packagePath = path.resolve(MODULE_ROOT, configuredPath);
  const resolvedPath = existsSync(cwdPath) ? cwdPath : packagePath;
  if (!existsSync(resolvedPath)) {
    return {
      ok: false,
      code: 'OPERATION_POLICY_CONFIG_NOT_FOUND',
      message: `Operation policy config was not found at ${configuredPath}.`
    };
  }

  const config = JSON.parse(readFileSync(resolvedPath, 'utf8'));
  return {
    ok: true,
    config: normalizePolicyConfig(config),
    source: {
      kind: 'repository_config',
      configured_path: configuredPath,
      loaded: true
    }
  };
}

function normalizePolicyConfig(config) {
  const adminExecutionEnabled = adminAgentExecutionToolsEnabled();
  return {
    schema_version: String(config.schema_version ?? SCHEMA_VERSION),
    policy_version: String(config.policy_version ?? OPERATION_POLICY_VERSION),
    mode: String(config.mode ?? 'read_only_defaults'),
    admin_policy: {
      currently_equivalent_to_full: adminExecutionEnabled ? false : config.admin_policy?.currently_equivalent_to_full !== false,
      write_execute_tools_exposed: adminExecutionEnabled,
      live_execution_enabled: false,
      token_issuance_enabled: false,
      receipt_writer_enabled: false,
      execution_harness_enabled: false,
      agent_execution_plan_enabled: adminExecutionEnabled,
      agent_execution_run_enabled: adminExecutionEnabled,
      provider_api_execution_enabled: adminExecutionEnabled
    },
    requirements: {
      plan_required: config.requirements?.plan_required !== false,
      explicit_intent_required: config.requirements?.explicit_intent_required !== false,
      approval_required_for_live_execution: config.requirements?.approval_required_for_live_execution !== false,
      receipt_required_for_live_execution: config.requirements?.receipt_required_for_live_execution !== false,
      idempotency_key_required: config.requirements?.idempotency_key_required !== false,
      workspace_confinement_required: config.requirements?.workspace_confinement_required !== false,
      credential_values_forbidden: config.requirements?.credential_values_forbidden !== false
    },
    mcp_readiness: {
      safe_readiness_tool_enabled: config.mcp_readiness?.safe_readiness_tool_enabled !== false,
      admin_execution_tools_enabled: adminExecutionEnabled,
      http_full_or_admin_enabled: false,
      socket_or_remote_listener_enabled: false
    },
    boundaries: {
      writes_artifacts: false,
      deletes_files: false,
      provider_call_performed: false,
      capture_performed: false,
      translation_execution_performed: false,
      package_publication_performed: false,
      artifact_root_migration_performed: false,
      legacy_alias_removed: false,
      shell_used: false,
      mcp_write_execute_exposed: adminExecutionEnabled
    }
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

function summarizePolicy(readinessItems, config) {
  return {
    readiness_count: readinessItems.length,
    implemented_phase_min: 65,
    implemented_phase_max: 68,
    admin_policy_config_loaded: true,
    cli_plan_available: readinessItems.some((item) => item.id === 'cli_plan') || readinessItems.length === READINESS.length,
    safe_mcp_readiness_available: config.mcp_readiness.safe_readiness_tool_enabled,
    token_issuance_enabled: false,
    receipt_writer_enabled: false,
    execution_harness_enabled: false,
    live_execution_performed: false,
    admin_execution_tools_enabled: config.mcp_readiness.admin_execution_tools_enabled,
    mcp_write_execute_exposed: config.mcp_readiness.admin_execution_tools_enabled
  };
}

function adminAgentExecutionToolsEnabled() {
  const toolNames = new Set(getMcpTools('admin').map((tool) => tool.name));
  return toolNames.has('browser_debug_agent_execution_plan')
    && toolNames.has('browser_debug_agent_execution_run');
}

function normalizeScopeSelection(selection) {
  if (selection === undefined || selection === null || selection === '' || selection === 'all') {
    return { ok: true, value: 'all' };
  }
  const value = String(selection);
  if (OPERATION_POLICY_SCOPE_IDS.includes(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION_POLICY_SCOPE',
    message: `Unsupported operation policy scope: ${value}. Expected one of: all, ${OPERATION_POLICY_SCOPE_IDS.join(', ')}.`
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
