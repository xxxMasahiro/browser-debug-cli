import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  artifactObject,
  artifactRelPath,
  createArtifactId,
  ensureArtifactRoot,
  resolveArtifactRoot,
  writeJsonArtifact,
  writeTextArtifact
} from './artifacts.js';
import { AGENT_SURFACES } from './agent.js';
import { CLI_NAME, DEFAULT_ARTIFACT_ROOT, SCHEMA_VERSION } from './constants.js';
import { redact, redactString, truncateText } from './redaction.js';

export const AGENTIC_HUMAN_REVIEW_VERSION = '1.0.0';

const DEFAULT_PROVIDER_ID = 'fake-agent';
const DEFAULT_MODEL_ID = 'fake-model';
const DEFAULT_REVIEW_EFFORT = 'standard';
const DEFAULT_SUBAGENT_EFFORT = 'medium';
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_SNIPPETS = 20;
const MAX_EVIDENCE_REFS = 50;
const MAX_ROLE_OPINIONS = 12;
const MAX_FINDINGS = 50;

const REVIEW_EFFORTS = new Set(['quick', 'standard', 'deep', 'xhigh']);
const SUBAGENT_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'inconclusive']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

const TRANSFER_CLASSES = Object.freeze([
  { id: 'raw_pixels', flag: 'allow-raw-pixels', label: 'Screenshot or image pixels' },
  { id: 'page_text', flag: 'allow-page-text', label: 'Visible page or screen text' },
  { id: 'dom_summary', flag: 'allow-dom-summary', label: 'DOM or semantic summary' },
  { id: 'url', flag: 'allow-url', label: 'URL, route, or navigation metadata' },
  { id: 'artifact_refs', flag: 'allow-artifact-refs', label: 'Local artifact references' },
  { id: 'accessibility_summary', flag: 'allow-accessibility-summary', label: 'Accessibility or comprehension summary' }
]);

const RUBRIC_AREAS = Object.freeze([
  'first_impression',
  'visual_perception',
  'ui_ux_clarity',
  'readability',
  'meaning_and_comprehension',
  'copy_and_tone',
  'trust_and_credibility',
  'emotional_reception',
  'information_architecture',
  'flow_and_next_action_clarity',
  'accessibility_and_comprehension',
  'risk_and_misleading_content',
  'strengths',
  'improvement_suggestions'
]);

export async function runAgenticHumanReviewPlan(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const id = context.createId?.('agentic-human-review-plan', now) ?? createArtifactId(now, 'agentic-human-review-plan');
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  if (options.execute) {
    return errorResult('AGENTIC_REVIEW_PLAN_EXECUTE_NOT_SUPPORTED', 'agentic review plan is planning-only and does not accept --execute.', {
      option: 'execute'
    });
  }

  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return errorResult('ARTIFACT_ROOT_INVALID', error.message, { artifact_root: artifactRootInput });
  }

  const reviewIndexRead = await readWorkspaceJson({
    cwd,
    inputPath: options['review-index'],
    label: 'review artifact index',
    maxBytes: maxBytes.value
  });
  if (!reviewIndexRead.ok) {
    return errorResult(reviewIndexRead.error.code, reviewIndexRead.error.message, reviewIndexRead.error.details);
  }

  const reviewArtifact = await readLinkedReviewArtifact({
    cwd,
    reviewIndex: reviewIndexRead.value,
    maxBytes: maxBytes.value
  });
  const intentRead = await resolveIntent(options, context);
  if (!intentRead.ok) {
    return errorResult(intentRead.error.code, intentRead.error.message, intentRead.error.details);
  }

  const effort = normalizeReviewEffort(options.effort ?? options['review-effort']);
  if (!effort.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_EFFORT', effort.message, { effort: options.effort ?? options['review-effort'] });
  }
  const defaultSubagentEffort = normalizeSubagentEffort(options['default-subagent-effort']);
  if (!defaultSubagentEffort.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_SUBAGENT_EFFORT', defaultSubagentEffort.message, {
      default_subagent_effort: options['default-subagent-effort']
    });
  }
  const roleEfforts = parseRoleEfforts(options['role-efforts']);
  if (!roleEfforts.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_ROLE_EFFORTS', roleEfforts.message, { role_efforts: options['role-efforts'] });
  }

  const provider = resolveProviderDescriptor(options.provider, context);
  if (!provider.ok) {
    return errorResult(provider.error.code, provider.error.message, provider.error.details);
  }
  const model = { id: options.model ?? provider.provider.default_model ?? DEFAULT_MODEL_ID };
  const surface = findSurface(options.surface);
  if (!surface) {
    return errorResult('AGENTIC_REVIEW_SURFACE_NOT_FOUND', 'No agent surface matched the requested agentic review surface.', {
      surface: options.surface,
      available_surfaces: AGENT_SURFACES.map((item) => item.id)
    });
  }

  const packageRel = artifactRelPath(artifactRootInput, 'agentic-human-review-packages', id, 'package.json');
  const planRel = artifactRelPath(artifactRootInput, 'agentic-human-review-plans', id, 'plan.json');
  const receiptRel = artifactRelPath(artifactRootInput, 'receipts', `${id}-agentic-plan.json`);
  const reviewPackage = buildReviewPackage({
    id,
    now,
    packagePath: packageRel,
    reviewIndex: reviewIndexRead.value,
    reviewIndexPath: reviewIndexRead.relativePath,
    reviewIndexHash: hashText(reviewIndexRead.text),
    reviewArtifact,
    intent: intentRead.intent,
    targetAudience: options['target-audience'],
    expectedImpression: options['expected-impression']
  });
  const transferPermissions = buildTransferPermissions({ reviewPackage, intent: intentRead.intent });
  const orchestration = buildEffortOrchestration({
    effort: effort.value,
    defaultSubagentEffort: defaultSubagentEffort.value,
    roleEfforts: roleEfforts.value
  });

  const planBase = redact({
    schema_version: SCHEMA_VERSION,
    plan_version: AGENTIC_HUMAN_REVIEW_VERSION,
    type: 'agentic_human_review_plan',
    id,
    status: 'planned',
    created_at: now.toISOString(),
    plan_path: planRel,
    package_path: packageRel,
    package_hash: hashJson(reviewPackage),
    source: reviewPackage.source,
    intent: intentRead.intent,
    review_scope: reviewScope(intentRead.intent),
    human_explanation: {
      plain_language_summary: explainPlan({ reviewPackage, orchestration, transferPermissions }),
      what_will_be_reviewed: reviewScope(intentRead.intent).review_targets,
      likely_reader_questions: reviewScope(intentRead.intent).likely_reader_questions,
      sub_agent_roles: orchestration.sub_agents.map((agent) => ({
        role: agent.role,
        display_name: agent.display_name,
        effort: agent.effort,
        purpose: agent.purpose
      })),
      disclosure_summary: disclosureSummary(transferPermissions),
      exact_run_command: null,
      planning_performed_only: true,
      provider_execution_requires_approval: true
    },
    review_effort: orchestration.review_effort,
    default_subagent_effort: orchestration.default_subagent_effort,
    role_efforts: orchestration.role_efforts,
    sub_agents: orchestration.sub_agents,
    rounds: orchestration.rounds,
    transfer_permissions: transferPermissions,
    disclosure: {
      scope: 'agentic_human_review_plan',
      raw_pixels_may_be_transferred_after_flag: transferPermissions.classes.raw_pixels.required_for_execution,
      page_text_may_be_transferred_after_flag: transferPermissions.classes.page_text.required_for_execution,
      dom_summary_included: transferPermissions.classes.dom_summary.included,
      url_metadata_included: transferPermissions.classes.url.included,
      artifact_references_included: transferPermissions.classes.artifact_refs.included,
      accessibility_summary_included: transferPermissions.classes.accessibility_summary.included,
      external_evidence_transfer_authorized: false,
      provider_execution_authorized: false,
      raw_provider_response_storage_allowed: false
    },
    provider: provider.provider,
    model,
    surface: surfaceSummary(surface),
    rubric: humanReviewRubric(),
    result_contract: {
      required_output_schema: 'agentic_human_review_advisory',
      result_type: 'agentic_human_review_advisory',
      advisory_only: true,
      deterministic_findings_unchanged: true,
      gate_effect: 'none'
    },
    approval: {
      required_before_run: true,
      approval_method: 'cli_execute_with_matching_plan_hash_and_transfer_flags',
      required_plan_hash: null,
      execute_flag_required: true,
      plan_hash_flag_required: true,
      required_transfer_flags: transferPermissions.required_flags,
      mcp_execution_allowed: false
    },
    execution: {
      enabled: false,
      provider_call_performed: false,
      api_call_performed: false,
      external_evidence_transfer: false,
      raw_pixels_read: false,
      raw_pixels_transferred: false,
      page_text_transferred: false,
      raw_provider_response_stored: false,
      mcp_execution_exposed: false
    },
    boundary: agenticHumanReviewBoundary({
      writes_artifacts: true,
      planning_only: true
    }),
    gate_effect: 'none'
  });
  const planHash = computePlanHash(planBase);
  const plan = redact({
    ...planBase,
    plan_hash: planHash,
    human_explanation: {
      ...planBase.human_explanation,
      exact_run_command: buildRunCommand({
        planPath: planRel,
        planHash,
        requiredFlags: transferPermissions.required_flags
      })
    },
    approval: {
      ...planBase.approval,
      required_plan_hash: planHash
    }
  });
  const planReceipt = redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_plan_receipt',
    id,
    created_at: now.toISOString(),
    plan_path: planRel,
    package_path: packageRel,
    plan_hash: planHash,
    package_hash: plan.package_hash,
    status: 'planning_completed_execution_not_started',
    provider_call_performed: false,
    api_call_performed: false,
    external_evidence_transfer: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    raw_provider_response_stored: false,
    credential_values_recorded: false,
    mcp_execution_exposed: false,
    gate_effect: 'none'
  });

  await writeJsonArtifact(root, ['agentic-human-review-packages', id, 'package.json'], reviewPackage);
  await writeJsonArtifact(root, ['agentic-human-review-plans', id, 'plan.json'], plan);
  await writeJsonArtifact(root, ['receipts', `${id}-agentic-plan.json`], planReceipt);

  const warnings = [...reviewArtifact.warnings, ...intentRead.warnings];
  return {
    status: 'ok',
    data: {
      agentic_human_review_plan: plan,
      agentic_human_review_package: reviewPackage,
      plan_hash: planHash,
      approval_required: true,
      boundary: plan.boundary
    },
    warnings,
    errors: [],
    artifacts: [
      artifactObject({
        type: 'agentic_human_review_plan',
        path: planRel,
        description: 'Local approval-gated agentic human review plan.'
      }),
      artifactObject({
        type: 'agentic_human_review_package',
        path: packageRel,
        description: 'Local multimodal metadata package for agentic human review.'
      }),
      artifactObject({
        type: 'agentic_human_review_plan_receipt',
        path: receiptRel,
        description: 'Content-free receipt for the planning step.'
      })
    ]
  };
}

