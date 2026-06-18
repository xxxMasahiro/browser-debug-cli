import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { executeCli } from '../src/cli.js';
import { handleMcpRequest } from '../src/mcp.js';
import { runObserve } from '../src/observe.js';
import { parseCliArgs } from '../src/parser.js';
import { redact, redactUrl } from '../src/redaction.js';
import { classifyActionCandidate, normalizeTargetManifest } from '../src/review.js';
import { buildLocalContentUxAdvisory } from '../src/content-ux-advisory.js';
import { createTargetManifest } from '../src/target.js';

const fixedNow = '2026-06-17T00:00:00.000Z';

test('doctor returns the JSON envelope without launching a browser', async () => {
  const result = await executeCli(['doctor', '--json'], {
    cwd: process.cwd(),
    nodeVersion: '24.14.1',
    platform: 'linux',
    now: fixedNow,
    importPlaywright: async () => ({ available: false, reason: 'module not found' })
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.schema_version, '0.1.0');
  assert.equal(body.command, 'doctor');
  assert.equal(body.status, 'ok');
  assert.equal(body.observed_at, fixedNow);
  assert.equal(body.data.runtime.minimum_node_major, 20);
  assert.equal(body.data.schema_version_policy.current, '0.1.0');
  assert.equal(body.data.schema_version_policy.stage, 'mvp-pre-1.0');
  assert.equal(body.data.artifact_retention.mode, 'manual');
  assert.equal(body.data.artifact_retention.automatic_cleanup, false);
  assert.equal(body.artifacts.length, 0);
  assert.deepEqual(body.errors, []);
  assert.equal(body.warnings[0].code, 'PLAYWRIGHT_NOT_INSTALLED');
});

test('missing command produces a deterministic JSON error', async () => {
  const result = await executeCli(['--json'], { now: fixedNow });

  assert.equal(result.exitCode, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'unknown');
  assert.equal(body.status, 'error');
  assert.equal(body.observed_at, fixedNow);
  assert.equal(body.errors[0].code, 'MISSING_COMMAND');
  assert.deepEqual(body.warnings, []);
  assert.deepEqual(body.artifacts, []);
});

test('observe requires an absolute URL', async () => {
  const result = await executeCli(['observe', '--json'], { now: fixedNow });

  assert.equal(result.exitCode, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'observe');
  assert.equal(body.errors[0].code, 'MISSING_REQUIRED_OPTION');
  assert.equal(body.errors[0].details.option, 'url');
});

test('observe parses a URL and returns a deterministic JSON envelope', async () => {
  const result = await executeCli(
    ['observe', '--url', 'https://example.test/', '--trace', '--json'],
    {
      now: fixedNow,
      observeRunner: async (options) => ({
        status: 'ok',
        data: {
          id: 'observation-fixed',
          input_url: options.url,
          final_url: options.url,
          title: 'Fixture',
          page: { action_candidates: [] }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'observation', path: '.browser-debug/observations/observation-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'observe');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.id, 'observation-fixed');
  assert.equal(result.envelope.data.input_url, 'https://example.test/');
  assert.equal(body.artifacts[0].type, 'observation');
});

test('parser keeps the planned session command surface explicit', () => {
  const parsed = parseCliArgs(['session', 'close', '--session', 'abc123', '--json']);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'session close');
  assert.equal(parsed.json, true);
  assert.equal(parsed.options.session, 'abc123');
});

test('supervise parses actions and returns a deterministic JSON envelope', async () => {
  const result = await executeCli(
    ['supervise', '--url', 'https://example.test/', '--actions', '[{"type":"observe"}]', '--json'],
    {
      now: fixedNow,
      supervisorRunner: async (options) => ({
        status: 'ok',
        data: {
          supervision: {
            id: 'supervision-fixed',
            current_url: options.url,
            action_history: JSON.parse(options.actions)
          },
          final_observation: { title: 'Supervision Fixture' }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'supervision', path: '.browser-debug/sessions/supervision-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'supervise');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.supervision.id, 'supervision-fixed');
  assert.equal(body.data.supervision.action_history[0].type, 'observe');
});

test('review parses URL targets and returns a deterministic JSON envelope', async () => {
  const parsed = parseCliArgs(['review', '--url', 'https://example.test/', '--viewport', 'mobile', '--screenshot', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.url, 'https://example.test/');
  assert.equal(parsed.options.viewport, 'mobile');
  assert.equal(parsed.options.screenshot, true);

  const result = await executeCli(
    ['review', '--url', 'https://example.test/', '--json'],
    {
      now: fixedNow,
      reviewRunner: async (options) => ({
        status: 'ok',
        data: {
          review: { id: 'review-fixed', mode: 'single_url', final_url: options.url },
          findings: [],
          metrics: { finding_count: 0 },
          environment: {}
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'review', path: '.browser-debug/reviews/review-fixed.json' }]
      })
    }
  );

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'review');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.review.id, 'review-fixed');
});

test('schema commands expose machine-readable contracts', async () => {
  const listed = await executeCli(['schema', 'list', '--json'], { now: fixedNow });
  assert.equal(listed.exitCode, 0);
  const listedBody = JSON.parse(listed.stdout);
  assert.equal(listedBody.command, 'schema list');
  assert.ok(listedBody.data.schemas.some((schema) => schema.name === 'review'));

  const fetched = await executeCli(['schema', 'get', '--name', 'finding', '--json'], { now: fixedNow });
  assert.equal(fetched.exitCode, 0);
  const fetchedBody = JSON.parse(fetched.stdout);
  assert.equal(fetchedBody.command, 'schema get');
  assert.equal(fetchedBody.data.schema.title, 'Browser Debug CLI Review Finding');

  const reviewSchemaFile = JSON.parse(await readFile(new URL('../schemas/review.schema.json', import.meta.url), 'utf8'));
  const reviewSchema = await executeCli(['schema', 'get', '--name', 'review', '--json'], { now: fixedNow });
  const reviewSchemaBody = JSON.parse(reviewSchema.stdout);
  assert.deepEqual(
    Object.keys(reviewSchemaBody.data.schema.properties).sort(),
    Object.keys(reviewSchemaFile.properties).sort()
  );

  const targetManifestSchemaFile = JSON.parse(await readFile(new URL('../schemas/target-manifest.schema.json', import.meta.url), 'utf8'));
  const targetManifestSchema = await executeCli(['schema', 'get', '--name', 'target_manifest', '--json'], { now: fixedNow });
  const targetManifestSchemaBody = JSON.parse(targetManifestSchema.stdout);
  assert.deepEqual(
    Object.keys(targetManifestSchemaBody.data.schema.properties).sort(),
    Object.keys(targetManifestSchemaFile.properties).sort()
  );
});

test('target manifests and action candidates use generic review abstractions', () => {
  const template = createTargetManifest({
    url: 'https://example.test/app',
    name: 'Example App',
    'max-routes': '12'
  });
  assert.equal(template.name, 'Example App');
  assert.equal(template.budgets.maxRoutes, 12);
  assert.deepEqual(template.viewportMatrix, ['desktop', 'mobile']);

  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    seeds: ['/app#overview'],
    pages: [{
      name: 'Overview',
      path: '/app#overview',
      priority: 'P1',
      viewports: ['mobile', { name: 'tablet', width: 768, height: 1024 }],
      expectations: {
        text: ['Overview'],
        selectors: ['#primary'],
        dataBindings: [{
          id: 'git-status',
          sourceId: 'workflow',
          pointer: '/git/status',
          selector: '#git-state',
          target: 'data-state'
        }],
        userQuestions: [{
          id: 'blocked-state',
          question: 'Can the user tell whether work is blocked?',
          expectedEvidence: ['not blocked'],
          selector: '#blocker'
        }]
      },
      mock: 'mocks/overview.png'
    }],
    sourceData: [{
      id: 'workflow',
      data: { git: { status: 'clean' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['non-engineer', 'early-career engineer'],
      goal: 'Help users understand the current workflow state.',
      requiredUserQuestions: [{
        id: 'branch-state',
        pageId: 'overview',
        question: 'Can the user identify the active branch?',
        expectedEvidence: ['main']
      }]
    },
    viewportMatrix: ['desktop', { name: 'phone', width: 390, height: 844 }],
    budgets: { maxRoutes: 5 }
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.target.seeds[0], 'https://example.test/app#overview');
  assert.equal(normalized.target.viewportMatrix[0].name, 'desktop');
  assert.equal(normalized.target.viewportMatrix[1].name, 'phone');
  assert.equal(normalized.target.viewportMatrix.some((viewport) => viewport.name === 'mobile'), true);
  assert.equal(normalized.target.viewportMatrix.some((viewport) => viewport.name === 'tablet'), true);
  assert.equal(normalized.target.budgets.maxRoutes, 5);
  assert.equal(normalized.target.pages[0].id, 'overview');
  assert.equal(normalized.target.pages[0].priority, 'high');
  assert.equal(normalized.target.pages[0].expectations.text[0].value, 'Overview');
  assert.equal(normalized.target.pages[0].expectations.selectors[0].value, '#primary');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].sourceId, 'workflow');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].target, 'data-state');
  assert.equal(normalized.target.pages[0].expectations.userQuestions[0].id, 'blocked-state');
  assert.equal(normalized.target.localContentUxAdvisory.enabled, true);
  assert.equal(normalized.target.localContentUxAdvisory.requiredUserQuestions[0].id, 'branch-state');
  assert.equal(normalized.target.localContentUxAdvisory.sourceData[0].available, true);

  assert.equal(classifyActionCandidate({ tag: 'a', href: 'https://example.test/app#next' }, 'https://example.test/app'), 'navigation');
  assert.equal(classifyActionCandidate({ tag: 'input' }, 'https://example.test/app'), 'input_required');
  assert.equal(classifyActionCandidate({ tag: 'button', text: 'Delete project' }, 'https://example.test/app'), 'destructive');
  assert.equal(classifyActionCandidate({ tag: 'button', text: 'Open settings' }, 'https://example.test/app'), 'state_revealing');
});

test('local content UX advisory is manifest opt-in and does not expose source values', () => {
  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Overview',
      path: '/app',
      expectations: {
        dataBindings: [{
          id: 'run-summary',
          sourceId: 'workflow',
          pointer: '/status/summary',
          target: 'text',
          severity: 'medium'
        }]
      }
    }],
    sourceData: [{
      id: 'workflow',
      data: { status: { summary: 'Current local run is healthy' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Expose workflow state in a way users can understand.'
    }
  });
  assert.equal(normalized.ok, true);
  const target = normalized.target;
  const matched = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Dashboard overview. Current local run is healthy.',
        visible_text_length: 53
      }
    }]
  });
  assert.equal(matched.status, 'passed');
  assert.equal(matched.counts.data_binding_matches, 1);
  assert.deepEqual(matched.findings, []);
  assert.equal(matched.action_plan.status, 'passed');
  assert.equal(matched.action_plan.gate_effect, 'none');
  assert.equal(matched.readiness.status, 'passed');
  assert.equal(matched.readiness.legacy_release_readiness_unchanged, true);
  assert.equal(matched.page_handoff.summary.pages, 1);
  assert.equal(matched.page_handoff.summary.pages_with_findings, 0);
  assert.equal(matched.manifest_authoring.status, 'advisory_notes');
  assert.doesNotMatch(JSON.stringify(matched), /Current local run is healthy/);

  const mismatched = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Dashboard overview is unavailable.',
        visible_text_length: 34
      }
    }]
  });
  assert.equal(mismatched.status, 'needs_owner_review');
  assert.equal(mismatched.counts.data_binding_mismatches, 1);
  assert.ok(mismatched.signals.some((signal) => signal.id === 'content_ux_source_text_not_visible'));
  assert.equal(mismatched.findings.length, 1);
  assert.equal(mismatched.findings[0].category, 'content_contract');
  assert.equal(mismatched.findings[0].source, 'local_content_ux_advisory');
  assert.equal(mismatched.findings[0].gate_effect, 'none');
  assert.equal(mismatched.action_plan.status, 'needs_content_owner_review');
  assert.equal(mismatched.action_plan.legacy_action_plan_unchanged, true);
  assert.equal(mismatched.action_plan.total_action_items, 1);
  assert.equal(mismatched.action_plan.page_focus[0].page_id, 'overview');
  assert.equal(mismatched.readiness.status, 'needs_content_owner_review');
  assert.equal(mismatched.readiness.gate_effect, 'none');
  assert.equal(mismatched.readiness.blocking_release_gate, false);
  assert.equal(mismatched.page_handoff.summary.pages_with_findings, 1);
  assert.equal(mismatched.page_handoff.pages[0].status, 'needs_content_owner_review');
  assert.ok(mismatched.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'add_user_questions'));
  assert.doesNotMatch(JSON.stringify(mismatched), /Current local run is healthy/);
});

