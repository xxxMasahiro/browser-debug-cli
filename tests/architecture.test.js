import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_IDENTITY } from '../src/product-identity.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('runtime and tests avoid caller-specific implementation literals', async () => {
  const files = [
    'src/cli.js',
    'src/agent.js',
    'src/agent-execution.js',
    'src/agent-execution-providers.js',
    'src/visual-review-provider-policy.js',
    'src/visual-review-result-preparation.js',
    'src/visual-review-dashboard.js',
    'src/visual-review-aggregation.js',
    'src/desktop-review-provider-preparation-plan.js',
    'src/image-review.js',
    'src/identity-audit.js',
    'src/legacy-alias-audit.js',
    'src/legacy-alias-removal-readiness.js',
    'src/release-readiness.js',
    'src/artifact-root-policy.js',
    'src/artifact-root-migration.js',
    'src/constrained-shell-readiness.js',
    'src/final-hardening-readiness.js',
    'src/language-settings.js',
    'src/locale-policy.js',
    'src/constants.js',
    'src/content-ux-advisory.js',
    'src/daemon.js',
    'src/daemon-worker.js',
    'src/durations.js',
    'src/observe.js',
    'src/page-evidence.js',
    'src/parser.js',
    'src/resource-artifacts.js',
    'src/resource-guard.js',
    'src/resource-status.js',
    'src/review.js',
    'src/mcp.js',
    'src/mcp-capabilities.js',
    'src/capture-handoff.js',
    'src/capture-plan.js',
    'src/mcp-execution-gates.js',
    'src/operation-registry.js',
    'src/operation-roadmap.js',
    'src/operation-contracts.js',
    'src/operation-policy.js',
    'src/operation-admin-readiness.js',
    'src/operation-provider-readiness.js',
    'src/mcp-client-config.js',
    'src/mcp-http-transport.js',
    'src/mcp-profiles.js',
    'src/mcp-transport-policy.js',
    'src/api.js',
    'src/target.js',
    'src/sessions.js',
    'src/supervisor.js',
    'src/visual-evidence.js',
    'templates/review-target-manifest.json',
    'templates/status-dashboard-content-ux-target-manifest.json',
    '.github/workflows/ci.yml',
    'tests/cli.test.js',
    'tests/browser-smoke.test.js',
    'README.md'
  ];
  const forbidden = [
    /127\.0\.0\.1:517[34]/,
    /\bControl Center\b/i,
    /\bFrameCue\b/i,
    /\bai-driven-development-lesson\b/i,
    /\btask-tracker-repository\b/i,
    /\/home\/masahiro\/projects\//
  ];

  for (const file of files) {
    const content = await readText(file);
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${file} should not contain ${pattern}`);
    }
  }
});

test('observe and supervise share reusable page evidence helpers', async () => {
  const observe = await readText('src/observe.js');
  const supervisor = await readText('src/supervisor.js');

  for (const content of [observe, supervisor]) {
    assert.match(content, /from '\.\/page-evidence\.js'/);
    assert.match(content, /\battachPageObservers\b/);
    assert.match(content, /\bwaitForNetworkIdle\b/);
    assert.match(content, /\bwritePageObservation\b/);
  }

  assert.doesNotMatch(supervisor, /\bfunction attachPageObservers\b/);
  assert.doesNotMatch(supervisor, /\bfunction waitForNetworkIdle\b/);
  assert.doesNotMatch(supervisor, /\bfunction writeObservation\b/);
});

test('package keeps a standard local Node CLI surface', async () => {
  const pkg = JSON.parse(await readText('package.json'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.name, PRODUCT_IDENTITY.packageName);
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.equal(pkg.engines.node, '>=20');
  assert.equal(pkg.bin[PRODUCT_IDENTITY.cliBinName], PRODUCT_IDENTITY.cliBinPath);
  assert.equal(pkg.bin[PRODUCT_IDENTITY.mcpBinName], PRODUCT_IDENTITY.mcpBinPath);
  for (const legacyBin of [...PRODUCT_IDENTITY.legacyCliBins, ...PRODUCT_IDENTITY.legacyMcpBins]) {
    assert.equal(pkg.bin[legacyBin.name], legacyBin.path);
  }
  assert.equal(pkg.exports['.'], './src/api.js');
  assert.equal(pkg.exports['./schemas/*'], './schemas/*.schema.json');
  assert.ok(pkg.files.includes('.codex-plugin/'));
  assert.ok(pkg.files.includes('.mcp.json'));
  assert.ok(pkg.files.includes('docs/workflow/CONSUMER_USAGE.md'));
  assert.ok(pkg.files.includes('docs/workflow/IDENTITY_MIGRATION.md'));
  assert.ok(pkg.files.includes('ops/ARTIFACT_ROOT_POLICY.json'));
  assert.ok(pkg.files.includes('templates/'));
  assert.ok(pkg.files.includes(PRODUCT_IDENTITY.pluginSkillPath));
  for (const legacySkill of PRODUCT_IDENTITY.legacyPluginSkillPaths) {
    assert.ok(pkg.files.includes(legacySkill));
  }
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts['test:browser']);
  assert.ok(pkg.scripts['test:rename-readiness']);
  assert.ok(pkg.scripts['test:pack']);
  assert.ok(pkg.scripts['test:pack-install']);
  assert.ok(pkg.scripts['release:check']);
  assert.match(pkg.scripts['release:check'], /npm run test:rename-readiness/);
  assert.match(pkg.scripts['release:check'], /npm run test:pack-install/);
  assert.match(pkg.scripts['test:pack'], /tools\/pack-dry-run\.mjs/);
  assert.equal(pkg.scripts['test:pack'].includes(`${PRODUCT_IDENTITY.repositoryName}-npm-cache`), false);
  assert.match(pkg.scripts['test:pack-install'], /tools\/pack-install-smoke\.mjs/);
  assert.equal(pkg.scripts['test:pack-install'].includes(`${PRODUCT_IDENTITY.repositoryName}-${PRODUCT_IDENTITY.packageVersion}.tgz`), false);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.scripts.prepublishOnly, undefined);
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /\b(?:gh|curl|wget|publish)\b/);
});

test('review platform keeps local-first and manifest-driven boundaries', async () => {
  const review = await readText('src/review.js');
  const contentUxAdvisory = await readText('src/content-ux-advisory.js');
  const mcp = await readText('src/mcp.js');
  const mcpCapabilities = await readText('src/mcp-capabilities.js');
  const mcpProfiles = await readText('src/mcp-profiles.js');
  const target = await readText('src/target.js');
  const combined = `${review}\n${contentUxAdvisory}\n${mcp}\n${mcpCapabilities}\n${mcpProfiles}\n${target}`;

  assert.doesNotMatch(combined, /127\.0\.0\.1:517[34]|Control Center|FrameCue|ai-driven-development-lesson/);
  assert.doesNotMatch(combined, /launchPersistentContext|userDataDir|storageState/);
  assert.doesNotMatch(combined, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(combined, /node:child_process|child_process|execFile|spawn\(/);
  assert.match(review, /normalizeTargetManifest/);
  assert.match(review, /classifyActionCandidate/);
  assert.match(contentUxAdvisory, /local_content_ux_advisory/);
  assert.doesNotMatch(contentUxAdvisory, /from 'node:fs|from 'node:fs\/promises|from 'playwright'|import\('playwright'\)/);
  assert.match(target, /createTargetManifest/);
  assert.match(mcp, /tools\/list/);
  assert.match(mcp, /tools\/call/);
});

test('resource status preflight stays read-only and local', async () => {
  const resourceStatus = await readText('src/resource-status.js');

  assert.doesNotMatch(resourceStatus, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(resourceStatus, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(resourceStatus, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(resourceStatus, /launchPersistentContext|userDataDir|storageState/);
  assert.doesNotMatch(resourceStatus, /\bwriteFile\b|\bunlink\b|\brmdir\b|\bchmod\b|\bchown\b/);
  assert.match(resourceStatus, /automatic_system_cache_reclamation:\s*false/);
  assert.match(resourceStatus, /automatic_swap_configuration:\s*false/);
  assert.match(resourceStatus, /system_cache_mutated:\s*false/);
  assert.match(resourceStatus, /swap_mutated:\s*false/);
  assert.match(resourceStatus, /cache_deleted:\s*false/);
  assert.match(resourceStatus, /shell_used:\s*false/);
});

test('visual evidence core stays local, additive, and provider-free', async () => {
  const source = await readText('src/visual-evidence.js');
  const artifacts = await readText('src/artifacts.js');
  const api = await readText('src/api.js');
  const schemaFile = JSON.parse(await readText('schemas/visual-evidence.schema.json'));

  assert.match(artifacts, /'visual-evidence'/);
  assert.match(api, /createVisualEvidenceRecord/);
  assert.equal(schemaFile.title, 'TraceCue Visual Evidence');
  assert.match(source, /raw_pixels_in_json:\s*false/);
  assert.match(source, /external_upload:\s*false/);
  assert.match(source, /provider_call_performed:\s*false/);
  assert.match(source, /mcp_execution_exposed:\s*false/);
  assert.doesNotMatch(source, /from 'node:http'|from 'node:child_process'|createServer|\.listen\(|fetch\(|playwright/);
});

test('standalone image review stays workspace-confined and provider-free', async () => {
  const source = await readText('src/image-review.js');
  const parser = await readText('src/parser.js');
  const api = await readText('src/api.js');
  const artifacts = await readText('src/artifacts.js');
  const schemaFile = JSON.parse(await readText('schemas/image-review.schema.json'));

  assert.match(source, /readWorkspaceImageFile/);
  assert.match(source, /createVisualEvidenceArtifact/);
  assert.match(source, /review-artifacts/);
  assert.match(source, /browser_launched:\s*false/);
  assert.match(source, /provider_call_performed:\s*false/);
  assert.match(source, /raw_pixels_in_json:\s*false/);
  assert.match(source, /mcp_execution_exposed:\s*false/);
  assert.match(parser, /--image <path>|image/);
  assert.match(api, /runImageReview/);
  assert.equal(schemaFile.title, 'TraceCue Image Review');
  assert.doesNotMatch(artifacts, /'image-reviews'/);
  assert.doesNotMatch(source, /from 'node:http'|from 'node:child_process'|createServer|\.listen\(|fetch\(|playwright|process\.env/);
});

test('resource guard and artifact cleanup keep explicit local boundaries', async () => {
  const resourceGuard = await readText('src/resource-guard.js');
  const resourceArtifacts = await readText('src/resource-artifacts.js');

  assert.doesNotMatch(resourceGuard, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(resourceGuard, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(resourceGuard, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(resourceGuard, /launchPersistentContext|userDataDir|storageState/);
  assert.doesNotMatch(resourceGuard, /\bunlink\b|\brmdir\b|\bchmod\b|\bchown\b/);
  assert.match(resourceGuard, /system_cache_mutated:\s*false/);
  assert.match(resourceGuard, /swap_mutated:\s*false/);
  assert.match(resourceGuard, /cache_deleted:\s*false/);

  assert.doesNotMatch(resourceArtifacts, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(resourceArtifacts, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(resourceArtifacts, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(resourceArtifacts, /launchPersistentContext|userDataDir|storageState/);
  assert.doesNotMatch(resourceArtifacts, /curl|wget|token|password/i);
  assert.match(resourceArtifacts, /external_upload:\s*false/);
  assert.match(resourceArtifacts, /resolveArtifactRoot/);
  assert.match(resourceArtifacts, /requires_execute_flag:\s*true/);
  assert.match(resourceArtifacts, /candidate_lock_algorithm:\s*'sha256:path-size-mtime-content'/);
  assert.match(resourceArtifacts, /plan_hash_algorithm:\s*'sha256:policy-and-candidate-locks'/);
  assert.match(resourceArtifacts, /validateCandidateLock/);
  assert.match(resourceArtifacts, /realpath_confined/);
  assert.match(resourceArtifacts, /deletion_scope:\s*cacheDeleted \? 'artifact_root_only' : 'none'/);
  assert.match(resourceArtifacts, /directories_deleted:\s*false/);
  assert.match(resourceArtifacts, /privileged_helper_used:\s*false/);
  assert.match(resourceArtifacts, /shell_used:\s*false/);
});

test('agent advisory layer keeps local handoff and import boundaries', async () => {
  const agent = await readText('src/agent.js');
  const agentExecution = await readText('src/agent-execution.js');
  const mcp = `${await readText('src/mcp.js')}\n${await readText('src/mcp-profiles.js')}`;
  const combinedAgent = `${agent}\n${agentExecution}`;

  assert.doesNotMatch(combinedAgent, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(combinedAgent, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(combinedAgent, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(combinedAgent, /\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(combinedAgent, /launchPersistentContext|userDataDir|storageState/);
  assert.match(combinedAgent, /api_call_performed:\s*false/);
  assert.match(combinedAgent, /automatic_upload:\s*false/);
  assert.match(combinedAgent, /credential_storage:\s*false/);
  assert.match(combinedAgent, /existing_review_mutated:\s*false/);
  assert.match(combinedAgent, /raw_artifact_content_included:\s*false/);
  assert.match(combinedAgent, /external_evidence_transfer:\s*false/);
  assert.match(agentExecution, /mcp_execution_exposed:\s*false/);
  assert.match(mcp, /browser_debug_agent_requests_list/);
  assert.match(mcp, /browser_debug_agent_workflow_status/);
  assert.doesNotMatch(
    mcp,
    /browser_debug_agent_package|browser_debug_agent_ingest|browser_debug_agent_report|browser_debug_agent_workflow_create|browser_debug_agent_workflow_report/
  );
  assert.match(mcp, /browser_debug_agent_execution_plan/);
  assert.match(mcp, /browser_debug_agent_execution_run/);
  assert.match(mcp, /minimumProfile:\s*'admin'/);
});

test('agent execution provider calls stay in the dedicated adapter boundary', async () => {
  const agent = await readText('src/agent.js');
  const agentExecution = await readText('src/agent-execution.js');
  const providers = await readText('src/agent-execution-providers.js');
  const mcp = `${await readText('src/mcp.js')}\n${await readText('src/mcp-profiles.js')}`;

  assert.doesNotMatch(`${agent}\n${agentExecution}`, /\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.match(providers, /\bfetchImpl\b/);
  assert.doesNotMatch(providers, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(providers, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(providers, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(providers, /launchPersistentContext|userDataDir|storageState/);
  assert.match(providers, /environment_variable_only/);
  assert.match(providers, /raw_provider_response_stored:\s*false/);
  assert.match(providers, /credential_values_recorded:\s*false/);
  assert.match(providers, /free_form_shell_input_accepted:\s*false/);
  assert.match(mcp, /browser_debug_agent_execution_status/);
  assert.match(mcp, /browser_debug_agent_execution_plan/);
  assert.match(mcp, /browser_debug_agent_execution_run/);
  assert.doesNotMatch(mcp, /provider_execute/);
});

test('capture handoff stays workspace-confined and MCP-execution-free', async () => {
  const handoff = await readText('src/capture-handoff.js');
  const profiles = await readText('src/mcp-profiles.js');

  assert.match(handoff, /workspace_confined_input:\s*true/);
  assert.match(handoff, /symlink_escape_allowed:\s*false/);
  assert.match(handoff, /artifact_created:\s*false/);
  assert.match(handoff, /writes_artifacts:\s*false/);
  assert.match(handoff, /capture_performed:\s*false/);
  assert.match(handoff, /raw_pixels_in_json:\s*false/);
  assert.match(handoff, /mcp_permissions_changed:\s*false/);
  assert.match(handoff, /mcp_execution_exposed:\s*false/);
  assert.match(handoff, /os_capture_api_used:\s*false/);
  assert.match(handoff, /window_enumeration_performed:\s*false/);
  assert.doesNotMatch(handoff, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(handoff, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(handoff, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(handoff, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(profiles, /browser_debug_capture_handoff|browser_debug_capture_run|screen_capture_execute|window_capture_execute/);
});

test('desktop review provider-preparation planning stays read-only and MCP-free', async () => {
  const plan = await readText('src/desktop-review-provider-preparation-plan.js');
  const profiles = await readText('src/mcp-profiles.js');

  assert.match(plan, /read_only:\s*true/);
  assert.match(plan, /capture_handoff_json_read:\s*true/);
  assert.match(plan, /image_bytes_read:\s*false/);
  assert.match(plan, /raw_pixels_in_json:\s*false/);
  assert.match(plan, /artifact_created:\s*false/);
  assert.match(plan, /writes_artifacts:\s*false/);
  assert.match(plan, /provider_call_performed:\s*false/);
  assert.match(plan, /provider_execution_authorized:\s*false/);
  assert.match(plan, /external_evidence_transfer:\s*false/);
  assert.match(plan, /mcp_execution_exposed:\s*false/);
  assert.match(plan, /mcp_write_execute_exposed:\s*false/);
  assert.match(plan, /existing_review_mutated:\s*false/);
  assert.doesNotMatch(plan, /readWorkspaceImageFile|imageMetadata|writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(plan, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(plan, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(plan, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(plan, /process\.env/);
  assert.doesNotMatch(profiles, /browser_debug_visual_review_plan|browser_debug_desktop_review_provider_preparation/);
});

test('capture plan stays read-only and does not capture pixels', async () => {
  const capturePlan = await readText('src/capture-plan.js');
  const captureReadiness = await readText('src/capture-readiness.js');
  const mcpProfiles = await readText('src/mcp-profiles.js');
  const combinedCapturePlanning = `${capturePlan}\n${captureReadiness}`;

  assert.match(combinedCapturePlanning, /read_only:\s*true/);
  assert.match(capturePlan, /planning_only:\s*true/);
  assert.match(captureReadiness, /readiness_only:\s*true/);
  assert.match(combinedCapturePlanning, /capture_performed:\s*false/);
  assert.match(combinedCapturePlanning, /raw_pixels_read:\s*false/);
  assert.match(combinedCapturePlanning, /raw_pixels_written:\s*false/);
  assert.match(combinedCapturePlanning, /raw_pixels_in_json:\s*false/);
  assert.match(combinedCapturePlanning, /writes_artifacts:\s*false/);
  assert.match(combinedCapturePlanning, /provider_call_performed:\s*false/);
  assert.match(combinedCapturePlanning, /mcp_execution_exposed:\s*false/);
  assert.match(combinedCapturePlanning, /os_capture_api_used:\s*false/);
  assert.match(combinedCapturePlanning, /native_capture_dependency_loaded:\s*false/);
  assert.match(combinedCapturePlanning, /window_enumeration_performed:\s*false/);
  assert.match(combinedCapturePlanning, /process_enumeration_performed:\s*false/);
  assert.match(captureReadiness, /static_platform_probe_only:\s*true/);
  assert.match(captureReadiness, /implemented_writer_enabled:\s*false/);
  assert.doesNotMatch(combinedCapturePlanning, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(combinedCapturePlanning, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(combinedCapturePlanning, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(combinedCapturePlanning, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.match(mcpProfiles, /browser_debug_capture_readiness/);
  assert.match(mcpProfiles, /browser_debug_capture_plan/);
  assert.doesNotMatch(mcpProfiles, /browser_debug_capture_run|screen_capture_execute|window_capture_execute/);
});

test('MCP execution gates stay read-only and non-executing', async () => {
  const gates = await readText('src/mcp-execution-gates.js');
  const registry = await readText('src/operation-registry.js');
  const roadmap = await readText('src/operation-roadmap.js');
  const contracts = await readText('src/operation-contracts.js');
  const policy = await readText('src/operation-policy.js');
  const adminReadiness = await readText('src/operation-admin-readiness.js');
  const providerReadiness = await readText('src/operation-provider-readiness.js');
  const profiles = await readText('src/mcp-profiles.js');

  assert.match(gates, /read_only:\s*true/);
  assert.match(gates, /writes_artifacts:\s*false/);
  assert.match(gates, /provider_call_performed:\s*false/);
  assert.match(gates, /mcp_permissions_changed:\s*false/);
  assert.match(gates, /mcp_write_execute_exposed:\s*false/);
  assert.doesNotMatch(gates, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(registry, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(roadmap, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(contracts, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(policy, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(adminReadiness, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(providerReadiness, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(gates, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(registry, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(roadmap, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(contracts, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(policy, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(adminReadiness, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(providerReadiness, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(gates, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(registry, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(roadmap, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(contracts, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(policy, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(adminReadiness, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(providerReadiness, /node:child_process|from 'child_process'|require\(['"]child_process|execFile|spawn\(/);
  assert.doesNotMatch(gates, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(registry, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(roadmap, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(contracts, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(policy, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(adminReadiness, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(providerReadiness, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.match(registry, /npm_publish_performed:\s*false/);
  assert.match(registry, /artifact_root_migration_performed:\s*false/);
  assert.match(registry, /legacy_alias_removed:\s*false/);
  assert.match(registry, /translation_execution_performed:\s*false/);
  assert.match(registry, /mcp_write_execute_exposed:\s*false/);
  assert.match(roadmap, /roadmap_report_only:\s*true/);
  assert.match(roadmap, /draft_roadmap_promoted_to_product_plan:\s*false/);
  assert.match(roadmap, /live_execution_performed:\s*false/);
  assert.match(roadmap, /execution_tokens_issued:\s*false/);
  assert.match(roadmap, /mcp_write_execute_exposed:\s*false/);
  assert.match(contracts, /contracts_report_only:\s*true/);
  assert.match(contracts, /token_issuance_enabled:\s*false/);
  assert.match(contracts, /receipt_writer_enabled:\s*false/);
  assert.match(contracts, /execution_harness_enabled:\s*false/);
  assert.match(contracts, /live_execution_performed:\s*false/);
  assert.match(contracts, /mcp_write_execute_exposed:\s*false/);
  assert.match(policy, /policy_report_only:\s*true/);
  assert.match(policy, /admin_policy_config_written:\s*false/);
  assert.match(policy, /execution_harness_enabled:\s*false/);
  assert.match(policy, /mcp_admin_execution_enabled:\s*adminExecutionEnabled/);
  assert.match(policy, /mcp_write_execute_exposed:\s*adminExecutionEnabled/);
  assert.match(adminReadiness, /admin_readiness_report_only:\s*true/);
  assert.match(adminReadiness, /mcp_admin_token_flow_enabled:\s*false/);
  assert.match(adminReadiness, /execution_tokens_issued:\s*false/);
  assert.match(adminReadiness, /mcp_admin_harness_enabled:\s*false/);
  assert.match(adminReadiness, /mcp_write_execute_exposed:\s*adminExecutionEnabled/);
  assert.match(providerReadiness, /provider_readiness_report_only:\s*true/);
  assert.match(providerReadiness, /provider_mcp_status_list_available:\s*true/);
  assert.match(providerReadiness, /provider_mcp_status_list_read_only:\s*true/);
  assert.match(providerReadiness, /admin_mcp_provider_execution_enabled:\s*true/);
  assert.match(providerReadiness, /safe_mcp_provider_execution_enabled:\s*false/);
  assert.match(providerReadiness, /provider_call_performed:\s*false/);
  assert.match(providerReadiness, /credential_values_read:\s*false/);
  assert.match(providerReadiness, /mcp_write_execute_exposed:\s*true/);
  assert.match(profiles, /PROVIDER_STATUS_LIST_READ/);
  assert.match(profiles, /AGENT_EXECUTION_STATUS_READ/);
  assert.match(profiles, /AGENT_EXECUTION_LIST_READ/);
  assert.match(profiles, /browser_debug_mcp_execution_gates/);
  assert.match(profiles, /browser_debug_operation_registry/);
  assert.match(profiles, /browser_debug_operation_roadmap/);
  assert.match(profiles, /browser_debug_operation_contracts/);
  assert.match(profiles, /browser_debug_operation_policy/);
  assert.match(profiles, /browser_debug_operation_admin_readiness/);
  assert.match(profiles, /browser_debug_operation_provider_readiness/);
  assert.match(profiles, /browser_debug_agent_execution_plan/);
  assert.match(profiles, /browser_debug_agent_execution_run/);
  assert.doesNotMatch(profiles, /browser_debug_visual_review_run|cleanup_execute/);
});

test('visual review dashboard stays read-only and safe-profile compatible', async () => {
  const dashboard = await readText('src/visual-review-dashboard.js');
  const mcpProfiles = await readText('src/mcp-profiles.js');

  assert.match(dashboard, /read_only:\s*true/);
  assert.match(dashboard, /writes_artifacts:\s*false/);
  assert.match(dashboard, /provider_call_performed:\s*false/);
  assert.match(dashboard, /api_call_performed:\s*false/);
  assert.match(dashboard, /raw_pixels_read:\s*false/);
  assert.match(dashboard, /mcp_write_execute_exposed:\s*false/);
  assert.match(dashboard, /gate_effect:\s*'none'/);
  assert.doesNotMatch(dashboard, /writeFile|writeJsonArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(dashboard, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(dashboard, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(dashboard, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.match(mcpProfiles, /browser_debug_visual_review_dashboard/);
});

test('language settings stay local read-only and provider-free', async () => {
  const settings = await readText('src/language-settings.js');
  const localization = await readText('src/localization-resources.js');
  const localePolicy = await readText('src/locale-policy.js');
  const api = await readText('src/api.js');
  const cli = await readText('src/cli.js');
  const parser = await readText('src/parser.js');
  const mcpProfiles = await readText('src/mcp-profiles.js');
  const schemaFile = JSON.parse(await readText('schemas/language-settings.schema.json'));
  const combined = `${settings}\n${localization}`;

  assert.equal(schemaFile.title, 'TraceCue Language Settings');
  assert.match(api, /runLanguageSettings/);
  assert.match(api, /runLocalizationResources/);
  assert.match(api, /runTranslationReadiness/);
  assert.match(cli, /settings language/);
  assert.match(cli, /settings locale resources/);
  assert.match(cli, /translation readiness/);
  assert.match(parser, /settings language policy/);
  assert.match(mcpProfiles, /browser_debug_language_settings/);
  assert.match(mcpProfiles, /browser_debug_localization_resources/);
  assert.match(mcpProfiles, /browser_debug_translation_readiness/);
  assert.match(combined, /read_only:\s*true/);
  assert.match(settings, /settings_write_enabled:\s*false/);
  assert.match(combined, /translation_execution_enabled:\s*false/);
  assert.match(combined, /provider_dispatch_enabled:\s*false/);
  assert.match(combined, /external_sending_enabled:\s*false/);
  assert.match(combined, /mcp_write_execute_exposed:\s*false/);
  assert.match(combined, /raw_evidence_translated:\s*false/);
  assert.match(combined, /raw_evidence_sent_to_provider:\s*false/);
  assert.match(combined, /canonical_enums_translated:\s*false/);
  assert.match(combined, /provider_call_performed:\s*false/);
  assert.match(combined, /gate_effect:\s*'none'/);
  assert.match(localePolicy, /TRACE_CUE_LOCALE_CODES/);
  assert.doesNotMatch(combined, /writeFile|writeJsonArtifact|writeTextArtifact|ensureArtifactRoot|\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(combined, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(combined, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(combined, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(combined, /process\.env/);
  assert.doesNotMatch(localePolicy, /writeFile|readFile|fetch|playwright|child_process|createServer|process\.env/);
});

test('multi-agent visual review aggregation stays read-only provider-free and MCP-free', async () => {
  const aggregation = await readText('src/visual-review-aggregation.js');
  const profiles = await readText('src/mcp-profiles.js');
  const capabilities = await readText('src/mcp-capabilities.js');
  const registry = await readText('src/operation-registry.js');

  assert.match(aggregation, /read_only:\s*true/);
  assert.match(aggregation, /writes_artifacts:\s*false/);
  assert.match(aggregation, /provider_call_performed:\s*false/);
  assert.match(aggregation, /raw_pixels_read:\s*false/);
  assert.match(aggregation, /mcp_execution_exposed:\s*false/);
  assert.doesNotMatch(aggregation, /\bfetch\s*\(|XMLHttpRequest|curl|wget/);
  assert.doesNotMatch(aggregation, /process\.env/);
  assert.doesNotMatch(aggregation, /writeFile|writeJsonArtifact|ensureArtifactRoot/);
  assert.doesNotMatch(aggregation, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(aggregation, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(aggregation, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(profiles, /browser_debug_visual_review_aggregate/);
  assert.match(capabilities, /visual_review_aggregation/);
  assert.match(registry, /visual_review_aggregation/);
});

test('visual review execution keeps provider boundaries isolated from MCP and raw pixels', async () => {
  const execution = await readText('src/visual-review-execution.js');
  const mcp = `${await readText('src/mcp.js')}\n${await readText('src/mcp-profiles.js')}`;
  const capabilities = await readText('src/mcp-capabilities.js');

  assert.match(execution, /raw_pixels_included:\s*false/);
  assert.match(execution, /raw_pixels_transferred:\s*false/);
  assert.match(execution, /raw_provider_response_stored:\s*false/);
  assert.match(execution, /mcp_execution_exposed:\s*false/);
  assert.match(execution, /existing_review_mutated:\s*false/);
  assert.match(execution, /credential_values_recorded:\s*false/);
  assert.doesNotMatch(execution, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(execution, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(execution, /from 'node:http'|createServer|\.listen\(|WebSocket|EventSource/);
  assert.match(execution, /\bfetchImpl\b/);
  assert.doesNotMatch(mcp, /visual_review_run|browser_debug_visual_review_run|visual_review_execute|browser_debug_visual_review_execute/);
  assert.match(capabilities, /visual_review_run/);
});

test('visual review result preparation stays local metadata-only and provider-free', async () => {
  const preparation = await readText('src/visual-review-result-preparation.js');
  const mcp = `${await readText('src/mcp.js')}\n${await readText('src/mcp-profiles.js')}`;
  const capabilities = await readText('src/mcp-capabilities.js');

  assert.match(preparation, /provider_call_performed:\s*false/);
  assert.match(preparation, /raw_pixels_included:\s*false/);
  assert.match(preparation, /external_evidence_transfer:\s*false/);
  assert.match(preparation, /mcp_execution_exposed:\s*false/);
  assert.match(preparation, /existing_review_mutated:\s*false/);
  assert.doesNotMatch(preparation, /from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(preparation, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(preparation, /\bfetch\s*\(|XMLHttpRequest|curl|wget|from 'node:http'|createServer|\.listen\(/);
  assert.doesNotMatch(preparation, /process\.env/);
  assert.doesNotMatch(mcp, /visual_review_prepare|browser_debug_visual_review_prepare/);
  assert.match(capabilities, /visual_review_result_preparation/);
});

test('visual review provider policy stays pure planning metadata', async () => {
  const policy = await readText('src/visual-review-provider-policy.js');
  const agentExecution = await readText('src/agent-execution.js');
  const providers = await readText('src/agent-execution-providers.js');
  const mcp = `${await readText('src/mcp.js')}\n${await readText('src/mcp-profiles.js')}`;

  assert.match(policy, /planning_only:\s*true/);
  assert.match(policy, /raw_pixels_included:\s*false/);
  assert.match(policy, /provider_execution_authorized:\s*false/);
  assert.match(policy, /mcp_execution_exposed:\s*false/);
  assert.doesNotMatch(policy, /\bfetch\s*\(|XMLHttpRequest|curl|wget|from 'node:http'|createServer|\.listen\(/);
  assert.doesNotMatch(policy, /node:child_process|child_process|execFile|spawn\(|from 'playwright'|import\('playwright'\)/);
  assert.doesNotMatch(policy, /readFile|writeFile|process\.env|provider_execute|agent_execution_run/);
  assert.match(agentExecution, /visual_review_provider_policy/);
  assert.match(providers, /\bfetchImpl\b/);
  assert.doesNotMatch(mcp, /visual_provider_execute|provider_execute/);
});

test('packaged target templates stay domain-neutral', async () => {
  const templateFiles = [
    'templates/review-target-manifest.json',
    'templates/status-dashboard-content-ux-target-manifest.json'
  ];
  const forbidden = [
    /\bControl Center\b/i,
    /\bFrameCue\b/i,
    /\bai-driven-development-lesson\b/i,
    /\btask-tracker-repository\b/i,
    /\bworktree\b/i,
    /\bbranch\b/i,
    /\bblocker\b/i
  ];

  for (const file of templateFiles) {
    const content = await readText(file);
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${file} should not contain ${pattern}`);
    }
  }
});

