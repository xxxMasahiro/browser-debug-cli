import { SCHEMA_VERSION } from './constants.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_REGISTRY_VERSION = '1.0.0';

const MCP_EXPOSURE_NONE = Object.freeze({
  safe: false,
  full: false,
  admin: false
});

const MCP_EXPOSURE_ADMIN = Object.freeze({
  safe: false,
  full: false,
  admin: true
});

const MCP_EXPOSURE_ALL = Object.freeze({
  safe: true,
  full: true,
  admin: true
});

const GROUPS = Object.freeze([
  group('operation_governance', 'Operation and execution governance', '60-70'),
  group('provider_mcp', 'Provider MCP readiness and execution boundaries', '71-78'),
  group('cleanup_mcp', 'Artifact cleanup MCP boundaries', '79-84'),
  group('capture', 'Screen, window, and desktop app capture boundaries', '85-95'),
  group('localization', 'UI, report, and translation boundaries', '96-119'),
  group('release_identity', 'npm, artifact-root, and legacy-alias release boundaries', '120-139'),
  group('constrained_shell', 'Constrained shell review boundaries', '140-148'),
  group('final_hardening', 'Cross-feature release hardening', '149-155')
]);

const RISK_TAXONOMY = Object.freeze([
  risk('read', 'Reads local metadata or bounded local files without side effects.'),
  risk('write', 'Writes local artifacts, plans, receipts, reports, or metadata.'),
  risk('delete', 'Deletes local files and requires candidate locking plus receipts.'),
  risk('provider', 'Calls configured local runners or provider/API adapters.'),
  risk('capture', 'Captures or handles screen, window, desktop app, or image evidence.'),
  risk('translation', 'Changes generated language output or calls translation providers.'),
  risk('release', 'Changes package publication, artifact-root, license, or identity compatibility state.'),
  risk('shell', 'Runs constrained commands or any shell-like operation.')
]);