export async function runAgenticHumanReviewRun(options = {}, context = {}) {
  if (!options.execute) {
    return errorResult('AGENTIC_REVIEW_RUN_REQUIRES_EXECUTE', 'agentic review run requires explicit --execute.', {
      execute_required: true
    });
  }
  if (!options.plan) {
    return errorResult('AGENTIC_REVIEW_PLAN_REQUIRED', 'agentic review run requires --plan <agentic-human-review-plan>.', {
      option: 'plan'
    });
  }
  if (!options['plan-hash']) {
    return errorResult('AGENTIC_REVIEW_PLAN_HASH_REQUIRED', 'agentic review run requires --plan-hash <sha256>.', {
      option: 'plan-hash'
    });
  }

  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }

  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return errorResult('ARTIFACT_ROOT_INVALID', error.message, { artifact_root: artifactRootInput });
  }

  const planRead = await readWorkspaceJson({
    cwd,
    inputPath: options.plan,
    label: 'agentic human review plan',
    maxBytes: maxBytes.value
  });
  if (!planRead.ok) {
    return errorResult(planRead.error.code, planRead.error.message, planRead.error.details);
  }

  const validation = validateRunRequest({
    plan: planRead.value,
    planPath: planRead.relativePath,
    suppliedPlanHash: options['plan-hash'],
    options,
    context
  });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }

  const provider = validation.provider;
  const model = validation.model;
  const surface = validation.surface;
  const executionId = context.createId?.('agentic-human-review-execution', now) ?? createArtifactId(now, 'agentic-human-review-execution');
  const resultId = context.createId?.('agentic-human-review-result', now) ?? `${executionId}-result`;
  const executionRel = artifactRelPath(artifactRootInput, 'agentic-human-review-results', executionId, 'execution.json');
  const resultRel = artifactRelPath(artifactRootInput, 'agentic-human-review-results', executionId, 'result.json');
  const reportRel = artifactRelPath(artifactRootInput, 'reports', `${executionId}-agentic-human-review.md`);
  const approvalReceiptRel = artifactRelPath(artifactRootInput, 'receipts', `${executionId}-agentic-approval.json`);
  const runReceiptRel = artifactRelPath(artifactRootInput, 'receipts', `${executionId}-agentic-run.json`);
  const providerResult = await executeAgenticProvider({
    provider,
    model,
    surface,
    plan: planRead.value,
    planPath: planRead.relativePath,
    transferFlags: validation.transferFlags,
    execution: {
      id: executionId,
      execution_path: executionRel,
      result_path: resultRel,
      report_path: reportRel
    },
    resultId,
    now,
    context
  });
  const boundary = agenticHumanReviewBoundary({
    provider_call_performed: providerResult.boundary.provider_call_performed,
    api_call_performed: providerResult.boundary.api_call_performed,
    external_evidence_transfer: providerResult.boundary.external_evidence_transfer,
    writes_artifacts: true,
    planning_only: false
  });
  const execution = buildExecutionRecord({
    id: executionId,
    now,
    status: providerResult.status,
    executionPath: executionRel,
    resultPath: providerResult.ok ? resultRel : null,
    reportPath: providerResult.ok ? reportRel : null,
    approvalReceiptPath: approvalReceiptRel,
    runReceiptPath: runReceiptRel,
    plan: planRead.value,
    planPath: planRead.relativePath,
    planHash: validation.planHash,
    provider,
    model,
    surface,
    transferFlags: validation.transferFlags,
    providerResult,
    boundary
  });
  const approvalReceipt = buildApprovalReceipt({ execution, transferFlags: validation.transferFlags });
  const runReceipt = buildRunReceipt({ execution, providerResult });

  if (providerResult.ok) {
    await writeJsonArtifact(root, ['agentic-human-review-results', executionId, 'result.json'], providerResult.result);
    await writeTextArtifact(root, ['reports', `${executionId}-agentic-human-review.md`], renderAgenticReviewReport(providerResult.result));
  }
  await writeJsonArtifact(root, ['agentic-human-review-results', executionId, 'execution.json'], execution);
  await writeJsonArtifact(root, ['receipts', `${executionId}-agentic-approval.json`], approvalReceipt);
  await writeJsonArtifact(root, ['receipts', `${executionId}-agentic-run.json`], runReceipt);

  const artifacts = [
    artifactObject({
      type: 'agentic_human_review_execution',
      path: executionRel,
      description: 'Local agentic human review execution status record.'
    }),
    artifactObject({
      type: 'agentic_human_review_approval_receipt',
      path: approvalReceiptRel,
      description: 'Content-free receipt for plan hash and transfer permission approval.'
    }),
    artifactObject({
      type: 'agentic_human_review_run_receipt',
      path: runReceiptRel,
      description: 'Content-free receipt for the agentic human review run.'
    })
  ];
  if (providerResult.ok) {
    artifacts.unshift(artifactObject({
      type: 'agentic_human_review_advisory',
      path: resultRel,
      description: 'Normalized untrusted advisory result for agentic human review.'
    }));
    artifacts.push(artifactObject({
      type: 'agentic_human_review_report',
      path: reportRel,
      description: 'Plain-language Markdown report for agentic human review.'
    }));
  }

  if (!providerResult.ok) {
    return {
      status: 'error',
      data: {
        agentic_human_review_execution: execution,
        agentic_human_review_status: execution,
        boundary
      },
      warnings: providerResult.warnings,
      errors: [providerResult.error],
      artifacts
    };
  }

  return {
    status: 'ok',
    data: {
      agentic_human_review_execution: execution,
      agentic_human_review_status: execution,
      agentic_human_review_advisory: {
        id: resultId,
        path: resultRel,
        status: providerResult.result.agentic_human_review_advisory.status,
        gate_effect: 'none',
        untrusted_model_output: true
      },
      boundary
    },
    warnings: providerResult.warnings,
    errors: [],
    artifacts
  };
}

