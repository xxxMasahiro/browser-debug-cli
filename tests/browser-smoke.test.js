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
    '<img id="missing-alt" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="width:32px;height:32px">',
    '<p id="low-contrast" style="color:rgb(120,120,120);background:rgb(120,120,120)">Low contrast text</p>',
    '<div style="position:relative;width:160px;height:70px">',
    '<p id="overlap-a" style="position:absolute;left:0;top:0;width:90px;height:36px;background:#eee">Alpha panel</p>',
    '<p id="overlap-b" style="position:absolute;left:10px;top:6px;width:90px;height:36px;background:#ddd">Beta panel</p>',
    '</div>',
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
  assert.equal(body.data.quality_signals.reviewer, 'local_quality_signals');
  assert.equal(body.data.quality_signals.model_review_boundary.external_evidence_transfer, false);
  assert.equal(body.data.quality_signals.accessibility_structure.missing_image_alt_count >= 1, true);
  assert.equal(body.data.quality_signals.accessibility_structure.low_contrast_text_count >= 1, true);
  assert.equal(body.data.quality_signals.responsive_layout.overlap_pair_count >= 1, true);
  assert.ok(body.data.findings.some((finding) => finding.category === 'browser_health'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'layout_integrity'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'accessibility_basics'));
  assert.ok(body.data.findings.some((finding) => finding.category === 'mock_fidelity'));
  assert.ok(body.data.findings.some((finding) => /alt text/.test(finding.message)));
  assert.ok(body.data.findings.some((finding) => /contrast/.test(finding.message)));
  assert.ok(body.data.findings.some((finding) => /overlap/.test(finding.message)));
  assert.ok(body.data.findings.every((finding) => finding.priority));
  assert.ok(body.data.findings.some((finding) => finding.recommendation));

  for (const type of ['review', 'layout', 'screenshot', 'report', 'mock_metrics']) {
    const artifact = body.artifacts.find((candidate) => candidate.type === type);
    assert.ok(artifact, `missing ${type} artifact`);
    await access(path.join(cwd, artifact.path));
  }
  const report = body.artifacts.find((artifact) => artifact.type === 'report');
  const reportText = await readFile(path.join(cwd, report.path), 'utf8');
  assert.match(reportText, /Quality Signals/);
  assert.match(reportText, /Local release gate/);
});

test('review reports rendered-state evidence for media loading and empty data UI', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-rendered-state-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'rendered-state.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Rendered State Smoke</title></head>',
    '<body>',
    '<main>',
    '<h1>Rendered State</h1>',
    '<img id="broken-image" src="./missing-chart.png" alt="Revenue chart" style="width:80px;height:48px">',
    '<div id="loading-panel" aria-busy="true">Loading reports</div>',
    '<table id="orders"><thead><tr><th>Order</th></tr></thead><tbody></tbody></table>',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const result = await executeCli([
    'review',
    '--url',
    `file://${fixture}`,
    '--screenshot',
    '--report',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.quality_signals.rendered_state.status, 'needs_attention');
  assert.equal(body.data.quality_signals.rendered_state.broken_image_count >= 1, true);
  assert.equal(body.data.quality_signals.rendered_state.loading_indicator_count >= 1, true);
  assert.equal(body.data.quality_signals.rendered_state.empty_container_warning_count >= 1, true);
  assert.ok(body.data.findings.some((finding) => /appears broken or unfinished/.test(finding.message)));
  assert.ok(body.data.findings.some((finding) => /loading indicator/.test(finding.message)));
  assert.ok(body.data.findings.some((finding) => /empty without a visible empty-state/.test(finding.message)));
  assert.equal(body.data.evidence_summary.loading_indicators.length >= 1, true);
  assert.equal(body.data.evidence_summary.empty_containers.length >= 1, true);

  const report = body.artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(report);
  const reportText = await readFile(path.join(cwd, report.path), 'utf8');
  assert.match(reportText, /Developer Triage/);
  assert.match(reportText, /Rendered state: needs_attention/);
});

