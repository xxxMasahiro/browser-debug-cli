import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION } from './constants.js';
import { artifactRelPath } from './artifacts.js';
import { artifactRootBoundary, resolveArtifactRootConfig } from './artifact-root-policy.js';
import { PRODUCT_IDENTITY, productIdentitySummary } from './product-identity.js';

export const ARTIFACT_ROOT_MIGRATION_VERSION = '1.0.0';

export async function runArtifactRootMigrationPlan(options = {}, context = {}) {
  const plan = await buildArtifactRootMigrationPlan(options, context);
  return {
    status: 'ok',
    data: {
      artifact_root_migration: plan,
      boundary: plan.boundary
    },
    warnings: plan.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runArtifactRootMigrationExecute(options = {}, context = {}) {
  if (!options.execute) {
    return artifactRootMigrationError('ARTIFACT_ROOT_MIGRATION_EXECUTE_REQUIRED', 'artifact-root migration execute requires --execute.', options);
  }
  if (!options['fixture-root']) {
    return artifactRootMigrationError(
      'ARTIFACT_ROOT_MIGRATION_FIXTURE_ONLY',
      'artifact-root migration execute is fixture-only in this phase and requires --fixture-root.',
      options
    );
  }

  const fixtureRoot = path.resolve(String(options['fixture-root']));
  const allowed = await isAllowedFixtureRoot(fixtureRoot);
  if (!allowed) {
    return artifactRootMigrationError(
      'ARTIFACT_ROOT_MIGRATION_FIXTURE_ROOT_REJECTED',
      'artifact-root migration execute only accepts fixture roots inside the local temporary directory.',
      { fixture_root: fixtureRoot }
    );
  }

  const plan = await buildArtifactRootMigrationPlan(options, { ...context, cwd: fixtureRoot, fixtureOnly: true });
  if (options['plan-hash'] && options['plan-hash'] !== plan.plan_hash) {
    return artifactRootMigrationError(
      'ARTIFACT_ROOT_MIGRATION_PLAN_HASH_MISMATCH',
      'artifact-root migration execute received a plan hash that does not match the current fixture plan.',
      { expected: options['plan-hash'], actual: plan.plan_hash }
    );
  }

  const copied = [];
  const skipped = [];
  for (const candidate of plan.candidates) {
    if (candidate.conflict) {
      skipped.push({ ...candidate, reason: 'target_exists_conflict' });
      continue;
    }
    await mkdir(path.dirname(candidate.target_absolute_path), { recursive: true });
    await copyFile(candidate.source_absolute_path, candidate.target_absolute_path);
    copied.push(candidate);
  }

  const receipt = {
    schema_version: SCHEMA_VERSION,
    migration_version: ARTIFACT_ROOT_MIGRATION_VERSION,
    operation: 'artifact-root migration execute',
    created_at: materializeNow(context.now).toISOString(),
    fixture_only: true,
    plan_hash: plan.plan_hash,
    copied_count: copied.length,
    skipped_count: skipped.length,
    deletes_legacy_files: false,
    overwrites_conflicts: false,
    copied: copied.map(candidateReceipt),
    skipped: skipped.map(candidateReceipt),
    boundary: {
      ...artifactRootBoundary(),
      read_only: false,
      artifacts_written: true,
      files_mutated: true,
      migration_executed: true,
      real_workspace_migration_executed: false,
      legacy_files_deleted: false
    }
  };

  const receiptRel = artifactRelPath(PRODUCT_IDENTITY.futureArtifactRoot, 'receipts', `artifact-root-migration-${shortHash(plan.plan_hash)}.json`);
  const receiptPath = path.join(fixtureRoot, receiptRel);
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  return {
    status: 'ok',
    data: {
      artifact_root_migration: {
        ...plan,
        status: 'fixture_executed',
        execution: {
          fixture_only: true,
          copied_count: copied.length,
          skipped_count: skipped.length,
          receipt_path: receiptRel,
          deletes_legacy_files: false,
          overwrites_conflicts: false
        },
        boundary: receipt.boundary
      },
      boundary: receipt.boundary
    },
    warnings: plan.warnings,
    errors: [],
    artifacts: [{
      schema_version: SCHEMA_VERSION,
      type: 'artifact_root_migration_receipt',
      path: receiptRel,
      description: 'Fixture-only artifact-root migration receipt.'
    }]
  };
}

export async function buildArtifactRootMigrationPlan(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const config = await resolveArtifactRootConfig(options, { ...context, cwd });
  const sourceRoots = uniqueRootsByPath(config.read_roots.filter((root) => root.path !== PRODUCT_IDENTITY.futureArtifactRoot));
  const targetRoot = PRODUCT_IDENTITY.futureArtifactRoot;
  const candidates = [];
  const warnings = [...config.warnings];

  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = path.resolve(cwd, sourceRoot.path);
    const files = await collectRegularFiles(absoluteRoot).catch(() => []);
    for (const filePath of files) {
      const relPath = path.relative(absoluteRoot, filePath).split(path.sep).join(path.posix.sep);
      const targetAbsolutePath = path.resolve(cwd, targetRoot, relPath);
      const fileStat = await stat(filePath);
      const targetStat = await stat(targetAbsolutePath).catch(() => null);
      candidates.push({
        source_root_role: sourceRoot.role,
        source_root: sourceRoot.path,
        source_relative_path: relPath,
        target_root: targetRoot,
        target_relative_path: relPath,
        source_absolute_path: filePath,
        target_absolute_path: targetAbsolutePath,
        size_bytes: fileStat.size,
        mtime_ms: fileStat.mtimeMs,
        sha256: await sha256File(filePath),
        action: targetStat ? 'skip_conflict' : 'copy',
        conflict: Boolean(targetStat)
      });
    }
  }

  const planHash = hashObject({
    version: ARTIFACT_ROOT_MIGRATION_VERSION,
    target_root: targetRoot,
    fixture_only: Boolean(context.fixtureOnly || options['fixture-root']),
    candidates: candidates.map((candidate) => ({
      source_root: candidate.source_root,
      source_relative_path: candidate.source_relative_path,
      target_relative_path: candidate.target_relative_path,
      size_bytes: candidate.size_bytes,
      mtime_ms: candidate.mtime_ms,
      sha256: candidate.sha256,
      action: candidate.action
    }))
  });

  return {
    schema_version: SCHEMA_VERSION,
    migration_version: ARTIFACT_ROOT_MIGRATION_VERSION,
    generated_at: now.toISOString(),
    status: 'planned',
    product_identity: productIdentitySummary(),
    policy_source: config.policy_source,
    mode: config.mode,
    source_roots: sourceRoots.map((root) => root.path),
    target_root: targetRoot,
    fixture_only: Boolean(context.fixtureOnly || options['fixture-root']),
    candidate_count: candidates.length,
    copy_count: candidates.filter((candidate) => candidate.action === 'copy').length,
    conflict_count: candidates.filter((candidate) => candidate.conflict).length,
    plan_hash: planHash,
    candidates,
    execution_boundary: {
      real_workspace_execution_enabled: false,
      fixture_execution_enabled: true,
      requires_execute_flag: true,
      requires_fixture_root: true,
      requires_plan_hash_for_strict_revalidation: false,
      deletes_legacy_files: false,
      overwrites_conflicts: false,
      approval_required_for_real_workspace: true
    },
    warnings,
    boundary: artifactRootBoundary()
  };
}

function artifactRootMigrationError(code, message, details) {
  return {
    status: 'error',
    data: {
      artifact_root_migration: null,
      boundary: artifactRootBoundary()
    },
    warnings: [],
    errors: [{ code, message, details }],
    artifacts: []
  };
}

async function collectRegularFiles(root) {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) {
    return [];
  }
  const output = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...await collectRegularFiles(absolutePath));
    } else if (entry.isFile()) {
      output.push(absolutePath);
    }
  }
  return output.sort();
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function isAllowedFixtureRoot(fixtureRoot) {
  const allowedRoot = await realpath(tmpdir()).catch(() => path.resolve(tmpdir()));
  const resolvedFixture = await realpath(fixtureRoot).catch(() => fixtureRoot);
  return resolvedFixture === allowedRoot || resolvedFixture.startsWith(`${allowedRoot}${path.sep}`);
}

function candidateReceipt(candidate) {
  return {
    source_root: candidate.source_root,
    source_relative_path: candidate.source_relative_path,
    target_root: candidate.target_root,
    target_relative_path: candidate.target_relative_path,
    size_bytes: candidate.size_bytes,
    sha256: candidate.sha256,
    action: candidate.action,
    reason: candidate.reason ?? null
  };
}

function hashObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function shortHash(value) {
  return String(value).slice(0, 16);
}

function uniqueRootsByPath(roots) {
  const seen = new Set();
  return roots.filter((root) => {
    if (seen.has(root.path)) {
      return false;
    }
    seen.add(root.path);
    return true;
  });
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