const OPERATIONS = Object.freeze([
  operation({
    id: 'operation_registry',
    group: 'operation_governance',
    command: 'operation registry',
    category: 'operation_governance',
    cliAvailable: true,
    currentStatus: 'read_only_available',
    proposedStage: 'foundation_ready',
    risk: ['read'],
    mcpGate: false,
    capabilityExcluded: false,
    gates: [
      gate('read_only', 'Registry inspection must not write artifacts or change permissions.'),
      gate('source_of_truth', 'MCP capability and execution-gate reports should derive risky operation metadata from this registry.')
    ]
  }),
  operation({
    id: 'agent_execution_plan',
    group: 'operation_governance',
    command: 'agent execution plan',
    category: 'agent_execution_write',
    cliAvailable: true,
    currentStatus: 'admin_exposed',
    proposedStage: 'admin_planning_available',
    risk: ['write', 'provider'],
    mcpExposure: MCP_EXPOSURE_ADMIN,
    capabilityExcluded: false,
    capabilityReason: 'Writes dry-run execution plan metadata and receipts.',
    futureReview: 'Further expansion outside the admin profile requires a separate approval and tests.',
    gates: [
      gate('admin_profile_only', 'Planning exposure would require an explicit admin-only write profile decision.'),
      gate('package_confined', 'Planning must read only workspace-confined local agent packages.'),
      gate('receipt_required', 'Planning writes need content-free local receipts.'),
      gate('no_provider_call', 'Planning must not call local runners or provider APIs.'),
      gate('idempotent_request_key', 'MCP callers need a request key so retries do not duplicate plans unexpectedly.')
    ]
  }),
  operation({
    id: 'agent_package_ingest_report',
    group: 'operation_governance',
    command: 'agent package / ingest / report',
    category: 'agent_advisory_write',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'planning_gate_required',
    risk: ['write'],
    mcpGate: false,
    capabilityReason: 'Creates or imports local advisory artifacts and reports.',
    futureReview: 'Requires per-command receipts, package/result confinement, and no provider execution.',
    gates: [
      gate('receipt_required', 'Write-producing advisory commands need local receipts.'),
      gate('no_provider_call', 'Advisory package, ingest, and report commands must not execute providers.'),
      gate('review_gate_neutrality', 'Advisory writes must not mutate deterministic review gates.')
    ]
  }),
  operation({
    id: 'agent_workflow_create_report',
    group: 'operation_governance',
    command: 'agent workflow create / report',
    category: 'agent_workflow_write',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'planning_gate_required',
    risk: ['write'],
    mcpGate: false,
    capabilityReason: 'Creates workflow manifests or writes workflow reports under the local artifact root.',
    futureReview: 'Requires workflow receipt parity and clear separation from read-only status/index tools.',
    gates: [
      gate('receipt_required', 'Workflow writes need local receipts.'),
      gate('artifact_root_confined', 'Workflow artifacts must stay under the configured local artifact root.'),
      gate('status_read_separation', 'Workflow status and index reads must remain separate from write-producing commands.')
    ]
  }),
  operation({
    id: 'daemon_session_control',
    group: 'operation_governance',
    command: 'daemon start/status/stop and session start/act/report/spec',
    category: 'local_runtime_control',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'runtime_control_gate_required',
    risk: ['write', 'capture'],
    mcpGate: false,
    capabilityReason: 'Controls local browser runtime state or writes browser/session artifacts.',
    futureReview: 'Requires lifecycle receipts, process ownership constraints, and browser artifact disclosure review.',
    gates: [
      gate('process_ownership', 'Runtime control must be limited to TraceCue-owned processes.'),
      gate('browser_artifact_disclosure', 'Browser/session artifacts need local disclosure boundaries.'),
      gate('no_arbitrary_process_control', 'Runtime control must not become arbitrary process control.')
    ]
  }),
  operation({
    id: 'agent_execution_run',
    group: 'provider_mcp',
    command: 'agent execution run --execute',
    category: 'provider_execution',
    cliAvailable: true,
    currentStatus: 'admin_exposed',
    proposedStage: 'admin_execution_available',
    risk: ['provider', 'write'],
    mcpExposure: MCP_EXPOSURE_ADMIN,
    capabilityExcluded: false,
    capabilityReason: 'May call configured local runners or provider/API adapters after explicit CLI execution approval.',
    futureReview: 'Further expansion outside the admin profile requires a separate approval, credential boundary review, and provider disclosure policy.',
    gates: [
      gate('admin_profile_only', 'Provider execution through MCP would require an explicit admin-only execution profile decision.'),
      gate('plan_required', 'Execution must reference a matching dry-run plan.'),
      gate('explicit_execute_intent', 'MCP execution must carry an explicit execute intent separate from planning.'),
      gate('credential_boundary', 'Credentials must remain environment-only and must never be passed as tool arguments.'),
      gate('bounded_disclosure', 'Package and prompt disclosure must stay bounded by the existing disclosure policy.'),
      gate('receipt_required', 'Execution must write local receipts that omit raw provider responses and credential values.'),
      gate('gate_neutrality', 'Execution must not mutate deterministic findings, release gates, or existing reviews.')
    ]
  }),
  operation({
    id: 'provider_mcp_plan',
    group: 'provider_mcp',
    command: 'provider MCP plan',
    category: 'provider_execution_planning',
    cliAvailable: false,
    currentStatus: 'draft_only',
    proposedStage: 'readiness_report_required',
    risk: ['read', 'provider'],
    gates: [
      gate('no_provider_call', 'Provider MCP planning must not call providers.'),
      gate('bounded_disclosure', 'Any plan must disclose exactly which package and prompt fields could leave the process.')
    ]
  }),
  operation({
    id: 'provider_mcp_api_execute',
    group: 'provider_mcp',
    command: 'provider/API execution through MCP admin',
    category: 'provider_execution',
    cliAvailable: false,
    currentStatus: 'admin_exposed_via_agent_execution_run',
    proposedStage: 'admin_execution_available',
    risk: ['provider', 'write'],
    capabilityId: 'provider_api_execution',
    mcpExposure: MCP_EXPOSURE_ADMIN,
    capabilityExcluded: false,
    capabilityReason: 'May send bounded package/prompt data outside the local process through the Phase 29 adapter.',
    futureReview: 'Further expansion outside the admin agent execution path requires explicit external-service, credential, and evidence-disclosure approval.',
    gates: [
      gate('admin_profile_only', 'Provider/API execution must stay out of safe and full profiles.'),
      gate('env_only_credentials', 'Credentials must be read only from named environment variables.'),
      gate('receipt_required', 'Execution must write local receipts without raw provider responses or credential values.')
    ]
  }),
  operation({
    id: 'resource_artifacts_cleanup_plan',
    group: 'cleanup_mcp',
    command: 'resource artifacts plan',
    category: 'cleanup_planning',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'read_only_plan_hardened',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Cleanup planning must not delete files or write receipts.'),
      gate('no_execute_argument', 'MCP cleanup planning must reject execute-like arguments.'),
      gate('candidate_lock', 'Cleanup candidates must include path, type, size, mtime, and content hash locks.'),
      gate('plan_hash', 'Cleanup plans must include a deterministic plan hash for later CLI revalidation.'),
      gate('artifact_root_confined', 'Planning must inspect only regular files whose realpaths stay under the configured artifact root.')
    ]
  }),
  operation({
    id: 'resource_artifacts_cleanup_execute',
    group: 'cleanup_mcp',
    command: 'resource artifacts cleanup --execute',
    category: 'cleanup',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'destructive_gate_required',
    risk: ['delete', 'write'],
    capabilityReason: 'Deletes local artifact files and must stay explicit at the CLI boundary.',
    futureReview: 'Requires selected artifact-root receipts, failure-safe dry-run parity, and separate MCP cleanup approval.',
    gates: [
      gate('admin_profile_only', 'Cleanup execution through MCP would require an explicit admin-only destructive-operation decision.'),
      gate('dry_run_parity', 'Cleanup execution must match a prior dry-run candidate set.'),
      gate('candidate_lock', 'Cleanup candidates must be locked by path, size, mtime, and content hash before execution.'),
      gate('artifact_root_confined', 'Cleanup must delete only selected regular files under the configured artifact root.'),
      gate('receipt_required', 'Cleanup must write a local deletion receipt.'),
      gate('no_system_cleanup', 'Cleanup must not mutate host cache, swap, privileged helpers, or arbitrary processes.')
    ]
  }),
  operation({
    id: 'capture_readiness_probe',
    group: 'capture',
    command: 'capture readiness',
    category: 'capture_readiness',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'no_capture_readiness_available',
    risk: ['read', 'capture'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Capture readiness must not write artifacts or perform capture.'),
      gate('no_os_capture_api', 'Readiness must not call OS capture APIs or load native capture dependencies.'),
      gate('no_window_or_process_enumeration', 'Readiness must not enumerate windows or processes.'),
      gate('no_raw_pixels', 'Readiness must not read, write, or embed raw pixels.'),
      gate('execution_unavailable', 'CLI and MCP capture execution must remain unavailable until a separate approval.')
    ]
  }),
  operation({
    id: 'capture_plan_read_only',
    group: 'capture',
    command: 'capture plan',
    category: 'capture_planning',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'no_capture_plan_available',
    risk: ['read', 'capture'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Capture planning must not write artifacts or perform capture.'),
      gate('selected_surface_policy', 'Planning must record selected-surface policy without selecting a live surface.'),
      gate('no_raw_pixels', 'Planning must not read, write, or embed raw pixels.'),
      gate('mcp_read_only', 'MCP exposure must stay read-only and reject execute-like arguments.')
    ]
  }),
  operation({
    id: 'capture_handoff_file_read',
    group: 'capture',
    command: 'capture handoff --image',
    category: 'desktop_capture_metadata',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'read_exposure_gate_required',
    risk: ['read', 'capture'],
    capabilityReason: 'Reads existing workspace image bytes for metadata and can reference sensitive desktop content.',
    futureReview: 'Requires workspace-confined file input policy, owner review, and no raw-pixel JSON guarantees before MCP exposure.',
    gates: [
      gate('workspace_confined', 'Capture handoff input must stay workspace-confined.'),
      gate('no_raw_pixel_json', 'JSON output must not embed raw pixels.'),
      gate('owner_review_required', 'Desktop capture metadata can reference sensitive local content and needs owner review before MCP exposure.')
    ]
  }),
  operation({
    id: 'screen_window_capture_execute',
    group: 'capture',
    command: 'capture run --execute',
    category: 'desktop_capture_execution',
    cliAvailable: true,
    currentStatus: 'fail_closed_cli_gate',
    proposedStage: 'capture_gate_required',
    risk: ['capture', 'write'],
    capabilityId: 'screen_window_capture_execution',
    capabilityReason: 'Screen, window, and desktop app capture execution is not implemented in this planning phase.',
    futureReview: 'Requires owner-initiated capture, selected surface constraints, local artifact receipts, raw-pixel JSON exclusion, and separate MCP execution approval before exposure.',
    gates: [
      gate('admin_profile_only', 'Capture execution through MCP would require an explicit admin-only execution profile decision.'),
      gate('owner_initiated_capture', 'Capture must be initiated by the local workspace owner.'),
      gate('selected_surface_required', 'Execution must target an explicit screen, region, window, or desktop app surface.'),
      gate('artifact_root_confined', 'Captured files must stay under the configured local artifact root.'),
      gate('no_raw_pixel_json', 'JSON output must reference local artifacts and metadata instead of embedding pixels.'),
      gate('receipt_required', 'Execution must write local receipts that identify capture scope without storing credentials.'),
      gate('external_transfer_review', 'Any external transfer requires separate owner review after capture.')
    ]
  }),
  operation({
    id: 'visual_review_prepare',
    group: 'operation_governance',
    command: 'visual review prepare',
    category: 'visual_review_preparation',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'planning_gate_required',
    risk: ['write', 'capture'],
    capabilityId: 'visual_review_result_preparation',
    capabilityReason: 'Writes local metadata-only preparation artifacts for future visual review results and is not exposed through MCP in this phase.',
    futureReview: 'Requires a separate MCP planning approval, receipt parity, and continued no-provider/no-transfer enforcement before exposure.',
    gates: [
      gate('admin_profile_only', 'MCP exposure would require an explicit admin-only write profile decision.'),
      gate('artifact_root_confined', 'Preparation writes must stay under the configured local artifact root.'),
      gate('receipt_required', 'Preparation writes need content-free local receipts with operation ids.'),
      gate('no_provider_call', 'Preparation must remain no-provider and no-API.'),
      gate('no_raw_pixels', 'Preparation must continue reading visual evidence metadata only.'),
      gate('idempotent_request_key', 'MCP callers need a request key so retries do not duplicate artifacts unexpectedly.')
    ]
  }),
  operation({
    id: 'desktop_review_provider_preparation_plan',
    group: 'capture',
    command: 'visual review plan --capture-handoff',
    category: 'desktop_review_provider_preparation',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'read_exposure_gate_required',
    risk: ['read', 'capture', 'provider'],
    capabilityReason: 'Reads caller-declared desktop capture handoff metadata that can reference sensitive desktop content and remains CLI/API-only in this phase.',
    futureReview: 'Requires owner-review semantics, no raw-pixel transfer guarantees, and MCP read exposure approval before any MCP tool is added.',
    gates: [
      gate('safe_profile_review', 'MCP exposure would require explicit approval because capture handoff metadata can reference sensitive desktop content.'),
      gate('no_artifact_write', 'Planning must remain read-only and must not create preparation artifacts.'),
      gate('no_provider_call', 'Planning must not call providers or API adapters.'),
      gate('no_raw_pixels', 'Planning must read capture handoff JSON only and must not read or transfer image bytes.'),
      gate('owner_review_required', 'Provider preparation and external evidence transfer must remain owner-reviewed future actions.')
    ]
  }),
  operation({
    id: 'visual_review_run',
    group: 'provider_mcp',
    command: 'visual review run --execute',
    category: 'visual_provider_execution',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'execution_gate_required',
    risk: ['provider', 'capture', 'write'],
    capabilityReason: 'Runs visual review provider adapters from preparation metadata and writes local advisory artifacts; MCP exposure is intentionally excluded.',
    futureReview: 'Requires dedicated MCP planning approval, receipt parity, credential boundary review, and continued no-raw-pixel enforcement before exposure.',
    gates: [
      gate('admin_profile_only', 'Provider execution through MCP would require an explicit admin-only execution profile decision.'),
      gate('preparation_required', 'Execution must reference a valid metadata-only preparation artifact.'),
      gate('explicit_execute_intent', 'MCP execution must carry an explicit execute intent separate from planning.'),
      gate('provider_policy_match', 'Surface, provider, model, and disclosure policy must match the preparation contract.'),
      gate('credential_boundary', 'Credentials must remain environment-only and must never be passed as tool arguments.'),
      gate('no_raw_pixel_transfer', 'Raw-pixel transfer remains disabled unless a separate raw-image transfer design is approved.'),
      gate('receipt_required', 'Execution must write local receipts that omit raw provider responses and credential values.'),
      gate('gate_neutrality', 'Execution must not mutate deterministic findings, release gates, or existing reviews.')
    ]
  }),
  operation({
    id: 'visual_review_aggregation',
    group: 'operation_governance',
    command: 'visual review aggregate',
    category: 'visual_review_aggregation',
    cliAvailable: true,
    currentStatus: 'not_exposed',
    proposedStage: 'read_exposure_gate_required',
    risk: ['read', 'provider'],
    capabilityReason: 'Aggregates existing local visual review result metadata and untrusted advisory findings; MCP exposure remains excluded until read-only attribution and bounding gates are reviewed.',
    futureReview: 'Requires no-artifact-write, no-provider-call, no-raw-pixel, untrusted-output bounding, and source-attribution tests before any MCP read exposure.',
    gates: [
      gate('no_artifact_write', 'Aggregation must remain read-only and must not write artifacts.'),
      gate('no_provider_call', 'Aggregation must not call providers or API adapters.'),
      gate('no_raw_pixels', 'Aggregation must read local result metadata only and must not read raw image bytes.'),
      gate('untrusted_output_bounded', 'Aggregated advisory text must stay bounded, deterministic, and marked as untrusted.'),
      gate('source_attribution_required', 'Every aggregated finding must keep source result, provider, model, and finding attribution.')
    ]
  }),
  operation({
    id: 'visual_provider_execution',
    group: 'provider_mcp',
    command: 'raw-pixel visual provider execution',
    category: 'visual_provider_execution',
    cliAvailable: false,
    currentStatus: 'not_available',
    proposedStage: 'external_transfer_gate_required',
    risk: ['provider', 'capture'],
    capabilityReason: 'Raw-pixel visual provider execution is not available through CLI or MCP in this phase.',
    futureReview: 'Requires explicit image-transfer approval, size/type/reference caps, transfer receipts, and separate MCP execution approval before exposure.',
    gates: [
      gate('explicit_image_transfer_approval', 'Raw-pixel transfer requires separate owner approval.'),
      gate('credential_boundary', 'Provider credentials must stay env-only.'),
      gate('receipt_required', 'Transfer and provider execution would need local receipts without raw provider responses.')
    ]
  }),
  operation({
    id: 'ui_i18n_resource_runtime',
    group: 'localization',
    command: 'settings locale resources',
    category: 'localization',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'provider_free_localization_allowed',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('raw_evidence_preserved', 'UI localization must not translate page text, selectors, logs, traces, screenshots, or provider output.'),
      gate('fallback_required', 'Locale resources need deterministic fallback to the baseline language.')
    ]
  }),
  operation({
    id: 'report_localized_rendering',
    group: 'localization',
    command: 'settings report templates',
    category: 'report_localization',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'provider_free_template_contract_available',
    risk: ['read', 'translation'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('raw_evidence_non_translation', 'Report templates must not translate raw page evidence.'),
      gate('artifact_language_policy_match', 'Report language must follow artifact output language settings.')
    ]
  }),
  operation({
    id: 'translation_readiness',
    group: 'localization',
    command: 'translation readiness',
    category: 'translation_readiness',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'provider_free_readiness_available',
    risk: ['read', 'translation'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Translation readiness must not write artifacts or call providers.'),
      gate('minimal_disclosure', 'Readiness must classify generated chrome separately from raw evidence.'),
      gate('raw_evidence_non_translation', 'Raw page evidence, selectors, URLs, logs, traces, screenshots, and provider output must never be translated.')
    ]
  }),
  operation({
    id: 'translation_mcp_admin_execute',
    group: 'localization',
    command: 'translation run --execute',
    category: 'translation_execution',
    cliAvailable: true,
    currentStatus: 'fail_closed_cli_gate',
    proposedStage: 'translation_gate_required',
    risk: ['translation', 'provider', 'write'],
    gates: [
      gate('provider_threat_model', 'Translation provider execution requires a dedicated threat model.'),
      gate('minimal_disclosure', 'Only approved generated template text may leave the process.'),
      gate('raw_evidence_non_translation', 'Raw page evidence, selectors, URLs, logs, traces, screenshots, and provider output must never be translated.'),
      gate('admin_profile_only', 'MCP translation execution must stay admin-only if ever implemented.'),
      gate('receipt_required', 'Translation execution must write local receipts without raw provider responses or credential values.')
    ]
  }),
  operation({
    id: 'release_readiness',
    group: 'release_identity',
    command: 'release readiness',
    category: 'release_readiness',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'local_readiness_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Release readiness must not mutate package metadata or product documents.'),
      gate('no_registry_contact', 'Release readiness must not contact npm, check auth, read tokens, or publish.'),
      gate('approval_boundary', 'Publication, publish dry-run, package visibility, and license changes remain approval-bound.')
    ]
  }),
  operation({
    id: 'npm_publish',
    group: 'release_identity',
    command: 'package publication',
    category: 'package_publication',
    cliAvailable: false,
    currentStatus: 'approval_bound',
    proposedStage: 'release_approval_required',
    risk: ['release'],
    gates: [
      gate('package_name_decision', 'Public package naming must be approved before publication.'),
      gate('license_decision', 'License must be approved before publication.'),
      gate('token_handling_policy', 'npm token, provenance, and 2FA policy must be approved.'),
      gate('publish_dry_run', 'Local publish dry-run and release checks must pass without publishing.')
    ]
  }),
  operation({
    id: 'artifact_root_status',
    group: 'release_identity',
    command: 'artifact-root status',
    category: 'artifact_root_policy',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'read_only_policy_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Artifact-root status must not write artifacts or migrate files.'),
      gate('legacy_compatibility', 'Status must preserve current artifact-root behavior until migration is approved.'),
      gate('identity_derived_roots', 'Canonical, future, and legacy roots must derive from product identity metadata.')
    ]
  }),
  operation({
    id: 'artifact_root_migration_plan',
    group: 'release_identity',
    command: 'artifact-root migration plan',
    category: 'artifact_root_migration',
    cliAvailable: true,
    currentStatus: 'read_only_available',
    proposedStage: 'dry_run_plan_available',
    risk: ['read'],
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Migration planning must not copy, delete, or overwrite files.'),
      gate('plan_hash', 'Migration plans need deterministic plan hashes for fixture revalidation.'),
      gate('conflict_detection', 'Plans must detect target conflicts before any fixture execution.')
    ]
  }),
  operation({
    id: 'artifact_root_migration_execute',
    group: 'release_identity',
    command: 'artifact-root migration execute',
    category: 'artifact_root_migration',
    cliAvailable: true,
    currentStatus: 'fixture_only_cli_gate',
    proposedStage: 'real_migration_approval_required',
    risk: ['release', 'write'],
    gates: [
      gate('canonical_root_policy', 'Canonical and legacy artifact-root policy must be approved.'),
      gate('dry_run_parity', 'Migration execution must match a prior dry-run plan.'),
      gate('receipt_required', 'Migration must write local receipts.'),
      gate('legacy_compatibility', 'Legacy artifact-root compatibility must remain until the approved boundary.'),
      gate('fixture_only_without_approval', 'Unapproved execution must be confined to explicit temporary fixtures and must not delete legacy files.')
    ]
  }),
  operation({
    id: 'legacy_alias_audit',
    group: 'release_identity',
    command: 'identity aliases',
    category: 'identity_compatibility',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'read_only_audit_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Legacy alias audit must not mutate package, MCP, plugin, or docs metadata.'),
      gate('compatibility_retained', 'Legacy aliases must remain available until an approved removal boundary.'),
      gate('warning_only', 'Deprecation warnings must be advisory and must not break machine-readable JSON output.')
    ]
  }),
  operation({
    id: 'legacy_alias_removal_readiness',
    group: 'release_identity',
    command: 'identity aliases removal-readiness',
    category: 'identity_compatibility',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'removal_readiness_report_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Legacy alias removal readiness must not mutate package, MCP, plugin, docs, or artifact-root metadata.'),
      gate('removal_not_authorized', 'Readiness must report that alias removal is not authorized in the current compatibility window.'),
      gate('compatibility_retained', 'Package bins, MCP aliases, plugin skill paths, and artifact-root compatibility must remain retained.')
    ]
  }),
  operation({
    id: 'legacy_alias_removal',
    group: 'release_identity',
    command: 'identity aliases remove',
    category: 'identity_compatibility',
    cliAvailable: true,
    currentStatus: 'fail_closed_cli_gate',
    proposedStage: 'compatibility_window_required',
    risk: ['release'],
    gates: [
      gate('usage_audit', 'Legacy alias usage must be audited first.'),
      gate('deprecation_window', 'A compatibility window and migration guide must be approved.'),
      gate('release_boundary', 'Alias removal must happen only at an approved release boundary.')
    ]
  }),
  operation({
    id: 'constrained_shell_readiness',
    group: 'constrained_shell',
    command: 'shell readiness / shell plan',
    category: 'shell_readiness',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'plan_only_readiness_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Shell readiness must not execute commands, write receipts, or read environment values.'),
      gate('no_child_process', 'Readiness and plan modules must not import process execution APIs.'),
      gate('execution_unavailable', 'CLI and MCP shell execution must remain unavailable until a separate approval.')
    ]
  }),
  operation({
    id: 'constrained_shell_execute',
    group: 'constrained_shell',
    command: 'shell run --execute',
    category: 'shell',
    cliAvailable: true,
    currentStatus: 'fail_closed_cli_gate',
    proposedStage: 'use_case_review_required',
    risk: ['shell', 'write'],
    capabilityId: 'arbitrary_shell',
    capabilityReason: 'No arbitrary shell tool is exposed by the CLI or MCP profiles.',
    futureReview: 'Held out of scope until there is a separate threat model, allowlist design, and operational history.',
    gates: [
      gate('use_case_review', 'First reassess whether shell execution is needed at all.'),
      gate('threat_model_required', 'Shell execution requires a dedicated threat model.'),
      gate('allowlist_schema', 'Only allowlisted commands may run.'),
      gate('cwd_confinement', 'Execution must be confined to approved working directories.'),
      gate('environment_scrubbing', 'Environment must be scrubbed before command execution.'),
      gate('timeout_required', 'Every command must have a timeout and receipt.')
    ]
  }),
  operation({
    id: 'constrained_shell_mcp_execute',
    group: 'constrained_shell',
    command: 'constrained shell execution through MCP admin',
    category: 'shell',
    cliAvailable: false,
    currentStatus: 'not_available',
    proposedStage: 'admin_shell_gate_required',
    risk: ['shell', 'write'],
    gates: [
      gate('admin_profile_only', 'MCP shell execution must stay admin-only if ever implemented.'),
      gate('allowlist_schema', 'Only allowlisted commands may run.'),
      gate('receipt_required', 'Execution receipts must record command identity without secrets.'),
      gate('no_free_form_shell', 'Free-form shell input must never be accepted.')
    ]
  }),
  operation({
    id: 'final_hardening_readiness',
    group: 'final_hardening',
    command: 'final readiness',
    category: 'release_hardening',
    cliAvailable: true,
    currentStatus: 'safe_full_admin_exposed',
    proposedStage: 'local_readiness_report_available',
    risk: ['read'],
    mcpExposure: MCP_EXPOSURE_ALL,
    capabilityExcluded: false,
    mcpGate: false,
    gates: [
      gate('read_only', 'Final readiness must not run gates, launch browsers, trigger remote CI, publish, push, or mutate files.'),
      gate('regression_matrix', 'Readiness must cover provider, cleanup, capture, localization, release, artifact-root, alias, shell, MCP, browser, and security families.'),
      gate('no_overclaiming', 'Readiness must distinguish available checks from checks executed by the report.')
    ]
  }),
  operation({
    id: 'http_full_admin_socket_remote',
    group: 'final_hardening',
    command: 'HTTP full/admin, socket transport, or remote HTTP listener',
    category: 'transport_expansion',
    cliAvailable: false,
    currentStatus: 'not_available',
    proposedStage: 'transport_security_design_required',
    risk: ['provider', 'shell'],
    capabilityReason: 'Current HTTP MCP transport is safe-profile-only and loopback-only.',
    futureReview: 'Requires separate transport security design before any broader listener or profile support.',
    gates: [
      gate('transport_threat_model', 'Remote listeners and socket transports require a dedicated transport threat model.'),
      gate('credential_boundary', 'Authentication must not expose token values or persistent credentials.'),
      gate('profile_gate', 'HTTP full/admin must not bypass profile or operation gates.')
    ]
  }),
  operation({
    id: 'full_release_gate_hardening',
    group: 'final_hardening',
    command: 'full release gate hardening',
    category: 'release_hardening',
    cliAvailable: false,
    currentStatus: 'planned',
    proposedStage: 'final_matrix_required',
    risk: ['release'],
    capabilityExcluded: false,
    gates: [
      gate('regression_matrix', 'Provider, cleanup, capture, localization, npm, artifact-root, alias, and shell boundaries need a final regression matrix.'),
      gate('security_sweep', 'Secrets, provider, shell, upload, and capture boundaries need a final sweep.'),
      gate('product_gate', 'Final product gate must pass before release readiness is reported.')
    ]
  })
]);