test('review does not treat ready and progress business text as lingering loading UI', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-ready-state-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const fixture = path.join(cwd, 'ready-state.html');
  await writeFile(fixture, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Ready State Smoke</title></head>',
    '<body>',
    '<div id="root">',
    '<main>',
    '<h1>Run Status</h1>',
    '<section aria-labelledby="run-title">',
    '<h2 id="run-title">Current Run</h2>',
    '<p>Status ready</p>',
    '<p>Progress 3 / 3</p>',
    '<p>adapter-ready</p>',
    '<div role="status" aria-label="Progress 3 / 3">Ready for review</div>',
    '<p>Review state is ready for developer handoff.</p>',
    '</section>',
    '</main>',
    '</div>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');

  const result = await executeCli([
    'review',
    '--url',
    `file://${fixture}`,
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.data.quality_signals.rendered_state.loading_indicator_count, 0);
  assert.equal(body.data.evidence_summary.loading_indicators.length, 0);
  assert.equal(body.data.findings.some((finding) => /loading indicator/.test(finding.message)), false);
});

test('target review discovers same-origin routes and records coverage', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-review-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const first = path.join(cwd, 'first.html');
  const second = path.join(cwd, 'second.html');
  const expected = path.join(cwd, 'expected.html');
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
  await writeFile(expected, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Expected Review Route</title></head>',
    '<body>',
    '<h1>Expected Route</h1>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(manifest, JSON.stringify({
    baseUrl: `file://${first}`,
    seeds: [`file://${first}`],
    expectedRoutes: [`file://${expected}`],
    viewportMatrix: ['mobile'],
    budgets: { maxRoutes: 3 },
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
  assert.ok(body.data.coverage.routes.discovered.length >= 3);
  assert.ok(body.data.coverage.routes.visited.length >= 3);
  assert.equal(body.data.coverage.routes.expected.length, 1);
  assert.ok(body.data.coverage.routes.visited.some((route) => route.url === `file://${expected}`));
  const coverage = body.artifacts.find((artifact) => artifact.type === 'coverage');
  assert.ok(coverage);
  await access(path.join(cwd, coverage.path));
  assert.equal(body.data.action_plan.coverage.discovered_routes >= 3, true);
  assert.equal(body.data.review_advisory.reviewer, 'local_heuristic');
  assert.equal(body.data.quality_signals.route_coverage.status, 'passed');
  assert.equal(body.data.quality_signals.route_coverage.expected_manifest_routes, 1);
  assert.equal(body.data.quality_signals.model_review_boundary.external_evidence_transfer, false);
  assert.ok(body.data.manifest_suggestions.some((suggestion) => suggestion.type === 'add_page_expectations'));
  const report = body.artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(report);
  await access(path.join(cwd, report.path));
  const reportText = await readFile(path.join(cwd, report.path), 'utf8');
  assert.match(reportText, /Quality Signals/);
  assert.match(reportText, /Manifest Suggestions/);
});

test('target review records route budget skips for unvisited discovered routes', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-budget-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const first = path.join(cwd, 'first.html');
  const expected = path.join(cwd, 'expected.html');
  const manifest = path.join(cwd, 'target.json');
  await writeFile(first, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Budget First Route</title></head>',
    '<body>',
    '<h1>Budget First Route</h1>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(expected, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Budget Expected Route</title></head>',
    '<body>',
    '<h1>Budget Expected Route</h1>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(manifest, JSON.stringify({
    baseUrl: `file://${first}`,
    seeds: [`file://${first}`],
    expectedRoutes: [`file://${expected}`],
    viewportMatrix: ['mobile'],
    budgets: { maxRoutes: 1 },
    artifacts: { screenshots: false }
  }), 'utf8');

  const result = await executeCli([
    'review',
    '--target',
    '@target.json',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.coverage.routes.expected.length, 1);
  assert.equal(body.data.coverage.routes.visited.length, 1);
  assert.ok(body.data.coverage.routes.skipped.some((route) => route.reason === 'route_budget_exceeded'));
  assert.equal(body.data.quality_signals.route_coverage.status, 'needs_attention');
  assert.equal(body.data.quality_signals.route_coverage.route_budget_exceeded_routes, 1);
});

