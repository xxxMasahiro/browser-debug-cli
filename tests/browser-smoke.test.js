import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { executeCli } from '../src/cli.js';

const runBrowserSmoke = process.env.BROWSER_DEBUG_BROWSER_SMOKE === '1';

test('observe captures a local file page with Playwright', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'fixture.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Observation Smoke</title></head>',
    '<body>',
    '<h1>Smoke Page</h1>',
    '<button id="primary" onclick="document.getElementById(\'result\').textContent = \'Clicked\'">Primary Action</button>',
    '<p id="result">Waiting</p>',
    '<a href="https://example.test/?token=secret-value">External Link</a>',
    '<script>console.warn("token=abc123456789")</script>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const result = await executeCli([
    'observe',
    '--url',
    `file://${fixture}`,
    '--screenshot',
    '--trace',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'observe');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.title, 'Observation Smoke');
  assert.match(body.data.page.visible_text, /Smoke Page/);
  assert.equal(body.data.browser.ephemeral_context, true);
  assert.ok(body.data.page.action_candidates.some((candidate) => candidate.selector === '#primary'));

  const observation = body.artifacts.find((artifact) => artifact.type === 'observation');
  const screenshot = body.artifacts.find((artifact) => artifact.type === 'screenshot');
  const trace = body.artifacts.find((artifact) => artifact.type === 'trace');
  assert.ok(observation);
  assert.ok(screenshot);
  assert.ok(trace);
  await access(path.join(cwd, observation.path));
  await access(path.join(cwd, screenshot.path));
  await access(path.join(cwd, trace.path));
  assert.equal(body.warnings[0].code, 'TRACE_CONTAINS_PAGE_CONTENT');

  const observationJson = await readFile(path.join(cwd, observation.path), 'utf8');
  assert.doesNotMatch(observationJson, /secret-value/);
  assert.match(observationJson, /\[REDACTED\]/);
});

test('session action can click and observe the changed page', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-session-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'fixture.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Session Smoke</title></head>',
    '<body>',
    '<h1>Session Smoke Page</h1>',
    '<button id="primary" onclick="document.getElementById(\'result\').textContent = \'Clicked\'">Primary Action</button>',
    '<p id="result">Waiting</p>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const started = await executeCli([
    'session',
    'start',
    '--url',
    `file://${fixture}`,
    '--json'
  ], { cwd });
  assert.equal(started.exitCode, 0);
  const sessionId = JSON.parse(started.stdout).data.session.id;

  const acted = await executeCli([
    'act',
    '--session',
    sessionId,
    '--action',
    '{"type":"click","selector":"#primary"}',
    '--json'
  ], { cwd });
  assert.equal(acted.exitCode, 0);
  const body = JSON.parse(acted.stdout);
  assert.equal(body.data.action_result.type, 'click');
  assert.match(body.data.session.current_url, /^file:/);
  assert.match(body.data.session.action_history[0].action.selector, /#primary/);
  assert.match(body.data.action_result.final_url, /^file:/);
  const observation = body.artifacts.find((artifact) => artifact.type === 'observation');
  assert.ok(observation);
  const observed = JSON.parse(await readFile(path.join(cwd, observation.path), 'utf8'));
  assert.match(observed.page.visible_text, /Clicked/);
});

