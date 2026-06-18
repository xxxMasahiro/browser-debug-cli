import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('runtime and tests avoid caller-specific implementation literals', async () => {
  const files = [
    'src/cli.js',
    'src/constants.js',
    'src/content-ux-advisory.js',
    'src/daemon.js',
    'src/daemon-worker.js',
    'src/observe.js',
    'src/page-evidence.js',
    'src/parser.js',
    'src/review.js',
    'src/mcp.js',
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
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.equal(pkg.engines.node, '>=20');
  assert.equal(pkg.bin['browser-debug'], './bin/browser-debug.js');
  assert.equal(pkg.bin['browser-debug-mcp'], './bin/browser-debug-mcp.js');
  assert.equal(pkg.exports['.'], './src/api.js');
  assert.equal(pkg.exports['./schemas/*'], './schemas/*.schema.json');
  assert.ok(pkg.files.includes('.codex-plugin/'));
  assert.ok(pkg.files.includes('.mcp.json'));
  assert.ok(pkg.files.includes('templates/'));
  assert.ok(pkg.files.includes('skills/browser-debug-review/SKILL.md'));
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts['test:browser']);
  assert.ok(pkg.scripts['test:pack']);
  assert.ok(pkg.scripts['release:check']);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.scripts.prepublishOnly, undefined);
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /\b(?:gh|curl|wget|publish)\b/);
});

test('review platform keeps local-first and manifest-driven boundaries', async () => {
  const review = await readText('src/review.js');
  const contentUxAdvisory = await readText('src/content-ux-advisory.js');
  const mcp = await readText('src/mcp.js');
  const target = await readText('src/target.js');
  const combined = `${review}\n${contentUxAdvisory}\n${mcp}\n${target}`;

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

  assert.equal(plugin.name, 'browser-debug-cli');
  assert.equal(plugin.license, 'UNLICENSED');
  assert.equal(plugin.mcpServers, './.mcp.json');
  assert.equal(plugin.skills, './skills/');
  assert.equal(mcp.mcpServers['browser-debug-cli'].command, 'node');
  assert.deepEqual(mcp.mcpServers['browser-debug-cli'].args, ['./bin/browser-debug-mcp.js']);
  assert.doesNotMatch(JSON.stringify(mcp), /http|https|WebSocket|listen|curl|wget|token|password/i);
  assert.match(skill, /browser-debug review --target/);
  assert.match(skill, /upload artifacts|external upload/i);
});

test('CI workflow stays generic and release-safe', async () => {
  const workflow = await readText('.github/workflows/ci.yml');
  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/setup-node@v5/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run test:pack/);
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
});

function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}
