import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from './constants.js';
import {
  LEGACY_ALIAS_POLICY,
  PRODUCT_IDENTITY,
  legacyAliasReplacementMap,
  legacyAliasSurfaces,
  productIdentitySummary
} from './product-identity.js';

export const LEGACY_ALIAS_AUDIT_VERSION = '1.0.0';

export async function runLegacyAliasAudit(options = {}, context = {}) {
  const audit = await buildLegacyAliasAudit(options, context);
  return {
    status: 'ok',
    data: {
      legacy_alias_audit: audit,
      boundary: audit.boundary
    },
    warnings: [
      ...legacyAliasWarningsForInvocation(context.invokedBinName),
      ...audit.warnings
    ],
    errors: [],
    artifacts: []
  };
}

export async function buildLegacyAliasAudit(_options = {}, context = {}) {
  const now = materializeNow(context.now);
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const surfaces = legacyAliasSurfaces();
  const packageJson = await readJson(path.join(cwd, 'package.json'));
  const mcpJson = await readJson(path.join(cwd, '.mcp.json'));
  const pluginJson = await readJson(path.join(cwd, '.codex-plugin', 'plugin.json'));
  const warnings = [];
  const surfaceStatus = surfaces.map((surface) => ({
    ...surface,
    present: detectSurface(surface, { packageJson, mcpJson, pluginJson }),
    canonical_replacement: surface.canonical
  }));

  for (const surface of surfaceStatus) {
    if (!surface.present && surface.kind !== 'repository_url' && surface.kind !== 'artifact_root') {
      warnings.push({
        code: 'LEGACY_ALIAS_SURFACE_NOT_DETECTED',
        message: 'A legacy alias surface from identity metadata was not detected in local package metadata.',
        details: { surface: surface.id }
      });
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    alias_audit_version: LEGACY_ALIAS_AUDIT_VERSION,
    generated_at: now.toISOString(),
    product_identity: productIdentitySummary(),
    policy: LEGACY_ALIAS_POLICY,
    summary: {
      surface_count: surfaceStatus.length,
      retained_count: surfaceStatus.filter((surface) => surface.status === 'retained').length,
      warning_eligible_count: surfaceStatus.filter((surface) => surface.warning_eligible).length,
      removal_authorized: false,
      removal_candidate_ready: false,
      compatibility_window: LEGACY_ALIAS_POLICY.compatibility_window
    },
    surfaces: surfaceStatus,
    replacement_map: legacyAliasReplacementMap(),
    invocation: {
      invoked_bin_name: context.invokedBinName ?? null,
      legacy_invocation: legacyAliasWarningsForInvocation(context.invokedBinName).length > 0,
      warnings: legacyAliasWarningsForInvocation(context.invokedBinName)
    },
    migration_status: {
      guide_available: true,
      existing_aliases_retained: true,
      canonical_bins_available: true,
      removal_requires_explicit_approval: true,
      phase_139_removal_boundary: 'approval_required_not_implemented'
    },
    warnings,
    boundary: legacyAliasAuditBoundary()
  };
}

export function legacyAliasWarningsForInvocation(invokedBinName, identity = PRODUCT_IDENTITY) {
  const invoked = String(invokedBinName ?? '').trim();
  if (!invoked) {
    return [];
  }
  const legacyCli = identity.legacyCliBins.find((entry) => entry.name === invoked);
  if (legacyCli) {
    return [legacyWarning('LEGACY_CLI_BIN_USED', invoked, identity.cliBinName)];
  }
  const legacyMcp = identity.legacyMcpBins.find((entry) => entry.name === invoked);
  if (legacyMcp) {
    return [legacyWarning('LEGACY_MCP_BIN_USED', invoked, identity.mcpBinName)];
  }
  return [];
}

export function legacyAliasAuditBoundary() {
  return {
    local_only: true,
    read_only: true,
    artifacts_written: false,
    files_mutated: false,
    package_metadata_mutated: false,
    mcp_permissions_changed: false,
    legacy_alias_removed: false,
    removal_candidate_created: false,
    network_contact: false,
    provider_call_performed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

function detectSurface(surface, { packageJson, mcpJson, pluginJson }) {
  if (surface.kind === 'cli_bin' || surface.kind === 'mcp_bin') {
    return Boolean(packageJson?.bin?.[surface.legacy]);
  }
  if (surface.kind === 'mcp_server') {
    return Boolean(mcpJson?.mcpServers?.[surface.legacy]);
  }
  if (surface.kind === 'plugin') {
    return pluginJson?.name === surface.legacy
      || pluginJson?.legacyName === surface.legacy
      || Array.isArray(pluginJson?.aliases)
      || PRODUCT_IDENTITY.legacyPluginSkillPaths.some((skillPath) => Array.isArray(packageJson?.files) && packageJson.files.includes(skillPath));
  }
  if (surface.kind === 'plugin_skill') {
    return Array.isArray(packageJson?.files) && packageJson.files.includes(surface.legacy);
  }
  if (surface.kind === 'package_name') {
    return PRODUCT_IDENTITY.legacyPackageNames.includes(surface.legacy);
  }
  if (surface.kind === 'repository_url' || surface.kind === 'artifact_root' || surface.kind === 'mcp_tool_prefix') {
    return true;
  }
  return false;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function legacyWarning(code, legacy, canonical) {
  return {
    code,
    message: 'A retained legacy alias was used; migrate to the canonical name before an explicitly approved removal boundary.',
    details: {
      legacy,
      canonical,
      removal_authorized: false,
      compatibility_window: LEGACY_ALIAS_POLICY.compatibility_window
    }
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
