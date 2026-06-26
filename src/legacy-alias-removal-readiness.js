import { SCHEMA_VERSION } from './constants.js';
import { buildLegacyAliasAudit, legacyAliasAuditBoundary } from './legacy-alias-audit.js';
import { LEGACY_ALIAS_POLICY, productIdentitySummary } from './product-identity.js';

export const LEGACY_ALIAS_REMOVAL_READINESS_VERSION = '1.0.0';

export async function runLegacyAliasRemovalReadiness(options = {}, context = {}) {
  const readiness = await buildLegacyAliasRemovalReadiness(options, context);
  return {
    status: 'ok',
    data: {
      legacy_alias_removal_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: readiness.warnings,
    errors: [],
    artifacts: []
  };
}

export async function buildLegacyAliasRemovalReadiness(_options = {}, context = {}) {
  const now = materializeNow(context.now);
  const audit = await buildLegacyAliasAudit({}, context);
  const retainedSurfaces = audit.surfaces.filter((surface) => surface.status === 'retained');
  const missingSurfaces = audit.surfaces.filter((surface) => !surface.present);
  const blockers = [
    blocker('approval_required', true, 'Legacy alias removal requires explicit developer approval at a release boundary.'),
    blocker('compatibility_window_open', true, 'Compatibility aliases remain retained until an approved removal candidate changes the policy.'),
    blocker('aliases_still_retained', retainedSurfaces.length > 0, 'Package bins, MCP aliases, plugin skill paths, and artifact-root compatibility are still retained.'),
    blocker('usage_audit_required', true, 'A usage audit must be reviewed before any removal candidate is created.')
  ];

  return {
    schema_version: SCHEMA_VERSION,
    readiness_version: LEGACY_ALIAS_REMOVAL_READINESS_VERSION,
    generated_at: now.toISOString(),
    status: 'blocked_approval_required',
    product_identity: productIdentitySummary(),
    policy: LEGACY_ALIAS_POLICY,
    audit_summary: audit.summary,
    readiness: {
      phase: 139,
      removal_authorized: false,
      removal_candidate_created: false,
      removal_candidate_ready: false,
      package_bins_removed: false,
      mcp_aliases_removed: false,
      plugin_aliases_removed: false,
      artifact_root_compatibility_removed: false,
      product_docs_promoted: false,
      approval_required_before_removal: true
    },
    compatibility: {
      retained_surface_count: retainedSurfaces.length,
      missing_surface_count: missingSurfaces.length,
      compatibility_window: LEGACY_ALIAS_POLICY.compatibility_window,
      legacy_aliases_must_remain: true,
      canonical_replacements_available: true
    },
    blockers,
    next_steps: [
      'Keep compatibility aliases available until the removal boundary is explicitly approved.',
      'Use identity aliases to audit retained surfaces before preparing any removal candidate.',
      'Do not remove package bins, MCP server aliases, plugin skill paths, or artifact-root compatibility from this readiness report.'
    ],
    warnings: audit.warnings,
    boundary: legacyAliasRemovalReadinessBoundary()
  };
}

export function legacyAliasRemovalUnavailableInfo(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const boundary = legacyAliasRemovalReadinessBoundary();
  return {
    status: 'error',
    data: {
      legacy_alias_removal: {
        schema_version: SCHEMA_VERSION,
        readiness_version: LEGACY_ALIAS_REMOVAL_READINESS_VERSION,
        generated_at: now.toISOString(),
        requested_execute: options.execute === true,
        status: 'not_available',
        reason: 'Legacy alias removal is approval-bound and is not implemented in this phase.',
        policy: LEGACY_ALIAS_POLICY,
        removal_authorized: false,
        package_bins_removed: false,
        mcp_aliases_removed: false,
        plugin_aliases_removed: false,
        artifact_root_compatibility_removed: false,
        boundary
      },
      boundary
    },
    warnings: [],
    errors: [{
      code: 'LEGACY_ALIAS_REMOVAL_NOT_AVAILABLE',
      message: 'Legacy alias removal is approval-bound and fails closed in this phase.',
      details: {
        approval_required: true,
        removal_authorized: false,
        compatibility_window: LEGACY_ALIAS_POLICY.compatibility_window
      }
    }],
    artifacts: []
  };
}

export function legacyAliasRemovalReadinessBoundary() {
  return {
    ...legacyAliasAuditBoundary(),
    removal_readiness_reported: true,
    read_only: true,
    files_mutated: false,
    package_metadata_mutated: false,
    package_bins_removed: false,
    mcp_aliases_removed: false,
    plugin_aliases_removed: false,
    artifact_root_compatibility_removed: false,
    removal_candidate_created: false,
    legacy_alias_removed: false,
    approval_required: true,
    mcp_execution_exposed: false,
    product_docs_promoted: false
  };
}

function blocker(id, active, summary) {
  return Object.freeze({ id, active, summary, approval_required: active });
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