export async function runAgenticHumanReviewStatus(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const executionRead = await readWorkspaceJson({
    cwd,
    inputPath: options.execution,
    label: 'agentic human review execution',
    maxBytes: parseMaxBytes(options['max-bytes']).value
  });
  if (!executionRead.ok) {
    return errorResult(executionRead.error.code, executionRead.error.message, executionRead.error.details);
  }
  return {
    status: 'ok',
    data: {
      agentic_human_review_execution: executionRead.value,
      agentic_human_review_status: executionRead.value,
      boundary: executionRead.value.boundary ?? agenticHumanReviewBoundary()
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewList(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const root = resolveArtifactRoot(cwd, artifactRootInput);
  const executions = [];
  const warnings = [];
  try {
    const entries = await readdir(path.join(root, 'agentic-human-review-results'), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const executionPath = artifactRelPath(artifactRootInput, 'agentic-human-review-results', entry.name, 'execution.json');
      const executionRead = await readWorkspaceJson({
        cwd,
        inputPath: executionPath,
        label: 'agentic human review execution',
        maxBytes: DEFAULT_MAX_BYTES
      });
      if (executionRead.ok) {
        executions.push(executionRead.value);
      } else {
        warnings.push({
          code: 'AGENTIC_REVIEW_EXECUTION_READ_FAILED',
          message: 'Could not read an agentic human review execution while listing execution status.',
          details: { execution_path: executionPath, reason: executionRead.error.message }
        });
      }
    }
  } catch {
    // Missing execution directory is a valid empty-list state.
  }

  return {
    status: 'ok',
    data: {
      agentic_human_review_executions: executions,
      summary: summarizeExecutions(executions),
      boundary: agenticHumanReviewBoundary({ read_only: true })
    },
    warnings,
    errors: [],
    artifacts: []
  };
}

export function agenticHumanReviewBoundary(overrides = {}) {
  return {
    local_only: true,
    browser_launched: false,
    read_only: false,
    writes_artifacts: false,
    planning_only: false,
    provider_call_performed: false,
    api_call_performed: false,
    automatic_upload: false,
    external_upload: false,
    external_evidence_transfer: false,
    raw_pixels_embedded_in_json: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    raw_dom_transferred: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    deterministic_findings_mutated: false,
    existing_review_mutated: false,
    metrics_finding_count_mutated: false,
    release_gate_mutated: false,
    mcp_execution_exposed: false,
    mcp_write_execute_exposed: false,
    shell_used: false,
    free_form_shell_input_accepted: false,
    gate_effect: 'none',
    advisory_only: true,
    ...overrides
  };
}

export function isAgenticHumanReviewPackage(agentPackage) {
  const packet = agentPackage?.packet ?? agentPackage;
  return packet?.task?.type === 'agentic_human_review'
    || packet?.task?.kind === 'agentic_human_review'
    || packet?.result_contract?.required_output_schema === 'agentic_human_review_advisory'
    || packet?.package_kind === 'agentic_human_review_package'
    || packet?.agentic_human_review === true;
}

function buildReviewPackage({
  id,
  now,
  packagePath,
  reviewIndex,
  reviewIndexPath,
  reviewIndexHash,
  reviewArtifact,
  intent,
  targetAudience,
  expectedImpression
}) {
  const artifactRefs = normalizeArtifactReferences(reviewIndex.artifacts);
  const review = reviewArtifact.value ?? {};
  const textSnippets = extractTextSnippets(review);
  const route = stringOrNull(review.review?.final_url ?? review.review?.input_url ?? review.final_url ?? review.input_url);
  const viewport = review.review?.viewport ?? review.environment?.viewport ?? null;
  return redact({
    schema_version: SCHEMA_VERSION,
    package_version: AGENTIC_HUMAN_REVIEW_VERSION,
    package_kind: 'agentic_human_review_package',
    id,
    created_at: now.toISOString(),
    package_path: packagePath,
    task: {
      type: 'agentic_human_review',
      intent,
      target_audience: truncateText(targetAudience ?? 'The intended viewer or user of the reviewed page, image, or screen.', 500),
      expected_impression: truncateText(expectedImpression ?? 'The reviewer should judge what a person is likely to notice, understand, trust, feel, and want to do next.', 700)
    },
    source: {
      review_artifact_index_path: reviewIndexPath,
      review_artifact_index_hash: reviewIndexHash,
      review_id: stringOrNull(reviewIndex.id ?? review.review?.id),
      review_mode: stringOrNull(reviewIndex.mode ?? review.review?.mode),
      route,
      viewport,
      artifact_count: artifactRefs.length,
      evidence_classes: normalizeStringArray(reviewIndex.evidence_classes)
    },
    visual_evidence: {
      reference_count: artifactRefs.filter(isVisualReference).length,
      references: artifactRefs.filter(isVisualReference).slice(0, MAX_EVIDENCE_REFS),
      raw_pixels_embedded_in_json: false,
      raw_pixels_read_by_planning: false
    },
    content_evidence: {
      text_snippet_count: textSnippets.length,
      text_snippets: textSnippets,
      page_text_included_as_bounded_summary: textSnippets.length > 0,
      raw_dom_included: false,
      raw_report_body_included: false
    },
    semantic_evidence: {
      accessibility_summary: summarizeAccessibility(review),
      information_architecture_summary: summarizeInformationArchitecture(review),
      next_action_summary: summarizeNextActions(review)
    },
    artifact_references: artifactRefs.slice(0, MAX_EVIDENCE_REFS),
    existing_review_state: {
      findings_count: Number(review.metrics?.finding_count ?? review.findings?.length ?? 0),
      local_release_gate: stringOrNull(
        review.quality_signals?.release_readiness?.local_gate
        ?? review.action_plan?.release_gate
        ?? reviewIndex.triage?.local_release_gate
      ),
      deterministic_review_path: reviewArtifact.relativePath,
      deterministic_review_hash: reviewArtifact.hash,
      deterministic_review_mutation_allowed: false
    },
    disclosure: {
      raw_pixels_embedded_in_json: false,
      raw_pixels_read_by_planning: false,
      page_text_summary_included: textSnippets.length > 0,
      dom_summary_included: false,
      url_metadata_included: Boolean(route),
      local_artifact_references_included: artifactRefs.length > 0,
      external_evidence_transfer_authorized: false,
      provider_execution_authorized: false
    },
    boundary: agenticHumanReviewBoundary({
      planning_only: true,
      writes_artifacts: true
    })
  });
}

function buildTransferPermissions({ reviewPackage, intent }) {
  const intentWantsText = /\b(copy|content|text|read|readability|comprehension|meaning|tone|文章|文言|読解|内容)\b/i.test(intent);
  const rawPixelsRequired = Number(reviewPackage.visual_evidence?.reference_count ?? 0) > 0;
  const pageTextRequired = intentWantsText || Number(reviewPackage.content_evidence?.text_snippet_count ?? 0) > 0;
  const classRecords = {};
  for (const transferClass of TRANSFER_CLASSES) {
    const included = transferClass.id === 'raw_pixels'
      ? rawPixelsRequired
      : transferClass.id === 'page_text'
        ? pageTextRequired
        : transferClass.id === 'url'
          ? Boolean(reviewPackage.source?.route)
          : transferClass.id === 'artifact_refs'
            ? Number(reviewPackage.source?.artifact_count ?? 0) > 0
            : transferClass.id === 'accessibility_summary'
              ? true
              : false;
    const requiredForExecution = transferClass.id === 'raw_pixels'
      ? rawPixelsRequired
      : transferClass.id === 'page_text'
        ? pageTextRequired
        : false;
    classRecords[transferClass.id] = {
      id: transferClass.id,
      label: transferClass.label,
      included,
      flag: transferClass.flag,
      required_for_execution: requiredForExecution,
      transfer_performed_by_planning: false,
      transfer_performed_by_fake_provider: false
    };
  }
  const requiredFlags = TRANSFER_CLASSES
    .filter((item) => classRecords[item.id].required_for_execution)
    .map((item) => item.flag);
  return {
    exact_match_required: true,
    required_flags: requiredFlags,
    optional_flags_allowed: [],
    classes: classRecords,
    default_external_transfer: false,
    mcp_transfer_allowed: false
  };
}

function buildEffortOrchestration({ effort, defaultSubagentEffort, roleEfforts }) {
  const roles = rolesForEffort(effort);
  const roleEffortMap = new Map(roleEfforts.map((item) => [item.role, item.effort]));
  const subAgents = roles.map((role, index) => ({
    id: `${role.id}-${index + 1}`,
    role: role.id,
    display_name: role.display_name,
    effort: roleEffortMap.get(role.id) ?? role.default_effort ?? defaultSubagentEffort,
    purpose: role.purpose,
    round: role.round ?? 1,
    independent_review: role.independent_review !== false
  }));
  return {
    review_effort: {
      mode: effort,
      role_count: subAgents.length,
      rounds: Math.max(...subAgents.map((agent) => agent.round), 1),
      synthesis_required: true,
      critic_or_verifier_included: subAgents.some((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role))
    },
    default_subagent_effort: defaultSubagentEffort,
    role_efforts: roleEfforts,
    rounds: [...new Set(subAgents.map((agent) => agent.round))].sort((left, right) => left - right),
    sub_agents: subAgents
  };
}

function rolesForEffort(effort) {
  if (effort === 'quick') {
    return [
      role('general_reviewer', 'General Human Reviewer', 'First impression, obvious UI issues, obvious text/comprehension issues.')
    ];
  }
  if (effort === 'deep') {
    return [
      role('visual_reviewer', 'Visual Reviewer', 'Visual quality, visual perception, and layout clarity.', 'high'),
      role('ux_reviewer', 'UX Reviewer', 'Flow, navigation, interaction clarity, and next action clarity.', 'high'),
      role('content_reviewer', 'Content Reviewer', 'Copy, meaning, tone, and reading comprehension.', 'high'),
      role('audience_reviewer', 'Audience Reviewer', 'Likely audience reaction, first impression, emotional reception, and trust.', 'high'),
      role('accessibility_reviewer', 'Accessibility and Comprehension Reviewer', 'Accessibility basics, cognitive load, and comprehension risks.', 'high'),
      role('risk_reviewer', 'Risk Reviewer', 'Misleading content, credibility risk, and owner-decision needs.', 'high'),
      role('synthesis_agent', 'Synthesis Agent', 'Consensus, dissent, and prioritized improvement suggestions.', 'high')
    ];
  }
  if (effort === 'xhigh') {
    return [
      role('visual_reviewer', 'Visual Reviewer', 'Visual quality, visual perception, and layout clarity.', 'xhigh', 1),
      role('ux_reviewer', 'UX Reviewer', 'Flow, navigation, interaction clarity, and next action clarity.', 'xhigh', 1),
      role('content_reviewer', 'Content Reviewer', 'Copy, meaning, tone, and reading comprehension.', 'xhigh', 1),
      role('audience_reviewer', 'Audience Reviewer', 'Likely audience reaction, first impression, emotional reception, and trust.', 'xhigh', 1),
      role('accessibility_reviewer', 'Accessibility and Comprehension Reviewer', 'Accessibility basics, cognitive load, and comprehension risks.', 'xhigh', 1),
      role('risk_reviewer', 'Risk Reviewer', 'Misleading content, credibility risk, and owner-decision needs.', 'xhigh', 1),
      role('critic_reviewer', 'Critic Reviewer', 'Challenge weak conclusions and look for contradictions.', 'xhigh', 2),
      role('verification_reviewer', 'Verification Reviewer', 'Re-check evidence references, uncertainty, and missed issues.', 'xhigh', 2),
      role('synthesis_agent', 'Synthesis Agent', 'Consensus, dissent, and prioritized improvement suggestions.', 'xhigh', 3)
    ];
  }
  return [
    role('visual_reviewer', 'Visual and UX Reviewer', 'First impression, visual clarity, layout, and interaction clarity.'),
    role('content_reviewer', 'Content and Copy Reviewer', 'Screen text, meaning, tone, and reading comprehension.'),
    role('accessibility_reviewer', 'Accessibility and Comprehension Reviewer', 'Accessibility basics, cognitive load, and comprehension risks.')
  ];
}

function role(id, displayName, purpose, defaultEffort = DEFAULT_SUBAGENT_EFFORT, round = 1) {
  return { id, display_name: displayName, purpose, default_effort: defaultEffort, round };
}

async function executeAgenticProvider({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now, context }) {
  if (provider.id === 'fake-agent') {
    return fakeAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now });
  }
  if (provider.id === 'injected-runner') {
    return injectedAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now, context });
  }
  return providerFailure({
    status: 'blocked',
    code: 'AGENTIC_REVIEW_PROVIDER_UNKNOWN',
    message: 'No implemented agentic human review provider adapter is available for the requested provider.',
    details: { provider: provider.id },
    provider
  });
}

function fakeAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now }) {
  const input = {
    summary: 'Deterministic fake agentic human review completed from the approved local plan and metadata package.',
    subjective_perception: {
      first_impression: ['A person is likely to first scan the visible hierarchy, the main message, and the clearest next action.'],
      emotional_reception: ['The review should treat emotional reception as advisory judgment that needs owner review.'],
      trust_and_credibility: ['Trust depends on whether the content, visual structure, and evidence references support the intended message.'],
      cognitive_load: ['Cognitive load should be checked from text density, navigation clarity, and terminology risk.'],
      likely_user_questions: plan.review_scope?.likely_reader_questions ?? []
    },
    readability_comprehension: {
      scanability: 'mixed',
      reading_load: 'medium',
      terminology_risk: [],
      meaning_gaps: [],
      next_action_clarity: []
    },
    role_opinions: (plan.sub_agents ?? []).slice(0, MAX_ROLE_OPINIONS).map((agent) => ({
      role: agent.role,
      display_name: agent.display_name,
      effort: agent.effort,
      round: agent.round,
      summary: `${agent.display_name} reviewed the approved package metadata for ${plan.intent}.`,
      findings: [],
      uncertainties: ['Fake provider output is deterministic scaffolding; use a real approved provider or local runner for substantive judgment.'],
      confidence: { evidence: 'medium', judgment: 'low', implementation: 'inconclusive' }
    })),
    findings: [],
    strengths: ['The review workflow keeps subjective judgment separate from deterministic findings.'],
    improvement_suggestions: ['Run an approved human or provider review when substantive visual, textual, and audience judgment is required.'],
    owner_decision_requests: [{
      id: 'agentic-owner-review-required',
      question: 'Does the owner approve acting on this advisory result after reviewing the evidence and uncertainty?',
      reason: 'Agentic human review is advisory-only and cannot change release gates by itself.'
    }]
  };
  const boundary = providerBoundary({
    provider,
    providerCallPerformed: true,
    apiCallPerformed: false,
    externalEvidenceTransfer: false
  });
  return {
    ok: true,
    status: 'completed',
    result: normalizeAgenticAdvisoryResult({
      id: resultId,
      now,
      plan,
      planPath,
      input,
      provider,
      model,
      surface,
      transferFlags,
      execution,
      boundary
    }),
    boundary,
    warnings: []
  };
}

async function injectedAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now, context }) {
  const runner = runnerForContext(context, provider.id, model.id);
  if (!runner) {
    return providerFailure({
      status: 'blocked',
      code: 'AGENTIC_REVIEW_RUNNER_NOT_CONFIGURED',
      message: 'The requested injected agentic review runner is not configured in the execution context.',
      details: {
        provider: provider.id,
        model: model.id,
        shell_used: false,
        free_form_shell_input_accepted: false
      },
      provider
    });
  }
  let input;
  try {
    input = await runner({
      schema_version: SCHEMA_VERSION,
      type: 'agentic_human_review_request',
      plan: redact(plan),
      plan_path: planPath,
      transfer_permissions: transferFlags,
      provider,
      model,
      surface,
      execution
    });
  } catch (error) {
    return providerFailure({
      status: 'failed',
      code: 'AGENTIC_REVIEW_RUNNER_FAILED',
      message: 'The configured agentic review runner failed before returning advisory JSON.',
      details: {
        provider: provider.id,
        model: model.id,
        reason: error.message,
        shell_used: false,
        raw_provider_response_stored: false
      },
      provider,
      providerCallPerformed: true
    });
  }
  const boundary = providerBoundary({
    provider,
    providerCallPerformed: true,
    apiCallPerformed: false,
    externalEvidenceTransfer: false
  });
  return {
    ok: true,
    status: 'completed',
    result: normalizeAgenticAdvisoryResult({
      id: resultId,
      now,
      plan,
      planPath,
      input: input?.agentic_human_review_advisory ?? input ?? {},
      provider,
      model,
      surface,
      transferFlags,
      execution,
      boundary
    }),
    boundary,
    warnings: []
  };
}

