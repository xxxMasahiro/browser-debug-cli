import { SCHEMA_VERSION } from './constants.js';
import {
  OPERATION_GROUP_IDS,
  OPERATION_RISK_IDS,
  getOperationRegistryOperations,
  operationRegistryBoundary
} from './operation-registry.js';
import { PRODUCT_IDENTITY } from './product-identity.js';

export const OPERATION_ROADMAP_VERSION = '1.0.0';
export const OPERATION_ROADMAP_PHASE_MIN = 60;
export const OPERATION_ROADMAP_PHASE_MAX = 155;

const PHASE_GROUPS = Object.freeze([
  phaseGroup('operation_governance', 'Operation and execution governance', 60, 70),
  phaseGroup('provider_mcp', 'Provider MCP readiness and execution boundaries', 71, 78),
  phaseGroup('cleanup_mcp', 'Artifact cleanup MCP boundaries', 79, 84),
  phaseGroup('capture', 'Screen, window, and desktop app capture boundaries', 85, 95),
  phaseGroup('localization', 'UI, report, and translation boundaries', 96, 119),
  phaseGroup('release_identity', 'Package, artifact-root, and legacy-alias release boundaries', 120, 139),
  phaseGroup('constrained_shell', 'Constrained shell review boundaries', 140, 148),
  phaseGroup('final_hardening', 'Cross-feature release hardening', 149, 155)
]);

const LIVE_EXECUTION_APPROVAL_PHASES = new Set([
  67, 69, 70,
  74, 75, 76,
  81, 82,
  89, 91, 94,
  115, 116, 118,
  121, 125,
  129, 131,
  138, 139,
  144, 147,
  150, 152
]);

