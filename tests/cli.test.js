import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { executeCli } from '../src/cli.js';
import { handleMcpRequest } from '../src/mcp.js';
import { runObserve } from '../src/observe.js';
import { parseCliArgs } from '../src/parser.js';
import { redact, redactUrl } from '../src/redaction.js';
import { classifyActionCandidate, normalizeTargetManifest, runReview } from '../src/review.js';
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

test('resource status reports local memory boundaries without launching a browser', async () => {
  const parsed = parseCliArgs(['resource', 'status', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'resource status');

  const result = await executeCli(['resource', 'status', '--json'], {
    now: fixedNow,
    ...createResourceStatusContext()
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'resource status');
  assert.equal(body.status, 'ok');
  assert.equal(body.data.resource_status.status, 'ok');
  assert.equal(body.data.resource_status.source, 'proc_meminfo');
  assert.equal(body.data.resource_status.memory.total_bytes, 1024 * 1024 * 1024);
  assert.equal(body.data.resource_status.memory.available_ratio, 0.25);
  assert.equal(body.data.resource_status.memory.swap_used_ratio, 0.25);
  assert.equal(body.data.resource_status.cgroup.version, 'v2');
  assert.equal(body.data.resource_status.cgroup.usage_ratio, 0.5);
  assert.equal(body.data.resource_status.pressure.available, true);
  assert.equal(body.data.resource_status.process.rss_bytes, 64 * 1024 * 1024);
  assert.equal(body.data.resource_status.cache_policy.automatic_system_cache_reclamation, false);
  assert.equal(body.data.resource_status.cache_policy.automatic_swap_configuration, false);
  assert.equal(body.data.boundary.browser_launched, false);
  assert.equal(body.data.boundary.external_upload, false);
  assert.equal(body.data.boundary.profile_reuse, false);
  assert.equal(body.data.boundary.system_cache_mutated, false);
  assert.equal(body.data.boundary.swap_mutated, false);
  assert.equal(body.data.boundary.cache_deleted, false);
  assert.equal(body.data.boundary.shell_used, false);
  assert.deepEqual(body.artifacts, []);
  assert.deepEqual(body.errors, []);
});

test('resource artifacts plan and explicit cleanup stay scoped to the artifact root', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-artifacts-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  await mkdir(path.join(cwd, '.browser-debug', 'screenshots'), { recursive: true });
  await writeFile(path.join(cwd, '.browser-debug', 'screenshots', 'large-a.png'), '1234567890', 'utf8');
  await writeFile(path.join(cwd, '.browser-debug', 'screenshots', 'large-b.png'), '1234567890', 'utf8');

  const parsed = parseCliArgs(['resource', 'artifacts', 'plan', '--max-bytes', '5', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'resource artifacts plan');

  const planned = await executeCli(['resource', 'artifacts', 'plan', '--max-bytes', '5', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(planned.exitCode, 0);
  const plannedBody = JSON.parse(planned.stdout);
  assert.equal(plannedBody.command, 'resource artifacts plan');
  assert.equal(plannedBody.data.boundary.browser_launched, false);
  assert.equal(plannedBody.data.boundary.cache_deleted, false);
  assert.equal(plannedBody.data.cleanup_proposal.candidate_count >= 1, true);

  const dryRun = await executeCli(['resource', 'artifacts', 'cleanup', '--max-bytes', '5', '--dry-run', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(dryRun.exitCode, 0);
  const dryRunBody = JSON.parse(dryRun.stdout);
  assert.equal(dryRunBody.data.cleanup.dry_run, true);
  assert.equal(dryRunBody.data.boundary.cache_deleted, false);
  await access(path.join(cwd, '.browser-debug', 'screenshots', 'large-a.png'));

  const cleaned = await executeCli(['resource', 'artifacts', 'cleanup', '--max-bytes', '5', '--execute', '--json'], {
    cwd,
    now: fixedNow,
    createId: () => 'artifact-cleanup-fixed'
  });
  assert.equal(cleaned.exitCode, 0);
  const cleanedBody = JSON.parse(cleaned.stdout);
  assert.equal(cleanedBody.data.cleanup.execute, true);
  assert.equal(cleanedBody.data.cleanup.files_deleted >= 1, true);
  assert.equal(cleanedBody.data.boundary.cache_deleted, true);
  assert.equal(cleanedBody.artifacts[0].type, 'artifact_cleanup_receipt');
  const receipt = JSON.parse(
    await readFile(path.join(cwd, '.browser-debug', 'receipts', 'artifact-cleanup-fixed.json'), 'utf8')
  );
  assert.equal(receipt.execute, true);
  assert.equal(receipt.boundary.deletion_scope, 'artifact_root_only');
});

test('review resource guard can stop critical browser work before launch', async () => {
  let launches = 0;
  const result = await runReview({
    url: 'https://example.test/',
    'resource-guard': 'fail-critical'
  }, {
    now: fixedNow,
    collectResourceStatus: async () => criticalResourceStatus(),
    browserType: {
      async launch() {
        launches += 1;
        throw new Error('browser must not launch');
      }
    }
  });

  assert.equal(result.status, 'error');
  assert.equal(result.errors[0].code, 'RESOURCE_GUARD_CRITICAL');
  assert.equal(result.data.resource_guard.status, 'critical');
  assert.equal(result.data.resource_guard.stop_on_critical, true);
  assert.equal(result.data.resource_guard.boundary.browser_launched_by_guard, false);
  assert.equal(result.warnings.some((warning) => warning.code === 'RESOURCE_GUARD_CRITICAL'), true);
  assert.equal(launches, 0);
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
  const parsed = parseCliArgs(['review', '--url', 'https://example.test/', '--viewport', 'mobile', '--screenshot', '--resource-guard', 'fail-critical', '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'review');
  assert.equal(parsed.options.url, 'https://example.test/');
  assert.equal(parsed.options.viewport, 'mobile');
  assert.equal(parsed.options.screenshot, true);
  assert.equal(parsed.options['resource-guard'], 'fail-critical');

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

  const agentSchemaPairs = [
    ['agent_surface', '../schemas/agent-surface.schema.json'],
    ['agent_task_package', '../schemas/agent-task-package.schema.json'],
    ['agent_request_status', '../schemas/agent-request-status.schema.json'],
    ['agent_advisory_result', '../schemas/agent-advisory-result.schema.json'],
    ['agent_disclosure_policy', '../schemas/agent-disclosure-policy.schema.json']
  ];
  for (const [name, file] of agentSchemaPairs) {
    const schemaFile = JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
    const schema = await executeCli(['schema', 'get', '--name', name, '--json'], { now: fixedNow });
    assert.equal(schema.exitCode, 0);
    const schemaBody = JSON.parse(schema.stdout);
    assert.deepEqual(
      Object.keys(schemaBody.data.schema.properties).sort(),
      Object.keys(schemaFile.properties).sort()
    );
  }
});

test('agent package, ingest, and report stay local and advisory-only', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-agent-'));
  await writeFile(path.join(cwd, '.gitignore'), '.browser-debug/\n', 'utf8');
  await mkdir(path.join(cwd, '.browser-debug', 'review-artifacts'), { recursive: true });
  const reviewIndex = {
    schema_version: '0.1.0',
    id: 'review-fixed',
    mode: 'target_manifest',
    local_only: true,
    external_upload: false,
    artifact_root: '.browser-debug',
    evidence_classes: ['layout', 'screenshot'],
    artifacts: [
      { type: 'review', path: '.browser-debug/reviews/review-fixed.json', description: 'Review JSON.' },
      { type: 'screenshot', path: '.browser-debug/screenshots/review-fixed.png', description: 'Screenshot.' }
    ],
    triage: {
      status: 'needs_attention',
      local_release_gate: 'needs_fixes',
      model_review_enabled: false
    },
    coverage_summary: {
      discovered_routes: 1,
      visited_routes: 1,
      expected_routes: 1,
      skipped_routes: 0,
      failed_page_expectations: 0,
      viewports: ['desktop']
    },
    rerun: {
      command: 'browser-debug review --target @target.json --json',
      guidance: ['Rerun after fixes.']
    },
    boundaries: {
      screenshots_may_contain_page_content: true,
      traces_may_contain_page_content: false,
      profile_reuse: false,
      credential_storage: false
    }
  };
  await writeFile(
    path.join(cwd, '.browser-debug', 'review-artifacts', 'review-fixed.json'),
    `${JSON.stringify(reviewIndex, null, 2)}\n`,
    'utf8'
  );

  const listed = await executeCli(['agent', 'surfaces', 'list', '--json'], { now: fixedNow });
  assert.equal(listed.exitCode, 0);
  const listedBody = JSON.parse(listed.stdout);
  assert.equal(listedBody.command, 'agent surfaces list');
  assert.ok(listedBody.data.agent_surfaces.some((surface) => surface.kind === 'subscription_surface' && surface.implemented === true));
  assert.ok(listedBody.data.agent_surfaces.some((surface) => surface.kind === 'api_provider' && surface.status === 'approval_required'));
  assert.equal(listedBody.data.boundary.api_call_performed, false);

  const packaged = await executeCli([
    'agent',
    'package',
    '--review-index',
    '.browser-debug/review-artifacts/review-fixed.json',
    '--surface',
    'local-subscription-agent',
    '--task',
    'experience_review',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-package-fixed'
  });
  assert.equal(packaged.exitCode, 0);
  const packagedBody = JSON.parse(packaged.stdout);
  assert.equal(packagedBody.command, 'agent package');
  assert.equal(packagedBody.data.agent_task_package.path, '.browser-debug/agent-packages/agent-package-fixed/packet.json');
  assert.equal(packagedBody.data.agent_disclosure_policy.raw_artifact_content_included, false);
  assert.equal(packagedBody.data.agent_disclosure_policy.screenshot_binary_included, false);
  assert.equal(packagedBody.data.agent_disclosure_policy.external_evidence_transfer, false);
  assert.equal(packagedBody.data.boundary.api_call_performed, false);
  assert.equal(packagedBody.data.boundary.existing_review_mutated, false);
  assert.equal(packagedBody.artifacts.some((artifact) => artifact.type === 'agent_prompt'), true);
  assert.equal(packagedBody.warnings.some((warning) => warning.code === 'AGENT_PACKAGE_SENSITIVE_ARTIFACT_REFERENCES'), true);
  const packet = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'agent-packages', 'agent-package-fixed', 'packet.json'), 'utf8'));
  assert.equal(packet.evidence_packet.artifacts[1].content_included, false);
  assert.equal(packet.boundary.external_evidence_transfer, false);
  const prompt = await readFile(path.join(cwd, '.browser-debug', 'agent-packages', 'agent-package-fixed', 'prompt.md'), 'utf8');
  assert.match(prompt, /Required output shape/);

  const waitingRequests = await executeCli(['agent', 'requests', 'list', '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(waitingRequests.exitCode, 0);
  const waitingRequestsBody = JSON.parse(waitingRequests.stdout);
  assert.equal(waitingRequestsBody.command, 'agent requests list');
  assert.equal(waitingRequestsBody.data.summary.total, 1);
  assert.equal(waitingRequestsBody.data.summary.waiting_for_agent, 1);
  assert.equal(waitingRequestsBody.data.summary.api_call_performed, false);
  assert.equal(waitingRequestsBody.data.summary.automatic_upload, false);
  assert.equal(waitingRequestsBody.data.agent_requests[0].status, 'waiting_for_agent');
  assert.equal(waitingRequestsBody.data.agent_requests[0].package_path, '.browser-debug/agent-packages/agent-package-fixed/packet.json');
  assert.equal(waitingRequestsBody.data.agent_requests[0].gate_effect, 'none');
  assert.equal(waitingRequestsBody.data.agent_requests[0].existing_review_mutated, false);

  const advisoryInput = JSON.stringify({
    agent_advisory_findings: [{
      id: 'visual-density',
      category: 'visual_design',
      severity: 'medium',
      confidence: { evidence: 'high', judgment: 'medium', implementation: 'low' },
      message: 'Primary controls compete with secondary metadata.',
      recommendation: 'Reduce secondary metadata weight before changing the primary action.',
      selector: '#primary-panel',
      evidence_refs: ['.browser-debug/screenshots/review-fixed.png'],
      owner_decision_required: true
    }],
    owner_decision_requests: [{
      id: 'brand-fit',
      question: 'Is the denser layout acceptable for the target audience?',
      reason: 'This is a subjective product judgment.'
    }]
  });
  const absoluteInput = await executeCli([
    'agent',
    'ingest',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--input',
    `@${path.join(cwd, 'agent-advisory-result.json')}`,
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(absoluteInput.exitCode, 1);
  const absoluteInputBody = JSON.parse(absoluteInput.stdout);
  assert.equal(absoluteInputBody.errors[0].code, 'AGENT_INPUT_PATH_OUTSIDE_WORKSPACE');

  const ingested = await executeCli([
    'agent',
    'ingest',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--input',
    '-',
    '--surface',
    'local-subscription-agent',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    stdinText: advisoryInput,
    createId: () => 'agent-result-fixed'
  });
  assert.equal(ingested.exitCode, 0);
  const ingestedBody = JSON.parse(ingested.stdout);
  assert.equal(ingestedBody.command, 'agent ingest');
  assert.equal(ingestedBody.data.agent_advisory.gate_effect, 'none');
  assert.equal(ingestedBody.data.agent_advisory.untrusted_model_output, true);
  assert.equal(ingestedBody.data.agent_advisory_findings.length, 1);
  assert.equal(ingestedBody.data.agent_advisory_findings[0].source, 'agent_advisory');
  assert.equal(ingestedBody.data.agent_advisory_findings[0].gate_effect, 'none');
  assert.equal(ingestedBody.data.agent_advisory_action_plan.legacy_action_plan_unchanged, true);
  assert.equal(ingestedBody.data.agent_advisory_readiness.legacy_release_readiness_unchanged, true);
  assert.equal(ingestedBody.data.boundary.existing_review_mutated, false);
  assert.equal(ingestedBody.artifacts.some((artifact) => artifact.type === 'agent_import_receipt'), true);
  const receipt = JSON.parse(await readFile(path.join(cwd, '.browser-debug', 'receipts', 'agent-result-fixed.json'), 'utf8'));
  assert.equal(receipt.raw_response_stored, false);
  assert.equal(receipt.api_call_performed, false);

  const importedRequests = await executeCli([
    'agent',
    'requests',
    'list',
    '--package',
    '.browser-debug/agent-packages/agent-package-fixed/packet.json',
    '--json'
  ], {
    cwd,
    now: fixedNow
  });
  assert.equal(importedRequests.exitCode, 0);
  const importedRequestsBody = JSON.parse(importedRequests.stdout);
  assert.equal(importedRequestsBody.data.summary.total, 1);
  assert.equal(importedRequestsBody.data.summary.advisory_imported, 1);
  assert.equal(importedRequestsBody.data.agent_requests[0].status, 'advisory_imported');
  assert.equal(importedRequestsBody.data.agent_requests[0].latest_result_path, '.browser-debug/agent-results/agent-result-fixed.json');
  assert.equal(importedRequestsBody.data.agent_requests[0].advisory_findings, 1);
  assert.equal(importedRequestsBody.data.agent_requests[0].api_call_performed, false);

  const reported = await executeCli([
    'agent',
    'report',
    '--review-index',
    '.browser-debug/review-artifacts/review-fixed.json',
    '--agent-result',
    '.browser-debug/agent-results/agent-result-fixed.json',
    '--json'
  ], {
    cwd,
    now: fixedNow,
    createId: () => 'agent-report-fixed'
  });
  assert.equal(reported.exitCode, 0);
  const reportedBody = JSON.parse(reported.stdout);
  assert.equal(reportedBody.command, 'agent report');
  assert.equal(reportedBody.data.agent_report.existing_review_mutated, false);
  const report = await readFile(path.join(cwd, '.browser-debug', 'reports', 'agent-report-fixed.md'), 'utf8');
  assert.match(report, /Agent Advisory Report/);
  assert.match(report, /Existing deterministic review findings/);
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
      role: 'status_overview',
      priority: 'P1',
      viewports: ['mobile', { name: 'tablet', width: 768, height: 1024 }],
      expectations: {
        text: ['Overview'],
        selectors: ['#primary'],
        dataBindings: [{
          id: 'service-status',
          sourceId: 'service',
          pointer: '/service/status',
          selector: '#service-state',
          target: 'data-state'
        }],
        userQuestions: [{
          id: 'attention-state',
          question: 'Can the user tell whether the service needs attention?',
          expectedEvidence: ['ready'],
          selector: '#risk'
        }]
      },
      mock: 'mocks/overview.png'
    }],
    sourceData: [{
      id: 'service',
      data: { service: { status: 'ready' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['non-engineer', 'early-career engineer'],
      goal: 'Help users understand the current service status.',
      requiredUserQuestions: [{
        id: 'status-state',
        pageId: 'overview',
        question: 'Can the user identify the current service status?',
        expectedEvidence: ['ready']
      }],
      reviewBrief: {
        summary: 'The overview page should explain current service status and next decisions.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'intervention-decision',
          pageId: 'overview',
          question: 'Can the user decide whether intervention is needed?',
          expectedEvidence: ['ready']
        }]
      },
      rubric: [{
        id: 'status-state-criterion',
        category: 'status_clarity',
        pageId: 'overview',
        criterion: 'The page communicates status clearly.',
        expectedEvidence: ['ready']
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
  assert.equal(normalized.target.pages[0].role, 'status_overview');
  assert.equal(normalized.target.pages[0].priority, 'high');
  assert.equal(normalized.target.pages[0].expectations.text[0].value, 'Overview');
  assert.equal(normalized.target.pages[0].expectations.selectors[0].value, '#primary');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].sourceId, 'service');
  assert.equal(normalized.target.pages[0].expectations.dataBindings[0].target, 'data-state');
  assert.equal(normalized.target.pages[0].expectations.userQuestions[0].id, 'attention-state');
  assert.equal(normalized.target.localContentUxAdvisory.enabled, true);
  assert.equal(normalized.target.localContentUxAdvisory.requiredUserQuestions[0].id, 'status-state');
  assert.equal(normalized.target.localContentUxAdvisory.reviewBrief.decisionNeeds[0].id, 'intervention-decision');
  assert.equal(normalized.target.localContentUxAdvisory.rubric[0].category, 'status_clarity');
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
      role: 'status_overview',
      expectations: {
        dataBindings: [{
          id: 'run-summary',
          sourceId: 'service',
          pointer: '/status/summary',
          target: 'text',
          severity: 'medium'
        }]
      }
    }],
    sourceData: [{
      id: 'service',
      data: { status: { summary: 'Current local run is healthy' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Expose service status in a way users can understand.',
      reviewBrief: {
        summary: 'The overview page should let operators decide whether intervention is needed.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'operator-decision',
          pageId: 'overview',
          question: 'Can operators decide whether intervention is needed?',
          expectedEvidence: ['healthy']
        }]
      },
      rubric: [{
        id: 'state-summary-rubric',
        category: 'status_clarity',
        pageId: 'overview',
        criterion: 'The page communicates service health clearly.',
        expectedEvidence: ['healthy'],
        severity: 'medium'
      }]
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
  assert.equal(matched.review_brief.status, 'passed');
  assert.equal(matched.review_brief.summary.decision_needs_met, 1);
  assert.equal(matched.rubric_evaluation.status, 'passed');
  assert.equal(matched.rubric_evaluation.summary.criteria_passed, 1);
  assert.equal(matched.quality_signal.rubric_criteria, 1);
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
  assert.equal(mismatched.review_brief.status, 'needs_content_owner_review');
  assert.equal(mismatched.review_brief.summary.decision_needs_needing_owner_review, 1);
  assert.equal(mismatched.rubric_evaluation.status, 'needs_content_owner_review');
  assert.equal(mismatched.rubric_evaluation.summary.criteria_needing_owner_review, 1);
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
            id: 'service-state',
            sourceId: 'service',
            pointer: '/service/state',
            selector: '#service',
            target: 'data-state',
            match: 'exact'
          },
          {
            id: 'health-status',
            sourceId: 'service',
            pointer: '/health/status',
            selector: '#check',
            target: 'attribute',
            attribute: 'data-status',
            match: 'exact'
          },
          {
            id: 'risk-level',
            sourceId: 'service',
            pointer: '/risk/level',
            selector: '#risk',
            target: 'data-risk',
            match: 'exact'
          }
        ],
        userQuestions: [{
          id: 'risk-awareness',
          question: 'Can users identify current risk?',
          expectedEvidence: ['Low risk'],
          selector: '#risk'
        }]
      }
    }],
    sourceData: [{
      id: 'service',
      data: {
        service: { state: 'ready' },
        health: { status: 'complete' },
        risk: { level: 'minor' }
      }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain service status and risk.',
      requiredUserQuestions: [{
        id: 'environment-awareness',
        pageId: 'status',
        question: 'Can users identify the active environment?',
        expectedEvidence: ['Production']
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
        visible_text: 'Production environment. Low risk.',
        visible_text_length: 25,
        elements: [
          { selector: '#service', text: 'Service state', accessible_name: 'Service state', attributes: { 'data-state': 'ready' } },
          { selector: '#check', text: 'Health check', accessible_name: 'Health check', attributes: { 'data-status': 'complete' } },
          { selector: '#risk', text: 'Low risk', accessible_name: 'Low risk', attributes: { 'data-risk': 'minor' } }
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
  assert.doesNotMatch(JSON.stringify(advisory), /"ready"|"complete"|"minor"/);

  const mismatch = buildLocalContentUxAdvisory({
    target,
    routeReviews: [{
      route: { url: target.pages[0].url },
      manifest_page_id: 'status',
      viewport: { name: 'desktop' },
      evidenceSummary: {
        visible_text: 'Environment unknown.',
        visible_text_length: 12,
        elements: [
          { selector: '#service', text: 'Service state', attributes: { 'data-state': 'offline' } },
          { selector: '#check', text: 'Health check', attributes: { 'data-status': 'failed' } },
          { selector: '#risk', text: 'Unknown', attributes: { 'data-risk': 'high' } }
        ]
      }
    }]
  });
  assert.equal(mismatch.status, 'needs_owner_review');
  assert.equal(mismatch.counts.data_binding_mismatches, 3);
  assert.equal(mismatch.counts.user_questions_unanswered, 2);
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_source_state_not_matched'));
  assert.ok(mismatch.signals.some((signal) => signal.id === 'content_ux_user_question_not_answered'));
  assert.equal(mismatch.findings.length, 5);
  assert.ok(mismatch.findings.some((finding) => finding.category === 'content_contract'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'status_clarity'));
  assert.ok(mismatch.findings.some((finding) => finding.category === 'information_architecture'));
  assert.equal(mismatch.action_plan.total_action_items, mismatch.findings.length);
  assert.equal(mismatch.action_plan.status, 'needs_content_owner_review');
  assert.equal(mismatch.action_plan.gate_effect, 'none');
  assert.equal(mismatch.action_plan.page_focus[0].page_id, 'status');
  assert.equal(mismatch.readiness.status, 'needs_content_owner_review');
  assert.equal(mismatch.readiness.content_owner_review_required, true);
  assert.equal(mismatch.readiness.page_handoff.pages_with_findings, 1);
  assert.equal(mismatch.page_handoff.pages.find((page) => page.page_id === 'status').top_categories.includes('status_clarity'), true);
  assert.doesNotMatch(JSON.stringify(mismatch), /"ready"|"complete"|"minor"/);

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
  assert.ok(userJourneyGapAdvisory.findings.some((finding) => finding.category === 'action_clarity'));
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

test('target validate checks edited manifests without launching a browser', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-target-validate-'));
  const manifestPath = path.join(cwd, 'target.json');
  await writeFile(manifestPath, JSON.stringify({
    baseUrl: 'https://example.test/app',
    expectedRoutes: ['/app/status'],
    pages: [{
      name: 'Status',
      path: '/app/status',
      role: 'status_overview',
      expectations: {
        text: ['Status'],
        selectors: ['#status'],
        dataBindings: [{
          id: 'status-summary',
          sourceId: 'status-source',
          pointer: '/status/summary',
          selector: '#status',
          target: 'text'
        }],
        userQuestions: [{
          id: 'status-understanding',
          question: 'Can users understand the current status?',
          expectedEvidence: ['healthy']
        }]
      }
    }],
    sourceData: [{
      id: 'status-source',
      data: { status: { summary: 'Current local run is healthy' } }
    }],
    localContentUxAdvisory: {
      enabled: true,
      audience: ['operators'],
      goal: 'Explain status clearly.',
      requiredUserQuestions: [{
        id: 'next-decision',
        pageId: 'status',
        question: 'Can users decide the next step?',
        expectedEvidence: ['healthy']
      }],
      reviewBrief: {
        summary: 'The status page should explain whether action is needed.',
        userRoles: ['operator'],
        decisionNeeds: [{
          id: 'action-decision',
          pageId: 'status',
          question: 'Can users decide whether action is needed?',
          expectedEvidence: ['healthy']
        }]
      },
      rubric: [{
        id: 'status-clarity',
        pageId: 'status',
        category: 'status_clarity',
        criterion: 'Status is clear.',
        expectedEvidence: ['healthy']
      }]
    }
  }), 'utf8');

  const parsed = parseCliArgs(['target', 'validate', '--target', manifestPath, '--json']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'target validate');

  const result = await executeCli(['target', 'validate', '--target', manifestPath, '--json'], {
    cwd,
    now: fixedNow
  });
  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.command, 'target validate');
  assert.equal(body.data.target_manifest.status, 'valid');
  assert.equal(body.data.target_manifest.counts.expected_routes, 1);
  assert.equal(body.data.target_manifest.counts.pages, 1);
  assert.equal(body.data.target_manifest.counts.source_data_available, 1);
  assert.equal(body.data.target_manifest.counts.data_bindings, 1);
  assert.equal(body.data.target_manifest.counts.required_user_questions, 1);
  assert.equal(body.data.target_manifest.counts.review_brief_decision_needs, 1);
  assert.equal(body.data.target_manifest.counts.rubric_criteria, 1);
  assert.equal(body.data.boundary.browser_launched, false);
  assert.equal(body.data.boundary.external_upload, false);
  assert.equal(body.data.boundary.profile_reuse, false);
  assert.equal(body.data.boundary.source_data_values_exposed, false);
  assert.equal(body.data.boundary.manifest_mutated, false);
  assert.match(body.data.next_commands.review_json, /browser-debug review --target @/);
  assert.doesNotMatch(result.stdout, /Current local run is healthy/);

  const invalid = await executeCli(['target', 'validate', '--target', '{"name":"missing base"}', '--json'], {
    now: fixedNow
  });
  assert.equal(invalid.exitCode, 1);
  const invalidBody = JSON.parse(invalid.stdout);
  assert.equal(invalidBody.command, 'target validate');
  assert.equal(invalidBody.errors[0].code, 'TARGET_BASE_URL_REQUIRED');
});

test('MCP adapter exposes a local allowlisted tool surface', async () => {
  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_review'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_target_init'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_target_validate'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_resource_status'), true);
  assert.equal(listed.result.tools.some((tool) => tool.name === 'browser_debug_resource_artifacts_plan'), true);
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

  const resource = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'browser_debug_resource_status',
      arguments: {}
    }
  }, { now: fixedNow, ...createResourceStatusContext() });
  assert.equal(resource.result.structuredContent.command, 'resource status');
  assert.equal(resource.result.structuredContent.status, 'ok');
  assert.equal(resource.result.structuredContent.data.boundary.browser_launched, false);
  assert.equal(resource.result.structuredContent.data.boundary.system_cache_mutated, false);

  const artifactCwd = await mkdtemp(path.join(tmpdir(), 'browser-debug-mcp-artifacts-'));
  const artifactPlan = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'browser_debug_resource_artifacts_plan',
      arguments: { maxBytes: '1mib' }
    }
  }, { cwd: artifactCwd, now: fixedNow });
  assert.equal(artifactPlan.result.structuredContent.command, 'resource artifacts plan');
  assert.equal(artifactPlan.result.structuredContent.data.boundary.cache_deleted, false);

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

  const targetArtifact = target.result.structuredContent.artifacts.find((artifact) => artifact.type === 'target_manifest');
  const validated = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'browser_debug_target_validate',
      arguments: { target: targetArtifact.path }
    }
  }, { cwd, now: fixedNow });
  assert.equal(validated.result.structuredContent.command, 'target validate');
  assert.equal(validated.result.structuredContent.data.target_manifest.status, 'valid');
  assert.equal(validated.result.structuredContent.data.boundary.browser_launched, false);
});