export const OPERATION_GROUP_IDS = Object.freeze(GROUPS.map((item) => item.id));
export const OPERATION_IDS = Object.freeze(OPERATIONS.map((item) => item.id));
export const OPERATION_CAPABILITY_IDS = Object.freeze([...new Set(OPERATIONS.map((item) => item.capability_id))]);
export const OPERATION_RISK_IDS = Object.freeze(RISK_TAXONOMY.map((item) => item.id));

const OPERATION_CAPABILITY_ID_ALIASES = new Map(
  OPERATIONS
    .filter((item) => item.capability_id !== item.id)
    .map((item) => [item.capability_id, item.id])
);

export function buildOperationRegistryReport(options = {}, context = {}) {
  const operationSelection = normalizeOperationSelection(options.operation);
  if (!operationSelection.ok) {
    return operationSelection;
  }
  const groupSelection = normalizeSelection(options.group, OPERATION_GROUP_IDS, 'group');
  if (!groupSelection.ok) {
    return groupSelection;
  }
  const riskSelection = normalizeSelection(options.risk, OPERATION_RISK_IDS, 'risk');
  if (!riskSelection.ok) {
    return riskSelection;
  }
  const now = materializeNow(context.now ?? options.now);
  const operations = OPERATIONS
    .filter((item) => operationSelection.value === 'all' || item.id === operationSelection.value)
    .filter((item) => groupSelection.value === 'all' || item.group === groupSelection.value)
    .filter((item) => riskSelection.value === 'all' || item.risk.effects.includes(riskSelection.value))
    .map(publicOperation);
  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      registry_version: OPERATION_REGISTRY_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      operation_selection: operationSelection.value,
      group_selection: groupSelection.value,
      risk_selection: riskSelection.value,
      summary: summarizeOperations(operations),
      groups: GROUPS,
      risk_taxonomy: RISK_TAXONOMY,
      operations,
      boundary: operationRegistryBoundary(),
      next_steps: [
        'Use this registry as the shared source for risky operation policy reports.',
        'Promote one operation family at a time; do not treat registry presence as execution approval.',
        'Keep MCP write/execute exposure disabled until tokens, receipts, policy, and tests exist for a specific operation.'
      ]
    }
  };
}

