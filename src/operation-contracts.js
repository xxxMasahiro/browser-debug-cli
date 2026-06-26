import { SCHEMA_VERSION } from './constants.js';
import {
  OPERATION_GROUP_IDS,
  OPERATION_RISK_IDS,
  buildOperationRegistryReport,
  operationRegistryBoundary
} from './operation-registry.js';
import {
  OPERATION_ROADMAP_PHASE_MAX,
  OPERATION_ROADMAP_PHASE_MIN,
  operationRoadmapBoundary
} from './operation-roadmap.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_CONTRACTS_VERSION = '1.0.0';

export const OPERATION_CONTRACT_SCOPE_IDS = Object.freeze([
  'risk_taxonomy',
  'gate_schema',
  'token_contract',
  'receipt_contract'
]);

const CONTRACTS = Object.freeze([
  contract({
    id: 'risk_taxonomy',
    phase: 61,
    label: 'Operation risk taxonomy contract',
    purpose: 'Classify operation effects before any write, delete, provider, capture, translation, release, or shell authority expands.',
    required_fields: ['id', 'description'],
    validates: OPERATION_RISK_IDS,
    boundary: {
      classification_only: true,
      permission_granted: false
    }
  }),
  contract({
    id: 'gate_schema',
    phase: 62,
    label: 'Operation gate schema contract',
    purpose: 'Define reusable plan, execute request, and receipt gate objects before operation-specific execution surfaces exist.',
    required_fields: ['id', 'message'],
    validates: ['plan_required', 'explicit_intent', 'approval_boundary', 'receipt_required'],
    shapes: {
      plan: ['operation_id', 'request_key', 'risk', 'required_gates', 'live_execution_enabled'],
      execute_request: ['operation_id', 'request_key', 'explicit_intent', 'token_ref', 'dry_run'],
      receipt: ['receipt_id', 'operation_id', 'request_key', 'status', 'started_at', 'finished_at', 'effects']
    },
    boundary: {
      schema_only: true,
      live_gate_enforcement_enabled: false
    }
  }),
  contract({
    id: 'token_contract',
    phase: 63,
    label: 'Execute token contract',
    purpose: 'Record the shape of scoped, expiring, one-time execute tokens without issuing tokens or enabling execution.',
    required_fields: ['token_id', 'operation_id', 'scope', 'expires_at', 'request_key', 'single_use'],
    validates: ['scope_match_required', 'expiry_required', 'one_time_use_required', 'replay_rejection_required'],
    boundary: {
      token_issuance_enabled: false,
      execution_tokens_issued: false,
      token_storage_enabled: false
    }
  }),
  contract({
    id: 'receipt_contract',
    phase: 64,
    label: 'Execution receipt contract',
    purpose: 'Define redacted, local receipt fields for future side-effectful operations without writing receipts in this slice.',
    required_fields: ['receipt_id', 'operation_id', 'request_key', 'status', 'effects', 'redactions', 'artifacts'],
    validates: ['credential_values_omitted', 'raw_provider_response_omitted', 'artifact_root_confined', 'gate_neutral'],
    boundary: {
      receipt_writer_enabled: false,
      artifacts_written: false,
      raw_evidence_embedded: false
    }
  })
]);

export function buildOperationContractsReport(options = {}, context = {}) {
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

  const now = materializeNow(context.now ?? options.now);
  const contracts = CONTRACTS.filter((item) => (
    scopeSelection.value === 'all' || item.id === scopeSelection.value
  ));

  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      contracts_version: OPERATION_CONTRACTS_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      phase_range: {
        min: OPERATION_ROADMAP_PHASE_MIN,
        max: OPERATION_ROADMAP_PHASE_MAX,
        implemented_contract_phases: CONTRACTS.map((item) => item.phase)
      },
      scope_selection: scopeSelection.value,
      operation_selection: registry.report.operation_selection,
      summary: summarizeContracts(contracts),
      risk_taxonomy: scopeSelection.value === 'all' || scopeSelection.value === 'risk_taxonomy'
        ? registry.report.risk_taxonomy
        : [],
      groups: registry.report.groups.filter((group) => OPERATION_GROUP_IDS.includes(group.id)),
      selected_operations: registry.report.operations.map((operation) => ({
        id: operation.id,
        group: operation.group,
        risk: operation.risk.effects,
        required_gates: operation.required_gates.map((gate) => ({ id: gate.id, message: gate.message })),
        current_status: operation.current_status,
        mcp_exposure: operation.mcp_exposure
      })),
      contracts,
      boundary: operationContractsBoundary(),
      notes: [
        'This report records shared operation contracts for Phase 61-64 only.',
        'It does not issue execute tokens, enforce live gates, write receipts, or enable execution harnesses.',
        'Operation-specific live behavior remains approval-bound and must reference these contracts before implementation.'
      ]
    }
  };
}

export function operationContractsBoundary() {
  return {
    ...operationRegistryBoundary(),
    ...operationRoadmapBoundary(),
    contracts_report_only: true,
    slice_index: 1,
    phase_contracts_recorded: [61, 62, 63, 64],
    risk_taxonomy_contract_recorded: true,
    gate_schema_recorded: true,
    execute_token_contract_recorded: true,
    receipt_contract_recorded: true,
    token_issuance_enabled: false,
    execution_tokens_issued: false,
    token_storage_enabled: false,
    receipt_writer_enabled: false,
    execution_harness_enabled: false,
    live_execution_performed: false,
    artifacts_written: false,
    mcp_write_execute_exposed: false,
    remote_or_external_operation_performed: false
  };
}

export function getOperationContracts() {
  return CONTRACTS;
}

function contract({
  id,
  phase,
  label,
  purpose,
  required_fields,
  validates,
  shapes = {},
  boundary
}) {
  return Object.freeze({
    id,
    phase,
    label,
    purpose,
    required_fields: Object.freeze([...required_fields]),
    validates: Object.freeze([...validates]),
    shapes: Object.freeze({ ...shapes }),
    boundary: Object.freeze({ ...boundary })
  });
}

function summarizeContracts(contracts) {
  return {
    contract_count: contracts.length,
    implemented_phase_min: 61,
    implemented_phase_max: 64,
    shared_governance_ready: true,
    risk_count: OPERATION_RISK_IDS.length,
    token_issuance_enabled: false,
    receipt_writer_enabled: false,
    live_execution_performed: false,
    mcp_write_execute_exposed: false
  };
}

function normalizeScopeSelection(selection) {
  if (selection === undefined || selection === null || selection === '' || selection === 'all') {
    return { ok: true, value: 'all' };
  }
  const value = String(selection);
  if (OPERATION_CONTRACT_SCOPE_IDS.includes(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION_CONTRACTS_SCOPE',
    message: `Unsupported operation contracts scope: ${value}. Expected one of: all, ${OPERATION_CONTRACT_SCOPE_IDS.join(', ')}.`
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