function normalizeAgenticAdvisoryResult({ id, now, plan, planPath, input, provider, model, surface, transferFlags, execution, boundary }) {
  const roleOpinions = normalizeRoleOpinions(input.role_opinions, plan.sub_agents);
  const findings = normalizeFindings(input.findings ?? input.agentic_human_review_findings, id);
  const ownerDecisions = normalizeOwnerDecisionRequests(input.owner_decision_requests);
  const safeInputSummary = secretSafeText(input.summary ?? 'Agentic human review completed with advisory-only output.', 1200);
  const status = findings.length > 0 || ownerDecisions.length > 0 || roleOpinions.length > 0
    ? 'owner_review_recommended'
    : 'completed';
  const advisory = {
    schema_version: SCHEMA_VERSION,
    id,
    status,
    source: 'agentic_human_review',
    imported_at: now.toISOString(),
    plan_id: plan.id,
    plan_path: planPath,
    plan_hash: plan.plan_hash,
    review_effort: plan.review_effort?.mode ?? DEFAULT_REVIEW_EFFORT,
    default_subagent_effort: plan.default_subagent_effort ?? DEFAULT_SUBAGENT_EFFORT,
    role_efforts: plan.role_efforts ?? [],
    gate_effect: 'none',
    untrusted_model_output: true,
    existing_review_mutated: false,
    deterministic_findings_unchanged: true
  };
  return redact({
    schema_version: SCHEMA_VERSION,
    id,
    result_type: 'agentic_human_review_advisory',
    agentic_human_review_advisory: advisory,
    non_engineer_summary: {
      plain_language_scope: plan.human_explanation?.plain_language_summary ?? safeInputSummary,
      likely_first_impression: secretSafeText(input.non_engineer_summary?.likely_first_impression ?? input.likely_first_impression ?? 'Reviewers should inspect what a person notices first and whether the page or image communicates the intended message.', 900),
      main_takeaway: safeInputSummary,
      top_concerns: normalizeStringArray(input.non_engineer_summary?.top_concerns ?? input.top_concerns).slice(0, 8),
      top_strengths: normalizeStringArray(input.non_engineer_summary?.top_strengths ?? input.strengths).slice(0, 8),
      owner_decisions_needed: ownerDecisions.map((item) => item.question)
    },
    subjective_perception: {
      first_impression: normalizeStringArray(input.subjective_perception?.first_impression),
      emotional_reception: normalizeStringArray(input.subjective_perception?.emotional_reception),
      trust_and_credibility: normalizeStringArray(input.subjective_perception?.trust_and_credibility),
      cognitive_load: normalizeStringArray(input.subjective_perception?.cognitive_load),
      likely_user_questions: normalizeStringArray(input.subjective_perception?.likely_user_questions)
    },
    readability_comprehension: {
      scanability: normalizeEnum(input.readability_comprehension?.scanability, ['clear', 'mixed', 'hard'], 'mixed'),
      reading_load: normalizeEnum(input.readability_comprehension?.reading_load, ['low', 'medium', 'high'], 'medium'),
      terminology_risk: normalizeStringArray(input.readability_comprehension?.terminology_risk),
      meaning_gaps: normalizeStringArray(input.readability_comprehension?.meaning_gaps),
      next_action_clarity: normalizeStringArray(input.readability_comprehension?.next_action_clarity)
    },
    role_opinions: roleOpinions,
    consensus_summary: buildConsensusSummary({ roleOpinions, findings, input }),
    dissent_summary: buildDissentSummary({ roleOpinions, input }),
    agentic_human_review_findings: findings,
    agentic_human_review_action_plan: {
      next_actions: normalizeStringArray(input.agentic_human_review_action_plan?.next_actions ?? input.improvement_suggestions).slice(0, 12),
      suggested_fixes: normalizeStringArray(input.suggested_fixes ?? input.improvement_suggestions).slice(0, 12),
      owner_review_required: true,
      gate_effect: 'none'
    },
    agentic_human_review_readiness: {
      status,
      advisory_only: true,
      blocking_release_gate: false,
      deterministic_findings_unchanged: true,
      metrics_finding_count_unchanged: true,
      existing_review_mutated: false,
      gate_effect: 'none'
    },
    owner_decision_requests: ownerDecisions,
    provider: {
      id: provider.id,
      kind: provider.kind,
      transport: provider.transport
    },
    model: { id: model.id },
    surface: surfaceSummary(surface),
    transfer_permissions: transferFlags,
    execution: {
      id: execution.id,
      execution_path: execution.execution_path,
      result_path: execution.result_path,
      report_path: execution.report_path,
      provider_call_performed: boundary.provider_call_performed,
      api_call_performed: boundary.api_call_performed,
      external_evidence_transfer: boundary.external_evidence_transfer,
      raw_provider_response_stored: false
    },
    boundary: agenticHumanReviewBoundary(boundary)
  });
}

function buildExecutionRecord({
  id,
  now,
  status,
  executionPath,
  resultPath,
  reportPath,
  approvalReceiptPath,
  runReceiptPath,
  plan,
  planPath,
  planHash,
  provider,
  model,
  surface,
  transferFlags,
  providerResult,
  boundary
}) {
  return redact({
    schema_version: SCHEMA_VERSION,
    execution_version: AGENTIC_HUMAN_REVIEW_VERSION,
    id,
    status,
    mode: 'agentic_human_review_run',
    created_at: now.toISOString(),
    completed_at: status === 'completed' ? now.toISOString() : null,
    execution_path: executionPath,
    result_path: resultPath,
    report_path: reportPath,
    approval_receipt_path: approvalReceiptPath,
    run_receipt_path: runReceiptPath,
    plan_id: plan.id,
    plan_path: planPath,
    plan_hash: planHash,
    package_path: plan.package_path,
    package_hash: plan.package_hash,
    provider,
    model,
    surface: surfaceSummary(surface),
    transfer_permissions: transferFlags,
    steps: {
      plan_validation: {
        status: 'completed',
        plan_hash_matched: true,
        exact_run_command_matched: true
      },
      approval: {
        status: 'completed',
        execute_flag_received: true,
        transfer_flags_matched: true,
        mcp_execution_exposed: false
      },
      provider_execution: {
        status,
        provider_call_performed: boundary.provider_call_performed,
        api_call_performed: boundary.api_call_performed,
        external_evidence_transfer: boundary.external_evidence_transfer,
        raw_provider_response_stored: false
      },
      normalize: {
        status: providerResult.ok ? 'completed' : 'blocked',
        expected_schema: 'agentic_human_review_advisory',
        raw_provider_response_stored: false
      }
    },
    dashboard_handoff: {
      status_command: `${CLI_NAME} agentic review status --execution ${executionPath} --json`,
      list_command: `${CLI_NAME} agentic review list --json`,
      rerun_command: buildRunCommand({
        planPath,
        planHash,
        requiredFlags: transferFlags.required_flags
      }),
      next_safe_action: providerResult.ok
        ? 'Review the advisory report with the product owner before acting on subjective findings.'
        : 'Inspect the execution error and rerun only after the plan hash and provider boundary are valid.'
    },
    gate_effect: 'none',
    provider_call_performed: boundary.provider_call_performed,
    api_call_performed: boundary.api_call_performed,
    external_evidence_transfer: boundary.external_evidence_transfer,
    automatic_upload: false,
    credential_storage: 'none',
    persistent_credential_storage: false,
    credential_values_recorded: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    deterministic_findings_mutated: false,
    metrics_finding_count_mutated: false,
    existing_review_mutated: false,
    release_gate_mutated: false,
    mcp_execution_exposed: false,
    boundary
  });
}

function validateRunRequest({ plan, planPath, suppliedPlanHash, options, context }) {
  if (plan.type !== 'agentic_human_review_plan' || plan.result_contract?.required_output_schema !== 'agentic_human_review_advisory') {
    return validationError('AGENTIC_REVIEW_PLAN_CONTRACT_MISMATCH', 'agentic review run requires an agentic_human_review_plan artifact.', {
      plan: planPath,
      type: plan.type ?? null,
      required_output_schema: plan.result_contract?.required_output_schema ?? null
    });
  }
  const recomputedHash = computePlanHash(plan);
  if (plan.plan_hash !== recomputedHash) {
    return validationError('AGENTIC_REVIEW_PLAN_MODIFIED', 'The agentic review plan content no longer matches its stored plan_hash.', {
      plan: planPath,
      stored_plan_hash: plan.plan_hash ?? null,
      recomputed_plan_hash: recomputedHash
    });
  }
  if (suppliedPlanHash !== plan.plan_hash) {
    return validationError('AGENTIC_REVIEW_PLAN_HASH_MISMATCH', 'The supplied --plan-hash does not match the approved plan hash.', {
      plan: planPath,
      supplied_plan_hash: suppliedPlanHash,
      expected_plan_hash: plan.plan_hash
    });
  }

  const requiredFlags = normalizeStringArray(plan.transfer_permissions?.required_flags);
  const suppliedFlags = collectTransferFlags(options);
  const suppliedFlagNames = Object.entries(suppliedFlags)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .sort();
  const requiredFlagNames = [...requiredFlags].sort();
  if (JSON.stringify(suppliedFlagNames) !== JSON.stringify(requiredFlagNames)) {
    return validationError('AGENTIC_REVIEW_TRANSFER_FLAGS_MISMATCH', 'agentic review run requires transfer flags to exactly match the approved plan.', {
      required_flags: requiredFlagNames,
      supplied_flags: suppliedFlagNames
    });
  }

  const expectedCommand = buildRunCommand({
    planPath,
    planHash: plan.plan_hash,
    requiredFlags
  });
  if (plan.human_explanation?.exact_run_command !== expectedCommand) {
    return validationError('AGENTIC_REVIEW_PLAN_COMMAND_MISMATCH', 'The plan run command preview does not match the current plan path, hash, and required transfer flags.', {
      plan: planPath,
      expected_command: expectedCommand
    });
  }

  const provider = resolveProviderDescriptor(options.provider ?? plan.provider?.id, context);
  if (!provider.ok) {
    return validationError(provider.error.code, provider.error.message, provider.error.details);
  }
  const model = { id: options.model ?? plan.model?.id ?? provider.provider.default_model ?? DEFAULT_MODEL_ID };
  const surface = findSurface(options.surface ?? plan.surface?.id);
  if (!surface) {
    return validationError('AGENTIC_REVIEW_SURFACE_NOT_FOUND', 'No agent surface matched the requested agentic review surface.', {
      surface: options.surface ?? plan.surface?.id,
      available_surfaces: AGENT_SURFACES.map((item) => item.id)
    });
  }
  const mismatches = [
    ['provider', plan.provider?.id, provider.provider.id],
    ['model', plan.model?.id, model.id],
    ['surface', plan.surface?.id, surface.id]
  ].filter(([, expected, actual]) => expected && expected !== actual);
  if (mismatches.length > 0) {
    return validationError('AGENTIC_REVIEW_PLAN_RUN_MISMATCH', 'The requested provider, model, or surface does not match the approved plan.', {
      mismatches: mismatches.map(([field, expected, actual]) => ({ field, expected, actual }))
    });
  }
  return {
    ok: true,
    planHash: recomputedHash,
    provider: provider.provider,
    model,
    surface,
    transferFlags: {
      exact_match_required: true,
      required_flags: requiredFlagNames,
      supplied_flags: suppliedFlagNames,
      classes: plan.transfer_permissions?.classes ?? {},
      approved_by_cli_execute: true,
      mcp_transfer_allowed: false
    }
  };
}

