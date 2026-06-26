import path from 'node:path';
import { CLI_NAME, PACKAGE_VERSION } from './constants.js';

export const PRODUCT_IDENTITY = Object.freeze({
  packageName: 'trace-cue',
  legacyPackageNames: Object.freeze(['browser-debug-cli']),
  packageVersion: PACKAGE_VERSION,
  displayName: 'TraceCue',
  legacyDisplayNames: Object.freeze(['Browser Debug CLI']),
  cliBinName: CLI_NAME,
  cliBinPath: './bin/trace-cue.js',
  legacyCliBins: Object.freeze([
    Object.freeze({ name: 'browser-debug', path: './bin/browser-debug.js' })
  ]),
  mcpBinName: `${CLI_NAME}-mcp`,
  mcpBinPath: './bin/trace-cue-mcp.js',
  legacyMcpBins: Object.freeze([
    Object.freeze({ name: 'browser-debug-mcp', path: './bin/browser-debug-mcp.js' })
  ]),
  mcpServerName: 'trace-cue',
  legacyMcpServerNames: Object.freeze(['browser-debug-cli']),
  pluginName: 'trace-cue',
  legacyPluginNames: Object.freeze(['browser-debug-cli']),
  pluginSkillPath: 'skills/trace-cue-review/SKILL.md',
  legacyPluginSkillPaths: Object.freeze(['skills/browser-debug-review/SKILL.md']),
  repositoryName: 'trace-cue',
  futureRepositoryName: 'trace-cue',
  repositoryUrl: 'https://github.com/xxxMasahiro/trace-cue',
  futureRepositoryUrl: 'https://github.com/xxxMasahiro/trace-cue',
  legacyRepositoryUrls: Object.freeze(['https://github.com/xxxMasahiro/browser-debug-cli']),
  mcpToolPrefix: 'browser_debug',
  legacyMcpToolPrefixes: Object.freeze(['browser_debug']),
  npmCacheDirectoryName: 'trace-cue-npm-cache',
  packSmokeDirectoryName: 'trace-cue-pack-smoke',
  packSmokeKeepEnv: 'TRACE_CUE_KEEP_PACK_INSTALL_SMOKE',
  legacyPackSmokeKeepEnvs: Object.freeze(['BROWSER_DEBUG_KEEP_PACK_INSTALL_SMOKE']),
  defaultArtifactRoot: '.browser-debug',
  futureArtifactRoot: '.trace-cue',
  legacyArtifactRoots: Object.freeze(['.browser-debug'])
});

export const LEGACY_ALIAS_POLICY = Object.freeze({
  status: 'compatibility_retained',
  warning_status: 'advisory_warning_available',
  removal_authorized: false,
  removal_phase: 139,
  compatibility_window: 'retained_until_explicit_removal_release_candidate_approval',
  migration_guide_status: 'workflow_guidance_available'
});

export function packageTarballFilename(identity = PRODUCT_IDENTITY) {
  return `${tarballPackageName(identity.packageName)}-${identity.packageVersion}.tgz`;
}

export function packageInstallDirectory(nodeModules, identity = PRODUCT_IDENTITY) {
  return path.join(nodeModules, ...packageNamePathParts(identity.packageName));
}

export function packageSchemaSpecifier(schemaName, identity = PRODUCT_IDENTITY) {
  return `${identity.packageName}/schemas/${schemaName}`;
}

export function packageBinEntries(identity = PRODUCT_IDENTITY) {
  return Object.freeze([
    Object.freeze({ name: identity.cliBinName, path: identity.cliBinPath, canonical: true }),
    Object.freeze({ name: identity.mcpBinName, path: identity.mcpBinPath, canonical: true }),
    ...identity.legacyCliBins.map((entry) => Object.freeze({ ...entry, canonical: false })),
    ...identity.legacyMcpBins.map((entry) => Object.freeze({ ...entry, canonical: false }))
  ]);
}