test('local content UX advisory supports selector-scoped state contracts and user questions', () => {
  const normalized = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Status',
      path: '/app',
      expectations: {
        dataBindings: [
          {
            id: 'git-state',
            sourceId: 'workflow',
            pointer: '/git/state',
            selector: '#git',
            target: 'data-state',
            match: 'exact'
          },
          {
            id: 'check-status',
            sourceId: 'workflow',
            pointer: '/checks/status',
            selector: '#check',
            target: 'attribute',
            attribute: 'data-status',
            match: 'exact'
          },
          {
            id: 'risk-level',
            sourceId: 'workflow',
            pointer: '/risk/level',
            selector: '#risk',
            target: 'data-risk',
            match: 'exact'
          }
        ],
        userQuestions: [{
          id: 'blocker-awareness',
          question: 'Can users identify blockers?',
          expectedEvidence: ['No blockers'],
          selector: '#risk'
        }]
      }
    }],
    sourceData: [{
      id: 'workflow',
      data: {
        git: { state: 'clean' },
        checks: { status: 'complete' },
        risk: { level: 'minor' }
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain workflow status and blockers.',
      requiredUserQuestions: [{
        id: 'branch-awareness',
        pageId: 'status',
        question: 'Can users identify the active branch?',
        expectedEvidence: ['main']
      }]
    }
  });
  assert.equal(normalized.ok, true);
  const target = normalized.target;
  const advisory = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      manifest_page_id: 'status',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Branch main. No blockers.',
        visible_text_length: 25,
        elements: [
          { selector: '#git', text: 'Worktree state', accessible_name: 'Worktree state', attributes: { 'data-state': 'clean' } },
          { selector: '#check', text: 'Checks', accessible_name: 'Checks', attributes: { 'data-status': 'complete' } },
          { selector: '#risk', text: 'No blockers', accessible_name: 'No blockers', attributes: { 'data-risk': 'minor' } }
        ]
      }
    }]
  });

  assert.equal(advisory.status, 'passed');
  assert.equal(advisory.counts.data_binding_checks, 3);
  assert.equal(advisory.counts.selector_scoped_binding_checks, 3);
  assert.equal(advisory.counts.attribute_binding_checks, 1);
  assert.equal(advisory.counts.state_binding_checks, 1);
  assert.equal(advisory.counts.risk_binding_checks, 1);
  assert.equal(advisory.counts.data_binding_matches, 3);
  assert.equal(advisory.counts.required_user_questions, 2);
  assert.equal(advisory.counts.user_questions_answered, 2);
  assert.equal(advisory.quality_signal.required_user_questions, 2);
  assert.deepEqual(advisory.findings, []);
  assert.equal(advisory.action_plan.status, 'passed');
  assert.equal(advisory.readiness.status, 'passed');
  assert.doesNotMatch(JSON.stringify(advisory), /"clean"|"complete"|"minor"/);

  const mismatch = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      manifest_page_id: 'status',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Branch main.',
        visible_text_length: 12,
        elements: [
          { selector: '#git', text: 'Worktree state', attributes: { 'data-state': 'dirty' } },
          { selector: '#check', text: 'Checks', attributes: { 'data-status': 'failed' } },
          { selector: '#risk', text: 'Unknown', attributes: { 'data-risk': 'high' } }
        ]
      }
    }]
  });
  assert.equal(mismatch.status, 'needs_owner_review');
  assert.equal(mismatch.counts.data_binding_mismatches, 3);
  assert.equal(mismatch.counts.user_questions_unanswered, 1);
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_source_state_not_matched'));
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_user_question_not_answered'));
  assert.equal(mismatch.findings.length, 4);
  assert.ok(mismatch.findings.some((finding) => finding.category === 'content_contract'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'workflow_state_clarity'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'information_architecture'));
  assert.equal(mismatch.action_plan.total_action_items, mismatch.findings.length);
  assert.equal(mismatch.action_plan.status, 'needs_content_owner_review');
  assert.equal(mismatch.action_plan.gate_effect, 'none');
  assert.equal(mismatch.action_plan.page_focus[0].page_id, 'status');
  assert.equal(mismatch.readiness.status, 'needs_content_owner_review');
  assert.equal(mismatch.readiness.content_owner_review_required, true);
  assert.equal(mismatch.readiness.page_handoff.pages_with_findings, 1);
  assert.equal(mismatch.page_handoff.pages.find((page) => page.page_id === 'status').top_categories.includes('workflow_state_clarity'), true);
  assert.doesNotMatch(JSON.stringify(mismatch), /"clean"|"complete"|"minor"/);

  const questionOnly = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Question Only',
      path: '/app',
      expectations: {
        userQuestions: [{
          id: 'next-action',
          question: 'Can users identify the next action?',
          expectedEvidence: ['Run checks']
        }]
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain next actions.'
    }
  });
  const questionOnlyAdvisory = buildLocalContentUxAdvisory({
    target: questionOnly.target,
    routeReviews: [{
      route: { url: questionOnly.target.pages[0].url },
      manifest_page_id: 'question-only',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Run checks before release.',
        visible_text_length: 26,
        elements: []
      }
    }]
  });
  assert.equal(questionOnlyAdvisory.counts.pages_without_content_contract, 1);
  assert.equal(questionOnlyAdvisory.counts.required_user_questions, 1);
  assert.equal(questionOnlyAdvisory.counts.user_questions_answered, 1);
  assert.equal(questionOnlyAdvisory.action_plan.status, 'advisory_notes');
  assert.ok(questionOnlyAdvisory.findings.some((finding) => finding.category === 'coverage_contract'));

  const userJourneyGap = normalizeTargetManifest({
    baseUrl: 'https://example.test/app',
    pages: [{
      name: 'Next Action',
      path: '/next',
      expectations: {
        userQuestions: [{
          id: 'next-action',
          question: 'Can users identify the next action?',
          expectedEvidence: ['Run checks'],
          severity: 'medium'
        }, {
          id: 'details-navigation',
          question: 'Can users find the details page?',
          expectedEvidence: ['Open details'],
          severity: 'medium'
        }]
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain next actions and navigation.'
    }
  });
  const userJourneyGapAdvisory = buildLocalContentUxAdvisory({
    target: userJourneyGap.target,
    routeReviews: [{
      route: { url: userJourneyGap.target.pages[0].url },
      manifest_page_id: 'next-action',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Overview only.',
        visible_text_length: 14,
        elements: []
      }
    }]
  });
  assert.ok(userJourneyGapAdvisory.findings.some((finding) => finding.category === 'next_action_clarity'));
  assert.ok(userJourneyGapAdvisory.findings.some((finding) => finding.category === 'navigation_clarity'));
  assert.equal(userJourneyGapAdvisory.page_handoff.summary.pages_with_findings, 1);
  assert.ok(userJourneyGapAdvisory.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'strengthen_next_action_contracts'));
  assert.ok(userJourneyGapAdvisory.manifest_authoring.suggestions.some((suggestion) => suggestion.type === 'strengthen_navigation_contracts'));
});