function buildApprovalReceipt({ execution, transferFlags }) {
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_approval_receipt',
    id: `${execution.id}-approval`,
    created_at: execution.created_at,
    execution_id: execution.id,
    plan_path: execution.plan_path,
    plan_hash: execution.plan_hash,
    approved_by: 'cli_execute_with_matching_plan_hash_and_transfer_flags',
    execute_flag_received: true,
    transfer_flags: transferFlags.supplied_flags,
    provider_id: execution.provider?.id ?? null,
    model_id: execution.model?.id ?? null,
    surface_id: execution.surface?.id ?? null,
    external_evidence_transfer_authorized: false,
    mcp_execution_exposed: false,
    gate_effect: 'none'
  });
}

function buildRunReceipt({ execution, providerResult }) {
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_run_receipt',
    id: `${execution.id}-run`,
    created_at: execution.completed_at ?? execution.created_at,
    execution_id: execution.id,
    execution_path: execution.execution_path,
    result_path: execution.result_path,
    report_path: execution.report_path,
    plan_path: execution.plan_path,
    plan_hash: execution.plan_hash,
    status: execution.status,
    provider_id: execution.provider?.id ?? null,
    model_id: execution.model?.id ?? null,
    provider_call_performed: execution.provider_call_performed,
    api_call_performed: execution.api_call_performed,
    external_evidence_transfer: execution.external_evidence_transfer,
    automatic_upload: false,
    credential_values_recorded: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    deterministic_findings_mutated: false,
    metrics_finding_count_mutated: false,
    release_gate_mutated: false,
    mcp_execution_exposed: false,
    provider_error_code: providerResult.error?.code ?? null,
    gate_effect: 'none'
  });
}

function renderAgenticReviewReport(result) {
  const summary = result.non_engineer_summary ?? {};
  const advisory = result.agentic_human_review_advisory ?? {};
  const lines = [
    '# Agentic Human Review',
    '',
    `Status: ${advisory.status ?? 'unknown'}`,
    `Plan: ${advisory.plan_path ?? ''}`,
    '',
    '## Plain-Language Review',
    '',
    summary.main_takeaway ?? '',
    '',
    '## Likely First Impression',
    '',
    summary.likely_first_impression ?? '',
    '',
    '## Consensus',
    '',
    ...normalizeStringArray(result.consensus_summary?.corroborated_findings).map((item) => `- ${item}`),
    '',
    '## Dissent And Uncertainty',
    '',
    ...normalizeStringArray(result.dissent_summary?.contradictions).map((item) => `- ${item}`),
    ...normalizeStringArray(result.dissent_summary?.minority_opinions).map((item) => `- ${item}`),
    '',
    '## Suggested Fixes',
    '',
    ...normalizeStringArray(result.agentic_human_review_action_plan?.suggested_fixes).map((item) => `- ${item}`),
    '',
    '## Boundary',
    '',
    '- Advisory-only result.',
    '- Deterministic findings, metrics, release gates, and existing review artifacts are unchanged.',
    '- Raw provider responses and credential values are not stored.'
  ];
  return `${lines.join('\n')}\n`;
}

function computePlanHash(plan) {
  return hashText(canonicalStringify(hashablePlan(plan)));
}

function hashablePlan(plan) {
  const clone = structuredCloneSafe(plan);
  delete clone.plan_hash;
  if (clone.approval) {
    delete clone.approval.required_plan_hash;
  }
  if (clone.human_explanation) {
    delete clone.human_explanation.exact_run_command;
  }
  return clone;
}

function buildRunCommand({ planPath, planHash, requiredFlags }) {
  const parts = [
    CLI_NAME,
    'agentic',
    'review',
    'run',
    '--plan',
    planPath,
    '--plan-hash',
    planHash,
    ...[...requiredFlags].sort().map((flag) => `--${flag}`),
    '--execute',
    '--json'
  ];
  return parts.join(' ');
}

function collectTransferFlags(options) {
  return Object.fromEntries(TRANSFER_CLASSES.map((item) => [item.flag, options[item.flag] === true]));
}

function resolveProviderDescriptor(providerId, context = {}) {
  const providers = [
    ...normalizeProviderDescriptors(context.agenticReviewProviders),
    {
      id: 'fake-agent',
      display_name: 'Deterministic fake agentic reviewer',
      kind: 'fake_provider',
      transport: 'local_function',
      implemented: true,
      credential_mode: 'none',
      default_model: DEFAULT_MODEL_ID,
      external_evidence_transfer: false,
      api_call_performed: false,
      raw_provider_response_stored: false
    },
    {
      id: 'injected-runner',
      display_name: 'Injected local agentic reviewer',
      kind: 'injected_runner',
      transport: 'local_callback',
      implemented: true,
      credential_mode: 'none',
      default_model: 'injected-local-model',
      external_evidence_transfer: false,
      api_call_performed: false,
      raw_provider_response_stored: false
    }
  ];
  const id = providerId ?? DEFAULT_PROVIDER_ID;
  const provider = providers.find((candidate) => candidate.id === id);
  if (!provider) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PROVIDER_UNKNOWN',
        message: 'No agentic human review provider matched the requested provider.',
        details: {
          provider: id,
          available_providers: providers.map((candidate) => candidate.id)
        }
      }
    };
  }
  return {
    ok: true,
    provider: {
      id: provider.id,
      display_name: provider.display_name ?? provider.id,
      kind: provider.kind ?? 'provider',
      transport: provider.transport ?? 'unknown',
      implemented: provider.implemented === true,
      credential_mode: provider.credential_mode ?? 'none',
      default_model: provider.default_model ?? DEFAULT_MODEL_ID,
      external_evidence_transfer: provider.external_evidence_transfer === true,
      api_call_performed: false,
      raw_provider_response_stored: false
    }
  };
}

function normalizeProviderDescriptors(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function findSurface(id) {
  const surfaceId = id ?? AGENT_SURFACES[0]?.id;
  return AGENT_SURFACES.find((surface) => surface.id === surfaceId) ?? null;
}

async function resolveIntent(options, context) {
  const fallback = 'Review this page, image, or screen as a human would, including first impression, visual clarity, text comprehension, trust, emotional reception, and improvement suggestions.';
  if (options.intent) {
    return { ok: true, intent: truncateText(options.intent, 1200), warnings: [] };
  }
  if (!options.input) {
    return { ok: true, intent: fallback, warnings: [] };
  }
  if (options.input === '-') {
    return { ok: true, intent: truncateText(context.stdinText ?? fallback, 1200), warnings: [] };
  }
  if (String(options.input).startsWith('@')) {
    const fileRead = await readWorkspaceText({
      cwd: context.cwd ?? process.cwd(),
      inputPath: String(options.input).slice(1),
      label: 'agentic review intent',
      maxBytes: 32 * 1024
    });
    if (!fileRead.ok) {
      return { ok: false, error: fileRead.error };
    }
    return { ok: true, intent: truncateText(fileRead.text, 1200), warnings: [] };
  }
  return { ok: true, intent: truncateText(options.input, 1200), warnings: [] };
}

async function readLinkedReviewArtifact({ cwd, reviewIndex, maxBytes }) {
  const artifacts = normalizeArtifactReferences(reviewIndex.artifacts);
  const reviewRef = artifacts.find((artifact) => ['review', 'image_review'].includes(artifact.type));
  if (!reviewRef?.path) {
    return {
      ok: false,
      value: null,
      relativePath: null,
      hash: null,
      warnings: [{
        code: 'AGENTIC_REVIEW_SOURCE_REVIEW_NOT_FOUND',
        message: 'The review artifact index did not include a readable review artifact reference.',
        details: {}
      }]
    };
  }
  const read = await readWorkspaceJson({ cwd, inputPath: reviewRef.path, label: 'review artifact', maxBytes });
  if (!read.ok) {
    return {
      ok: false,
      value: null,
      relativePath: reviewRef.path,
      hash: null,
      warnings: [{
        code: 'AGENTIC_REVIEW_SOURCE_REVIEW_READ_FAILED',
        message: 'Could not read the linked review artifact while building the agentic review package.',
        details: { review_artifact_path: reviewRef.path, reason: read.error.message }
      }]
    };
  }
  return {
    ok: true,
    value: read.value,
    relativePath: read.relativePath,
    hash: hashText(read.text),
    warnings: []
  };
}

async function readWorkspaceJson({ cwd, inputPath, label, maxBytes }) {
  const textRead = await readWorkspaceText({ cwd, inputPath, label, maxBytes });
  if (!textRead.ok) {
    return textRead;
  }
  try {
    return {
      ok: true,
      value: JSON.parse(textRead.text),
      text: textRead.text,
      relativePath: textRead.relativePath
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_INVALID_JSON',
        message: `The ${label} was not valid JSON.`,
        details: { input: inputPath, reason: error.message }
      }
    };
  }
}