test('session actions cover form controls and exported evidence', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-actions-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'fixture.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Action Smoke</title></head>',
    '<body style="min-height: 2200px">',
    '<h1>Action Smoke Page</h1>',
    '<label>Name <input id="name" oninput="document.getElementById(\'name-result\').textContent = `Filled ${this.value}`"></label>',
    '<p id="name-result">Name pending</p>',
    '<label>Mode <select id="mode" onchange="document.getElementById(\'mode-result\').textContent = `Mode ${this.value}`"><option value="alpha">Alpha</option><option value="beta">Beta</option></select></label>',
    '<p id="mode-result">Mode pending</p>',
    '<label>Shortcut <input id="shortcut" onkeydown="document.getElementById(\'key-result\').textContent = `Key ${event.key}`"></label>',
    '<p id="key-result">Key pending</p>',
    '<p id="scroll-result">Scroll pending</p>',
    '<script>window.addEventListener("scroll", () => { document.getElementById("scroll-result").textContent = `Scrolled ${window.scrollY > 0}`; });</script>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const started = await executeCli([
    'session',
    'start',
    '--url',
    `file://${fixture}`,
    '--json'
  ], { cwd });
  assert.equal(started.exitCode, 0);
  const sessionId = JSON.parse(started.stdout).data.session.id;

  const filled = await runAction(cwd, sessionId, { type: 'fill', selector: '#name', value: 'Example User' });
  assert.match(await observationText(cwd, filled), /Filled Example User/);

  const selected = await runAction(cwd, sessionId, { type: 'select', selector: '#mode', value: 'beta' });
  assert.match(await observationText(cwd, selected), /Mode beta/);

  const pressed = await runAction(cwd, sessionId, { type: 'press', selector: '#shortcut', key: 'Enter' });
  assert.match(await observationText(cwd, pressed), /Key Enter/);

  const scrolled = await runAction(cwd, sessionId, { type: 'scroll', deltaY: 900 });
  assert.match(await observationText(cwd, scrolled), /Scrolled true/);

  const waited = await runAction(cwd, sessionId, { type: 'wait', ms: 25 });
  assert.equal(JSON.parse(waited.stdout).data.action_result.type, 'wait');

  const screenshot = await runAction(cwd, sessionId, { type: 'screenshot' });
  const screenshotBody = JSON.parse(screenshot.stdout);
  const screenshotArtifact = screenshotBody.artifacts.find((artifact) => artifact.type === 'screenshot');
  assert.ok(screenshotArtifact);
  await access(path.join(cwd, screenshotArtifact.path));

  const reported = await executeCli(['report', '--session', sessionId, '--json'], { cwd });
  assert.equal(reported.exitCode, 0);
  const reportArtifact = JSON.parse(reported.stdout).artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(reportArtifact);
  const report = await readFile(path.join(cwd, reportArtifact.path), 'utf8');
  assert.match(report, /"type":"fill"/);
  assert.match(report, /"type":"screenshot"/);

  const exported = await executeCli(['spec', 'export', '--session', sessionId, '--json'], { cwd });
  assert.equal(exported.exitCode, 0);
  const specBody = JSON.parse(exported.stdout);
  assert.deepEqual(
    specBody.data.spec.steps.map((step) => step.action.type),
    ['fill', 'select', 'press', 'scroll', 'wait', 'screenshot']
  );
  const specArtifact = specBody.artifacts.find((artifact) => artifact.type === 'spec');
  assert.ok(specArtifact);
  await access(path.join(cwd, specArtifact.path));
});

test('supervise keeps one ephemeral context for ordered actions', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-supervise-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'fixture.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Supervision Smoke</title></head>',
    '<body>',
    '<h1>Supervise Smoke Page</h1>',
    '<label>Name <input id="name" oninput="document.getElementById(\'result\').textContent = `Name ${this.value}`"></label>',
    '<button id="primary" onclick="document.getElementById(\'clicked\').textContent = document.getElementById(\'name\').value">Apply</button>',
    '<p id="result">Name pending</p>',
    '<p id="clicked">Click pending</p>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const result = await executeCli([
    'supervise',
    '--url',
    `file://${fixture}`,
    '--actions',
    JSON.stringify([
      { type: 'fill', selector: '#name', value: 'Example User' },
      { type: 'click', selector: '#primary' },
      { type: 'observe' }
    ]),
    '--screenshot',
    '--trace',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'supervise');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.supervision.mode, 'supervised_ephemeral_context');
  assert.equal(body.data.supervision.browser.existing_profile_reused, false);
  assert.equal(body.data.supervision.action_history.length, 3);
  assert.match(body.data.final_observation.page.visible_text, /Name Example User/);
  assert.match(body.data.final_observation.page.visible_text, /Example User/);

  const observations = body.artifacts.filter((artifact) => artifact.type === 'observation');
  const screenshot = body.artifacts.find((artifact) => artifact.type === 'screenshot');
  const trace = body.artifacts.find((artifact) => artifact.type === 'trace');
  const supervision = body.artifacts.find((artifact) => artifact.type === 'supervision');
  assert.equal(observations.length, 4);
  assert.ok(screenshot);
  assert.ok(trace);
  assert.ok(supervision);
  await access(path.join(cwd, observations.at(-1).path));
  await access(path.join(cwd, screenshot.path));
  await access(path.join(cwd, trace.path));
  await access(path.join(cwd, supervision.path));
});

