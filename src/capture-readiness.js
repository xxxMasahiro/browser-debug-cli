import { CLI_NAME, SCHEMA_VERSION } from './constants.js';

export const CAPTURE_READINESS_VERSION = '1.0.0';

const SOURCE_CAPABILITIES = Object.freeze([
  sourceCapability({
    id: 'screen',
    source_kind: 'screen_capture',
    required_selection: 'display_or_region',
    privacy_classification: 'may_include_unrelated_private_desktop_content',
    plan_command: ['capture', 'plan', '--source', 'screen']
  }),
  sourceCapability({
    id: 'window',
    source_kind: 'window_capture',
    required_selection: 'explicit_window_or_region',
    privacy_classification: 'may_include_window_edges_overlays_or_notifications',
    plan_command: ['capture', 'plan', '--source', 'window']
  }),
  sourceCapability({
    id: 'desktop-app',
    source_kind: 'desktop_app_capture',
    required_selection: 'explicit_application_surface',
    privacy_classification: 'may_include_application_state_and_neighbor_surfaces',
    plan_command: ['capture', 'plan', '--source', 'desktop-app']
  })
]);

const PLATFORM_SUPPORT = Object.freeze({
  linux: 'possible_with_approved_adapter',
  darwin: 'possible_with_approved_adapter',
  win32: 'possible_with_approved_adapter',
  aix: 'requires_platform_design',
  freebsd: 'requires_platform_design',
  openbsd: 'requires_platform_design',
  sunos: 'requires_platform_design'
});

export const CAPTURE_READINESS_SOURCE_IDS = Object.freeze(SOURCE_CAPABILITIES.map((item) => item.id));

export function buildCaptureReadiness(options = {}, context = {}) {
  const sourceSelection = normalizeCaptureReadinessSource(options.source);
  if (!sourceSelection.ok) {
    return sourceSelection;
  }
  const now = materializeNow(context.now ?? options.now);
  const platform = String(context.platform ?? process.platform);
  const arch = String(context.arch ?? process.arch);
  const capabilities = SOURCE_CAPABILITIES
    .filter((item) => sourceSelection.source === 'all' || item.id === sourceSelection.source)
    .map((item) => capabilityReport(item, platform));
  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      readiness_version: CAPTURE_READINESS_VERSION,
      generated_at: now.toISOString(),
      source_selection: sourceSelection.source,
      probe: {
        method: 'static_process_platform_only',
        platform,
        arch,
        os_capture_api_used: false,
        native_capture_dependency_loaded: false,
        window_enumeration_performed: false,
        process_enumeration_performed: false,
        raw_pixels_read: false,
        raw_pixels_written: false
      },
      summary: {
        source_count: capabilities.length,
        implementation_stage: 'readiness_only',
        cli_plan_available: true,
        cli_execute_available: false,
        mcp_readiness_available: true,
        mcp_execute_available: false,
        capture_performed: false,
        raw_pixels_read: false,
        raw_pixels_written: false,
        writes_artifacts: false,
        owner_review_required_before_capture: true
      },
      capabilities,
      privacy_policy: capturePrivacyPolicy(),
      artifact_contract: captureArtifactContract(),
      approval_bound_operations: approvalBoundOperations(),
      boundary: captureReadinessBoundary(),
      next_steps: [
        'Use capture plan for source-specific no-capture planning.',
        'Use capture handoff for owner-created local image files until capture execution is approved.',
        'Keep CLI and MCP capture execution unavailable until owner review, selected-surface receipts, artifact confinement, and no-raw-pixel JSON gates are implemented.'
      ]
    }
  };
}

export function captureReadinessBoundary() {
  return {
    local_only: true,
    read_only: true,
    readiness_only: true,
    capture_performed: false,
    screen_capture_performed: false,
    window_capture_performed: false,
    desktop_app_capture_performed: false,
    browser_launched: false,
    writes_artifacts: false,
    deletes_files: false,
    provider_call_performed: false,
    api_call_performed: false,
    external_upload: false,
    raw_pixels_read: false,
    raw_pixels_written: false,
    raw_pixels_in_json: false,
    raw_pixels_transferred: false,
    binary_content_included: false,
    credential_values_read: false,
    credential_values_recorded: false,
    mcp_permissions_changed: false,
    mcp_execution_exposed: false,
    mcp_write_execute_exposed: false,
    shell_used: false,
    os_capture_api_used: false,
    native_capture_dependency_loaded: false,
    window_enumeration_performed: false,
    process_enumeration_performed: false,
    static_platform_probe_only: true,
    requires_owner_review_before_capture: true,
    requires_owner_review_before_external_transfer: true,
    gate_effect: 'none'
  };
}

function capabilityReport(item, platform) {
  const supportStatus = PLATFORM_SUPPORT[platform] ?? 'unknown_platform_requires_design';
  return {
    id: item.id,
    source_kind: item.source_kind,
    current_status: 'readiness_only',
    platform_support_status: supportStatus,
    required_selection: item.required_selection,
    privacy_classification: item.privacy_classification,
    cli_plan_available: true,
    cli_plan_command: `${CLI_NAME} ${item.plan_command.join(' ')} --json`,
    cli_execute_available: false,
    mcp_readiness_available: true,
    mcp_execute_available: false,
    adapter_required_before_execution: true,
    capture_artifact_schema_available: true,
    capture_receipt_schema_available: true,
    boundary: captureReadinessBoundary()
  };
}

function capturePrivacyPolicy() {
  return {
    owner_initiated_capture_required: true,
    selected_surface_required: true,
    visible_consent_boundary_required: true,
    window_or_process_enumeration_allowed_in_readiness: false,
    os_capture_api_allowed_in_readiness: false,
    raw_pixels_allowed_in_json: false,
    external_transfer_requires_separate_review: true,
    credential_capture_review_required: true,
    notifications_and_neighbor_content_sensitive: true
  };
}

function captureArtifactContract() {
  return {
    capture_artifact_schema: 'capture_artifact',
    capture_receipt_schema: 'capture_receipt',
    storage_scope: 'configured_artifact_root_only',
    raw_pixel_json_policy: 'forbidden',
    required_artifact_fields: [
      'schema_version',
      'id',
      'created_at',
      'source_kind',
      'selected_surface',
      'artifact',
      'media',
      'privacy',
      'receipt',
      'boundary'
    ],
    required_receipt_fields: [
      'schema_version',
      'id',
      'created_at',
      'operation',
      'source_kind',
      'selected_surface',
      'artifact',
      'disclosure',
      'boundary'
    ],
    implemented_writer_enabled: false
  };
}

function approvalBoundOperations() {
  return [
    'capture run --source screen --execute',
    'capture run --source window --execute',
    'capture run --source desktop-app --execute',
    'MCP admin capture execution'
  ];
}

function sourceCapability({
  id,
  source_kind,
  required_selection,
  privacy_classification,
  plan_command
}) {
  return Object.freeze({
    id,
    source_kind,
    required_selection,
    privacy_classification,
    plan_command: Object.freeze(plan_command)
  });
}

function normalizeCaptureReadinessSource(value) {
  const source = String(value ?? 'all').trim() || 'all';
  if (source === 'all' || CAPTURE_READINESS_SOURCE_IDS.includes(source)) {
    return { ok: true, source };
  }
  return {
    ok: false,
    code: 'INVALID_CAPTURE_READINESS_SOURCE',
    message: `Unsupported capture readiness source: ${source}. Expected one of: all, ${CAPTURE_READINESS_SOURCE_IDS.join(', ')}.`
  };
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