test('target init writes a reusable local target manifest artifact', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-init-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');

  const parsed = parseCliArgs([
    'target',
    'init',
    '--url',
    'https://example.test/app',
    '--name',
    'Example App',
    '--max-routes',
    '8',
    '--json'
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'target init');
  assert.equal(parsed.options['max-routes'], '8');

  const result = await executeCli([
    'target',
    'init',
    '--url',
    'https://example.test/app',
    '--name',
    'Example App',
    '--max-routes',
    '8',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'target-fixed'
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'target init');
  assert.equal(body.data.target_manifest.name, 'Example App');
  assert.equal(body.data.target_manifest.budgets.maxRoutes, 8);
  assert.deepEqual(body.data.target_manifest.pages, []);
  assert.equal(body.data.boundary.external_upload, false);
  const artifact = body.artifacts.find((candidate) => candidate.type === 'target_manifest');
  assert.ok(artifact);
  const manifest = JSON.parse(await readFile(path.join(cwd, artifact.path), 'utf8'));
  assert.equal(manifest.baseUrl, 'https://example.test/app');
});

test('MCP adapter exposes a local allowlisted tool surface', async () => {
  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_review'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_target_init'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_review_target'), true);
  assert.equal(listed.result.tools.some((tool) => /shell|cleanup/i.test(tool.name)), false);

  const schema = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'browser_debug_schema_get',
      arguments: { name: 'envelope' }
    }
  }, { now: fixedNow });
  assert.equal(schema.result.structuredContent.command, 'schema get');
  assert.equal(schema.result.structuredContent.status, 'ok');

  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-mcp-target-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const target = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_init',
      arguments: { url: 'https://example.test/app', maxRoutes: 4 }
    }
  }, { cwd, now: fixedNow, createId: () => 'target-mcp' });
  assert.equal(target.result.structuredContent.command, 'target init');
  assert.equal(target.result.structuredContent.data.target_manifest.budgets.maxRoutes, 4);
});

