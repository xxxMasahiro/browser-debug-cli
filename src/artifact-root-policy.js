import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from './constants.js';
import { PRODUCT_IDENTITY, productIdentitySummary } from './product-identity.js';

export const ARTIFACT_ROOT_POLICY_VERSION = '1.0.0';
export const ARTIFACT_ROOT_POLICY_DEFAULT_PATH = 'ops/ARTIFACT_ROOT_POLICY.json';

const DEFAULT_POLICY = Object.freeze({
  schema_version: ARTIFACT_ROOT_POLICY_VERSION,
  mode: 'legacy_compatibility',
  write_root_role: 'default',
  canonical_root_role: 'future',
  read_root_roles: Object.freeze(['default', 'future', 'legacy']),
  dual_write_enabled: false,
  migration_execution_enabled: false,
  fixture_migration_execution_enabled: true,
  legacy_compatibility_required: true
});

export async function runArtifactRootStatus(options = {}, context = {}) {
  const report = await buildArtifactRootStatus(options, context);
  return {
    status: 'ok',
    data: {
      artifact_root_status: report,
      boundary: report.boundary
    },
    warnings: report.warnings,
    errors: [],
    artifacts: []
  };
}

export async function buildArtifactRootStatus(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const config = await resolveArtifactRootConfig(options, { ...context, cwd });
  const roots = await Promise.all(config.root_set.map(async (root) => {
    const absolutePath = path.resolve(cwd, root.path);
    const rootStat = await stat(absolutePath).catch(() => null);
    return {
      ...root,
      exists: Boolean(rootStat),
      directory: Boolean(rootStat?.isDirectory()),
      absolute_path_confined: isInside(cwd, absolutePath)
    };
  }));

  return {
    schema_version: SCHEMA_VERSION,
    policy_version: ARTIFACT_ROOT_POLICY_VERSION,
    generated_at: now.toISOString(),
    product_identity: productIdentitySummary(),
    policy_source: config.policy_source,
    mode: config.mode,
    current_behavior: {
      effective_write_root: config.write_root.path,
      write_root_role: config.write_root.role,
      future_artifact_root: PRODUCT_IDENTITY.futureArtifactRoot,
      default_artifact_root_preserved: config.write_root.path === PRODUCT_IDENTITY.defaultArtifactRoot,
      dual_write_enabled: config.dual_write_enabled,
      dual_write_active: false,
      read_roots: config.read_roots.map((root) => root.path),
      legacy_compatibility_required: config.legacy_compatibility_required
    },
    roots,
    migration: {
      planned: true,
      real_workspace_execution_enabled: false,
      fixture_execution_enabled: config.fixture_migration_execution_enabled,
      deletes_legacy_files: false,
      overwrites_conflicts: false,
      receipt_required: true,
      approval_required_for_real_workspace: true
    },
    warnings: config.warnings,
    boundary: artifactRootBoundary()
  };
}

export async function resolveArtifactRootConfig(options = {}, context = {}) {
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const policyPath = path.resolve(cwd, options.policy ?? ARTIFACT_ROOT_POLICY_DEFAULT_PATH);
  const loaded = await readPolicy(policyPath);
  const policy = normalizePolicy(loaded.policy);
  const rootSet = artifactRootSet();
  const rootByRole = new Map(rootSet.map((root) => [root.role, root]));
  const writeRoot = options['artifact-root']
    ? rootRecord('override', String(options['artifact-root']), 'caller_override')
    : rootByRole.get(policy.write_root_role) ?? rootByRole.get('default');
  const readRoots = normalizeReadRoots(policy.read_root_roles, rootSet, writeRoot);
  return {
    policy_source: {
      path: path.relative(cwd, policyPath) || path.basename(policyPath),
      loaded: loaded.loaded,
      defaulted: !loaded.loaded,
      schema_version: policy.schema_version
    },
    mode: policy.mode,
    write_root: writeRoot,
    read_roots: readRoots,
    root_set: rootSet,
    dual_write_enabled: Boolean(policy.dual_write_enabled),
    migration_execution_enabled: Boolean(policy.migration_execution_enabled),
    fixture_migration_execution_enabled: policy.fixture_migration_execution_enabled !== false,
    legacy_compatibility_required: policy.legacy_compatibility_required !== false,
    warnings: loaded.warnings
  };
}

export function artifactRootBoundary() {
  return {
    local_only: true,
    read_only: true,
    artifacts_written: false,
    files_mutated: false,
    migration_executed: false,
    real_workspace_migration_executed: false,
    fixture_migration_execute_available: true,
    legacy_files_deleted: false,
    dual_write_active: false,
    provider_call_performed: false,
    api_call_performed: false,
    network_contact: false,
    mcp_execution_exposed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

export function artifactRootSet(identity = PRODUCT_IDENTITY) {
  const roots = [
    rootRecord('default', identity.defaultArtifactRoot, 'current_default'),
    rootRecord('future', identity.futureArtifactRoot, 'future_canonical'),
    ...identity.legacyArtifactRoots.map((root) => rootRecord('legacy', root, root === identity.defaultArtifactRoot ? 'legacy_current_default' : 'legacy_compatibility'))
  ];
  const seen = new Set();
  return Object.freeze(roots.filter((root) => {
    const key = `${root.role}:${root.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }));
}

function normalizeReadRoots(roles, rootSet, writeRoot) {
  const output = [];
  for (const role of Array.isArray(roles) ? roles : DEFAULT_POLICY.read_root_roles) {
    for (const root of rootSet.filter((candidate) => candidate.role === role)) {
      output.push(root);
    }
  }
  output.push(writeRoot);
  const seen = new Set();
  return output.filter((root) => {
    const key = root.path;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizePolicy(policy) {
  return {
    ...DEFAULT_POLICY,
    ...(policy && typeof policy === 'object' ? policy : {})
  };
}

async function readPolicy(policyPath) {
  try {
    return {
      loaded: true,
      policy: JSON.parse(await readFile(policyPath, 'utf8')),
      warnings: []
    };
  } catch (error) {
    return {
      loaded: false,
      policy: DEFAULT_POLICY,
      warnings: [{
        code: 'ARTIFACT_ROOT_POLICY_DEFAULTED',
        message: 'Artifact-root policy file could not be read; built-in compatibility policy was used.',
        details: { reason: error.code ?? error.message }
      }]
    };
  }
}

function rootRecord(role, rootPath, status) {
  return Object.freeze({
    role,
    path: rootPath,
    status,
    relative: true
  });
}

function isInside(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolvedChild = path.resolve(child);
  return resolvedChild === resolvedParent || resolvedChild.startsWith(`${resolvedParent}${path.sep}`);
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