async function readWorkspaceText({ cwd, inputPath, label, maxBytes }) {
  const resolved = await resolveWorkspacePath({ cwd, inputPath, label });
  if (!resolved.ok) {
    return resolved;
  }
  try {
    const stats = await lstat(resolved.absolutePath);
    if (!stats.isFile()) {
      return {
        ok: false,
        error: {
          code: 'AGENTIC_REVIEW_INPUT_NOT_FILE',
          message: `The ${label} path must be a regular file.`,
          details: { input: inputPath }
        }
      };
    }
    if (stats.size > maxBytes) {
      return {
        ok: false,
        error: {
          code: 'AGENTIC_REVIEW_INPUT_TOO_LARGE',
          message: `The ${label} is larger than the configured max bytes.`,
          details: { input: inputPath, bytes: stats.size, max_bytes: maxBytes }
        }
      };
    }
    const text = await readFile(resolved.absolutePath, 'utf8');
    return { ok: true, text, relativePath: resolved.relativePath };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error.code === 'ENOENT' ? 'AGENTIC_REVIEW_INPUT_NOT_FOUND' : 'AGENTIC_REVIEW_INPUT_READ_FAILED',
        message: `Could not read the ${label}.`,
        details: { input: inputPath, reason: error.message }
      }
    };
  }
}

async function resolveWorkspacePath({ cwd, inputPath, label }) {
  const value = String(inputPath ?? '').trim();
  if (!value || value === '-') {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_INPUT_REQUIRED',
        message: `${label} requires a workspace-relative file path.`,
        details: { input: inputPath }
      }
    };
  }
  if (value.startsWith('@')) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_INPUT_INDIRECTION_UNSUPPORTED',
        message: `${label} does not accept @file indirection at this boundary.`,
        details: { input: inputPath }
      }
    };
  }
  if (path.isAbsolute(value) || value.includes('\0') || value.split(/[\\/]+/).includes('..')) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_INPUT_OUTSIDE_WORKSPACE',
        message: `${label} must stay inside the current workspace.`,
        details: { input: inputPath }
      }
    };
  }
  try {
    const root = await realpath(cwd);
    const candidate = path.resolve(cwd, value);
    const resolved = await realpath(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      return {
        ok: false,
        error: {
          code: 'AGENTIC_REVIEW_INPUT_OUTSIDE_WORKSPACE',
          message: `${label} resolved outside the current workspace.`,
          details: { input: inputPath }
        }
      };
    }
    return { ok: true, absolutePath: resolved, relativePath: value.replace(/\\/g, '/') };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error.code === 'ENOENT' ? 'AGENTIC_REVIEW_INPUT_NOT_FOUND' : 'AGENTIC_REVIEW_INPUT_RESOLUTION_FAILED',
        message: `Could not resolve the ${label}.`,
        details: { input: inputPath, reason: error.message }
      }
    };
  }
}

function normalizeArtifactReferences(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, MAX_EVIDENCE_REFS).map((artifact) => ({
    type: stringOrNull(artifact?.type),
    path: stringOrNull(artifact?.path),
    description: stringOrNull(artifact?.description),
    content_included: false,
    local_reference: true
  }));
}

function isVisualReference(artifact) {
  const type = String(artifact?.type ?? '');
  const artifactPath = String(artifact?.path ?? '');
  return type.includes('visual') || type.includes('screenshot') || type.includes('image') || artifactPath.includes('/visual-evidence/') || artifactPath.includes('/screenshots/');
}

function extractTextSnippets(review) {
  const snippets = [];
  for (const finding of Array.isArray(review.findings) ? review.findings : []) {
    const text = truncateText(finding.message ?? finding.summary ?? finding.recommendation ?? '', 400);
    if (text) {
      snippets.push({ source: 'finding', text, content_included: true });
    }
  }
  for (const item of Array.isArray(review.content_ux_findings) ? review.content_ux_findings : []) {
    const text = truncateText(item.message ?? item.summary ?? '', 400);
    if (text) {
      snippets.push({ source: 'content_ux_finding', text, content_included: true });
    }
  }
  const reviewSummary = truncateText(review.review_advisory?.summary ?? review.image_review?.advisory?.next_step ?? '', 400);
  if (reviewSummary) {
    snippets.push({ source: 'review_summary', text: reviewSummary, content_included: true });
  }
  return snippets.slice(0, MAX_TEXT_SNIPPETS);
}

function summarizeAccessibility(review) {
  const accessibility = review.quality_signals?.accessibility ?? review.quality_signals?.accessibility_structure ?? {};
  return {
    status: stringOrNull(accessibility.status) ?? 'unknown',
    summary: truncateText(accessibility.summary ?? 'Accessibility and comprehension should be reviewed by the agentic review roles.', 500)
  };
}

function summarizeInformationArchitecture(review) {
  return {
    status: stringOrNull(review.quality_signals?.visual_hierarchy?.status ?? review.content_ux_readiness?.status) ?? 'unknown',
    summary: truncateText(review.content_ux_review_brief?.summary ?? review.review_advisory?.summary ?? 'Information architecture should be assessed from visible hierarchy, text, route, and next-action clarity.', 500)
  };
}

function summarizeNextActions(review) {
  const nextActions = normalizeStringArray(review.action_plan?.next_actions ?? review.content_ux_action_plan?.next_actions);
  return {
    count: nextActions.length,
    items: nextActions.slice(0, 8)
  };
}

function humanReviewRubric() {
  return {
    schema_version: SCHEMA_VERSION,
    rubric_version: AGENTIC_HUMAN_REVIEW_VERSION,
    output_schema: 'agentic_human_review_advisory',
    areas: RUBRIC_AREAS.map((area) => ({
      id: area,
      required: true,
      evidence_required: true,
      subjective_judgment_allowed: true,
      uncertainty_required: true
    })),
    confidence_model: ['low', 'medium', 'high', 'inconclusive'],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function reviewScope(intent) {
  return {
    intent,
    review_targets: [
      'first impression',
      'visual perception and UI/UX clarity',
      'readability and screen text comprehension',
      'copy tone and meaning',
      'trust, credibility, and emotional reception',
      'information architecture and next action clarity',
      'accessibility and cognitive-load risks',
      'misleading-content or owner-decision risks',
      'strengths and improvement suggestions'
    ],
    likely_reader_questions: [
      'What would a person notice first?',
      'What would they understand or misunderstand?',
      'What would they trust, doubt, or feel uncertain about?',
      'What should be improved before acting on the page or image?'
    ]
  };
}

function explainPlan({ reviewPackage, orchestration, transferPermissions }) {
  return [
    `This plan asks ${orchestration.review_effort.role_count} reviewer role(s) to inspect the target like a human reviewer.`,
    `The review covers first impression, visual clarity, text comprehension, subjective audience reaction, trust, risks, and improvement suggestions.`,
    `It uses local artifact references from ${reviewPackage.source.artifact_count} artifact(s) and keeps execution disabled until the matching plan hash, --execute, and required transfer flags are supplied.`,
    `Planning did not call a provider, read raw pixels, transfer page text, or change deterministic review output.`
  ].join(' ');
}

function disclosureSummary(transferPermissions) {
  return TRANSFER_CLASSES.map((item) => ({
    class: item.id,
    label: item.label,
    included_in_package_metadata: transferPermissions.classes[item.id].included,
    required_flag_for_run: transferPermissions.classes[item.id].required_for_execution ? `--${item.flag}` : null,
    mcp_transfer_allowed: false
  }));
}

function normalizeRoleOpinions(values, plannedAgents = []) {
  const inputValues = Array.isArray(values) && values.length > 0
    ? values
    : plannedAgents.map((agent) => ({
        role: agent.role,
        display_name: agent.display_name,
        effort: agent.effort,
        round: agent.round,
        summary: `${agent.display_name} did not return a separate opinion.`,
        findings: [],
        uncertainties: ['No role-specific output was returned.'],
        confidence: { evidence: 'inconclusive', judgment: 'inconclusive', implementation: 'inconclusive' }
      }));
  return inputValues.slice(0, MAX_ROLE_OPINIONS).map((value, index) => ({
    role: truncateText(value.role ?? plannedAgents[index]?.role ?? `reviewer_${index + 1}`, 120),
    display_name: truncateText(value.display_name ?? plannedAgents[index]?.display_name ?? 'Reviewer', 160),
    effort: normalizeSubagentEffort(value.effort).value ?? DEFAULT_SUBAGENT_EFFORT,
    round: Number.isFinite(Number(value.round)) ? Number(value.round) : 1,
    summary: secretSafeText(value.summary ?? 'Role-specific advisory review.', 900),
    findings: normalizeFindings(value.findings, `${value.role ?? 'role'}-${index + 1}`).slice(0, 8),
    uncertainties: normalizeStringArray(value.uncertainties),
    confidence: normalizeConfidence(value.confidence)
  }));
}

function normalizeFindings(values, resultId) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, MAX_FINDINGS).map((finding, index) => ({
    id: truncateText(finding?.id ?? `${resultId}-agentic-finding-${index + 1}`, 120),
    category: truncateText(finding?.category ?? 'human_review_advisory', 120),
    severity: SEVERITIES.has(finding?.severity) ? finding.severity : 'info',
    confidence: normalizeConfidence(finding?.confidence),
    message: secretSafeText(finding?.message ?? finding?.summary ?? 'Agentic human review advisory finding.', 700),
    recommendation: secretSafeText(finding?.recommendation ?? 'Review this advisory item with the owner before implementation.', 900),
    evidence_refs: normalizeArtifactReferences(finding?.evidence_refs ?? finding?.artifacts),
    subjective_judgment: finding?.subjective_judgment !== false,
    owner_decision_required: finding?.owner_decision_required !== false,
    source: 'agentic_human_review_advisory',
    untrusted_text: true,
    gate_effect: 'none'
  }));
}

