import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  PRODUCT_IDENTITY,
  packageInstallDirectory,
  packageSchemaSpecifier,
  packageTarballFilename
} from '../src/product-identity.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

await main();

async function main() {
  const tarballPath = process.argv[2];
  assert.ok(tarballPath, 'Usage: node tests/pack-install-smoke.test.js <packed-tarball>');
  assert.equal(path.basename(tarballPath), packageTarballFilename());
  await access(tarballPath, fsConstants.R_OK);

  const layout = await createPackedInstallLayout(tarballPath);
  try {
    const { installRoot, packageDir, binDir } = layout;

    await assertFile(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath));
    await assertFile(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath));
    await assertFile(packageDir, 'src/api.js');
    await assertFile(packageDir, 'src/mcp-capabilities.js');
    await assertFile(packageDir, 'src/mcp-client-config.js');
    await assertFile(packageDir, 'src/mcp-http-transport.js');
    await assertFile(packageDir, 'src/mcp-transport-policy.js');
    await assertFile(packageDir, 'src/product-identity.js');
    await assertFile(packageDir, 'src/mcp-profiles.js');
    await assertFile(packageDir, 'schemas/agent-execution.schema.json');
    await assertFile(packageDir, 'schemas/review.schema.json');
    await assertFile(packageDir, 'templates/review-target-manifest.json');
    await assertFile(packageDir, 'templates/status-dashboard-content-ux-target-manifest.json');
    await assertFile(packageDir, '.codex-plugin/plugin.json');
    await assertFile(packageDir, '.mcp.json');
    await assertFile(packageDir, PRODUCT_IDENTITY.pluginSkillPath);
    await assertFile(packageDir, 'docs/workflow/CONSUMER_USAGE.md');
    await assertFile(packageDir, 'docs/workflow/IDENTITY_MIGRATION.md');
    await assertFile(packageDir, 'docs/workflow/SECURITY.md');
    await assert.rejects(access(path.join(packageDir, 'docs/product/IMPLEMENTATION_PLAN.md')));

    const packageJson = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
    assert.equal(packageJson.name, PRODUCT_IDENTITY.packageName);
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.license, 'UNLICENSED');
    assert.equal(packageJson.bin[PRODUCT_IDENTITY.cliBinName], PRODUCT_IDENTITY.cliBinPath);
    assert.equal(packageJson.bin[PRODUCT_IDENTITY.mcpBinName], PRODUCT_IDENTITY.mcpBinPath);

    const browserDebugBin = await readFile(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath)), 'utf8');
    const browserDebugMcpBin = await readFile(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath)), 'utf8');
    assert.match(browserDebugBin, /from '\.\.\/src\/cli\.js'/);
    assert.match(browserDebugMcpBin, /from '\.\.\/src\/mcp\.js'/);
    assert.match(browserDebugMcpBin, /from '\.\.\/src\/mcp-http-transport\.js'/);
    assert.equal(((await stat(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath)))).mode & 0o111) !== 0, true);
    assert.equal(((await stat(path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath)))).mode & 0o111) !== 0, true);

    const requireFromInstall = createRequire(path.join(installRoot, 'package.json'));
    const apiPath = requireFromInstall.resolve(PRODUCT_IDENTITY.packageName);
    const reviewSchemaPath = requireFromInstall.resolve(packageSchemaSpecifier('review'));
    assert.equal(path.normalize(apiPath), path.join(packageDir, 'src/api.js'));
    assert.equal(path.normalize(reviewSchemaPath), path.join(packageDir, 'schemas/review.schema.json'));

    const api = await import(pathToFileURL(apiPath));
    assert.equal(typeof api.executeCli, 'function');
    assert.equal(typeof api.runTargetValidate, 'function');
    assert.equal(api.PRODUCT_IDENTITY.packageName, PRODUCT_IDENTITY.packageName);
    assert.equal(api.PRODUCT_IDENTITY.cliBinName, PRODUCT_IDENTITY.cliBinName);
    assert.equal(typeof api.packageTarballFilename, 'function');
    assert.equal(typeof api.getMcpTools, 'function');
    assert.equal(typeof api.resolveMcpProfile, 'function');
    assert.equal(typeof api.startMcpHttpServer, 'function');
    assert.equal(typeof api.buildMcpCapabilityReport, 'function');
    assert.equal(api.MCP_CAPABILITY_POLICY_VERSION, '1.0.0');
    assert.equal(typeof api.buildMcpClientConfig, 'function');
    assert.equal(typeof api.resolveMcpTransportConfig, 'function');
    assert.equal(api.schemaNames().includes('agent_execution'), true);
    assert.equal(api.MCP_TOOLS.some((tool) => tool.name === 'browser_debug_review_target'), true);
    assert.equal(api.DEFAULT_MCP_PROFILE, 'full');
    assert.equal(api.MCP_HTTP_DEFAULT_PROFILE, 'safe');
    assert.equal(api.MCP_HTTP_DEFAULT_CLIENT_PORT, 8765);
    assert.equal(api.resolveMcpTransportConfig({ transport: 'http', profile: 'full' }, {}, { requireToken: false }).ok, false);
    const httpClientConfig = api.buildMcpClientConfig({ transport: 'http' });
    assert.equal(httpClientConfig.ok, true);
    assert.equal(httpClientConfig.config.client_connection.url, 'http://127.0.0.1:8765/mcp');
    const mcpHttpTokenEnv = 'BROWSER_DEBUG_MCP_HTTP_TOKEN';
    assert.equal(httpClientConfig.config.launch.env[mcpHttpTokenEnv], '<set-16-or-more-character-token>');
    assert.equal(JSON.stringify(httpClientConfig).includes('secret'), false);
    assert.equal(api.resolveMcpProfile('safe').ok, true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
    assert.equal(api.getMcpTools('safe').some((tool) => tool.name === 'browser_debug_review'), false);
    assert.equal(api.getMcpTools('full').some((tool) => tool.name === 'browser_debug_review'), true);
    const capabilityReport = api.buildMcpCapabilityReport({ profile: 'admin', scope: 'excluded' });
    assert.equal(capabilityReport.ok, true);
    assert.equal(capabilityReport.report.admin_policy.write_execute_tools_exposed, false);
    assert.equal(capabilityReport.report.excluded_operations.some((operation) => operation.id === 'agent_execution_run'), true);
    assert.equal(capabilityReport.report.excluded_operations.every((operation) => operation.mcp_admin === false), true);

    const initialized = await api.handleMcpRequest(
      { jsonrpc: '2.0', id: 0, method: 'initialize' },
      { cwd: installRoot }
    );
    assert.equal(initialized.result.serverInfo.name, PRODUCT_IDENTITY.mcpServerName);
    assert.equal(initialized.result.metadata.name, 'full');
    assert.equal(initialized.result.metadata.identity.package_name, PRODUCT_IDENTITY.packageName);
    assert.equal(initialized.result.metadata.identity.package_version, PRODUCT_IDENTITY.packageVersion);
    assert.equal(initialized.result.metadata.identity.cli_bin_name, PRODUCT_IDENTITY.cliBinName);

    const httpToken = 'pack-smoke-token';
    const resolvedHttp = api.resolveMcpTransportConfig(
      { transport: 'http', port: 8765 },
      { [mcpHttpTokenEnv]: httpToken }
    );
    assert.equal(resolvedHttp.ok, true);
    const httpServer = api.createMcpHttpServer(resolvedHttp.config, {
      cwd: installRoot,
      env: { [mcpHttpTokenEnv]: httpToken }
    });
    const initializedHttp = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      url: '/mcp',
      headers: {
        host: '127.0.0.1:8765',
        'content-type': 'application/json',
        authorization: `Bearer ${httpToken}`,
        origin: 'http://127.0.0.1'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'initialize' })
    });
    assert.equal(initializedHttp.status, 200);
    assert.equal(initializedHttp.headers['MCP-Protocol-Version'], '2025-06-18');
    const initializedHttpBody = JSON.parse(initializedHttp.text);
    assert.equal(initializedHttpBody.result.serverInfo.name, PRODUCT_IDENTITY.mcpServerName);
    assert.equal(initializedHttpBody.result.metadata.profile.name, 'safe');
    assert.equal(initializedHttpBody.result.metadata.identity.cli_bin_name, PRODUCT_IDENTITY.cliBinName);

    const doctor = await api.executeCli(['doctor', '--json'], { cwd: installRoot });
    assert.equal(doctor.exitCode, 0);
    const doctorBody = JSON.parse(doctor.stdout);
    assert.equal(doctorBody.command, 'doctor');
    assert.equal(doctorBody.status, 'ok');
    assert.equal(doctorBody.data.checks.find((check) => check.id === 'artifact_root.ignored').status, 'pass');
    assert.equal(doctorBody.data.checks.find((check) => check.id === 'playwright.package').status, 'pass');

    const schemaList = await api.executeCli(['schema', 'list', '--json'], { cwd: installRoot });
    assert.equal(schemaList.exitCode, 0);
    const schemaBody = JSON.parse(schemaList.stdout);
    const schemaNames = schemaBody.data.schemas.map((schema) => schema.name);
    assert.ok(schemaNames.includes('review'));
    assert.ok(schemaNames.includes('target_manifest'));
    assert.ok(schemaNames.includes('agent_execution'));

    const targetPath = path.join(installRoot, 'target.json');
    await writeFile(targetPath, JSON.stringify(targetManifestFixture(), null, 2), 'utf8');
    const validate = await api.executeCli(
      ['target', 'validate', '--target', 'target.json', '--json'],
      { cwd: installRoot }
    );
    assert.equal(validate.exitCode, 0);
    const validateBody = JSON.parse(validate.stdout);
    assert.equal(validateBody.command, 'target validate');
    assert.equal(validateBody.status, 'ok');
    assert.equal(validateBody.data.boundary.browser_launched, false);
    assert.equal(validateBody.data.boundary.external_upload, false);

    const mcpBody = await api.handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { cwd: installRoot });
    assert.equal(mcpBody.result.profile.name, 'full');
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_requests_list'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_workflow_status'), true);
    assert.equal(mcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_status'), true);
    assert.equal(mcpBody.result.tools.some((tool) => /agent_execution_run|cleanup_execute|provider_execute/i.test(tool.name)), false);

    const safeMcpBody = await api.handleMcpRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { cwd: installRoot, mcpProfile: 'safe' }
    );
    assert.equal(safeMcpBody.result.profile.name, 'safe');
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_requests_show'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_agent_execution_list'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_mcp_capabilities'), true);
    assert.equal(safeMcpBody.result.tools.some((tool) => tool.name === 'browser_debug_review_target'), false);

    const capabilityCli = await api.executeCli(
      ['mcp', 'capabilities', '--profile', 'admin', '--scope', 'excluded', '--json'],
      { cwd: installRoot }
    );
    assert.equal(capabilityCli.exitCode, 0);
    const capabilityCliBody = JSON.parse(capabilityCli.stdout);
    assert.equal(capabilityCliBody.data.capabilities.admin_policy.agent_execution_run_exposed, false);
    assert.equal(capabilityCliBody.data.capabilities.excluded_operations.some((operation) => operation.id === 'resource_artifacts_cleanup_execute'), true);

    const capabilityTool = await api.handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'browser_debug_mcp_capabilities',
        arguments: { profile: 'admin', scope: 'excluded' }
      }
    }, { cwd: installRoot, mcpProfile: 'safe' });
    assert.equal(capabilityTool.result.structuredContent.command, 'mcp capabilities');
    assert.equal(capabilityTool.result.structuredContent.data.capabilities.admin_policy.write_execute_tools_exposed, false);

    const binLink = await lstat(path.join(binDir, PRODUCT_IDENTITY.cliBinName));
    assert.equal(binLink.isSymbolicLink(), true);
    console.log('Packed install smoke passed.');
  } finally {
    if (process.env[PRODUCT_IDENTITY.packSmokeKeepEnv] !== '1') {
      await rm(layout.tempRoot, { recursive: true, force: true });
    }
  }
}