const PHASES = Object.freeze([
  phase(60, 'Operation Registry', 'Put risky operations into a shared operation registry.', 'Unit and schema tests'),
  phase(61, 'Operation Risk Taxonomy', 'Classify read, write, delete, provider, shell, and capture operations.', 'Architecture tests'),
  phase(62, 'Operation Gate Schema', 'Define plan, execute, and receipt schemas.', 'Schema parity tests'),
  phase(63, 'Execute Token Contract', 'Define execution token scope, expiry, and one-time usage.', 'Unit tests'),
  phase(64, 'Receipt Contract', 'Define the common execution receipt format.', 'Unit and package tests'),
  phase(65, 'Admin Policy Config', 'Add the admin execution policy file.', 'Docs and security checks'),
  phase(66, 'CLI Operation Plan', 'Allow CLI users to inspect operation plans.', 'No-browser tests'),
  phase(67, 'CLI Operation Execute Harness', 'Build the shared execution harness.', 'Fake operation tests'),
  phase(68, 'MCP Execute Gate Readiness', 'Expose execution readiness through MCP as read-only data.', 'MCP safe-profile tests'),
  phase(69, 'MCP Execute Token Flow', 'Implement the MCP admin execution token flow.', 'MCP admin dry-run tests'),
  phase(70, 'MCP Execute Harness', 'Let MCP admin calls use the shared execution harness.', 'MCP smoke tests'),
  phase(71, 'Provider MCP Plan', 'Expose provider/API execution plans through MCP.', 'No-provider-call tests'),
  phase(72, 'Provider Disclosure Contract', 'Fix the bounded disclosure contract for provider inputs.', 'Security tests'),
  phase(73, 'Provider Env Credential Guard', 'Preserve env-only credential handling for MCP-triggered provider execution.', 'Secret-handling tests'),
  phase(74, 'Provider Fake MCP Execute', 'Execute the fake provider through MCP admin.', 'MCP admin smoke tests'),
  phase(75, 'Provider Local Runner MCP Execute', 'Execute configured local runner callbacks through MCP admin.', 'Callback tests'),
  phase(76, 'Provider API MCP Execute', 'Execute API providers through MCP admin with explicit execution.', 'Injected fetch tests'),
  phase(77, 'Provider MCP Status/List', 'Inspect provider execution status and lists through MCP.', 'MCP safe/full tests'),
  phase(78, 'Provider MCP Docs/Hardening', 'Synchronize docs, security, and release boundaries.', 'Product gate'),
  phase(79, 'Cleanup MCP Plan', 'Inspect cleanup plans through MCP without deletion.', 'No-delete tests'),
  phase(80, 'Cleanup Candidate Lock', 'Lock cleanup candidates by path, size, and hash.', 'Unit tests'),
  phase(81, 'Cleanup Execute Token', 'Add cleanup-specific execute tokens.', 'Unit tests'),
  phase(82, 'Cleanup MCP Execute Dry Fixture', 'Execute cleanup against a fixture artifact root.', 'Temporary-directory tests'),
  phase(83, 'Cleanup Receipt Audit', 'Strengthen receipts and skipped reasons.', 'Unit tests'),
  phase(84, 'Cleanup Docs/Hardening', 'Synchronize cleanup docs, security, and release boundaries.', 'Product gate'),
  phase(85, 'Capture OS Capability Probe', 'Detect OS capture capability without capturing pixels.', 'No-capture tests'),
  phase(86, 'Capture Privacy Policy', 'Define privacy, redaction, and window metadata policy.', 'Security docs'),
  phase(87, 'Capture Artifact Schema', 'Define capture artifact and receipt schemas.', 'Schema parity tests'),
  phase(88, 'Screen Capture CLI Plan', 'Add CLI screen-capture planning.', 'No-pixel-read tests'),
  phase(89, 'Screen Capture CLI Execute', 'Execute screen capture through the CLI.', 'Local fixture or manual tests'),
  phase(90, 'Window Capture CLI Plan', 'Add CLI window-capture planning.', 'No-process-leak tests'),
  phase(91, 'Window Capture CLI Execute', 'Execute window capture through the CLI.', 'Local or manual tests'),
  phase(92, 'Desktop App Capture Handoff Upgrade', 'Connect capture results to the existing review pipeline.', 'Image review smoke tests'),
  phase(93, 'Capture MCP Read-only', 'Expose capture capability, plan, and status through safe MCP.', 'MCP safe-profile tests'),
  phase(94, 'Capture MCP Admin Execute', 'Execute capture through MCP admin with explicit tokens.', 'Admin token tests'),
  phase(95, 'Capture Docs/Hardening', 'Synchronize capture docs, security, and release boundaries.', 'Product gate'),
  phase(96, 'UI i18n Key Inventory', 'Inventory dashboard display text keys.', 'Static checks'),
  phase(97, 'UI i18n Resource Schema', 'Define locale resource schemas.', 'Schema parity tests'),
  phase(98, 'UI i18n Runtime Resolver', 'Add locale fallback resolution.', 'Unit tests'),
  phase(99, 'UI i18n English Baseline', 'Make English resources the baseline.', 'Snapshot tests'),
  phase(100, 'UI i18n Locale Stubs', 'Add stub resources for the supported locales.', 'Schema tests'),
  phase(101, 'UI i18n RTL Layout Guard', 'Add direction and layout guards for RTL locales.', 'UI smoke tests'),
  phase(102, 'Dashboard Language Switch', 'Switch dashboard display with ui_locale.', 'Playwright tests'),
  phase(103, 'UI i18n Docs/Hardening', 'Synchronize UI i18n docs, security, and verification.', 'Product gate'),
  phase(104, 'Report Text Inventory', 'Inventory translatable report body text.', 'Static checks'),
  phase(105, 'Report Template Schema', 'Define report template schemas.', 'Schema parity tests'),
  phase(106, 'Report English Templates', 'Make English report templates the baseline.', 'Snapshot tests'),
  phase(107, 'Report Locale Resolver', 'Resolve report language from artifact output settings.', 'Unit tests'),
  phase(108, 'Report Localized Rendering', 'Render report bodies by locale.', 'Fixture tests'),
  phase(109, 'Raw Evidence Non-Translation Guard', 'Keep raw page text, selectors, and logs out of translation.', 'Security tests'),
  phase(110, 'Report Locale Stubs', 'Add report template stubs for the supported locales.', 'Schema and snapshot tests'),
  phase(111, 'Report Docs/Hardening', 'Synchronize report localization docs, security, and verification.', 'Product gate'),
  phase(112, 'Translation Provider Threat Model', 'Define the provider translation threat model.', 'Docs only'),
  phase(113, 'Translation Disclosure Plan', 'Plan minimal provider-bound disclosure.', 'No-provider tests'),
  phase(114, 'Translation Dry-run CLI', 'Add provider translation dry-run.', 'No-network tests'),
  phase(115, 'Translation Fake Provider', 'Execute translation through a fake provider.', 'Unit tests'),
  phase(116, 'Translation API Provider', 'Execute translation through an env-only API provider.', 'Injected fetch tests'),
  phase(117, 'Translation MCP Readiness', 'Inspect translation readiness through MCP.', 'MCP safe-profile tests'),
  phase(118, 'Translation MCP Admin Execute', 'Execute translation through MCP admin with token and receipt.', 'Token and receipt tests'),
  phase(119, 'Translation Docs/Hardening', 'Synchronize translation docs, security, and verification.', 'Product gate'),
  phase(120, 'Package Name/License Decision Pack', 'Prepare package-name and license decision material.', 'Docs checks'),
  phase(121, 'Public Package Metadata', 'Prepare public package metadata.', 'Package checks'),
  phase(122, 'Package Provenance/Two-factor Policy', 'Define provenance, token, and two-factor policy.', 'Docs and security checks'),
  phase(123, 'Package Release Candidate', 'Prepare a local release-candidate package.', 'Local-only checks'),
  phase(124, 'Package Publication Dry Run', 'Run package publication dry-run and checklist.', 'No-publication checks'),
  phase(125, 'Package Publication', 'Publish the first package release.', 'Post-release smoke tests'),
  phase(126, 'Artifact Root Policy', 'Define canonical and legacy artifact-root policy.', 'Docs checks'),
  phase(127, 'Artifact Root Config', 'Make artifact-root resolution configurable.', 'Unit tests'),
  phase(128, 'Dual Read Support', 'Read from both new and legacy artifact roots.', 'Fixture tests'),
  phase(129, 'Dual Write Support', 'Write to the new root while preserving legacy compatibility.', 'Fixture tests'),
  phase(130, 'Migration Plan CLI', 'Add artifact-root migration dry-run.', 'No-mutation tests'),
  phase(131, 'Migration Execute CLI', 'Add migration execution with receipts.', 'Temporary-directory tests'),
  phase(132, 'Artifact Root MCP Status', 'Inspect artifact-root migration state through MCP.', 'Read-only MCP tests'),
  phase(133, 'Artifact Root Docs/Hardening', 'Synchronize artifact-root docs, security, and verification.', 'Product gate'),
  phase(134, 'Legacy Alias Usage Audit', 'Audit legacy alias usage.', 'Static checks'),
  phase(135, 'Legacy Alias Deprecation Warnings', 'Add deprecation warnings.', 'CLI and MCP tests'),
  phase(136, 'Legacy Alias Migration Guide', 'Write the migration guide.', 'Docs checks'),
  phase(137, 'Legacy Alias Compatibility Window', 'Define the version boundary for compatibility.', 'Docs checks'),
  phase(138, 'Legacy Alias Removal RC', 'Prepare a removal candidate.', 'Tests'),
  phase(139, 'Legacy Alias Removal Boundary', 'Represent legacy alias removal as approval-bound readiness and fail-closed gating while retaining aliases.', 'Release-boundary tests'),
  phase(140, 'Shell Use-case Review', 'Reassess whether shell execution is truly needed.', 'Proposal review'),
  phase(141, 'Shell Threat Model', 'Define the shell threat model.', 'Security docs'),
  phase(142, 'Constrained Command Schema', 'Define an allowlisted command schema.', 'Schema tests'),
  phase(143, 'Constrained Runner CLI Plan', 'Add plan-only constrained shell support.', 'No-execution tests'),
  phase(144, 'Constrained Runner CLI Execute', 'Execute only allowlisted commands.', 'Temporary-directory tests'),
  phase(145, 'Env/CWD/Timeout Guard', 'Add environment scrubbing, cwd confinement, and timeout guards.', 'Security tests'),
  phase(146, 'Shell MCP Readiness', 'Inspect shell readiness through MCP.', 'MCP safe-profile tests'),
  phase(147, 'Shell MCP Admin Execute', 'Execute constrained shell through MCP admin.', 'Token and receipt tests'),
  phase(148, 'Shell Docs/Hardening', 'Synchronize shell docs, security, and verification.', 'Product gate'),
  phase(149, 'Cross-feature Regression Matrix', 'Build the provider, cleanup, capture, i18n, package, artifact-root, alias, and shell regression matrix.', 'Docs and tests'),
  phase(150, 'Full Release Gate Hardening', 'Reorganize full gates and CI for the completed roadmap.', 'Release checks'),
  phase(151, 'Browser Smoke Rebaseline', 'Rebaseline Playwright smoke coverage.', 'Browser tests'),
  phase(152, 'MCP Smoke Rebaseline', 'Rebaseline stdio, HTTP safe, and admin MCP smoke coverage.', 'MCP tests'),
  phase(153, 'Security Final Sweep', 'Sweep secrets, provider, shell, upload, and capture boundaries.', 'Security checks'),
  phase(154, 'Docs English Scan', 'Verify English-only documentation for changed docs.', 'Text scan'),
  phase(155, 'Final Product Gate', 'Run the final product gate.', 'All required checks')
]);

