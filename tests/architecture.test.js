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
    'src/observe.js',
    'src/page-evidence.js',
    'src/parser.js',
    'src/sessions.js',
    'src/supervisor.js',
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
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts['test:browser']);
  assert.ok(pkg.scripts['test:pack']);
  assert.ok(pkg.scripts['release:check']);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.scripts.prepublishOnly, undefined);
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /\b(?:gh|curl|wget|publish)\b/);
});

test('CI workflow stays generic and release-safe', async () => {
  const workflow = await readText('.github/workflows/ci.yml');
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run test:pack/);
  assert.match(workflow, /run: npm run test:browser/);
  assert.doesNotMatch(workflow, /npm publish|gh repo|secrets\.|curl |wget /i);
});

function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}
