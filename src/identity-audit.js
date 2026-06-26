import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { PRODUCT_IDENTITY, filesystemSafeName, productIdentitySummary } from './product-identity.js';
import { buildLegacyAliasAudit } from './legacy-alias-audit.js';

export const IDENTITY_AUDIT_VERSION = '1.0.0';

export async function runIdentityAudit(_options = {}, context = {}) {
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const audit = await buildIdentityAudit({ cwd, gitRemoteUrl: context.gitRemoteUrl });
  return {
    status: 'ok',
    data: {
      identity_audit: audit,
      boundary: identityAuditBoundary()
    },
    warnings: audit.warnings,
    errors: [],
    artifacts: []
  };
}

export async function buildIdentityAudit({ cwd = process.cwd(), gitRemoteUrl } = {}) {
  const root = await findRepositoryRoot(cwd);
  const rootPath = root?.path ?? path.resolve(cwd);
  const resolvedRoot = await realpath(rootPath).catch(() => rootPath);
  const rootName = path.basename(resolvedRoot);
  const remoteUrl = gitRemoteUrl ?? (root ? await readOriginUrl(root.path) : null);
  const normalizedRemote = normalizeRepositoryUrl(remoteUrl);
  const normalizedCurrent = normalizeRepositoryUrl(PRODUCT_IDENTITY.repositoryUrl);
  const normalizedFuture = normalizeRepositoryUrl(PRODUCT_IDENTITY.futureRepositoryUrl);
  const normalizedLegacy = PRODUCT_IDENTITY.legacyRepositoryUrls.map(normalizeRepositoryUrl).filter(Boolean);
  const currentRootMatches = rootName === PRODUCT_IDENTITY.repositoryName;
  const futureRootMatches = rootName === PRODUCT_IDENTITY.futureRepositoryName;
  const remoteMatchesCurrent = Boolean(normalizedRemote && normalizedRemote === normalizedCurrent);
  const remoteMatchesFuture = Boolean(normalizedRemote && normalizedRemote === normalizedFuture);
  const remoteMatchesLegacy = Boolean(normalizedRemote && normalizedLegacy.includes(normalizedRemote));
  const physicalRenamePending = !futureRootMatches;
  const remoteRenamePending = !remoteMatchesFuture;
  const warnings = [];
  const legacyAliasAudit = await buildLegacyAliasAudit({}, { cwd: rootPath });

  if (!root) {
    warnings.push({
      code: 'IDENTITY_AUDIT_GIT_ROOT_NOT_FOUND',
      message: 'No Git root was found from the current working directory.',
      details: { cwd }
    });
  }
  if (!remoteUrl) {
    warnings.push({
      code: 'IDENTITY_AUDIT_ORIGIN_NOT_FOUND',
      message: 'No origin remote URL was found in the local Git configuration.',
      details: { repository_root: rootPath }
    });
  }
  if (remoteUrl && !remoteMatchesCurrent && !remoteMatchesFuture && !remoteMatchesLegacy) {
    warnings.push({
      code: 'IDENTITY_AUDIT_REMOTE_UNRECOGNIZED',
      message: 'The origin remote URL does not match the current, future, or legacy repository identity metadata.',
      details: { remote_url: remoteUrl }
    });
  }

  return {
    schema_version: IDENTITY_AUDIT_VERSION,
    identity: productIdentitySummary(),
    repository: {
      root_path: rootPath,
      resolved_root_path: resolvedRoot,
      root_name: rootName,
      current_repository_name: PRODUCT_IDENTITY.repositoryName,
      future_repository_name: PRODUCT_IDENTITY.futureRepositoryName,
      root_matches_current_name: currentRootMatches,
      root_matches_future_name: futureRootMatches,
      physical_rename_pending: physicalRenamePending,
      origin_remote_url: remoteUrl,
      normalized_origin_remote_url: normalizedRemote,
      current_repository_url: PRODUCT_IDENTITY.repositoryUrl,
      future_repository_url: PRODUCT_IDENTITY.futureRepositoryUrl,
      origin_matches_current_repository_url: remoteMatchesCurrent,
      origin_matches_future_repository_url: remoteMatchesFuture,
      origin_matches_legacy_repository_url: remoteMatchesLegacy,
      remote_rename_pending: remoteRenamePending,
      current_remote_accepted_until_remote_rename: remoteMatchesCurrent || remoteMatchesLegacy
    },
    compatibility: {
      canonical_cli_bin_name: PRODUCT_IDENTITY.cliBinName,
      legacy_cli_bin_names: PRODUCT_IDENTITY.legacyCliBins.map((entry) => entry.name),
      canonical_mcp_bin_name: PRODUCT_IDENTITY.mcpBinName,
      legacy_mcp_bin_names: PRODUCT_IDENTITY.legacyMcpBins.map((entry) => entry.name),
      canonical_mcp_server_name: PRODUCT_IDENTITY.mcpServerName,
      legacy_mcp_server_names: PRODUCT_IDENTITY.legacyMcpServerNames,
      default_artifact_root: PRODUCT_IDENTITY.defaultArtifactRoot,
      future_artifact_root: PRODUCT_IDENTITY.futureArtifactRoot,
      legacy_artifact_roots: PRODUCT_IDENTITY.legacyArtifactRoots,
      legacy_alias_removal_authorized: false,
      artifact_root_migration_authorized: false,
      legacy_alias_audit: {
        surface_count: legacyAliasAudit.summary.surface_count,
        retained_count: legacyAliasAudit.summary.retained_count,
        warning_eligible_count: legacyAliasAudit.summary.warning_eligible_count,
        compatibility_window: legacyAliasAudit.summary.compatibility_window,
        removal_candidate_ready: false,
        phase_139_removal_boundary: legacyAliasAudit.migration_status.phase_139_removal_boundary
      }
    },
    package: {
      package_name: PRODUCT_IDENTITY.packageName,
      filesystem_safe_package_name: filesystemSafeName(PRODUCT_IDENTITY.packageName),
      npm_cache_directory_name: PRODUCT_IDENTITY.npmCacheDirectoryName,
      pack_smoke_directory_name: PRODUCT_IDENTITY.packSmokeDirectoryName
    },
    readiness: {
      status: identityReadinessStatus({
        remoteUnrecognized: warnings.some((warning) => warning.code === 'IDENTITY_AUDIT_REMOTE_UNRECOGNIZED'),
        physicalRenamePending,
        remoteRenamePending
      }),
      physical_directory_rename_safe_to_test: physicalRenamePending,
      physical_directory_rename_completed: futureRootMatches,
      remote_rename_required_for_future_repository_url: remoteRenamePending,
      legacy_aliases_must_remain: true,
      existing_feature_tradeoff: false
    },
    warnings
  };
}