test('daemon commands parse and return deterministic JSON envelopes', async () => {
  const started = await executeCli(
    ['daemon', 'start', '--url', 'https://example.test/', '--json'],
    {
      now: fixedNow,
      daemonStartRunner: async (options) => ({
        status: 'ok',
        data: {
          daemon: {
            id: 'daemon-fixed',
            status: 'running',
            current_url: options.url,
            browser: {
              ephemeral_context: true,
              existing_profile_reused: false,
              persistent_storage: false
            }
          }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'daemon', path: '.browser-debug/daemons/daemon-fixed.json' }]
      })
    }
  );
  assert.equal(started.exitCode, 0);
  const startedBody = JSON.parse(started.stdout);
  assert.equal(startedBody.command, 'daemon start');
  assert.equal(startedBody.data.daemon.id, 'daemon-fixed');
  assert.equal(startedBody.data.daemon.browser.existing_profile_reused, false);

  const statusParsed = parseCliArgs(['daemon', 'status', '--daemon', 'daemon-fixed', '--json']);
  assert.equal(statusParsed.ok, true);
  assert.equal(statusParsed.command, 'daemon status');
  assert.equal(statusParsed.options.daemon, 'daemon-fixed');

  const stopped = await executeCli(
    ['daemon', 'stop', '--daemon', 'daemon-fixed', '--json'],
    {
      now: fixedNow,
      daemonStopRunner: async (options) => ({
        status: 'ok',
        data: {
          daemon: {
            id: options.daemon,
            status: 'stopped',
            process_status: 'not_alive'
          }
        },
        warnings: [],
        errors: [],
        artifacts: [{ type: 'daemon', path: `.browser-debug/daemons/${options.daemon}.json` }]
      })
    }
  );
  assert.equal(stopped.exitCode, 0);
  assert.equal(JSON.parse(stopped.stdout).data.daemon.status, 'stopped');
});