export const OPERATION_ROADMAP_PHASES = Object.freeze(PHASES.map((item) => item.phase));

export function buildOperationRoadmapReport(options = {}, context = {}) {
  const phaseSelection = normalizePhaseSelection(options.phase);
  if (!phaseSelection.ok) {
    return phaseSelection;
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
  const operationIndex = operationsByGroup();
  const phases = PHASES
    .filter((item) => phaseSelection.value === 'all' || item.phase === phaseSelection.value)
    .map((item) => publicPhase(item, operationIndex))
    .filter((item) => groupSelection.value === 'all' || item.group.id === groupSelection.value)
    .filter((item) => riskSelection.value === 'all' || item.risk.effects.includes(riskSelection.value));

  return {
    ok: true,
    report: {
      schema_version: SCHEMA_VERSION,
      roadmap_version: OPERATION_ROADMAP_VERSION,
      generated_at: now.toISOString(),
      product_identity: {
        package_name: PRODUCT_IDENTITY.packageName,
        display_name: PRODUCT_IDENTITY.displayName,
        mcp_server_name: PRODUCT_IDENTITY.mcpServerName
      },
      phase_range: {
        min: OPERATION_ROADMAP_PHASE_MIN,
        max: OPERATION_ROADMAP_PHASE_MAX
      },
      phase_selection: phaseSelection.value,
      group_selection: groupSelection.value,
      risk_selection: riskSelection.value,
      summary: summarizePhases(phases),
      groups: PHASE_GROUPS,
      phases,
      boundary: operationRoadmapBoundary(),
      notes: [
        'This report is a read-only roadmap governance surface, not live execution approval.',
        'Proposal, plan, and implementation fields describe the local boundary contract for each phase.',
        'Approval-bound phases remain represented as decision, readiness, dry-run, or receipt contracts until separately approved.'
      ]
    }
  };
}

export function operationRoadmapBoundary() {
  return {
    ...operationRegistryBoundary(),
    roadmap_report_only: true,
    draft_roadmap_promoted_to_product_plan: false,
    phase_sequence_recorded: true,
    phase_abc_contracts_recorded: true,
    live_execution_performed: false,
    execution_tokens_issued: false,
    execution_harness_enabled: false,
    admin_policy_changed: false,
    mcp_write_execute_exposed: false,
    ci_remote_triggered: false
  };
}

export function getOperationRoadmapPhases() {
  const operationIndex = operationsByGroup();
  return PHASES.map((item) => publicPhase(item, operationIndex));
}

function publicPhase(item, operationIndex) {
  const group = groupForPhase(item.phase);
  const risk = riskForPhase(item.phase);
  const approvalRequired = LIVE_EXECUTION_APPROVAL_PHASES.has(item.phase);
  const relatedOperations = (operationIndex.get(group.id) ?? []).map((operation) => operation.id);
  const implementationStatus = implementationStatusForPhase(item.phase, approvalRequired);
  return {
    phase: item.phase,
    slice: item.slice,
    purpose: item.purpose,
    primary_verification: item.primary_verification,
    group: {
      id: group.id,
      label: group.label,
      phase_range: `${group.phase_min}-${group.phase_max}`
    },
    risk,
    related_operations: relatedOperations,
    sequence: {
      previous_phase: item.phase > OPERATION_ROADMAP_PHASE_MIN ? item.phase - 1 : null,
      next_phase: item.phase < OPERATION_ROADMAP_PHASE_MAX ? item.phase + 1 : null,
      sequential_contract: 'A proposal -> B implementation plan -> C local boundary implementation'
    },
    proposal: {
      step: 'A',
      status: 'available',
      scope: `${item.slice} is reviewed as a bounded ${group.label} slice.`,
      non_scope: 'No live side effect is authorized by this roadmap report.',
      existing_feature_tradeoff: false
    },
    implementation_plan: {
      step: 'B',
      status: 'available',
      order: 'Synchronize documents by role, implement the local contract, then run no-browser and product gates.',
      verification: item.primary_verification,
      recovery: 'Revert the additive local contract slice; no external state or user artifacts are mutated by this report.'
    },
    implementation: {
      step: 'C',
      status: implementationStatus,
      mode: approvalRequired ? 'approval_gate_contract' : 'local_contract',
      live_execution_performed: false,
      approval_required_before_live_execution: approvalRequired,
      safe_substitution: safeSubstitutionForPhase(item.phase, group.id),
      boundary: operationRoadmapBoundary()
    }
  };
}

function implementationStatusForPhase(phaseNumber, approvalRequired) {
  if (phaseNumber === 60) {
    return 'completed_read_only_foundation';
  }
  return approvalRequired ? 'implemented_as_fail_closed_approval_gate' : 'implemented_as_read_only_or_dry_run_contract';
}

function safeSubstitutionForPhase(phaseNumber, groupId) {
  if (phaseNumber === 60) {
    return 'Read-only registry, schema, API, CLI, MCP inspection, and policy-derived reports.';
  }
  if (LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber)) {
    return 'Decision pack, readiness report, dry-run plan, token policy, or receipt contract only.';
  }
  const substitutions = {
    operation_governance: 'Read-only governance report, schema, policy, or local planning contract.',
    provider_mcp: 'No-provider-call plan, disclosure report, env-only credential guard, status, or list contract.',
    cleanup_mcp: 'No-delete plan, candidate-lock contract, receipt audit, or docs hardening.',
    capture: 'No-capture capability, privacy, schema, plan, status, or handoff-readiness contract.',
    localization: 'Provider-free locale/report contract, raw-evidence guard, translation readiness, or docs hardening.',
    release_identity: 'Decision pack, local-only release candidate, dry-run report, artifact-root plan, alias audit, guide, or warning contract.',
    constrained_shell: 'Use-case review, threat model, allowlist schema, plan-only contract, guard contract, or readiness report.',
    final_hardening: 'Local regression matrix, local gate check, smoke rebaseline plan, security sweep, docs scan, or product gate evidence.'
  };
  return substitutions[groupId] ?? 'Local read-only or dry-run contract.';
}

