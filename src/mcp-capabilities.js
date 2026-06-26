import {
  DEFAULT_MCP_PROFILE,
  MCP_PROFILE_NAMES,
  MCP_PROFILES,
  getMcpTools,
  mcpProfileMetadata,
  resolveMcpProfile
} from './mcp-profiles.js';
import {
  MCP_HTTP_DEFAULT_HOST,
  MCP_HTTP_DEFAULT_PROFILE,
  MCP_HTTP_DEFAULT_TOKEN_ENV
} from './mcp-transport-policy.js';
import { getCapabilityExcludedOperations } from './operation-registry.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const MCP_CAPABILITY_POLICY_VERSION = '1.0.0';
export const MCP_CAPABILITY_DEFAULT_SCOPE = 'all';

const CAPABILITY_SCOPES = Object.freeze(['all', 'profiles', 'excluded']);

const EXCLUDED_OPERATIONS = Object.freeze(getCapabilityExcludedOperations());

export function buildMcpCapabilityReport(options = {}) {
  const scope = String(options.scope ?? MCP_CAPABILITY_DEFAULT_SCOPE).trim();
  if (!CAPABILITY_SCOPES.includes(scope)) {
    return {
      ok: false,
      code: 'INVALID_MCP_CAPABILITY_SCOPE',
      message: `Unsupported MCP capability scope: ${scope}. Expected one of: ${CAPABILITY_SCOPES.join(', ')}.`
    };
  }

  const profileSelection = String(options.profile ?? 'all').trim();
  const profiles = selectedProfiles(profileSelection);
  if (!profiles.ok) {
    return profiles;
  }

  return {
    ok: true,
    report: {
      policy_version: MCP_CAPABILITY_POLICY_VERSION,
      scope,
      server_name: PRODUCT_IDENTITY.mcpServerName,
      default_profile: DEFAULT_MCP_PROFILE,
      admin_policy: adminPolicy(),
      profiles: scope === 'excluded' ? [] : profiles.names.map(profileReport),
      transports: scope === 'excluded' ? [] : transportReports(),
      excluded_operations: scope === 'profiles' ? [] : EXCLUDED_OPERATIONS,
      boundaries: boundarySummary(),
      next_steps: nextSteps()
    }
  };
}

function selectedProfiles(profileSelection) {
  if (profileSelection === 'all') {
    return { ok: true, names: MCP_PROFILE_NAMES };
  }
  const resolved = resolveMcpProfile(profileSelection);
  if (!resolved.ok) {
    return { ok: false, code: 'INVALID_MCP_PROFILE', message: resolved.message };
  }
  return { ok: true, names: [resolved.profile] };
}

function profileReport(profileName) {
  const metadata = mcpProfileMetadata(profileName);
  const tools = getMcpTools(profileName);
  const effectSummary = tools.reduce((summary, tool) => {
    summary.browser_launched ||= Boolean(tool.effects?.browserLaunched);
    summary.writes_artifacts ||= Boolean(tool.effects?.writesArtifacts);
    summary.deletes_files ||= Boolean(tool.effects?.deletesFiles);
    summary.provider_call ||= Boolean(tool.effects?.providerCall);
    summary.shell_used ||= Boolean(tool.effects?.shellUsed);
    summary.external_listener ||= Boolean(tool.effects?.externalListener);
    summary.external_upload ||= Boolean(tool.effects?.externalUpload);
    return summary;
  }, {
    browser_launched: false,
    writes_artifacts: false,
    deletes_files: false,
    provider_call: false,
    shell_used: false,
    external_listener: false,
    external_upload: false
  });

  return {
    name: profileName,
    description: metadata.description,
    default: profileName === DEFAULT_MCP_PROFILE,
    tool_count: tools.length,
    tools: tools.map((tool) => ({
      name: tool.name,
      minimum_profile: tool.minimumProfile,
      effects: tool.effects
    })),
    boundaries: metadata.boundaries,
    effects: effectSummary
  };
}

function transportReports() {
  return [
    {
      transport: 'stdio',
      profiles: MCP_PROFILE_NAMES,
      default_profile: DEFAULT_MCP_PROFILE,
      local_only: true,
      external_listener: false,
      auth_required: false
    },
    {
      transport: 'http',
      profiles: [MCP_HTTP_DEFAULT_PROFILE],
      default_profile: MCP_HTTP_DEFAULT_PROFILE,
      host: MCP_HTTP_DEFAULT_HOST,
      local_only: true,
      external_listener: false,
      auth_required: true,
      token_env: MCP_HTTP_DEFAULT_TOKEN_ENV,
      full_or_admin_supported: false,
      socket_supported: false,
      remote_listener_supported: false
    }
  ];
}

