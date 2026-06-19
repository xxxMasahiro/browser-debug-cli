import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';

const ARTIFACT_DIRS = [
  'sessions',
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

export async function writeTextArtifact(root, relParts, value) {
  const file = path.join(root, ...relParts);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value, 'utf8');
  return file;
}

export function artifactObject({ type, path: artifactPath, description }) {
  return {
    schema_version: SCHEMA_VERSION,
    type,
    path: artifactPath,
    description
  };
}