export function operationRegistryBoundary() {
  return {
    local_only: true,
    read_only: true,
    writes_artifacts: false,
    deletes_files: false,
    provider_call_performed: false,
    api_call_performed: false,
    capture_performed: false,
    translation_execution_performed: false,
    npm_publish_performed: false,
    artifact_root_migration_performed: false,
    legacy_alias_removed: false,
    external_upload: false,
    raw_pixels_read: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_provider_response_stored: false,
    mcp_permissions_changed: false,
    mcp_write_execute_exposed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

export function getOperationRegistryOperations() {
  return OPERATIONS.map(publicOperation);
}

export function getMcpExecutionGateOperations() {
  return OPERATIONS.filter((item) => item.mcp_gate).map(publicOperation);
}

export function getMcpExecutionGateOperationIds() {
  return getMcpExecutionGateOperations().map((item) => item.id);
}

export function getCapabilityExcludedOperations() {
  return OPERATIONS
    .filter((item) => item.capability_excluded)
    .map((item) => Object.freeze({
      id: item.capability_id,
      operation_id: item.id,
      command: item.command,
      category: item.category,
      cli_available: item.cli_available,
      mcp_safe: false,
      mcp_full: false,
      mcp_admin: false,
      decision: item.current_status === 'not_available' ? 'not_available' : 'not_exposed',
      reason: item.capability_reason,
      future_review_required: true,
      future_review: item.future_review
    }));
}

export function findOperation(id) {
  const operationSelection = normalizeOperationSelection(id);
  if (!operationSelection.ok || operationSelection.value === 'all') {
    return null;
  }
  return OPERATIONS.find((item) => item.id === operationSelection.value) ?? null;
}

function normalizeOperationSelection(value) {
  const selection = String(value ?? 'all').trim() || 'all';
  if (selection === 'all') {
    return { ok: true, value: selection };
  }
  const canonical = OPERATION_CAPABILITY_ID_ALIASES.get(selection) ?? selection;
  if (OPERATION_IDS.includes(canonical)) {
    return { ok: true, value: canonical };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION',
    message: `Unsupported operation: ${selection}. Expected one of: all, ${OPERATION_IDS.join(', ')}; capability aliases: ${OPERATION_CAPABILITY_IDS.join(', ')}.`
  };
}

function operation({
  id,
  group,
  command,
  category,
  cliAvailable,
  currentStatus,
  proposedStage,
  risk,
  gates,
  capabilityExcluded = true,
  capabilityId = id,
  capabilityReason,
  futureReview,
  mcpGate = true,
  mcpExposure = MCP_EXPOSURE_NONE
}) {
  const record = {
    id,
    group,
    command,
    category,
    cli_available: cliAvailable,
    current_status: currentStatus,
    proposed_stage: proposedStage,
    current_mcp_exposure: mcpExposure,
    risk: riskRecord(risk),
    required_gate_count: gates.length,
    required_gates: Object.freeze(gates),
    capability_excluded: capabilityExcluded,
    capability_id: capabilityId,
    capability_reason: capabilityReason ?? 'Operation is not exposed through the current MCP profiles.',
    future_review: futureReview ?? 'Requires a separate approval, implementation plan, and tests before exposure.',
    mcp_gate: mcpGate,
    boundary: operationRegistryBoundary()
  };
  return Object.freeze(record);
}

function publicOperation(item) {
  return {
    id: item.id,
    group: item.group,
    command: item.command,
    category: item.category,
    cli_available: item.cli_available,
    current_status: item.current_status,
    proposed_stage: item.proposed_stage,
    current_mcp_exposure: item.current_mcp_exposure,
    risk: item.risk,
    required_gate_count: item.required_gate_count,
    required_gates: item.required_gates,
    capability_excluded: item.capability_excluded,
    capability_id: item.capability_id,
    future_review: item.future_review,
    boundary: item.boundary
  };
}

function summarizeOperations(operations) {
  const writeExecuteToolsExposed = operations.some((item) => (
    Boolean(item.current_mcp_exposure?.admin)
    && item.risk.effects.some((effect) => ['write', 'delete', 'provider', 'release', 'shell'].includes(effect))
  ));
  return {
    operation_count: operations.length,
    group_count: new Set(operations.map((item) => item.group)).size,
    write_execute_tools_exposed: writeExecuteToolsExposed,
    execution_ready_for_mcp: operations.some((item) => item.id === 'agent_execution_run' && item.current_mcp_exposure?.admin === true),
    planning_write_ready_for_mcp: operations.some((item) => item.id === 'agent_execution_plan' && item.current_mcp_exposure?.admin === true),
    read_only_registry_only: true,
    by_group: OPERATION_GROUP_IDS.reduce((summary, groupId) => {
      const count = operations.filter((item) => item.group === groupId).length;
      if (count > 0) {
        summary[groupId] = count;
      }
      return summary;
    }, {}),
    by_risk: OPERATION_RISK_IDS.reduce((summary, riskId) => {
      const count = operations.filter((item) => item.risk.effects.includes(riskId)).length;
      if (count > 0) {
        summary[riskId] = count;
      }
      return summary;
    }, {})
  };
}

function group(id, label, phaseRange) {
  return Object.freeze({
    id,
    label,
    phase_range: phaseRange
  });
}

function risk(id, description) {
  return Object.freeze({ id, description });
}

function riskRecord(effects) {
  return Object.freeze({
    effects: Object.freeze([...effects]),
    destructive: effects.includes('delete'),
    external_service: effects.includes('provider') || effects.includes('translation') || effects.includes('release'),
    release_bound: effects.includes('release'),
    approval_required_before_execution: effects.some((effect) => ['delete', 'provider', 'capture', 'translation', 'release', 'shell'].includes(effect))
  });
}

function gate(id, description) {
  return Object.freeze({
    id,
    required: true,
    status: 'required_before_exposure',
    enforcement: 'not_implemented_for_mcp_execution',
    description
  });
}

function normalizeSelection(value, allowed, label) {
  const selection = String(value ?? 'all').trim() || 'all';
  if (selection === 'all' || allowed.includes(selection)) {
    return { ok: true, value: selection };
  }
  return {
    ok: false,
    code: `INVALID_OPERATION_REGISTRY_${label.toUpperCase()}`,
    message: `Unsupported operation registry ${label}: ${selection}. Expected one of: all, ${allowed.join(', ')}.`
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