export function identityReadinessStatus({ remoteUnrecognized, physicalRenamePending, remoteRenamePending }) {
  if (remoteUnrecognized) {
    return 'needs_attention';
  }
  if (physicalRenamePending) {
    return 'ready_for_physical_rename_check';
  }
  if (remoteRenamePending) {
    return 'physical_rename_complete_remote_rename_pending';
  }
  return 'identity_rename_complete';
}

export function normalizeRepositoryUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }
  const withoutGitSuffix = text.replace(/\.git$/u, '').replace(/\/+$/u, '');
  const sshMatch = withoutGitSuffix.match(/^git@([^:]+):(.+)$/u);
  if (sshMatch) {
    return `${sshMatch[1].toLowerCase()}/${sshMatch[2]}`;
  }
  const sshUrlMatch = withoutGitSuffix.match(/^ssh:\/\/git@([^/]+)\/(.+)$/u);
  if (sshUrlMatch) {
    return `${sshUrlMatch[1].toLowerCase()}/${sshUrlMatch[2]}`;
  }
  try {
    const url = new URL(withoutGitSuffix);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/^\/+/u, '') ? `/${url.pathname.replace(/^\/+|\/+$/gu, '')}` : ''}`;
  } catch {
    return withoutGitSuffix;
  }
}

export function identityAuditBoundary() {
  return {
    browser_launched: false,
    artifacts_written: false,
    files_mutated: false,
    git_mutated: false,
    remote_contact: false,
    network_contact: false,
    shell_used: false,
    provider_call_performed: false,
    mcp_execution_exposed: false
  };
}

async function findRepositoryRoot(start) {
  let current = path.resolve(start);
  while (true) {
    const dotGit = path.join(current, '.git');
    const dotGitStat = await stat(dotGit).catch(() => null);
    if (dotGitStat) {
      return { path: current, dotGit, dotGitIsDirectory: dotGitStat.isDirectory() };
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function readOriginUrl(repoRoot) {
  const configPath = await resolveGitConfigPath(repoRoot);
  const text = await readFile(configPath, 'utf8').catch(() => '');
  let inOrigin = false;
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inOrigin = /^\[remote "origin"\]$/u.test(trimmed);
      continue;
    }
    if (inOrigin && trimmed.startsWith('url')) {
      const [, value] = trimmed.split(/=(.*)/su);
      return value?.trim() || null;
    }
  }
  return null;
}

async function resolveGitConfigPath(repoRoot) {
  const dotGit = path.join(repoRoot, '.git');
  const dotGitStat = await stat(dotGit).catch(() => null);
  if (dotGitStat?.isDirectory()) {
    return path.join(dotGit, 'config');
  }
  const dotGitText = await readFile(dotGit, 'utf8').catch(() => '');
  const gitdir = dotGitText.match(/^gitdir:\s*(.+)$/imu)?.[1]?.trim();
  if (gitdir) {
    return path.join(path.resolve(repoRoot, gitdir), 'config');
  }
  return path.join(dotGit, 'config');
}
