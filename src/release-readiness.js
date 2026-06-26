import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from './constants.js';
import { PRODUCT_IDENTITY, productIdentitySummary } from './product-identity.js';

export const RELEASE_READINESS_VERSION = '1.0.0';

export async function runReleaseReadiness(options = {}, context = {}) {
  const readiness = await buildReleaseReadiness(options, context);
  return {
    status: readiness.status === 'blocked' ? 'error' : 'ok',
    data: {
      release_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: readiness.warnings,
    errors: readiness.status === 'blocked'
      ? [{ code: 'RELEASE_READINESS_BLOCKED', message: 'Release readiness could not inspect local package metadata.', details: readiness.diagnostics }]
      : [],
    artifacts: []
  };
}

export async function buildReleaseReadiness(_options = {}, context = {}) {
  const now = materializeNow(context.now);
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const packageJson = context.packageJson ?? await readPackageJson(cwd);
  const diagnostics = [];
  const warnings = [];

  if (!packageJson) {
    diagnostics.push({ code: 'PACKAGE_JSON_NOT_FOUND', message: 'Local package metadata could not be read.' });
  }

  const metadata = packageMetadata(packageJson);
  const identity = productIdentitySummary();
  const packageMatchesIdentity = Boolean(
    packageJson
    && packageJson.name === PRODUCT_IDENTITY.packageName
    && packageJson.version === PRODUCT_IDENTITY.packageVersion
  );
  const unreleasedPrivatePackage = packageJson?.private === true;
  const licensePending = packageJson?.license === 'UNLICENSED';
  const publicationApprovalRequired = true;

  if (!packageMatchesIdentity) {
    warnings.push({
      code: 'PACKAGE_METADATA_IDENTITY_MISMATCH',
      message: 'Local package name or version does not match product identity metadata.',
      details: {
        package_name: packageJson?.name ?? null,
        identity_package_name: PRODUCT_IDENTITY.packageName,
        package_version: packageJson?.version ?? null,
        identity_package_version: PRODUCT_IDENTITY.packageVersion
      }
    });
  }

  return {
    schema_version: SCHEMA_VERSION,
    readiness_version: RELEASE_READINESS_VERSION,
    generated_at: now.toISOString(),
    status: packageJson ? 'ready_for_local_release_candidate_checks' : 'blocked',
    product_identity: identity,
    package_metadata: metadata,
    decisions: {
      package_name: decision('package_name', packageMatchesIdentity ? 'current_identity_aligned' : 'needs_attention', 'Public package name remains approval-bound before publication.'),
      license: decision('license', licensePending ? 'pending_public_release_decision' : 'declared', 'License changes remain approval-bound before publication.'),
      package_visibility: decision('package_visibility', unreleasedPrivatePackage ? 'private_unpublished' : 'needs_attention', 'The package must remain private until publication is explicitly approved.'),
      provenance: decision('provenance', 'policy_defined_not_verified', 'Provenance support cannot be verified without npm registry/auth contact.'),
      two_factor_auth: decision('two_factor_auth', 'policy_defined_not_verified', '2FA state cannot be verified without npm auth contact.'),
      token_policy: decision('token_policy', 'env_or_interactive_only_future', 'No token values are read, stored, printed, or written by this report.'),
      local_release_candidate: decision('local_release_candidate', 'local_pack_checks_available', 'Use local pack and packed-install checks as release-candidate evidence without publishing.'),
      publish_dry_run: decision('publish_dry_run', 'approval_required_not_run', 'Registry publication dry-run is not executed because it can touch registry/auth state.')
    },
    local_checks: [
      check('unit_and_architecture', 'npm test', 'local_only_available'),
      check('rename_readiness', 'npm run test:rename-readiness', 'local_only_available'),
      check('pack_dry_run', 'npm run test:pack', 'local_only_available'),
      check('packed_install_smoke', 'npm run test:pack-install', 'local_only_available'),
      check('release_check', 'npm run release:check', 'local_only_available')
    ],
    publication_boundary: {
      approval_required: publicationApprovalRequired,
      npm_publish_performed: false,
      npm_publish_dry_run_performed: false,
      registry_lookup_performed: false,
      npm_auth_checked: false,
      token_values_read: false,
      token_values_recorded: false,
      package_json_mutated: false,
      product_docs_promoted: false
    },
    next_steps: [
      'Run local release-candidate checks when release readiness needs local evidence.',
      'Request explicit approval before npm registry, auth, dry-run publication, or live publication actions.',
      'Keep package naming, license, provenance, token, and 2FA decisions separate from local readiness reporting.'
    ],
    diagnostics,
    warnings,
    boundary: releaseReadinessBoundary()
  };
}

export function releaseReadinessBoundary() {
  return {
    local_only: true,
    read_only: true,
    artifacts_written: false,
    package_json_mutated: false,
    npm_publish_performed: false,
    npm_publish_dry_run_performed: false,
    npm_registry_contacted: false,
    npm_auth_checked: false,
    network_contact: false,
    token_values_read: false,
    token_values_recorded: false,
    credential_values_read: false,
    credential_values_stored: false,
    product_docs_promoted: false,
    mcp_execution_exposed: false,
    shell_used: false,
    gate_effect: 'none'
  };
}

async function readPackageJson(cwd) {
  try {
    return JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function packageMetadata(packageJson) {
  if (!packageJson) {
    return null;
  }
  return {
    name: packageJson.name ?? null,
    version: packageJson.version ?? null,
    private: packageJson.private === true,
    license: packageJson.license ?? null,
    description: packageJson.description ?? null,
    bin_names: Object.keys(packageJson.bin ?? {}),
    files: Array.isArray(packageJson.files) ? packageJson.files : [],
    keywords: Array.isArray(packageJson.keywords) ? packageJson.keywords : [],
    repository: packageJson.repository ?? null,
    bugs: packageJson.bugs ?? null,
    homepage: packageJson.homepage ?? null,
    engines: packageJson.engines ?? null
  };
}

function decision(id, status, summary) {
  return Object.freeze({ id, status, summary, approval_required_before_publication: true });
}

function check(id, command, status) {
  return Object.freeze({ id, command, status, local_only: true });
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