function summarizePhases(phases) {
  const approvalBound = phases.filter((item) => item.implementation.approval_required_before_live_execution).length;
  return {
    phase_count: phases.length,
    min_phase: phases.length > 0 ? Math.min(...phases.map((item) => item.phase)) : null,
    max_phase: phases.length > 0 ? Math.max(...phases.map((item) => item.phase)) : null,
    proposal_available_count: phases.filter((item) => item.proposal.status === 'available').length,
    implementation_plan_available_count: phases.filter((item) => item.implementation_plan.status === 'available').length,
    local_boundary_implemented_count: phases.length,
    approval_bound_phase_count: approvalBound,
    live_execution_performed: false,
    read_only_report_only: true,
    draft_roadmap_promoted_to_product_plan: false,
    by_group: PHASE_GROUPS.reduce((summary, group) => {
      const count = phases.filter((item) => item.group.id === group.id).length;
      if (count > 0) {
        summary[group.id] = count;
      }
      return summary;
    }, {}),
    by_risk: OPERATION_RISK_IDS.reduce((summary, riskId) => {
      const count = phases.filter((item) => item.risk.effects.includes(riskId)).length;
      if (count > 0) {
        summary[riskId] = count;
      }
      return summary;
    }, {})
  };
}

function riskForPhase(phaseNumber) {
  const effects = riskEffectsForPhase(phaseNumber);
  return Object.freeze({
    effects: Object.freeze(effects),
    destructive: effects.includes('delete'),
    external_service: effects.includes('provider') || effects.includes('translation') || effects.includes('release'),
    release_bound: effects.includes('release'),
    approval_required_before_live_execution: LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber)
  });
}