async function createPackedInstallLayout(tarballPath) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), `${PRODUCT_IDENTITY.packageName}-pack-install-`));
  const installRoot = path.join(tempRoot, 'install');
  const nodeModules = path.join(installRoot, 'node_modules');
  const packageDir = packageInstallDirectory(nodeModules);
  const binDir = path.join(nodeModules, '.bin');

  await mkdir(packageDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(path.join(installRoot, 'package.json'), '{"type":"module"}\n', 'utf8');
  await writeFile(path.join(installRoot, '.gitignore'), '.browser-debug/\n', 'utf8');
  await extractPackageTarball(tarballPath, packageDir);
  await linkDependency(nodeModules, 'playwright');
  await linkDependency(nodeModules, 'playwright-core');
  await linkBin(binDir, PRODUCT_IDENTITY.cliBinName, path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.cliBinPath)));
  await linkBin(binDir, PRODUCT_IDENTITY.mcpBinName, path.join(packageDir, normalizePackagePath(PRODUCT_IDENTITY.mcpBinPath)));

  return { tempRoot, installRoot, packageDir, binDir };
}

function dispatchHttpRequest(server, { method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const request = new PassThrough();
    request.method = method;
    request.url = url;
    request.headers = headers;
    const response = {
      status: 200,
      headers: {},
      writeHead(status, responseHeaders) {
        this.status = status;
        this.headers = { ...responseHeaders };
      },
      end(chunk = '') {
        resolve({
          status: this.status,
          headers: this.headers,
          text: String(chunk)
        });
      }
    };
    server.once('error', reject);
    server.emit('request', request, response);
    request.end(body);
  });
}