test('session start, act, report, and spec export use local artifacts', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-cli-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');

  const context = {
    cwd,
    now: fixedNow,
    createId: (prefix) => `${prefix}-fixed`,
    observeRunner: async (options) => ({
      status: 'ok',
      data: {
        id: 'observation-fixed',
        input_url: options.url,
        final_url: options.url,
        title: 'Session Fixture',
        page: { action_candidates: [] }
      },
      warnings: [],
      errors: [],
      artifacts: [{ type: 'observation', path: '.browser-debug/observations/observation-fixed.json' }]
    })
  };

  const started = await executeCli(
    ['session', 'start', '--url', 'https://example.test/', '--json'],
    context
  );
  assert.equal(started.exitCode, 0);
  const startedBody = JSON.parse(started.stdout);
  assert.equal(startedBody.data.session.id, 'session-fixed');
  assert.equal(startedBody.data.session.current_url, 'https://example.test/');

  const acted = await executeCli(
    ['act', '--session', 'session-fixed', '--action', '{"type":"navigate","url":"https://example.test/next"}', '--json'],
    context
  );
  assert.equal(acted.exitCode, 0);
  const actedBody = JSON.parse(acted.stdout);
  assert.equal(actedBody.data.action_result.type, 'navigate');
  assert.equal(actedBody.data.session.current_url, 'https://example.test/next');

  const actedFromInput = await executeCli(
    ['act', '--session', 'session-fixed', '--input', '-', '--json'],
    { ...context, stdinText: '{"type":"observe"}' }
  );
  assert.equal(actedFromInput.exitCode, 0);
  assert.equal(JSON.parse(actedFromInput.stdout).data.action_result.type, 'observe');

  const reported = await executeCli(['report', '--session', 'session-fixed', '--json'], context);
  assert.equal(reported.exitCode, 0);
  assert.equal(JSON.parse(reported.stdout).artifacts[0].type, 'report');

  const exported = await executeCli(['spec', 'export', '--session', 'session-fixed', '--json'], context);
  assert.equal(exported.exitCode, 0);
  assert.equal(JSON.parse(exported.stdout).artifacts[0].type, 'spec');

  const report = await readFile(path.join(cwd, '.browser-debug', 'reports', 'session-fixed.md'), 'utf8');
  assert.match(report, /Browser Debug Report: session-fixed/);
});