function riskEffectsForPhase(phaseNumber) {
  if (phaseNumber <= 61 || phaseNumber === 66 || phaseNumber === 68) {
    return ['read'];
  }
  if (phaseNumber >= 62 && phaseNumber <= 65) {
    return ['read', 'write'];
  }
  if (phaseNumber === 67 || phaseNumber === 69 || phaseNumber === 70) {
    return ['provider', 'write'];
  }
  if (phaseNumber >= 71 && phaseNumber <= 78) {
    return LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber) ? ['provider', 'write'] : ['read', 'provider'];
  }
  if (phaseNumber >= 79 && phaseNumber <= 84) {
    return LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber) ? ['delete', 'write'] : ['read', 'delete'];
  }
  if (phaseNumber >= 85 && phaseNumber <= 95) {
    return LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber) ? ['capture', 'write'] : ['read', 'capture'];
  }
  if (phaseNumber >= 96 && phaseNumber <= 103) {
    return ['read', 'write'];
  }
  if (phaseNumber >= 104 && phaseNumber <= 119) {
    return LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber) ? ['translation', 'provider', 'write'] : ['read', 'translation'];
  }
  if (phaseNumber >= 120 && phaseNumber <= 139) {
    if (phaseNumber === 129 || phaseNumber === 131) {
      return ['release', 'write', 'delete'];
    }
    return phaseNumber === 120 || phaseNumber === 122 || phaseNumber === 124 || phaseNumber === 126 || phaseNumber === 130 || phaseNumber === 132 || phaseNumber === 134
      ? ['read', 'release']
      : ['release', 'write'];
  }
  if (phaseNumber >= 140 && phaseNumber <= 148) {
    return LIVE_EXECUTION_APPROVAL_PHASES.has(phaseNumber) ? ['shell', 'write'] : ['read', 'shell'];
  }
  return ['read', 'release'];
}

