import { SCHEMA_VERSION } from './constants.js';
import { MCP_PROFILE_NAMES } from './mcp-profiles.js';
import {
  getMcpExecutionGateOperationIds,
  getMcpExecutionGateOperations,
  operationRegistryBoundary
} from './operation-registry.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const MCP_EXECUTION_GATE_POLICY_VERSION = '1.0.0';

const OPERATIONS = Object.freeze(getMcpExecutionGateOperations());

export const MCP_EXECUTION_GATE_OPERATION_IDS = Object.freeze(getMcpExecutionGateOperationIds());

export function buildMcpExecutionGateReport(options = {}, context = {}) {
  const operationSelection = normalizeOperation(options.operation);
  if (!operationSelection.ok) {
    return operationSelection;
  }
  const profileSelection = normalizeProfile(options.profile);
  if (!profileSelection.ok) {
    return profileSelection;
  }
  const now = currentDate(context.now ?? options.now);
  const operations = OPERATIONS
    .filter((item) => operationSelection.operation === 'all' || item.id === operationSelection.operation)
    .map((item) => operationReport(item, profileSelection.profile));
  const writeExecuteToolsExposed = operations.some((item) => Boolean(item.current_mcp_exposure?.admin));

  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      policy_version: MCP_EXECUTION_GATE_POLICY_VERSION,
      generated_at: now.toISOString(),
      server_name: PRODUCT_IDENTITY.mcpServerName,
      profile_selection: profileSelection.profile,
      operation_selection: operationSelection.operation,
      summary: {
        operation_count: operations.length,
        write_execute_tools_exposed: writeExecuteToolsExposed,
        execution_ready_for_mcp: operations.some((item) => item.id === 'agent_execution_run' && item.current_mcp_exposure?.admin === true),
        planning_write_ready_for_mcp: operations.some((item) => item.id === 'agent_execution_plan' && item.current_mcp_exposure?.admin === true),
        read_only_report_only: true
      },
      operations,
      registry: {
        source: 'operation_registry',
        read_only: true,
        boundary: operationRegistryBoundary()
      },
      boundary: mcpExecutionGateBoundary(),
      next_steps: [
        'Use this report to review required gates before adding or expanding any MCP write or execute tool.',
        'Keep MCP execution exposure limited to explicitly approved operations with tests for every listed gate.',
        'Prefer read-only dashboard/status tools until write receipts, idempotency, and credential boundaries are proven.'
      ]
    }
  };
}

export function mcpExecutionGateBoundary() {
  return {
    local_only: true,
    read_only: true,
    writes_artifacts: false,
    deletes_files: false,
    provider_call_performed: false,
    api_call_performed: false,
    external_upload: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    mcp_permissions_changed: false,
    mcp_write_execute_exposed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

function operationReport(item, profileSelection) {
  return {
    id: item.id,
    command: item.command,
    category: item.category,
    cli_available: item.cli_available,
    current_status: item.current_status,
    proposed_stage: item.proposed_stage,
    profile_selection: profileSelection,
    current_mcp_exposure: item.current_mcp_exposure,
    group: item.group,
    risk: item.risk,
    required_gate_count: item.required_gates.length,
    required_gates: item.required_gates,
    boundary: mcpExecutionGateBoundary()
  };
}

function normalizeOperation(value) {
  const operation = String(value ?? 'all').trim() || 'all';
  if (operation === 'all' || MCP_EXECUTION_GATE_OPERATION_IDS.includes(operation)) {
    return { ok: true, operation };
  }
  return {
    ok: false,
    code: 'INVALID_MCP_EXECUTION_GATE_OPERATION',
    message: `Unsupported MCP execution gate operation: ${operation}. Expected one of: all, ${MCP_EXECUTION_GATE_OPERATION_IDS.join(', ')}.`
  };
}

function normalizeProfile(value) {
  const profile = String(value ?? 'all').trim() || 'all';
  if (profile === 'all' || MCP_PROFILE_NAMES.includes(profile)) {
    return { ok: true, profile };
  }
  return {
    ok: false,
    code: 'INVALID_MCP_EXECUTION_GATE_PROFILE',
    message: `Unsupported MCP execution gate profile: ${profile}. Expected one of: all, ${MCP_PROFILE_NAMES.join(', ')}.`
  };
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
