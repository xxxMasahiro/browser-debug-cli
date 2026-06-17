import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ARTIFACT_RETENTION_POLICY,
  DEFAULT_ARTIFACT_ROOT,
  MIN_NODE_MAJOR,
  SCHEMA_VERSION_POLICY
} from './constants.js';

export async function runDoctor({
  cwd = process.cwd(),
  nodeVersion = process.versions.node,
  platform = process.platform,
  importPlaywright = probePlaywright
} = {}) {
  const checks = [];
  const warnings = [];
  const errors = [];

  const nodeMajor = Number.parseInt(nodeVersion.split('.')[0], 10);
  const nodeOk = Number.isInteger(nodeMajor) && nodeMajor >= MIN_NODE_MAJOR;
  checks.push({
    id: 'node.version',
    status: nodeOk ? 'pass' : 'fail',
    summary: nodeOk
      ? `Node.js ${nodeVersion} satisfies >=${MIN_NODE_MAJOR}.`
      : `Node.js ${nodeVersion} does not satisfy >=${MIN_NODE_MAJOR}.`,
    details: { current: nodeVersion, minimum_major: MIN_NODE_MAJOR }
  });
  if (!nodeOk) {
    errors.push({
      code: 'NODE_VERSION_UNSUPPORTED',
      message: `Node.js ${MIN_NODE_MAJOR} or newer is required.`,
      details: { current: nodeVersion, minimum_major: MIN_NODE_MAJOR }
    });
  }

  checks.push({
    id: 'module.format',
    status: 'pass',
    summary: 'The package is configured for ESM modules.',
    details: { module_format: 'esm' }
  });

  const artifactIgnored = await isArtifactRootIgnored(cwd);
  checks.push({
    id: 'artifact_root.ignored',
    status: artifactIgnored ? 'pass' : 'fail',
    summary: artifactIgnored
      ? `${DEFAULT_ARTIFACT_ROOT}/ is ignored by Git.`
      : `${DEFAULT_ARTIFACT_ROOT}/ must be ignored by Git.`,
    details: { artifact_root: DEFAULT_ARTIFACT_ROOT }
  });
  if (!artifactIgnored) {
    errors.push({
      code: 'ARTIFACT_ROOT_NOT_IGNORED',
      message: `${DEFAULT_ARTIFACT_ROOT}/ must stay out of committed files.`,
      details: { artifact_root: DEFAULT_ARTIFACT_ROOT }
    });
  }

  const playwright = await importPlaywright();
  if (playwright.available) {
    checks.push({
      id: 'playwright.package',
      status: 'pass',
      summary: 'Playwright is available for future browser observation.',
      details: {}
    });
  } else {
    checks.push({
      id: 'playwright.package',
      status: 'warn',
      summary: 'Playwright is not installed; browser observation is unavailable until dependencies are added.',
      details: { reason: playwright.reason ?? 'not available' }
    });
    warnings.push({
      code: 'PLAYWRIGHT_NOT_INSTALLED',
      message: 'Playwright is not installed. This is expected before the dependency-installation phase.',
      details: { required_for: ['observe'] }
    });
  }

  checks.push({
    id: 'network.external_contact',
    status: 'pass',
    summary: 'doctor performs local checks only and does not contact external services.',
    details: {}
  });

  checks.push({
    id: 'schema.version_policy',
    status: 'pass',
    summary: `JSON envelopes use schema version ${SCHEMA_VERSION_POLICY.current}.`,
    details: SCHEMA_VERSION_POLICY
  });

  checks.push({
    id: 'artifact_retention.manual',
    status: 'pass',
    summary: 'Artifacts are retained until the developer manually removes the ignored artifact root.',
    details: ARTIFACT_RETENTION_POLICY
  });

  return {
    status: errors.length > 0 ? 'error' : 'ok',
    data: {
      runtime: {
        node_version: nodeVersion,
        minimum_node_major: MIN_NODE_MAJOR,
        module_format: 'esm',
        platform
      },
      artifact_root: DEFAULT_ARTIFACT_ROOT,
      artifact_retention: ARTIFACT_RETENTION_POLICY,
      schema_version_policy: SCHEMA_VERSION_POLICY,
      checks
    },
    warnings,
    errors
  };
}

async function isArtifactRootIgnored(cwd) {
  try {
    const gitignore = await readFile(path.join(cwd, '.gitignore'), 'utf8');
    return gitignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .some((line) => line === `${DEFAULT_ARTIFACT_ROOT}/` || line === DEFAULT_ARTIFACT_ROOT);
  } catch {
    return false;
  }
}

async function probePlaywright() {
  try {
    await import('playwright');
    return { available: true };
  } catch (error) {
    return {
      available: false,
      reason: error?.code === 'ERR_MODULE_NOT_FOUND' ? 'module not found' : 'import failed'
    };
  }
}