test('daemon commands parse and return deterministic JSON envelopes', async () => {
  const started = await executeCli(
    ['daemon', 'start', '--url', 'https://example.test/', '--idle-timeout', '30s', '--max-lifetime', '2h', '--json'],
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
            },
            lifecycle: {
              idle_timeout_ms: options['idle-timeout'],
              max_lifetime_ms: options['max-lifetime']
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
  assert.equal(startedBody.data.daemon.lifecycle.idle_timeout_ms, '30s');

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

function criticalResourceStatus() {
  return {
    status: 'critical',
    source: 'fixture',
    recommended_action: 'pause_browser_work_and_replan',
    memory: {
      available_bytes: 16 * 1024 * 1024,
      available_ratio: 0.01,
      swap_used_bytes: 900 * 1024 * 1024,
      swap_used_ratio: 0.95
    },
    cgroup: {
      available: true,
      current_bytes: 950 * 1024 * 1024,
      limit_bytes: 1024 * 1024 * 1024,
      usage_ratio: 0.95
    },
    pressure: {
      available: false,
      some: null,
      full: null
    },
    boundary: {
      local_only: true,
      browser_launched: false,
      system_cache_mutated: false,
      swap_mutated: false,
      cache_deleted: false
    }
  };
}

function createResourceStatusContext() {
  const files = new Map([
    ['/proc/meminfo', [
      'MemTotal:       1048576 kB',
      'MemFree:         131072 kB',
      'MemAvailable:    262144 kB',
      'Buffers:          16384 kB',
      'Cached:           65536 kB',
      'SwapCached:           0 kB',
      'Active(file):      4096 kB',
      'Inactive(file):    8192 kB',
      'Dirty:                0 kB',
      'Writeback:            0 kB',
      'KReclaimable:      8192 kB',
      'SReclaimable:      8192 kB',
      'SUnreclaim:        4096 kB',
      'SwapTotal:       524288 kB',
      'SwapFree:        393216 kB'
    ].join('\n')],
    ['/sys/fs/cgroup/memory.max', `${1024 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.current', `${512 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.swap.max', `${512 * 1024 * 1024}\n`],
    ['/sys/fs/cgroup/memory.swap.current', `${128 * 1024 * 1024}\n`],
    ['/proc/pressure/memory', [
      'some avg10=0.00 avg60=0.00 avg300=0.00 total=0',
      'full avg10=0.00 avg60=0.00 avg300=0.00 total=0'
    ].join('\n')]
  ]);
  return {
    readTextFile: async (filePath) => {
      if (files.has(filePath)) {
        return files.get(filePath);
      }
      const error = new Error(`missing fixture: ${filePath}`);
      error.code = 'ENOENT';
      throw error;
    },
    os: {
      totalmem: () => 2 * 1024 * 1024 * 1024,
      freemem: () => 1024 * 1024 * 1024
    },
    memoryUsage: () => ({
      rss: 64 * 1024 * 1024,
      heapTotal: 16 * 1024 * 1024,
      heapUsed: 8 * 1024 * 1024,
      external: 2 * 1024 * 1024,
      arrayBuffers: 1024 * 1024
    })
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