test('daemon start status and stop keep a local ephemeral browser process', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-daemon-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'fixture.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Daemon Smoke</title></head>',
    '<body>',
    '<h1>Daemon Smoke Page</h1>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  let daemonId = null;
  try {
    const started = await executeCli([
      'daemon',
      'start',
      '--url',
      `file://${fixture}`,
      '--timeout',
      '10000',
      '--json'
    ], { cwd });
    assert.equal(started.exitCode, 0);
    const startedBody = JSON.parse(started.stdout);
    daemonId = startedBody.data.daemon.id;
    assert.equal(startedBody.command, 'daemon start');
    assert.equal(startedBody.data.daemon.status, 'running');
    assert.equal(startedBody.data.daemon.browser.ephemeral_context, true);
    assert.equal(startedBody.data.daemon.browser.existing_profile_reused, false);
    assert.equal(startedBody.data.daemon.browser.persistent_storage, false);
    assert.equal(startedBody.data.daemon.control.external_channel, false);
    assert.match(startedBody.data.daemon.current_url, /^file:/);

    const daemonArtifact = startedBody.artifacts.find((artifact) => artifact.type === 'daemon');
    assert.ok(daemonArtifact);
    await access(path.join(cwd, daemonArtifact.path));

    const status = await executeCli(['daemon', 'status', '--daemon', daemonId, '--json'], { cwd });
    assert.equal(status.exitCode, 0);
    const statusBody = JSON.parse(status.stdout);
    assert.equal(statusBody.data.daemon.status, 'running');
    assert.equal(statusBody.data.daemon.process_status, 'alive');

    const stopped = await executeCli(['daemon', 'stop', '--daemon', daemonId, '--json'], { cwd });
    assert.equal(stopped.exitCode, 0);
    const stoppedBody = JSON.parse(stopped.stdout);
    assert.match(stoppedBody.data.daemon.status, /^(stopped|exited)$/);
    assert.equal(stoppedBody.data.daemon.process_status, 'not_alive');
  } finally {
    if (daemonId) {
      await executeCli(['daemon', 'stop', '--daemon', daemonId, '--json'], { cwd }).catch(() => {});
    }
  }
});

test('review reports deterministic layout and browser-health findings', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-review-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'review.html');
  const mock = path.join(cwd, 'mock.png');
  await writeFile(mock, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l9V2JwAAAABJRU5ErkJggg==', 'base64'));
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Review Smoke</title></head>',
    '<body>',
    '<h1>Review Smoke Page</h1>',
    '<div id="wide" style="width:2000px;height:20px;background:#ccc">Wide content</div>',
    '<div id="clip" style="width:20px;height:18px;overflow:hidden;white-space:nowrap">Clipped content should be detected</div>',
    '<button id="nameless" style="width:32px;height:32px"></button>',
    '<script>console.error("Review smoke console failure")</script>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const result = await executeCli([
    'review',
    '--url',
    `file://${fixture}`,
    '--viewport',
    '390x844',
    '--screenshot',
    '--mock',
    'mock.png',
    '--report',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.review.mode, 'single_url');
  assert.equal(body.data.action_plan.release_gate.status, 'blocked');
  assert.equal(body.data.review_advisory.status, 'needs_attention');
  assert.ok(body.data.findings.some((finding) => finding.category === 'browser_health'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'layout_integrity'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'accessibility_basics'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'mock_fidelity'));
  assert.ok(body.data.findings.every((finding) => finding.priority));
  assert.ok(body.data.findings.some((finding) => finding.recommendation));

  for (const type of ['review', 'layout', 'screenshot', 'report', 'mock_metrics']) {
    const artifact = body.artifacts.find((candidate) => candidate.type === type);
    assert.ok(artifact, `missing ${type} artifact`);
    await access(path.join(cwd, artifact.path));
  }
});

test('target review discovers same-origin routes and records coverage', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-review-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const first = path.join(cwd, 'first.html');
  const second = path.join(cwd, 'second.html');
  const manifest = path.join(cwd, 'target.json');
  await writeFile(first, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>First Review Route</title></head>',
    '<body>',
    '<h1>First Route</h1>',
    `<a id="next" href="file://${second}">Second Route</a>`,
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(second, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Second Review Route</title></head>',
    '<body>',
    '<h1>Second Route</h1>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(manifest, JSON.stringify({
    baseUrl: `file://${first}`,
    seeds: [`file://${first}`],
    viewportMatrix: ['mobile'],
    budgets: { maxRoutes: 2 },
    artifacts: { screenshots: true }
  }), 'utf8');

  const result = await executeCli([
    'review',
    '--target',
    '@target.json',
    '--report',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.review.mode, 'target_manifest');
  assert.ok(body.data.coverage.routes.discovered.length >= 2);
  assert.ok(body.data.coverage.routes.visited.length >= 2);
  const coverage = body.artifacts.find((artifact) => artifact.type === 'coverage');
  assert.ok(coverage);
  await access(path.join(cwd, coverage.path));
  assert.equal(body.data.action_plan.coverage.discovered_routes >= 2, true);
  assert.equal(body.data.review_advisory.reviewer, 'local_heuristic');
  const report = body.artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(report);
  await access(path.join(cwd, report.path));
});

async function runAction(cwd, sessionId, action) {
  const result = await executeCli([
    'act',
    '--session',
    sessionId,
    '--action',
    JSON.stringify(action),
    '--json'
  ], { cwd });
  assert.equal(result.exitCode, 0);
  return result;
}

async function observationText(cwd, result) {
  const body = JSON.parse(result.stdout);
  const observation = body.artifacts.find((artifact) => artifact.type === 'observation');
  assert.ok(observation);
  const observed = JSON.parse(await readFile(path.join(cwd, observation.path), 'utf8'));
  return observed.page.visible_text;
}