test('plugin metadata keeps local stdio MCP boundaries', async () => {
  const plugin = JSON.parse(await readText('.codex-plugin/plugin.json'));
  const mcp = JSON.parse(await readText('.mcp.json'));
  const skill = await readText(PRODUCT_IDENTITY.pluginSkillPath);
  const consumerUsage = await readText('docs/workflow/CONSUMER_USAGE.md');
  const mcpServer = mcp.mcpServers[PRODUCT_IDENTITY.mcpServerName];
  const legacyMcpServer = mcp.mcpServers[PRODUCT_IDENTITY.legacyMcpServerNames[0]];

  assert.equal(plugin.name, PRODUCT_IDENTITY.pluginName);
  assert.equal(plugin.repository, PRODUCT_IDENTITY.repositoryUrl);
  assert.equal(plugin.license, 'UNLICENSED');
  assert.equal(plugin.mcpServers, './.mcp.json');
  assert.equal(plugin.skills, './skills/');
  assert.equal(mcpServer.command, 'node');
  assert.deepEqual(mcpServer.args, [PRODUCT_IDENTITY.mcpBinPath]);
  assert.equal(legacyMcpServer.command, 'node');
  assert.deepEqual(legacyMcpServer.args, [PRODUCT_IDENTITY.legacyMcpBins[0].path]);
  assert.doesNotMatch(JSON.stringify(mcp), /http|https|WebSocket|listen|curl|wget|token|password/i);
  assert.match(skill, /trace-cue review --target/);
  assert.match(skill, /upload artifacts|external upload/i);
  assert.match(consumerUsage, /mcp config --profile safe --json/);
  assert.match(consumerUsage, /mcp capabilities --profile admin --scope excluded --json/);
  assert.match(consumerUsage, /Target Runtime Readiness/);
  assert.match(consumerUsage, /frontend-only dev server/);
  assert.match(consumerUsage, /needs_attention/);
  assert.match(consumerUsage, /API base/);
  assert.doesNotMatch(consumerUsage, /FrameCue|ai-driven-development-lesson|\/home\/masahiro\/projects/);
});