export function productIdentitySummary(identity = PRODUCT_IDENTITY) {
  return {
    package_name: identity.packageName,
    legacy_package_names: identity.legacyPackageNames,
    package_version: identity.packageVersion,
    display_name: identity.displayName,
    legacy_display_names: identity.legacyDisplayNames,
    cli_bin_name: identity.cliBinName,
    legacy_cli_bin_names: identity.legacyCliBins.map((entry) => entry.name),
    mcp_bin_name: identity.mcpBinName,
    legacy_mcp_bin_names: identity.legacyMcpBins.map((entry) => entry.name),
    mcp_server_name: identity.mcpServerName,
    legacy_mcp_server_names: identity.legacyMcpServerNames,
    plugin_name: identity.pluginName,
    legacy_plugin_names: identity.legacyPluginNames,
    repository_name: identity.repositoryName,
    future_repository_name: identity.futureRepositoryName,
    repository_url: identity.repositoryUrl,
    future_repository_url: identity.futureRepositoryUrl,
    legacy_repository_urls: identity.legacyRepositoryUrls,
    mcp_tool_prefix: identity.mcpToolPrefix,
    legacy_mcp_tool_prefixes: identity.legacyMcpToolPrefixes,
    default_artifact_root: identity.defaultArtifactRoot,
    future_artifact_root: identity.futureArtifactRoot,
    legacy_artifact_roots: identity.legacyArtifactRoots
  };
}

export function legacyAliasSurfaces(identity = PRODUCT_IDENTITY) {
  return Object.freeze([
    ...identity.legacyCliBins.map((entry) => legacySurface({
      id: `cli_bin:${entry.name}`,
      kind: 'cli_bin',
      legacy: entry.name,
      canonical: identity.cliBinName,
      path: entry.path,
      canonicalPath: identity.cliBinPath,
      warningEligible: true
    })),
    ...identity.legacyMcpBins.map((entry) => legacySurface({
      id: `mcp_bin:${entry.name}`,
      kind: 'mcp_bin',
      legacy: entry.name,
      canonical: identity.mcpBinName,
      path: entry.path,
      canonicalPath: identity.mcpBinPath,
      warningEligible: true
    })),
    ...identity.legacyMcpServerNames.map((name) => legacySurface({
      id: `mcp_server:${name}`,
      kind: 'mcp_server',
      legacy: name,
      canonical: identity.mcpServerName,
      warningEligible: false
    })),
    ...identity.legacyPluginNames.map((name) => legacySurface({
      id: `plugin:${name}`,
      kind: 'plugin',
      legacy: name,
      canonical: identity.pluginName,
      warningEligible: false
    })),
    ...identity.legacyPluginSkillPaths.map((skillPath) => legacySurface({
      id: `plugin_skill:${skillPath}`,
      kind: 'plugin_skill',
      legacy: skillPath,
      canonical: identity.pluginSkillPath,
      warningEligible: false
    })),
    ...identity.legacyPackageNames.map((name) => legacySurface({
      id: `package:${name}`,
      kind: 'package_name',
      legacy: name,
      canonical: identity.packageName,
      warningEligible: false
    })),
    ...identity.legacyRepositoryUrls.map((url) => legacySurface({
      id: `repository_url:${url}`,
      kind: 'repository_url',
      legacy: url,
      canonical: identity.repositoryUrl,
      warningEligible: false
    })),
    ...identity.legacyArtifactRoots.map((root) => legacySurface({
      id: `artifact_root:${root}`,
      kind: 'artifact_root',
      legacy: root,
      canonical: identity.futureArtifactRoot,
      warningEligible: false,
      retainedAsDefault: root === identity.defaultArtifactRoot
    })),
    ...identity.legacyMcpToolPrefixes.map((prefix) => legacySurface({
      id: `mcp_tool_prefix:${prefix}`,
      kind: 'mcp_tool_prefix',
      legacy: prefix,
      canonical: identity.mcpToolPrefix,
      warningEligible: false,
      retainedAsDefault: prefix === identity.mcpToolPrefix
    }))
  ]);
}

export function legacyAliasReplacementMap(identity = PRODUCT_IDENTITY) {
  return Object.freeze(Object.fromEntries(
    legacyAliasSurfaces(identity).map((surface) => [surface.legacy, surface.canonical])
  ));
}

export function filesystemSafeName(value) {
  return String(value)
    .replace(/^@/u, '')
    .replace(/[/\\]+/gu, '-')
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    || 'package';
}

function tarballPackageName(packageName) {
  return packageName.replace(/^@/u, '').replace(/\//gu, '-');
}

function packageNamePathParts(packageName) {
  return packageName.split('/').filter(Boolean);
}

function legacySurface({
  id,
  kind,
  legacy,
  canonical,
  path: legacyPath,
  canonicalPath,
  warningEligible,
  retainedAsDefault = false
}) {
  return Object.freeze({
    id,
    kind,
    legacy,
    canonical,
    legacy_path: legacyPath ?? null,
    canonical_path: canonicalPath ?? null,
    status: 'retained',
    warning_eligible: warningEligible,
    retained_as_default: retainedAsDefault,
    removal_authorized: false,
    compatibility_window: LEGACY_ALIAS_POLICY.compatibility_window
  });
}
