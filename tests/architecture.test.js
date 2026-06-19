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
    'src/mcp-client-config.js',
    'src/mcp-http-transport.js',
    'src/mcp-profiles.js',
    'src/mcp-transport-policy.js',
    'src/api.js',
    'src/target.js',
    'src/sessions.js',
    'src/supervisor.js',
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
  assert.equal(pkg.exports['.'], './src/api.js');
  assert.equal(pkg.exports['./schemas/*'], './schemas/*.schema.json');
  assert.ok(pkg.files.includes('.codex-plugin/'));
  assert.ok(pkg.files.includes('.mcp.json'));
  assert.ok(pkg.files.includes('docs/workflow/CONSUMER_USAGE.md'));
  assert.ok(pkg.files.includes('docs/workflow/IDENTITY_MIGRATION.md'));
  assert.ok(pkg.files.includes('templates/'));
  assert.ok(pkg.files.includes(PRODUCT_IDENTITY.pluginSkillPath));
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts['test:browser']);
  assert.ok(pkg.scripts['test:pack']);
  assert.ok(pkg.scripts['test:pack-install']);
  assert.ok(pkg.scripts['release:check']);
  assert.match(pkg.scripts['release:check'], /npm run test:pack-install/);
  assert.match(pkg.scripts['test:pack'], /tools\/pack-dry-run\.mjs/);
  assert.doesNotMatch(pkg.scripts['test:pack'], /browser-debug-cli-npm-cache/);
  assert.match(pkg.scripts['test:pack-install'], /tools\/pack-install-smoke\.mjs/);
  assert.doesNotMatch(pkg.scripts['test:pack-install'], /browser-debug-cli-0\.0\.0\.tgz/);
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
  assert.match(resourceArtifacts, /deletion_scope:\s*cacheDeleted \? 'artifact_root_only' : 'none'/);
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
    /browser_debug_agent_package|browser_debug_agent_ingest|browser_debug_agent_report|browser_debug_agent_workflow_create|browser_debug_agent_workflow_report|browser_debug_agent_execution_plan|browser_debug_agent_execution_run/
  );
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
  assert.doesNotMatch(mcp, /browser_debug_agent_execution_plan|browser_debug_agent_execution_run|provider_execute/);
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
  const skill = await readText('skills/browser-debug-review/SKILL.md');
  const consumerUsage = await readText('docs/workflow/CONSUMER_USAGE.md');
  const mcpServer = mcp.mcpServers[PRODUCT_IDENTITY.mcpServerName];

  assert.equal(plugin.name, PRODUCT_IDENTITY.pluginName);
  assert.equal(plugin.repository, PRODUCT_IDENTITY.repositoryUrl);
  assert.equal(plugin.license, 'UNLICENSED');
  assert.equal(plugin.mcpServers, './.mcp.json');
  assert.equal(plugin.skills, './skills/');
  assert.equal(mcpServer.command, 'node');
  assert.deepEqual(mcpServer.args, [PRODUCT_IDENTITY.mcpBinPath]);
  assert.doesNotMatch(JSON.stringify(mcp), /http|https|WebSocket|listen|curl|wget|token|password/i);
  assert.match(skill, /browser-debug review --target/);
  assert.match(skill, /upload artifacts|external upload/i);
  assert.match(consumerUsage, /mcp config --profile safe --json/);
  assert.match(consumerUsage, /mcp capabilities --profile admin --scope excluded --json/);
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
  assert.match(mcpSource, /PRODUCT_IDENTITY\.mcpServerName/);
  assert.match(cliSource, /PRODUCT_IDENTITY\.mcpBinName/);
});

test('CI workflow stays generic and release-safe', async () => {
  const workflow = await readText('.github/workflows/ci.yml');
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
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