function adminPolicy() {
  const adminTools = getMcpTools('admin');
  const fullToolNames = new Set(getMcpTools('full').map((tool) => tool.name));
  const adminToolNames = new Set(adminTools.map((tool) => tool.name));
  const adminOnlyTools = adminTools.filter((tool) => !fullToolNames.has(tool.name));
  const writeExecuteToolsExposed = adminOnlyTools.some((tool) => (
    tool.effects?.writesArtifacts
    || tool.effects?.providerCall
    || tool.effects?.deletesFiles
    || tool.effects?.shellUsed
  ));
  const agentExecutionRunExposed = adminToolNames.has('browser_debug_agent_execution_run');
  return {
    profile_name: 'admin',
    currently_equivalent_to_full: MCP_PROFILES.admin.tools.join('\n') === MCP_PROFILES.full.tools.join('\n'),
    write_execute_tools_exposed: writeExecuteToolsExposed,
    cleanup_plan_exposed: adminToolNames.has('browser_debug_resource_artifacts_plan'),
    cleanup_execution_exposed: false,
    agent_execution_plan_exposed: adminToolNames.has('browser_debug_agent_execution_plan'),
    agent_execution_run_exposed: agentExecutionRunExposed,
    agentic_human_review_plan_exposed: false,
    agentic_human_review_run_exposed: false,
    agentic_human_review_raw_pixel_transfer_exposed: false,
    agentic_human_review_page_text_transfer_exposed: false,
    provider_api_execution_exposed: agentExecutionRunExposed,
    visual_provider_execution_exposed: false,
    visual_review_run_exposed: false,
    visual_review_result_preparation_exposed: false,
    visual_review_aggregation_exposed: false,
    capture_readiness_exposed: adminToolNames.has('browser_debug_capture_readiness'),
    capture_plan_exposed: adminToolNames.has('browser_debug_capture_plan'),
    capture_execution_exposed: false,
    localization_resources_exposed: adminToolNames.has('browser_debug_localization_resources'),
    report_templates_exposed: adminToolNames.has('browser_debug_report_templates'),
    translation_readiness_exposed: adminToolNames.has('browser_debug_translation_readiness'),
    translation_execution_exposed: false,
    release_readiness_exposed: adminToolNames.has('browser_debug_release_readiness'),
    npm_publication_exposed: false,
    artifact_root_status_exposed: adminToolNames.has('browser_debug_artifact_root_status'),
    artifact_root_migration_exposed: false,
    legacy_alias_audit_exposed: adminToolNames.has('browser_debug_legacy_alias_audit'),
    legacy_alias_removal_readiness_exposed: adminToolNames.has('browser_debug_legacy_alias_removal_readiness'),
    legacy_alias_removal_exposed: false,
    shell_readiness_exposed: adminToolNames.has('browser_debug_shell_readiness'),
    shell_tools_exposed: false,
    final_readiness_exposed: adminToolNames.has('browser_debug_final_readiness'),
    daemon_session_control_exposed: false,
    credential_handling_exposed: false,
    decision: agentExecutionRunExposed ? 'admin-only agent execution approved' : 'read-only policy report only',
    reason: agentExecutionRunExposed
      ? 'Phase 74-76 exposes agent execution plan/run only on the admin MCP profile while safe and full remain non-execution profiles.'
      : 'Phase 36 records the current MCP capability boundary without adding write, delete, provider, shell, or runtime-control tools.'
  };
}

function boundarySummary() {
  const adminPolicySummary = adminPolicy();
  return {
    cleanup_plan: adminPolicySummary.cleanup_plan_exposed,
    cleanup_execution: false,
    agent_execution_plan: adminPolicySummary.agent_execution_plan_exposed,
    agent_execution_run: adminPolicySummary.agent_execution_run_exposed,
    agentic_human_review_plan: false,
    agentic_human_review_run: false,
    agentic_human_review_raw_pixel_transfer: false,
    agentic_human_review_page_text_transfer: false,
    provider_api_execution: adminPolicySummary.provider_api_execution_exposed,
    visual_provider_execution: false,
    visual_review_run: false,
    visual_review_dashboard_read_only: true,
    visual_review_result_preparation: false,
    visual_review_aggregation: false,
    capture_readiness: adminPolicySummary.capture_readiness_exposed,
    capture_plan: adminPolicySummary.capture_plan_exposed,
    capture_execution: false,
    localization_resources: adminPolicySummary.localization_resources_exposed,
    report_templates: adminPolicySummary.report_templates_exposed,
    translation_readiness: adminPolicySummary.translation_readiness_exposed,
    translation_execution: false,
    release_readiness: adminPolicySummary.release_readiness_exposed,
    npm_publication: false,
    artifact_root_status: adminPolicySummary.artifact_root_status_exposed,
    artifact_root_migration: false,
    legacy_alias_audit: adminPolicySummary.legacy_alias_audit_exposed,
    legacy_alias_removal_readiness: adminPolicySummary.legacy_alias_removal_readiness_exposed,
    legacy_alias_removal: false,
    shell_readiness: adminPolicySummary.shell_readiness_exposed,
    constrained_shell_execution: false,
    final_readiness: adminPolicySummary.final_readiness_exposed,
    raw_image_transfer: false,
    raw_page_text_transfer: false,
    arbitrary_shell: false,
    socket_transport: false,
    remote_http_listener: false,
    http_full_or_admin: false,
    credential_values_read: false,
    credential_values_stored: false,
    external_upload: adminPolicySummary.provider_api_execution_exposed,
    browser_profile_reuse: false,
    config_files_written: false
  };
}

function nextSteps() {
  return [
    'Use this report to inspect current MCP tool/profile exposure before configuring a client.',
    'Keep delete, visual review execution, agentic human review execution, shell, daemon/session, and credential-bearing operations on the CLI unless a later phase approves one operation at a time.',
    'Use trace-cue mcp config for token-free client setup metadata.'
  ];
}
