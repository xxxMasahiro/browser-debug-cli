import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import { resolveArtifactRootConfig } from './artifact-root-policy.js';

const ARTIFACT_DIRS = [
  'sessions',
  'session-commands',
  'session-results',
  'checkpoints',
  'auth',
  'observations',
  'screenshots',
  'traces',
  'reports',
  'specs',
  'daemons',
  'targets',
  'reviews',
  'layouts',
  'diffs',
  'coverage',
  'review-artifacts',
  'visual-evidence',
  'visual-review-results',
  'agentic-human-review-proposals',
  'agentic-human-review-plans',
  'agentic-human-review-packages',
  'agentic-human-review-results',
  'agent-packages',
  'agent-results',
  'agent-requests',
  'agent-workflows',
  'agent-executions',
  'receipts'
];

export function createArtifactId(now = new Date(), prefix = 'run') {
  const date = now instanceof Date ? now : new Date(now);
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}-${randomUUID().slice(0, 8)}`;
}

export function resolveArtifactRoot(cwd, artifactRoot = DEFAULT_ARTIFACT_ROOT) {
  if (!artifactRoot || artifactRoot === '.') {
    throw new Error('Artifact root must be a non-empty relative path.');
  }
  if (path.isAbsolute(artifactRoot)) {
    throw new Error('Artifact root must be relative to the current workspace.');
  }
  const root = path.resolve(cwd, artifactRoot);
  const resolvedCwd = path.resolve(cwd);
  if (root !== resolvedCwd && !root.startsWith(`${resolvedCwd}${path.sep}`)) {
    throw new Error('Artifact root must stay inside the current workspace.');
  }
  return root;
}

export async function ensureArtifactRoot(cwd, artifactRoot = DEFAULT_ARTIFACT_ROOT) {
  const root = resolveArtifactRoot(cwd, artifactRoot);
  await mkdir(root, { recursive: true });
  await Promise.all(ARTIFACT_DIRS.map((dir) => mkdir(path.join(root, dir), { recursive: true })));
  return root;
}

export async function resolveArtifactRootSet(cwd, options = {}, context = {}) {
  const config = await resolveArtifactRootConfig(options, { ...context, cwd });
  return {
    config,
    writeRoot: resolveArtifactRoot(cwd, config.write_root.path),
    readRoots: config.read_roots.map((root) => ({
      ...root,
      absolute_path: resolveArtifactRoot(cwd, root.path)
    }))
  };
}

export async function resolveArtifactReadRoots(cwd, options = {}, context = {}) {
  const resolved = await resolveArtifactRootSet(cwd, options, context);
  return resolved.readRoots;
}

export async function ensureArtifactWriteRoots(cwd, options = {}, context = {}) {
  const resolved = await resolveArtifactRootSet(cwd, options, context);
  await ensureArtifactRoot(cwd, resolved.config.write_root.path);
  return [resolved.writeRoot];
}

export function artifactRelPath(artifactRoot, ...parts) {
  return path.posix.join(artifactRoot.replace(/\\/g, '/'), ...parts);
}

export async function writeJsonArtifact(root, relParts, value) {
  const file = path.join(root, ...relParts);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

export async function readJsonArtifact(root, relParts) {
  const file = path.join(root, ...relParts);
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function readJsonArtifactAcrossRoots(cwd, relParts, options = {}, context = {}) {
  const readRoots = await resolveArtifactReadRoots(cwd, options, context);
  const errors = [];
  for (const root of readRoots) {
    try {
      const file = path.join(root.absolute_path, ...relParts);
      return {
        value: JSON.parse(await readFile(file, 'utf8')),
        root
      };
    } catch (error) {
      errors.push({ root: root.path, code: error.code ?? 'READ_FAILED' });
    }
  }
  const error = new Error('Artifact was not found in any configured read root.');
  error.code = 'ARTIFACT_NOT_FOUND';
  error.details = { read_roots: readRoots.map((root) => root.path), errors };
  throw error;
}

export async function writeTextArtifact(root, relParts, value) {
  const file = path.join(root, ...relParts);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value, 'utf8');
  return file;
}

export async function writeJsonArtifactToWriteRoots(cwd, relParts, value, options = {}, context = {}) {
  const [root] = await ensureArtifactWriteRoots(cwd, options, context);
  return writeJsonArtifact(root, relParts, value);
}

export async function writeTextArtifactToWriteRoots(cwd, relParts, value, options = {}, context = {}) {
  const [root] = await ensureArtifactWriteRoots(cwd, options, context);
  return writeTextArtifact(root, relParts, value);
}

export function artifactObject({ type, path: artifactPath, description }) {
  return {
    schema_version: SCHEMA_VERSION,
    type,
    path: artifactPath,
    description
  };
}