test('HTTP MCP listener stays isolated to the approved transport module', async () => {
  const httpTransport = await readText('src/mcp-http-transport.js');
  const policy = await readText('src/mcp-transport-policy.js');
  const clientConfig = await readText('src/mcp-client-config.js');
  const capabilities = await readText('src/mcp-capabilities.js');
  const core = await readText('src/mcp.js');
  const profiles = await readText('src/mcp-profiles.js');
  const review = await readText('src/review.js');
  const resourceStatus = await readText('src/resource-status.js');
  const agent = await readText('src/agent.js');
  const agentExecution = await readText('src/agent-execution.js');

  assert.match(httpTransport, /from 'node:http'/);
  assert.match(httpTransport, /createServer/);
  assert.match(httpTransport, /\.listen\(/);
  assert.match(httpTransport, /handleMcpRequest/);
  assert.match(policy, /MCP_HTTP_DEFAULT_PROFILE = 'safe'/);
  assert.match(policy, /HTTP MCP transport is limited to the safe profile/);
  assert.match(policy, /HTTP_MCP_TOKEN_REQUIRED/);
  assert.match(policy, /HTTP_MCP_HOST_REJECTED/);

  for (const content of [policy, clientConfig, capabilities, core, profiles, review, resourceStatus, agent, agentExecution]) {
    assert.doesNotMatch(content, /from 'node:http'|createServer|\.listen\(/);
  }
  assert.doesNotMatch(httpTransport, /WebSocket|EventSource|node:child_process|execFile|spawn\(|provider_execute|cleanup_execute|agent_execution_run/);
  assert.doesNotMatch(core, /from '\.\/mcp-http-transport\.js'/);
});

test('product identity keeps rename-sensitive surfaces aligned', async () => {
  const pkg = JSON.parse(await readText('package.json'));
  const plugin = JSON.parse(await readText('.codex-plugin/plugin.json'));
  const mcp = JSON.parse(await readText('.mcp.json'));
  const profile = JSON.parse(await readText('ops/PRODUCT_PROFILE.json'));
  const mcpSource = await readText('src/mcp.js');
  const cliSource = await readText('src/cli.js');

  assert.equal(pkg.name, PRODUCT_IDENTITY.packageName);
  assert.equal(pkg.version, PRODUCT_IDENTITY.packageVersion);
  assert.equal(profile.display_name.en, PRODUCT_IDENTITY.displayName);
  assert.equal(profile.display_name.ja, PRODUCT_IDENTITY.displayName);
  assert.equal(plugin.name, PRODUCT_IDENTITY.pluginName);
  assert.equal(plugin.interface.displayName, PRODUCT_IDENTITY.displayName);
  assert.ok(Object.hasOwn(mcp.mcpServers, PRODUCT_IDENTITY.mcpServerName));
  assert.equal(Object.hasOwn(mcp.mcpServers, PRODUCT_IDENTITY.legacyMcpServerNames[0]), true);
  assert.equal(profile.display_name.en, PRODUCT_IDENTITY.displayName);
  assert.match(mcpSource, /PRODUCT_IDENTITY\.mcpServerName/);
  assert.match(cliSource, /PRODUCT_IDENTITY\.mcpBinName/);
});

test('identity audit keeps rename readiness read-only and configurable', async () => {
  const identityAudit = await readText('src/identity-audit.js');
  const api = await readText('src/api.js');
  const parser = await readText('src/parser.js');
  const constants = await readText('src/constants.js');
  const cli = await readText('src/cli.js');
  const renameCheck = await readText('tools/check_rename_readiness.mjs');

  assert.match(identityAudit, /buildIdentityAudit/);
  assert.match(identityAudit, /identityReadinessStatus/);
  assert.match(identityAudit, /normalizeRepositoryUrl/);
  assert.match(identityAudit, /physical_rename_complete_remote_rename_pending/);
  assert.match(api, /runIdentityAudit/);
  assert.match(parser, /identity audit/);
  assert.match(cli, /identity audit/);
  assert.match(renameCheck, /PRODUCT_IDENTITY/);
  assert.doesNotMatch(identityAudit, /node:child_process|child_process|execFile|spawn\(/);
  assert.doesNotMatch(identityAudit, /\bfetch\s*\(|XMLHttpRequest|curl|wget|from 'node:http'|createServer|\.listen\(/);
  assert.doesNotMatch(identityAudit, /\bwriteFile\b|\bunlink\b|\brmdir\b|\bchmod\b|\bchown\b/);
  assert.doesNotMatch(identityAudit, /process\.env/);
  assert.match(identityAudit, /git_mutated:\s*false/);
  assert.match(identityAudit, /remote_contact:\s*false/);
  assert.match(identityAudit, /legacy_alias_removal_authorized:\s*false/);
  assert.match(identityAudit, /artifact_root_migration_authorized:\s*false/);
});

test('release, artifact-root, and legacy alias readiness stay non-live and compatibility-preserving', async () => {
  const releaseReadiness = await readText('src/release-readiness.js');
  const artifactPolicy = await readText('src/artifact-root-policy.js');
  const artifactMigration = await readText('src/artifact-root-migration.js');
  const legacyAlias = await readText('src/legacy-alias-audit.js');
  const productIdentity = await readText('src/product-identity.js');
  const parser = await readText('src/parser.js');
  const cli = await readText('src/cli.js');
  const profiles = await readText('src/mcp-profiles.js');
  const capabilities = await readText('src/mcp-capabilities.js');
  const operationRegistry = await readText('src/operation-registry.js');
  const packDryRun = await readText('tools/pack-dry-run.mjs');
  const pkg = JSON.parse(await readText('package.json'));

  assert.match(releaseReadiness, /npm_publish_performed:\s*false/);
  assert.match(releaseReadiness, /npm_publish_dry_run_performed:\s*false/);
  assert.match(releaseReadiness, /npm_registry_contacted:\s*false/);
  assert.match(releaseReadiness, /product_docs_promoted:\s*false/);
  assert.doesNotMatch(releaseReadiness, /npm publish|npm whoami|npm token|npm view|fetch\s*\(|from 'node:http'|createServer|\.listen\(/);
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.ok(pkg.files.includes('ops/ARTIFACT_ROOT_POLICY.json'));
  assert.match(packDryRun, /--ignore-scripts/);

  assert.match(artifactPolicy, /PRODUCT_IDENTITY\.defaultArtifactRoot/);
  assert.match(artifactPolicy, /PRODUCT_IDENTITY\.futureArtifactRoot/);
  assert.match(artifactPolicy, /dual_write_active:\s*false/);
  assert.match(artifactPolicy, /real_workspace_migration_executed:\s*false/);
  assert.doesNotMatch(artifactPolicy, /node:child_process|child_process|execFile|spawn\(|fetch\s*\(|from 'node:http'|createServer|\.listen\(|copyFile|writeFile\(/);

  assert.match(artifactMigration, /fixture_only:\s*true/);
  assert.match(artifactMigration, /real_workspace_migration_executed:\s*false/);
  assert.match(artifactMigration, /legacy_files_deleted:\s*false/);
  assert.match(artifactMigration, /copyFile/);
  assert.match(artifactMigration, /writeFile/);
  assert.doesNotMatch(artifactMigration, /\bunlink\b|\brm\(|\brmdir\b|\brename\b|node:child_process|child_process|execFile|spawn\(|fetch\s*\(|from 'node:http'|createServer|\.listen\(/);

  assert.match(productIdentity, /LEGACY_ALIAS_POLICY/);
  assert.match(productIdentity, /removal_authorized:\s*false/);
  assert.match(legacyAlias, /legacyAliasWarningsForInvocation/);
  assert.match(legacyAlias, /legacy_alias_removed:\s*false/);
  assert.doesNotMatch(legacyAlias, /\bwriteFile\b|\bunlink\b|\brmdir\b|\bchmod\b|\bchown\b|node:child_process|child_process|execFile|spawn\(|fetch\s*\(|from 'node:http'|createServer|\.listen\(/);

  assert.match(parser, /release readiness/);
  assert.match(parser, /artifact-root migration execute/);
  assert.match(parser, /identity aliases/);
  assert.match(cli, /runReleaseReadiness/);
  assert.match(cli, /runArtifactRootStatus/);
  assert.match(cli, /runLegacyAliasAudit/);
  assert.match(profiles, /browser_debug_release_readiness/);
  assert.match(profiles, /browser_debug_artifact_root_status/);
  assert.match(profiles, /browser_debug_legacy_alias_audit/);
  assert.match(capabilities, /npm_publication:\s*false/);
  assert.match(capabilities, /artifact_root_migration:\s*false/);
  assert.match(capabilities, /legacy_alias_removal:\s*false/);
  assert.match(operationRegistry, /release_readiness/);
  assert.match(operationRegistry, /artifact_root_status/);
  assert.match(operationRegistry, /legacy_alias_audit/);
  assert.match(operationRegistry, /fixture_only_cli_gate/);
});

test('alias removal, constrained shell, and final hardening readiness stay non-executing', async () => {
  const aliasRemoval = await readText('src/legacy-alias-removal-readiness.js');
  const shellReadiness = await readText('src/constrained-shell-readiness.js');
  const finalReadiness = await readText('src/final-hardening-readiness.js');
  const parser = await readText('src/parser.js');
  const constants = await readText('src/constants.js');
  const cli = await readText('src/cli.js');
  const profiles = await readText('src/mcp-profiles.js');
  const capabilities = await readText('src/mcp-capabilities.js');
  const operationRegistry = await readText('src/operation-registry.js');
  const roadmap = await readText('src/operation-roadmap.js');
  const api = await readText('src/api.js');

  assert.match(aliasRemoval, /removal_authorized:\s*false/);
  assert.match(aliasRemoval, /legacy_alias_removed:\s*false/);
  assert.match(aliasRemoval, /package_bins_removed:\s*false/);
  assert.match(aliasRemoval, /product_docs_promoted:\s*false/);
  assert.doesNotMatch(aliasRemoval, /\bwriteFile\b|\bunlink\b|\brmdir\b|\bchmod\b|\bchown\b|node:child_process|child_process|execFile|spawn\(|fetch\s*\(|from 'node:http'|createServer|\.listen\(/);

  assert.match(shellReadiness, /command_executed:\s*false/);
  assert.match(shellReadiness, /shell_used:\s*false/);
  assert.match(shellReadiness, /child_process_used:\s*false/);
  assert.match(shellReadiness, /mcp_write_execute_exposed:\s*false/);
  assert.doesNotMatch(shellReadiness, /node:child_process|from 'child_process'|require\(['"]child_process|spawn\(|execFile|exec\(|fork\(|process\.env|\breadFile\b|\bwriteFile\b|fetch\s*\(|from 'node:http'|createServer|\.listen\(|playwright|writeJsonArtifact|ensureArtifactRoot/);

  assert.match(finalReadiness, /browser_smoke_executed:\s*false/);
  assert.match(finalReadiness, /remote_ci_triggered:\s*false/);
  assert.match(finalReadiness, /npm_publish_performed:\s*false/);
  assert.match(finalReadiness, /shell_used:\s*false/);
  assert.match(finalReadiness, /executed_by_report:\s*false/);
  assert.doesNotMatch(finalReadiness, /node:child_process|child_process|execFile|spawn\(|fetch\s*\(|from 'node:http'|createServer|\.listen\(|from 'playwright'|import\('playwright'\)|\bwriteFile\b|\bunlink\b|\brmdir\b/);

  assert.match(parser, /identity aliases removal-readiness/);
  assert.match(parser, /parseShell/);
  assert.match(parser, /parseFinal/);
  assert.match(constants, /shell readiness/);
  assert.match(constants, /final readiness/);
  assert.match(cli, /runLegacyAliasRemovalReadiness/);
  assert.match(cli, /runConstrainedShellReadiness/);
  assert.match(cli, /runFinalHardeningReadiness/);
  assert.match(api, /buildLegacyAliasRemovalReadiness/);
  assert.match(api, /buildConstrainedShellReadiness/);
  assert.match(api, /buildFinalHardeningReadiness/);
  assert.match(profiles, /browser_debug_legacy_alias_removal_readiness/);
  assert.match(profiles, /browser_debug_shell_readiness/);
  assert.match(profiles, /browser_debug_final_readiness/);
  assert.doesNotMatch(profiles, /browser_debug_shell_(?:run|execute|command)/);
  assert.match(capabilities, /legacy_alias_removal_readiness/);
  assert.match(capabilities, /shell_readiness/);
  assert.match(capabilities, /final_readiness/);
  assert.match(capabilities, /constrained_shell_execution:\s*false/);
  assert.match(operationRegistry, /legacy_alias_removal_readiness/);
  assert.match(operationRegistry, /constrained_shell_readiness/);
  assert.match(operationRegistry, /final_hardening_readiness/);
  assert.match(operationRegistry, /fail_closed_cli_gate/);
  assert.match(roadmap, /Legacy Alias Removal Boundary/);
});

test('CI workflow stays generic and release-safe', async () => {
  const workflow = await readText('.github/workflows/ci.yml');
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run test:rename-readiness/);
  assert.match(workflow, /run: npm run test:pack/);
  assert.match(workflow, /run: npm run test:pack-install/);
  assert.match(workflow, /run: npm run test:browser/);
  assert.doesNotMatch(workflow, /npm publish|gh repo|secrets\.|curl |wget /i);
});

test('background daemon uses local process boundaries only', async () => {
  const daemon = await readText('src/daemon.js');
  const worker = await readText('src/daemon-worker.js');
  const combined = `${daemon}\n${worker}`;

  assert.doesNotMatch(combined, /createServer|listen\(|WebSocket|EventSource/);
  assert.doesNotMatch(combined, /userDataDir|launchPersistentContext|storageState/);
  assert.match(combined, /existing_profile_reused:\s*false/);
  assert.match(combined, /persistent_storage:\s*false/);
  assert.match(combined, /local_process_signal/);
  assert.match(combined, /idle_timeout_ms/);
  assert.match(combined, /max_lifetime_ms/);
});

function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}