function operationsByGroup() {
  const index = new Map();
  for (const operation of getOperationRegistryOperations()) {
    if (!index.has(operation.group)) {
      index.set(operation.group, []);
    }
    index.get(operation.group).push(operation);
  }
  return index;
}

function groupForPhase(phaseNumber) {
  return PHASE_GROUPS.find((group) => phaseNumber >= group.phase_min && phaseNumber <= group.phase_max)
    ?? PHASE_GROUPS[PHASE_GROUPS.length - 1];
}

function phaseGroup(id, label, min, max) {
  return Object.freeze({
    id,
    label,
    phase_min: min,
    phase_max: max,
    phase_range: `${min}-${max}`
  });
}

function phase(phaseNumber, slice, purpose, verification) {
  return Object.freeze({
    phase: phaseNumber,
    slice,
    purpose,
    primary_verification: verification
  });
}

function normalizePhaseSelection(value) {
  const selection = String(value ?? 'all').trim() || 'all';
  if (selection === 'all') {
    return { ok: true, value: selection };
  }
  const number = Number(selection);
  if (Number.isInteger(number) && number >= OPERATION_ROADMAP_PHASE_MIN && number <= OPERATION_ROADMAP_PHASE_MAX) {
    return { ok: true, value: number };
  }
  return {
    ok: false,
    code: 'INVALID_OPERATION_ROADMAP_PHASE',
    message: `Unsupported operation roadmap phase: ${selection}. Expected all or an integer from ${OPERATION_ROADMAP_PHASE_MIN} to ${OPERATION_ROADMAP_PHASE_MAX}.`
  };
}

function normalizeSelection(value, allowed, label) {
  const selection = String(value ?? 'all').trim() || 'all';
  if (selection === 'all' || allowed.includes(selection)) {
    return { ok: true, value: selection };
  }
  return {
    ok: false,
    code: `INVALID_OPERATION_ROADMAP_${label.toUpperCase()}`,
    message: `Unsupported operation roadmap ${label}: ${selection}. Expected one of: all, ${allowed.join(', ')}.`
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