function normalizeOwnerDecisionRequests(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 25).map((value, index) => ({
    id: truncateText(value?.id ?? `agentic-owner-decision-${index + 1}`, 120),
    question: secretSafeText(value?.question ?? value?.message ?? 'Owner decision required.', 600),
    reason: secretSafeText(value?.reason ?? '', 700),
    gate_effect: 'none',
    untrusted_text: true
  }));
}

function buildConsensusSummary({ roleOpinions, findings, input }) {
  return {
    agreement_count: Number(input.consensus_summary?.agreement_count ?? (roleOpinions.length > 1 ? 1 : 0)),
    corroborated_findings: normalizeStringArray(input.consensus_summary?.corroborated_findings).slice(0, 10),
    shared_positive_observations: normalizeStringArray(input.consensus_summary?.shared_positive_observations ?? input.strengths).slice(0, 10),
    shared_risks: normalizeStringArray(input.consensus_summary?.shared_risks).slice(0, 10),
    finding_count: findings.length
  };
}

function buildDissentSummary({ roleOpinions, input }) {
  return {
    disagreement_count: Number(input.dissent_summary?.disagreement_count ?? 0),
    contradictions: normalizeStringArray(input.dissent_summary?.contradictions).slice(0, 10),
    minority_opinions: normalizeStringArray(input.dissent_summary?.minority_opinions).slice(0, 10),
    owner_decision_required: roleOpinions.length > 1
  };
}

function providerFailure({ status, code, message, details, provider, providerCallPerformed = false }) {
  const boundary = providerBoundary({
    provider,
    providerCallPerformed,
    apiCallPerformed: false,
    externalEvidenceTransfer: false
  });
  return {
    ok: false,
    status,
    error: { code, message, details: redact(details ?? {}) },
    boundary,
    warnings: []
  };
}

function providerBoundary({ provider, providerCallPerformed, apiCallPerformed, externalEvidenceTransfer }) {
  return agenticHumanReviewBoundary({
    provider_adapter_implemented: provider.implemented === true,
    provider_call_performed: Boolean(providerCallPerformed),
    api_call_performed: Boolean(apiCallPerformed),
    external_evidence_transfer: Boolean(externalEvidenceTransfer)
  });
}

function runnerForContext(context, providerId, modelId) {
  if (typeof context.agenticHumanReviewRunner === 'function') {
    return context.agenticHumanReviewRunner;
  }
  if (typeof context.agenticReviewRunner === 'function') {
    return context.agenticReviewRunner;
  }
  const runners = context.agenticHumanReviewRunners ?? context.agenticReviewRunners;
  if (!runners || typeof runners !== 'object') {
    return null;
  }
  return runners[modelId] ?? runners[providerId] ?? null;
}

function summarizeExecutions(executions) {
  const summary = {
    total: executions.length,
    completed: 0,
    failed: 0,
    blocked: 0,
    provider_call_performed: false,
    api_call_performed: false,
    external_evidence_transfer: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    mcp_execution_exposed: false
  };
  for (const execution of executions) {
    if (Object.hasOwn(summary, execution.status)) {
      summary[execution.status] += 1;
    }
    summary.provider_call_performed ||= Boolean(execution.provider_call_performed);
    summary.api_call_performed ||= Boolean(execution.api_call_performed);
    summary.external_evidence_transfer ||= Boolean(execution.external_evidence_transfer);
    summary.raw_pixels_transferred ||= Boolean(execution.raw_pixels_transferred);
    summary.page_text_transferred ||= Boolean(execution.page_text_transferred);
    summary.raw_provider_response_stored ||= Boolean(execution.raw_provider_response_stored);
    summary.existing_review_mutated ||= Boolean(execution.existing_review_mutated);
    summary.mcp_execution_exposed ||= Boolean(execution.mcp_execution_exposed);
  }
  return summary;
}

function normalizeReviewEffort(value) {
  const effort = String(value ?? DEFAULT_REVIEW_EFFORT).trim() || DEFAULT_REVIEW_EFFORT;
  if (!REVIEW_EFFORTS.has(effort)) {
    return { ok: false, message: `Unsupported review effort: ${effort}. Expected one of: ${[...REVIEW_EFFORTS].join(', ')}.` };
  }
  return { ok: true, value: effort };
}

function normalizeSubagentEffort(value) {
  const effort = String(value ?? DEFAULT_SUBAGENT_EFFORT).trim() || DEFAULT_SUBAGENT_EFFORT;
  if (!SUBAGENT_EFFORTS.has(effort)) {
    return { ok: false, message: `Unsupported sub-agent effort: ${effort}. Expected one of: ${[...SUBAGENT_EFFORTS].join(', ')}.` };
  }
  return { ok: true, value: effort };
}

function parseRoleEfforts(value) {
  if (!value) {
    return { ok: true, value: [] };
  }
  const text = String(value).trim();
  if (text && !text.startsWith('[') && !text.startsWith('{')) {
    const output = [];
    for (const chunk of text.split(',').map((item) => item.trim()).filter(Boolean)) {
      const [role, effortValue, ...extra] = chunk.split(':').map((item) => item.trim());
      const effort = normalizeSubagentEffort(effortValue);
      if (!role || !effortValue || extra.length > 0 || !effort.ok) {
        return { ok: false, message: 'role efforts shorthand must use role:effort pairs with supported effort values.' };
      }
      output.push({ role, effort: effort.value });
    }
    return { ok: true, value: output };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: `role efforts must be JSON or role:effort shorthand: ${error.message}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: 'role efforts must be a JSON array.' };
  }
  const output = [];
  for (const item of parsed) {
    const effort = normalizeSubagentEffort(item?.effort);
    if (!item?.role || !effort.ok) {
      return { ok: false, message: 'each role effort must include role and a supported effort.' };
    }
    output.push({ role: String(item.role), effort: effort.value });
  }
  return { ok: true, value: output };
}

function parseMaxBytes(value) {
  if (value === undefined) {
    return { ok: true, value: DEFAULT_MAX_BYTES };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return { ok: false, message: 'max-bytes must be a positive number.' };
  }
  return { ok: true, value: Math.floor(number) };
}

function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const normalized = CONFIDENCE_VALUES.has(value) ? value : 'inconclusive';
    return { evidence: normalized, judgment: normalized, implementation: 'inconclusive' };
  }
  return {
    evidence: CONFIDENCE_VALUES.has(value?.evidence) ? value.evidence : 'inconclusive',
    judgment: CONFIDENCE_VALUES.has(value?.judgment) ? value.judgment : 'inconclusive',
    implementation: CONFIDENCE_VALUES.has(value?.implementation) ? value.implementation : 'inconclusive'
  };
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => secretSafeText(item, 600))
    .filter(Boolean);
}

function surfaceSummary(surface) {
  return {
    id: surface.id,
    display_name: surface.display_name,
    kind: surface.kind,
    transport: surface.transport,
    external_evidence_transfer: surface.external_evidence_transfer === true,
    credential_mode: surface.credential_mode ?? 'none'
  };
}

function secretSafeText(value, maxLength) {
  return truncateText(redactString(String(value ?? '')), maxLength);
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return truncateText(value, 500);
}

function hashJson(value) {
  return hashText(canonicalStringify(value));
}

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function validationError(code, message, details) {
  return { ok: false, error: { code, message, details: redact(details ?? {}) } };
}

function errorResult(code, message, details = {}) {
  return {
    status: 'error',
    data: {
      boundary: agenticHumanReviewBoundary()
    },
    warnings: [],
    errors: [{ code, message, details: redact(details) }],
    artifacts: []
  };
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
