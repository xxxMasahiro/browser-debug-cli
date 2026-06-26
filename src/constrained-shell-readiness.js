import { SCHEMA_VERSION } from './constants.js';
import { productIdentitySummary } from './product-identity.js';

export const CONSTRAINED_SHELL_READINESS_VERSION = '1.0.0';

export async function runConstrainedShellReadiness(options = {}, context = {}) {
  const readiness = buildConstrainedShellReadiness(options, context);
  return {
    status: 'ok',
    data: {
      constrained_shell_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: readiness.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runConstrainedShellPlan(options = {}, context = {}) {
  const plan = buildConstrainedShellReadiness({ ...options, mode: 'plan' }, context);
  return {
    status: 'ok',
    data: {
      constrained_shell_plan: plan,
      boundary: plan.boundary
    },
    warnings: plan.warnings,
    errors: [],
    artifacts: []
  };
}

export function buildConstrainedShellReadiness(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const mode = options.mode === 'plan' ? 'plan' : 'readiness';
  return {
    schema_version: SCHEMA_VERSION,
    readiness_version: CONSTRAINED_SHELL_READINESS_VERSION,
    generated_at: now.toISOString(),
    status: 'plan_only',
    mode,
    product_identity: productIdentitySummary(),
    use_case_review: [
      reviewItem('existing_product_checks', 'prefer_existing_tools', 'Existing product-local checks should remain the primary automation path.'),
      reviewItem('agent_handoff', 'prefer_structured_requests', 'Agent workflows should use structured package/result contracts instead of command execution.'),
      reviewItem('last_resort_operations', 'approval_required', 'Any future command runner must be a last-resort constrained operation with explicit approval.')
    ],
    threat_model: {
      arbitrary_command_input_allowed: false,
      free_form_shell_allowed: false,
      shell_interpreter_allowed: false,
      environment_value_reads_allowed: false,
      credential_values_allowed: false,
      workspace_cwd_confinement_required: true,
      timeout_required: true,
      output_cap_required: true,
      receipt_required_before_execution: true,
      mcp_admin_execute_requires_separate_approval: true
    },
    command_schema: {
      schema_status: 'draft_contract_only',
      allowlist_required: true,
      command_id_required: true,
      args_object_required: true,
      cwd_role_required: true,
      timeout_ms_required: true,
      environment_policy: 'scrubbed_allowlist_future',
      free_form_command_string_allowed: false,
      shell_interpolation_allowed: false,
      unbounded_output_allowed: false
    },
    cli_plan: {
      command: 'shell plan',
      read_only: true,
      execution_available: false,
      run_command: 'shell run --execute',
      run_status: 'fail_closed_approval_required',
      plan_hash_issued: false,
      receipt_written: false
    },
    mcp_readiness: {
      readiness_tool_exposed: true,
      execution_tool_exposed: false,
      safe_profile_readiness_only: true,
      full_profile_readiness_only: true,
      admin_profile_execution_approved: false,
      http_execution_supported: false,
      socket_transport_supported: false
    },
    final_boundary: {
      phase_range: '140-148',
      live_execution_implemented: false,
      mcp_execution_implemented: false,
      separate_approval_required: true
    },
    warnings: [],
    boundary: constrainedShellBoundary()
  };
}

export function constrainedShellRunUnavailableInfo(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const boundary = constrainedShellBoundary();
  return {
    status: 'error',
    data: {
      constrained_shell_execution: {
        schema_version: SCHEMA_VERSION,
        readiness_version: CONSTRAINED_SHELL_READINESS_VERSION,
        generated_at: now.toISOString(),
        requested_execute: options.execute === true,
        status: 'not_available',
        reason: 'Constrained shell execution is approval-bound and fails closed in this phase.',
        boundary
      },
      boundary
    },
    warnings: [],
    errors: [{
      code: 'CONSTRAINED_SHELL_EXECUTION_NOT_AVAILABLE',
      message: 'Constrained shell execution is not available without a separately approved runner implementation.',
      details: {
        approval_required: true,
        command_executed: false,
        mcp_execution_exposed: false
      }
    }],
    artifacts: []
  };
}

export function constrainedShellBoundary() {
  return {
    local_only: true,
    read_only: true,
    artifacts_written: false,
    writes_artifacts: false,
    files_mutated: false,
    deletes_files: false,
    command_executed: false,
    shell_used: false,
    shell_interpreter_used: false,
    child_process_used: false,
    environment_values_read: false,
    credential_values_read: false,
    credential_values_recorded: false,
    provider_call_performed: false,
    api_call_performed: false,
    network_contact: false,
    external_upload: false,
    mcp_readiness_exposed: true,
    mcp_execution_exposed: false,
    mcp_write_execute_exposed: false,
    gate_effect: 'none'
  };
}

function reviewItem(id, decision, summary) {
  return Object.freeze({ id, decision, summary });
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