test('redaction removes common secrets and sensitive query params', () => {
  assert.equal(
    redactUrl('https://example.test/path?token=abc123456789&ok=1'),
    'https://example.test/path?token=[REDACTED]&ok=1'
  );
  assert.deepEqual(redact({ password: 'secret-value', nested: 'Bearer abcdefghijklmnop' }), {
    password: '[REDACTED]',
    nested: 'Bearer [REDACTED]'
  });
});

test('headed and devtools observe modes set Playwright launch options', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-modes-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  const launches = [];
  const browserType = createFakeBrowserType(launches);

  const headed = await runObserve(
    { url: 'file:///tmp/browser-debug-headed.html', headed: true },
    { cwd, now: fixedNow, createId: () => 'observation-headed', browserType }
  );
  assert.equal(headed.status, 'ok');
  assert.deepEqual(launches[0], { headless: false, devtools: false });
  assert.equal(headed.data.browser.headless, false);
  assert.equal(headed.data.browser.devtools, false);
  assert.equal(headed.data.browser.ephemeral_context, true);

  const devtools = await runObserve(
    { url: 'file:///tmp/browser-debug-devtools.html', devtools: true },
    { cwd, now: fixedNow, createId: () => 'observation-devtools', browserType }
  );
  assert.equal(devtools.status, 'ok');
  assert.deepEqual(launches[1], { headless: false, devtools: true });
  assert.equal(devtools.data.browser.headless, false);
  assert.equal(devtools.data.browser.devtools, true);

  const observation = JSON.parse(
    await readFile(path.join(cwd, '.browser-debug', 'observations', 'observation-devtools.json'), 'utf8')
  );
  assert.equal(observation.browser.devtools, true);
});

function createFakeBrowserType(launches) {
  return {
    async launch(options) {
      launches.push(options);
      return createFakeBrowser();
    }
  };
}

function createFakeBrowser() {
  return {
    async newContext() {
      return {
        tracing: {
          async start() {},
          async stop() {}
        },
        async newPage() {
          return createFakePage();
        },
        async close() {}
      };
    },
    async close() {}
  };
}

function createFakePage() {
  let currentUrl = 'about:blank';
  return {
    on() {},
    async goto(url) {
      currentUrl = url;
      return {
        status: () => 200,
        ok: () => true,
        url: () => url
      };
    },
    async waitForLoadState() {},
    async evaluate() {
      return {
        url: currentUrl,
        title: 'Mode Fixture',
        ready_state: 'complete',
        language: 'en',
        viewport: { width: 1280, height: 720 },
        visible_text: 'Mode Fixture',
        headings: [],
        action_candidates: [],
        forms: []
      };
    },
    url() {
      return currentUrl;
    },
    async screenshot() {}
  };
}