test('target review checks manifest page expectations and writes an artifact index', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-page-expectation-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const page = path.join(cwd, 'state.html');
  const mock = path.join(cwd, 'mock.png');
  const manifest = path.join(cwd, 'target.json');
  await writeFile(mock, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l9V2JwAAAABJRU5ErkJggg==', 'base64'));
  await writeFile(page, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>State Route</title></head>',
    '<body>',
    '<main>',
    '<h1>Expected State</h1>',
    '<button id="primary">Primary Action</button>',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  await writeFile(manifest, JSON.stringify({
    baseUrl: `file://${page}`,
    seeds: [`file://${page}`],
    pages: [{
      name: 'Expected State Page',
      url: `file://${page}`,
      priority: 'high',
      viewports: ['mobile'],
      expectations: {
        text: ['Expected State'],
        selectors: ['#primary', '#secondary']
      },
      mock: 'mock.png',
      threshold: 0
    }],
    viewportMatrix: ['desktop'],
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
  assert.equal(body.data.coverage.pages.expected.length, 1);
  assert.equal(body.data.coverage.pages.checked.length, 1);
  assert.equal(body.data.coverage.pages.failed.length, 1);
  assert.equal(body.data.coverage.pages.checked[0].viewport.name, 'mobile');
  assert.equal(body.data.quality_signals.page_expectations.status, 'needs_attention');
  assert.equal(body.data.quality_signals.page_expectations.failed_pages, 1);
  assert.equal(body.data.quality_signals.page_expectations.missing_selector_expectations, 1);
  assert.equal(body.data.artifact_index.local_only, true);
  assert.equal(body.data.artifact_index.external_upload, false);
  assert.ok(body.data.findings.some((finding) => /Expected selector #secondary/.test(finding.message)));
  assert.ok(body.artifacts.some((artifact) => artifact.type === 'mock_metrics'));

  const indexes = body.artifacts.filter((artifact) => artifact.type === 'review_artifact_index');
  assert.ok(indexes.length >= 1);
  const targetIndex = indexes[indexes.length - 1];
  const indexJson = JSON.parse(await readFile(path.join(cwd, targetIndex.path), 'utf8'));
  assert.equal(indexJson.triage.page_expectations, 'needs_attention');
  assert.equal(indexJson.coverage_summary.expected_pages, 1);
  assert.equal(indexJson.boundaries.profile_reuse, false);
  assert.equal(indexJson.boundaries.credential_storage, false);
  assert.ok(indexJson.evidence_classes.includes('screenshot'));

  const report = body.artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(report);
  const reportText = await readFile(path.join(cwd, report.path), 'utf8');
  assert.match(reportText, /Page expectations/);
});

test('target content UX advisory is opt-in and does not alter review gates', { skip: !runBrowserSmoke }, async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-content-ux-smoke-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const page = path.join(cwd, 'overview.html');
  const disabledManifest = path.join(cwd, 'disabled.json');
  const enabledManifest = path.join(cwd, 'enabled.json');
  await writeFile(page, [
    '<!doctype html>',
    '<html lang="en">',
    '<head><title>Overview Route</title></head>',
    '<body>',
    '<main>',
    '<h1>Overview</h1>',
    '<p id="summary" data-state="ready">Operations summary ready</p>',
    '<p id="checks" data-status="passed">Checks passed</p>',
    '<p id="risk" data-risk="low">No blockers</p>',
    '<button id="primary">Open Details</button>',
    '</main>',
    '</body>',
    '</html>'
  ].join('\n'), 'utf8');
  const baseManifest = {
    baseUrl: `file://${page}`,
    seeds: [`file://${page}`],
    pages: [{
      name: 'Overview Page',
      url: `file://${page}`,
      expectations: {
        dataBindings: [{
          id: 'summary-copy',
          sourceId: 'workflow',
          pointer: '/status/summary',
          selector: '#summary',
          target: 'text'
        }, {
          id: 'summary-state',
          sourceId: 'workflow',
          pointer: '/status/state',
          selector: '#summary',
          target: 'data-state',
          match: 'exact'
        }, {
          id: 'check-status',
          sourceId: 'workflow',
          pointer: '/checks/status',
          selector: '#checks',
          target: 'attribute',
          attribute: 'data-status',
          match: 'exact'
        }, {
          id: 'risk-level',
          sourceId: 'workflow',
          pointer: '/risk/level',
          selector: '#risk',
          target: 'data-risk',
          match: 'exact'
        }],
        userQuestions: [{
          id: 'blocker-awareness',
          question: 'Can the user tell whether there are blockers?',
          expectedEvidence: ['No blockers'],
          selector: '#risk'
        }]
      }
    }],
    viewportMatrix: ['desktop'],
    budgets: { maxRoutes: 1 },
    artifacts: { screenshots: true }
  };
  await writeFile(disabledManifest, JSON.stringify(baseManifest), 'utf8');
  await writeFile(enabledManifest, JSON.stringify({
    ...baseManifest,
    sourceData: [{
      id: 'workflow',
      data: {
        status: { summary: 'Operations summary ready', state: 'ready' },
        checks: { status: 'passed' },
        risk: { level: 'low' }
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain the current workflow state at a glance.',
      requiredUserQuestions: [{
        id: 'summary-awareness',
        pageId: 'overview-page',
        question: 'Can the user understand the current summary?',
        expectedEvidence: ['Operations summary']
      }]
    }
  }), 'utf8');

  const disabled = await executeCli([
    'review',
    '--target',
    '@disabled.json',
    '--report',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });
  const enabled = await executeCli([
    'review',
    '--target',
    '@enabled.json',
    '--report',
    '--timeout',
    '10000',
    '--json'
  ], { cwd });

  assert.equal(disabled.exitCode, 0);
  assert.equal(enabled.exitCode, 0);
  const disabledBody = JSON.parse(disabled.stdout);
  const enabledBody = JSON.parse(enabled.stdout);
  assert.equal(disabledBody.data.local_content_ux_advisory, undefined);
  assert.equal(disabledBody.data.quality_signals.content_ux, undefined);
  assert.equal(enabledBody.data.local_content_ux_advisory.status, 'passed');
  assert.equal(enabledBody.data.quality_signals.content_ux.status, 'passed');
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.data_binding_checks, 4);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.selector_scoped_binding_checks, 4);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.attribute_binding_checks, 1);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.state_binding_checks, 1);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.risk_binding_checks, 1);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.required_user_questions, 2);
  assert.equal(enabledBody.data.local_content_ux_advisory.counts.user_questions_answered, 2);
  assert.equal(enabledBody.data.local_content_ux_advisory.gate_effect, 'none');
  assert.equal(enabledBody.data.local_content_ux_advisory.external_evidence_transfer, false);
  assert.equal(enabledBody.data.metrics.finding_count, disabledBody.data.metrics.finding_count);
  assert.deepEqual(
    enabledBody.data.findings.map((finding) => [finding.category, finding.severity, finding.message]),
    disabledBody.data.findings.map((finding) => [finding.category, finding.severity, finding.message])
  );
  assert.deepEqual(enabledBody.data.action_plan.release_gate, disabledBody.data.action_plan.release_gate);
  assert.deepEqual(enabledBody.data.quality_signals.release_readiness, disabledBody.data.quality_signals.release_readiness);

  const report = enabledBody.artifacts.find((artifact) => artifact.type === 'report');
  assert.ok(report);
  const reportText = await readFile(path.join(cwd, report.path), 'utf8');
  assert.match(reportText, /Content UX Advisory/);
  assert.doesNotMatch(reportText, /Operations summary ready/);
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