async function extractPackageTarball(tarballPath, outputDir) {
  const archive = gunzipSync(await readFile(tarballPath));
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const fullName = [prefix, name].filter(Boolean).join('/');
    const type = readTarString(header, 156, 1) || '0';
    const size = Number.parseInt(readTarString(header, 124, 12).trim() || '0', 8);
    const mode = Number.parseInt(readTarString(header, 100, 8).trim() || '644', 8);
    const relative = fullName.replace(/^package\/?/, '');
    offset += 512;
    if (relative && isSafeRelativePath(relative)) {
      const target = path.join(outputDir, relative);
      if (type === '5') {
        await mkdir(target, { recursive: true });
      } else if (type === '0' || type === '') {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, archive.subarray(offset, offset + size));
        await chmod(target, mode);
      }
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

function readTarString(buffer, start, length) {
  return buffer
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/u, '')
    .trim();
}

function isSafeRelativePath(relativePath) {
  return relativePath
    && !path.isAbsolute(relativePath)
    && !relativePath.split('/').some((part) => part === '..' || part === '');
}

function normalizePackagePath(packagePath) {
  return packagePath.replace(/^\.\//u, '');
}

async function linkDependency(nodeModules, name) {
  const source = path.join(repoRoot, 'node_modules', name);
  await access(source, fsConstants.R_OK);
  await symlink(source, path.join(nodeModules, name), 'dir');
}

async function linkBin(binDir, name, target) {
  await chmod(target, 0o755);
  await symlink(path.relative(binDir, target), path.join(binDir, name), 'file');
}

async function assertFile(root, relativePath) {
  await access(path.join(root, relativePath), fsConstants.R_OK);
}

function targetManifestFixture() {
  return {
    schema_version: '0.1.0',
    name: 'Packed install fixture',
    baseUrl: 'https://example.test/',
    scope: {
      sameOrigin: true,
      allowedHosts: ['example.test']
    },
    seeds: ['/'],
    expectedRoutes: ['/'],
    viewportMatrix: [
      { name: 'desktop', width: 1280, height: 720 }
    ],
    actionPolicy: {
      click: 'navigation_only',
      forms: 'skip',
      destructive: 'skip',
      external: 'skip'
    },
    budgets: {
      maxRoutes: 1,
      maxActionsPerRoute: 0
    },
    artifacts: {
      screenshot: false,
      trace: false,
      report: false
    },
    masks: [],
    regions: [],
    pages: [],
    localContentUxAdvisory: {
      enabled: false
    }
  };
}
