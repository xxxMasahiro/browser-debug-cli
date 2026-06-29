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
import {
  AGENTIC_REVIEW_LIVE_DOGFOOD_ENV,
  buildAgenticLiveDogfoodExecutionGate,
  agenticProviderCapabilityContract,
  agenticProviderCapabilityHash,
  buildAgenticDogfoodSetupReadiness,
  buildAgenticProviderReadiness,
  executeAgenticHumanReviewApiProvider,
  providerBoundary as providerBoundaryRecord,
  resolveAgenticHumanReviewProvider
} from './agentic-human-review-providers.js';

export const AGENTIC_HUMAN_REVIEW_VERSION = '1.0.0';
export const HUMAN_REVIEW_SCHEMA_VERSION = '2.0.0';
export const HUMAN_REVIEW_ORCHESTRATION_VERSION = '2.0.0';
export const HUMAN_REVIEW_CALIBRATION_VERSION = '1.0.0';
export const HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION = '1.0.0';
export const HUMAN_REVIEW_EVIDENCE_PACKAGE_VERSION = '2.0.0';
export const HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION = '3.0.0';
export const HUMAN_REPORT_VERSION = '3.0.0';
export const HUMAN_REVIEW_TEXT_PROVENANCE_VERSION = '1.0.0';
export const HUMAN_REVIEW_LIVE_DOGFOOD_GATE_VERSION = '1.0.0';
export const HUMAN_REVIEW_BENCHMARK_COMPLETION_VERSION = '1.0.0';
export const HUMAN_REVIEW_XHIGH_COMPLETION_VERSION = '1.0.0';
export const HUMAN_REVIEW_MATURITY_VERSION = '1.0.0';
export const HUMAN_REVIEW_EVIDENCE_SET_VERSION = '1.0.0';
export const HUMAN_REVIEW_BATCH_COMPARISON_VERSION = '1.0.0';
export const HUMAN_REVIEW_EVALUATOR_POLICY_VERSION = '1.0.0';
export const HUMAN_REVIEW_XHIGH_ROUND_PLAN_VERSION = '1.0.0';
export const HUMAN_REVIEW_LONGITUDINAL_QUALITY_VERSION = '1.0.0';
export const HUMAN_REVIEW_CLAIM_POLICY_VERSION = '1.0.0';
export const HUMAN_REVIEW_CLAIM_STANDARD_VERSION = '1.0.0';
export const HUMAN_REVIEW_HUMAN_BASELINE_VERSION = '1.0.0';
export const HUMAN_REVIEW_HUMAN_BASELINE_COMPARISON_VERSION = '1.0.0';
export const HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION = '1.0.0';
export const HUMAN_REVIEW_EFFORT_CONTRACT_VERSION = '1.0.0';
export const HUMAN_REVIEW_PROVIDER_EFFORT_BINDING_VERSION = '1.0.0';
export const HUMAN_REVIEW_STRICT_OUTPUT_CONTRACT_VERSION = '1.0.0';
export const HUMAN_REVIEW_REPAIR_RETRY_VERSION = '1.0.0';
export const HUMAN_REVIEW_MULTI_STEP_XHIGH_VERSION = '1.0.0';
export const HUMAN_REVIEW_EVIDENCE_PROVENANCE_VERSION = '1.0.0';

const DEFAULT_PROVIDER_ID = 'fake-agent';
const DEFAULT_MODEL_ID = 'fake-model';
const DEFAULT_REVIEW_EFFORT = 'standard';
const DEFAULT_SUBAGENT_EFFORT = 'medium';
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_SNIPPETS = 20;
const MAX_EVIDENCE_REFS = 50;
const MAX_ROLE_OPINIONS = 12;
const MAX_FINDINGS = 50;
const MAX_HUMAN_BASELINE_LABELS = 100;
const MAX_PROPOSAL_BRIEF_BYTES = 32 * 1024;

const REVIEW_EFFORTS = new Set(['quick', 'standard', 'deep', 'xhigh']);
const HUMAN_REVIEW_CLAIM_EFFORTS = Object.freeze(['standard', 'deep', 'xhigh']);
const HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS = Object.freeze(['direct-vs-tracecue', 'provider-dogfood', 'benchmark-regression']);
const EVIDENCE_SET_ARTIFACT_DATA_KEYS = Object.freeze({
  calibration: Object.freeze(['agentic_human_review_calibration']),
  comparison: Object.freeze([
    'agentic_human_review_comparison',
    'agentic_human_review_human_baseline_comparison'
  ]),
  humanBaseline: Object.freeze([
    'agentic_human_review_human_baseline',
    'agentic_human_review_human_baseline_approval_packet'
  ])
});
const SUBAGENT_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'inconclusive']);
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const HUMAN_BASELINE_APPROVAL_DECISIONS = new Set(['approved', 'needs-edits', 'rejected']);

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

const HUMAN_REVIEW_DIMENSIONS = Object.freeze([
  {
    id: 'first_impression',
    label: 'First impression',
    required_fields: Object.freeze(['non_engineer_summary.likely_first_impression']),
    purpose: 'Judge what a person is likely to notice first and whether the page communicates its point quickly.'
  },
  {
    id: 'reader_emotion',
    label: 'Reader emotion',
    required_fields: Object.freeze(['subjective_perception.emotional_reception']),
    purpose: 'Estimate likely comfort, anxiety, curiosity, trust, motivation, and friction from the viewer perspective.'
  },
  {
    id: 'content_comprehension',
    label: 'Content comprehension',
    required_fields: Object.freeze(['readability_comprehension.meaning_gaps', 'reader_experience_review.content_takeaway']),
    purpose: 'Review visible text, page meaning, copy tone, and whether a reader understands the intended message.'
  },
  {
    id: 'trust_and_credibility',
    label: 'Trust and credibility',
    required_fields: Object.freeze(['subjective_perception.trust_and_credibility', 'reader_experience_review.trust_assessment']),
    purpose: 'Assess whether the page earns trust through evidence, specificity, visual quality, and risk clarity.'
  },
  {
    id: 'visual_ux',
    label: 'Visual and UX perception',
    required_fields: Object.freeze(['reader_experience_review.visual_ux_assessment']),
    purpose: 'Judge layout, scanability, visual hierarchy, interaction clarity, and what UI choices reduce value.'
  },
  {
    id: 'accessibility_comprehension',
    label: 'Accessibility and comprehension',
    required_fields: Object.freeze(['readability_comprehension', 'reader_experience_review.accessibility_comprehension']),
    purpose: 'Review accessibility basics, cognitive load, and whether people can understand and act without unnecessary effort.'
  },
  {
    id: 'risk_and_misleading_content',
    label: 'Risk and misleading content',
    required_fields: Object.freeze(['reader_experience_review.risk_and_misleading_content', 'readability_comprehension.terminology_risk', 'subjective_perception.likely_user_questions']),
    purpose: 'Review whether visible wording, missing context, uncertainty, or trust gaps could mislead a real reader.'
  },
  {
    id: 'improvement_priority',
    label: 'Improvement priority',
    required_fields: Object.freeze(['agentic_human_review_action_plan.suggested_fixes', 'reader_experience_review.priority_recommendation']),
    purpose: 'Separate what is valuable from what is losing value, then prioritize the smallest useful improvements.'
  }
]);

const RUBRIC_PROFILES = Object.freeze([
  Object.freeze({
    id: 'general-human-review',
    label: 'General human review',
    fixture_types: Object.freeze(['general', 'page', 'image_or_screenshot']),
    emphasis: Object.freeze(['first_impression', 'visual_ux', 'content_comprehension', 'trust_and_credibility', 'improvement_priority']),
    evidence_priority: Object.freeze(['page_text', 'raw_pixels', 'artifact_refs', 'accessibility_summary'])
  }),
  Object.freeze({
    id: 'blog-content',
    label: 'Blog content review',
    fixture_types: Object.freeze(['blog', 'article_page']),
    emphasis: Object.freeze(['content_comprehension', 'reader_emotion', 'trust_and_credibility', 'readability', 'improvement_priority']),
    evidence_priority: Object.freeze(['page_text', 'raw_pixels', 'url', 'artifact_refs'])
  }),
  Object.freeze({
    id: 'landing-trust',
    label: 'Landing page trust review',
    fixture_types: Object.freeze(['landing_page', 'marketing_page']),
    emphasis: Object.freeze(['first_impression', 'trust_and_credibility', 'flow_and_next_action_clarity', 'copy_and_tone']),
    evidence_priority: Object.freeze(['page_text', 'raw_pixels', 'accessibility_summary', 'url'])
  }),
  Object.freeze({
    id: 'commerce-confidence',
    label: 'Commerce decision confidence review',
    fixture_types: Object.freeze(['commerce_page', 'product_page']),
    emphasis: Object.freeze(['trust_and_credibility', 'content_comprehension', 'risk_and_misleading_content', 'flow_and_next_action_clarity']),
    evidence_priority: Object.freeze(['page_text', 'raw_pixels', 'accessibility_summary', 'artifact_refs'])
  }),
  Object.freeze({
    id: 'dashboard-comprehension',
    label: 'Dashboard comprehension review',
    fixture_types: Object.freeze(['dashboard', 'app_screen']),
    emphasis: Object.freeze(['information_architecture', 'visual_ux', 'accessibility_comprehension', 'next_action_clarity']),
    evidence_priority: Object.freeze(['raw_pixels', 'page_text', 'accessibility_summary', 'dom_summary'])
  })
]);

const BENCHMARK_CASES = Object.freeze([
  Object.freeze({
    case_id: 'blog-content-value',
    fixture_type: 'blog',
    rubric_profile_id: 'blog-content',
    target_audience: 'A reader deciding whether the article is useful, trustworthy, and pleasant to read.',
    required_dimensions: Object.freeze(['content_comprehension', 'reader_emotion', 'trust_and_credibility', 'visual_ux', 'improvement_priority']),
    required_mentions: Object.freeze(['reader feeling', 'content value', 'UI or technical value loss', 'trust or credibility', 'specific improvement priority']),
    forbidden_claims: Object.freeze(['release is approved', 'deterministic findings were changed', 'credentials were used from artifacts']),
    thresholds: Object.freeze({ coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['page_text', 'raw_pixels', 'url', 'artifact_refs', 'accessibility_summary'])
  }),
  Object.freeze({
    case_id: 'landing-trust-clarity',
    fixture_type: 'landing_page',
    rubric_profile_id: 'landing-trust',
    target_audience: 'A visitor deciding whether to trust the offer and take the next action.',
    required_dimensions: Object.freeze(['first_impression', 'reader_emotion', 'trust_and_credibility', 'content_comprehension', 'improvement_priority']),
    required_mentions: Object.freeze(['first impression', 'trust proof', 'next action', 'copy clarity']),
    forbidden_claims: Object.freeze(['release is approved', 'provider output changed the gate']),
    thresholds: Object.freeze({ coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['page_text', 'raw_pixels', 'url', 'accessibility_summary'])
  }),
  Object.freeze({
    case_id: 'commerce-decision-confidence',
    fixture_type: 'commerce_page',
    rubric_profile_id: 'commerce-confidence',
    target_audience: 'A buyer deciding whether the product information is enough to move forward.',
    required_dimensions: Object.freeze(['content_comprehension', 'trust_and_credibility', 'visual_ux', 'risk_and_misleading_content', 'improvement_priority']),
    required_mentions: Object.freeze(['decision confidence', 'missing proof', 'risk', 'purchase friction']),
    forbidden_claims: Object.freeze(['release is approved', 'price or policy was verified without evidence']),
    thresholds: Object.freeze({ coverage_score: 0.75, actionability_score: 0.65, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['page_text', 'raw_pixels', 'artifact_refs', 'accessibility_summary'])
  }),
  Object.freeze({
    case_id: 'dashboard-empty-state',
    fixture_type: 'dashboard',
    rubric_profile_id: 'dashboard-comprehension',
    target_audience: 'An operator trying to understand status, risk, and the next useful action.',
    required_dimensions: Object.freeze(['first_impression', 'visual_ux', 'accessibility_comprehension', 'content_comprehension', 'improvement_priority']),
    required_mentions: Object.freeze(['scanability', 'state clarity', 'next action', 'cognitive load']),
    forbidden_claims: Object.freeze(['release is approved', 'system state changed']),
    thresholds: Object.freeze({ coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['page_text', 'raw_pixels', 'dom_summary', 'accessibility_summary'])
  }),
  Object.freeze({
    case_id: 'image-visual-hierarchy',
    fixture_type: 'image_or_screenshot',
    rubric_profile_id: 'general-human-review',
    target_audience: 'A viewer judging the image or screen from visible hierarchy and readable content.',
    required_dimensions: Object.freeze(['first_impression', 'visual_ux', 'reader_emotion', 'content_comprehension', 'improvement_priority']),
    required_mentions: Object.freeze(['visual hierarchy', 'viewer feeling', 'readable content', 'specific visual fix']),
    forbidden_claims: Object.freeze(['release is approved', 'raw image bytes were embedded in JSON']),
    thresholds: Object.freeze({ coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['raw_pixels', 'page_text', 'artifact_refs'])
  }),
  Object.freeze({
    case_id: 'article-comprehension-risk',
    fixture_type: 'article_page',
    rubric_profile_id: 'blog-content',
    target_audience: 'A reader deciding whether the article is understandable, balanced, and safe to act on.',
    required_dimensions: Object.freeze(['content_comprehension', 'trust_and_credibility', 'accessibility_comprehension', 'risk_and_misleading_content', 'improvement_priority']),
    required_mentions: Object.freeze(['plain-language takeaway', 'terminology risk', 'trust evidence', 'reader uncertainty', 'specific rewrite priority']),
    forbidden_claims: Object.freeze(['release is approved', 'medical legal or financial advice was verified', 'provider output changed the gate']),
    thresholds: Object.freeze({ coverage_score: 0.8, actionability_score: 0.65, forbidden_claim_score: 1 }),
    allowed_evidence_classes: Object.freeze(['page_text', 'raw_pixels', 'url', 'accessibility_summary', 'artifact_refs'])
  })
]);

const DOGFOOD_SET = Object.freeze({
  set_id: 'agentic-human-review-completion-dogfood-set',
  set_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
  manual_live_provider_default: false,
  ci_live_provider_default: false,
  case_ids: Object.freeze(BENCHMARK_CASES.map((item) => item.case_id)),
  required_review_modes: Object.freeze(['fake', 'injected', 'manual_live']),
  advisory_only: true,
  gate_effect: 'none'
});

export async function runAgenticHumanReviewPropose(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const artifactRootInput = options['artifact-root'] ?? DEFAULT_ARTIFACT_ROOT;
  const id = context.createId?.('agentic-human-review-proposal', now) ?? createArtifactId(now, 'agentic-human-review-proposal');
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  if (options.execute) {
    return errorResult('AGENTIC_REVIEW_PROPOSE_EXECUTE_NOT_SUPPORTED', 'agentic review propose is planning-intake only and does not accept --execute.', {
      option: 'execute'
    });
  }

  let root;
  try {
    root = await ensureArtifactRoot(cwd, artifactRootInput);
  } catch (error) {
    return errorResult('ARTIFACT_ROOT_INVALID', error.message, { artifact_root: artifactRootInput });
  }

  const briefRead = await resolveProposalBrief(options, context);
  if (!briefRead.ok) {
    return errorResult(briefRead.error.code, briefRead.error.message, briefRead.error.details);
  }

  const effort = normalizeReviewEffort(options.effort ?? options['review-effort'] ?? inferReviewEffort(briefRead.brief));
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

  const orchestration = buildEffortOrchestration({
    effort: effort.value,
    defaultSubagentEffort: defaultSubagentEffort.value,
    roleEfforts: roleEfforts.value
  });
  const reviewIndexPreview = await buildProposalReviewIndexPreview({
    cwd,
    options,
    artifactRootInput,
    id,
    now,
    brief: briefRead.brief,
    maxBytes: maxBytes.value,
    provider: provider.provider
  });
  if (!reviewIndexPreview.ok) {
    return errorResult(reviewIndexPreview.error.code, reviewIndexPreview.error.message, reviewIndexPreview.error.details);
  }
  const ownerBaselineContractRead = await readOwnerBaselineRequirementContract({
    cwd,
    options,
    maxBytes: maxBytes.value,
    now
  });
  if (!ownerBaselineContractRead.ok) {
    return errorResult(ownerBaselineContractRead.error.code, ownerBaselineContractRead.error.message, ownerBaselineContractRead.error.details);
  }

  const proposalRel = artifactRelPath(artifactRootInput, 'agentic-human-review-proposals', id, 'proposal.json');
  const receiptRel = artifactRelPath(artifactRootInput, 'receipts', `${id}-agentic-proposal.json`);
  const structuredIntent = buildStructuredIntent({
    brief: briefRead.brief,
    targetAudience: options['target-audience'],
    expectedImpression: options['expected-impression']
  });
  const humanReviewContract = buildHumanReviewContract({
    intent: structuredIntent.purpose,
    targetAudience: structuredIntent.target_audience,
    expectedImpression: structuredIntent.expected_impression
  });
  const proposalBase = redact({
    schema_version: SCHEMA_VERSION,
    proposal_version: AGENTIC_HUMAN_REVIEW_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    type: 'agentic_human_review_proposal',
    id,
    status: 'proposal_ready',
    created_at: now.toISOString(),
    proposal_path: proposalRel,
    source_request: {
      input_mode: briefRead.inputMode,
      brief_hash: hashText(briefRead.brief),
      brief_excerpt: truncateText(briefRead.brief, 600),
      review_index_path: reviewIndexPreview.reviewIndexPath,
      review_index_hash: reviewIndexPreview.reviewIndexHash,
      case_id: stringOrNull(options['case-id']),
      fixture_id: stringOrNull(options['fixture-id'])
    },
    structured_intent: structuredIntent,
    human_review_contract: humanReviewContract,
    plan_candidate: {
      review_index_path: reviewIndexPreview.reviewIndexPath,
      intent: structuredIntent.purpose,
      effort: orchestration.review_effort.mode,
      default_subagent_effort: orchestration.default_subagent_effort,
      role_efforts: orchestration.role_efforts,
      provider_id: provider.provider.id,
      model_id: model.id,
      surface_id: surface.id,
      target_audience: structuredIntent.target_audience,
      expected_impression: structuredIntent.expected_impression,
      benchmark_case_id: stringOrNull(options['benchmark-case'] ?? options['case-id']),
      human_baseline_path: ownerBaselineContractRead.relativePath,
      rubric_profile_id: stringOrNull(options['rubric-profile']),
      evidence_plan_mode: stringOrNull(options['evidence-plan-mode']),
      dogfood_metadata: buildDogfoodMetadataFromOptions(options)
    },
    human_explanation: {
      plain_language_summary: explainProposal({ structuredIntent, orchestration, transferPermissions: reviewIndexPreview.transferPermissions }),
      what_will_be_reviewed: reviewScope(structuredIntent.purpose).review_targets,
      likely_reader_questions: reviewScope(structuredIntent.purpose).likely_reader_questions,
      sub_agent_roles: orchestration.sub_agents.map((agent) => ({
        role: agent.role,
        display_name: agent.display_name,
        effort: agent.effort,
        purpose: agent.purpose
      })),
      disclosure_summary: disclosureSummary(reviewIndexPreview.transferPermissions),
      proposal_performed_only: true,
      provider_execution_requires_approved_plan: true
    },
    review_effort: orchestration.review_effort,
    default_subagent_effort: orchestration.default_subagent_effort,
    role_efforts: orchestration.role_efforts,
    sub_agents: orchestration.sub_agents,
    rounds: orchestration.rounds,
    transfer_preview: reviewIndexPreview.transferPermissions,
    owner_baseline_requirement_preview: ownerBaselineContractRead.contract,
    provider: provider.provider,
    model,
    surface: surfaceSummary(surface),
    next_commands: {
      plan: {
        argv: buildPlanCommandArgs({ proposalPath: proposalRel, reviewIndexPath: reviewIndexPreview.reviewIndexPath }),
        display: buildPlanCommand({ proposalPath: proposalRel, reviewIndexPath: reviewIndexPreview.reviewIndexPath })
      },
      run: {
        available_after_plan: true,
        reason: 'A fresh plan hash is created only by agentic review plan.'
      }
    },
    approval: {
      proposal_is_not_approval: true,
      plan_hash_created: false,
      provider_execution_authorized: false,
      transfer_authorized: false,
      execute_flag_accepted: false,
      mcp_execution_allowed: false
    },
    boundary: agenticHumanReviewBoundary({
      writes_artifacts: true,
      planning_only: true
    }),
    gate_effect: 'none'
  });
  const proposalHash = computeProposalHash(proposalBase);
  const proposal = redact({
    ...proposalBase,
    proposal_hash: proposalHash
  });
  const receipt = redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_proposal_receipt',
    id,
    created_at: now.toISOString(),
    proposal_path: proposalRel,
    proposal_hash: proposalHash,
    status: 'proposal_completed_execution_not_started',
    provider_call_performed: false,
    api_call_performed: false,
    external_evidence_transfer: false,
    raw_pixels_read: false,
    raw_pixels_transferred: false,
    page_text_transferred: false,
    dom_summary_transferred: false,
    url_metadata_transferred: false,
    artifact_refs_transferred: false,
    accessibility_summary_transferred: false,
    raw_provider_response_stored: false,
    credential_values_recorded: false,
    mcp_execution_exposed: false,
    gate_effect: 'none'
  });

  await writeJsonArtifact(root, ['agentic-human-review-proposals', id, 'proposal.json'], proposal);
  await writeJsonArtifact(root, ['receipts', `${id}-agentic-proposal.json`], receipt);

  return {
    status: 'ok',
    data: {
      agentic_human_review_proposal: proposal,
      proposal_hash: proposalHash,
      approval_required: true,
      boundary: proposal.boundary
    },
    warnings: [...briefRead.warnings, ...reviewIndexPreview.warnings, ...ownerBaselineContractRead.warnings],
    errors: [],
    artifacts: [
      artifactObject({
        type: 'agentic_human_review_proposal',
        path: proposalRel,
        description: 'Local non-executing conversational agentic human review proposal.'
      }),
      artifactObject({
        type: 'agentic_human_review_proposal_receipt',
        path: receiptRel,
        description: 'Content-free receipt for the proposal step.'
      })
    ]
  };
}

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

  const proposalRead = await readProposalForPlan({ cwd, options, maxBytes: maxBytes.value });
  if (!proposalRead.ok) {
    return errorResult(proposalRead.error.code, proposalRead.error.message, proposalRead.error.details);
  }
  const planOptions = applyProposalDefaults(options, proposalRead.proposal);
  const reviewIndexPath = planOptions['review-index'];
  if (!reviewIndexPath) {
    return errorResult('AGENTIC_REVIEW_REVIEW_INDEX_REQUIRED', 'agentic review plan requires --review-index or a proposal with a review_index_path.', {
      options: ['review-index', 'proposal']
    });
  }

  const reviewIndexRead = await readWorkspaceJson({
    cwd,
    inputPath: reviewIndexPath,
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
  const intentRead = await resolveIntent(planOptions, context);
  if (!intentRead.ok) {
    return errorResult(intentRead.error.code, intentRead.error.message, intentRead.error.details);
  }

  const effort = normalizeReviewEffort(planOptions.effort ?? planOptions['review-effort']);
  if (!effort.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_EFFORT', effort.message, { effort: planOptions.effort ?? planOptions['review-effort'] });
  }
  const defaultSubagentEffort = normalizeSubagentEffort(planOptions['default-subagent-effort']);
  if (!defaultSubagentEffort.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_SUBAGENT_EFFORT', defaultSubagentEffort.message, {
      default_subagent_effort: planOptions['default-subagent-effort']
    });
  }
  const roleEfforts = parseRoleEfforts(planOptions['role-efforts']);
  if (!roleEfforts.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_ROLE_EFFORTS', roleEfforts.message, { role_efforts: planOptions['role-efforts'] });
  }

  const provider = resolveProviderDescriptor(planOptions.provider, context);
  if (!provider.ok) {
    return errorResult(provider.error.code, provider.error.message, provider.error.details);
  }
  const model = { id: planOptions.model ?? provider.provider.default_model ?? DEFAULT_MODEL_ID };
  const surface = findSurface(planOptions.surface);
  if (!surface) {
    return errorResult('AGENTIC_REVIEW_SURFACE_NOT_FOUND', 'No agent surface matched the requested agentic review surface.', {
      surface: planOptions.surface,
      available_surfaces: AGENT_SURFACES.map((item) => item.id)
    });
  }

  const packageRel = artifactRelPath(artifactRootInput, 'agentic-human-review-packages', id, 'package.json');
  const planRel = artifactRelPath(artifactRootInput, 'agentic-human-review-plans', id, 'plan.json');
  const receiptRel = artifactRelPath(artifactRootInput, 'receipts', `${id}-agentic-plan.json`);
  const reviewPackageBase = buildReviewPackage({
    id,
    now,
    packagePath: packageRel,
    reviewIndex: reviewIndexRead.value,
    reviewIndexPath: reviewIndexRead.relativePath,
    reviewIndexHash: hashText(reviewIndexRead.text),
    reviewArtifact,
    intent: intentRead.intent,
    targetAudience: planOptions['target-audience'],
    expectedImpression: planOptions['expected-impression']
  });
  const requestedBenchmarkCaseId = planOptions['benchmark-case'] ?? planOptions['case-id'];
  let benchmarkCase = resolveBenchmarkCase(requestedBenchmarkCaseId);
  if (requestedBenchmarkCaseId && !benchmarkCase) {
    return errorResult('AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND', 'No agentic human review benchmark case matched the requested id.', {
      case: requestedBenchmarkCaseId,
      available_cases: BENCHMARK_CASES.map((item) => item.case_id)
    });
  }
  const ownerBaselineContractRead = await readOwnerBaselineRequirementContract({
    cwd,
    options: planOptions,
    maxBytes: maxBytes.value,
    now,
    benchmarkCase
  });
  if (!ownerBaselineContractRead.ok) {
    return errorResult(ownerBaselineContractRead.error.code, ownerBaselineContractRead.error.message, ownerBaselineContractRead.error.details);
  }
  if (!benchmarkCase && ownerBaselineContractRead.contract?.case_id) {
    benchmarkCase = resolveBenchmarkCase(ownerBaselineContractRead.contract.case_id);
  }
  const rubricProfile = resolveRubricProfile({
    profileId: planOptions['rubric-profile'],
    benchmarkCase,
    reviewPackage: reviewPackageBase
  });
  const evidencePlan = buildEvidencePlan({
    reviewPackage: reviewPackageBase,
    intent: intentRead.intent,
    provider: provider.provider,
    rubricProfile,
    mode: planOptions['evidence-plan-mode']
  });
  const reviewPackage = redact({
    ...reviewPackageBase,
    rubric_profile: rubricProfile,
    evidence_plan: evidencePlan,
    benchmark_completion_readiness: buildBenchmarkCompletionReadiness({
      benchmarkCase,
      rubricProfile,
      dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions)
    }),
    privacy_disclosure_audit: buildPrivacyDisclosureAudit({
      stage: 'package',
      provider: provider.provider,
      evidencePlan,
      transferPermissions: null,
      executionBoundary: reviewPackageBase.boundary
    })
  });
  const transferPermissions = buildTransferPermissions({ reviewPackage, intent: intentRead.intent, provider: provider.provider, evidencePlan });
  const orchestration = buildEffortOrchestration({
    effort: effort.value,
    defaultSubagentEffort: defaultSubagentEffort.value,
    roleEfforts: roleEfforts.value
  });
  const providerCapabilityContract = agenticProviderCapabilityContract(provider.provider);
  const providerCapabilityHash = agenticProviderCapabilityHash(provider.provider);
  const roleInstructionContracts = buildRoleInstructionContracts({ orchestration, rubricProfile, evidencePlan });
  const orchestrationContract = buildOrchestrationContract({ orchestration, roleInstructionContracts });
  const effortExecutionContract = buildEffortExecutionContract({
    orchestration,
    roleInstructionContracts,
    providerCapabilityContract,
    provider: provider.provider,
    model,
    benchmarkCase
  });
  const privacyDisclosureAudit = buildPrivacyDisclosureAudit({
    stage: 'plan',
    provider: provider.provider,
    evidencePlan,
    transferPermissions,
    executionBoundary: agenticHumanReviewBoundary({ planning_only: true, writes_artifacts: true })
  });

  const planBase = redact({
    schema_version: SCHEMA_VERSION,
    plan_version: AGENTIC_HUMAN_REVIEW_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    type: 'agentic_human_review_plan',
    id,
    status: 'planned',
    created_at: now.toISOString(),
    plan_path: planRel,
    package_path: packageRel,
    package_hash: hashJson(reviewPackage),
    proposal_provenance: proposalRead.proposal
      ? {
          proposal_path: proposalRead.relativePath,
          proposal_hash: proposalRead.proposal.proposal_hash,
          proposal_id: proposalRead.proposal.id,
          proposal_is_not_approval: true
        }
      : null,
    source: reviewPackage.source,
    source_evidence_summary: buildSourceEvidenceSummary(reviewPackage),
    intent: intentRead.intent,
    review_scope: reviewScope(intentRead.intent),
    human_review_contract: buildHumanReviewContract({
      intent: intentRead.intent,
      targetAudience: reviewPackage.task?.target_audience,
      expectedImpression: reviewPackage.task?.expected_impression
    }),
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
    transfer_approval_preview: buildTransferApprovalPreview({ transferPermissions, provider: provider.provider, evidencePlan }),
    review_effort: orchestration.review_effort,
    orchestration_version: HUMAN_REVIEW_ORCHESTRATION_VERSION,
    default_subagent_effort: orchestration.default_subagent_effort,
    role_efforts: orchestration.role_efforts,
    sub_agents: orchestration.sub_agents,
    rounds: orchestration.rounds,
    orchestration_contract: orchestrationContract,
    effort_execution_contract: effortExecutionContract,
    provider_effort_binding: effortExecutionContract.provider_effort_binding,
    strict_output_contract: effortExecutionContract.strict_output_contract,
    repair_retry_contract: effortExecutionContract.repair_retry_contract,
    xhigh_multi_step_contract: effortExecutionContract.xhigh_multi_step_contract,
    role_instruction_contracts: roleInstructionContracts,
    dogfood_metadata: buildDogfoodMetadataFromOptions(planOptions),
    owner_baseline_requirement_contract: ownerBaselineContractRead.contract,
    live_dogfood_execution_gate: buildAgenticLiveDogfoodExecutionGate({
      provider: provider.provider,
      plan: {
        dogfood_metadata: buildDogfoodMetadataFromOptions(planOptions),
        review_quality_benchmark: buildReviewQualityBenchmarkContract({
          dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions),
          benchmarkCase,
          rubricProfile,
          ownerBaselineRequirementContract: ownerBaselineContractRead.contract
        })
      },
      context,
      phase: 'plan'
    }),
    transfer_permissions: transferPermissions,
    evidence_plan: evidencePlan,
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
    privacy_disclosure_audit: privacyDisclosureAudit,
    provider: provider.provider,
    provider_capability_contract: providerCapabilityContract,
    provider_capability_hash: providerCapabilityHash,
    model,
    surface: surfaceSummary(surface),
    rubric_profile: rubricProfile,
    rubric: humanReviewRubric(rubricProfile),
    provider_instruction_contract: buildProviderInstructionContract({
      intent: intentRead.intent,
      reviewPackage,
      orchestration,
      rubricProfile,
      evidencePlan,
      roleInstructionContracts,
      benchmarkCase,
      ownerBaselineRequirementContract: ownerBaselineContractRead.contract
    }),
    review_quality_benchmark: buildReviewQualityBenchmarkContract({
      dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions),
      benchmarkCase,
      rubricProfile,
      ownerBaselineRequirementContract: ownerBaselineContractRead.contract
    }),
    benchmark_completion_readiness: buildBenchmarkCompletionReadiness({
      benchmarkCase,
      rubricProfile,
      dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions)
    }),
    result_contract: {
      required_output_schema: 'agentic_human_review_advisory',
      human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
      result_type: 'agentic_human_review_advisory',
      benchmark_requirement_coverage_required: Boolean(benchmarkCase),
      benchmark_requirement_coverage_source: 'review_quality_benchmark',
      owner_baseline_requirement_contract_required: Boolean(ownerBaselineContractRead.contract),
      owner_baseline_structured_findings_required: Boolean(ownerBaselineContractRead.contract),
      effort_execution_contract_required: true,
      strict_tracecue_output_validation_required: effortExecutionContract.strict_output_contract.tracecue_post_validation_required,
      xhigh_mechanical_completion_required: effortExecutionContract.xhigh_required,
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
      dom_summary_transferred: false,
      url_metadata_transferred: false,
      artifact_refs_transferred: false,
      accessibility_summary_transferred: false,
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
    dom_summary_transferred: false,
    url_metadata_transferred: false,
    artifact_refs_transferred: false,
    accessibility_summary_transferred: false,
    raw_provider_response_stored: false,
    credential_values_recorded: false,
    mcp_execution_exposed: false,
    gate_effect: 'none'
  });

  await writeJsonArtifact(root, ['agentic-human-review-packages', id, 'package.json'], reviewPackage);
  await writeJsonArtifact(root, ['agentic-human-review-plans', id, 'plan.json'], plan);
  await writeJsonArtifact(root, ['receipts', `${id}-agentic-plan.json`], planReceipt);

  const warnings = [...reviewArtifact.warnings, ...intentRead.warnings, ...ownerBaselineContractRead.warnings];
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
    maxBytes: maxBytes.value,
    resultId,
    now,
    context
  });
  const boundary = agenticHumanReviewBoundary({
    ...providerResult.boundary,
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
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const executionRead = await readWorkspaceJson({
    cwd,
    inputPath: options.execution,
    label: 'agentic human review execution',
    maxBytes: maxBytes.value
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

export async function runAgenticHumanReviewProviderReadiness(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  let proposal = null;
  let plan = null;
  if (options.proposal) {
    const proposalRead = await readWorkspaceJson({
      cwd,
      inputPath: options.proposal,
      label: 'agentic human review proposal',
      maxBytes: maxBytes.value
    });
    if (!proposalRead.ok) {
      return errorResult(proposalRead.error.code, proposalRead.error.message, proposalRead.error.details);
    }
    const validation = validateProposalArtifact({ proposal: proposalRead.value, proposalPath: proposalRead.relativePath });
    if (!validation.ok) {
      return errorResult(validation.error.code, validation.error.message, validation.error.details);
    }
    proposal = proposalRead.value;
  }
  if (options.plan) {
    const planRead = await readWorkspaceJson({
      cwd,
      inputPath: options.plan,
      label: 'agentic human review plan',
      maxBytes: maxBytes.value
    });
    if (!planRead.ok) {
      return errorResult(planRead.error.code, planRead.error.message, planRead.error.details);
    }
    const validation = validatePlanArtifact({ plan: planRead.value, planPath: planRead.relativePath });
    if (!validation.ok) {
      return errorResult(validation.error.code, validation.error.message, validation.error.details);
    }
    plan = planRead.value;
  }
  const providerReadiness = buildAgenticProviderReadiness({
    providerId: options.provider ?? plan?.provider?.id ?? proposal?.plan_candidate?.provider_id ?? 'all',
    surface: options.surface ?? plan?.surface?.id ?? proposal?.plan_candidate?.surface_id ?? null,
    model: options.model ?? plan?.model?.id ?? proposal?.plan_candidate?.model_id ?? null,
    proposal,
    plan,
    context,
    now: materializeNow(context.now)
  });
  if (!providerReadiness.ok) {
    return errorResult(providerReadiness.error.code, providerReadiness.error.message, providerReadiness.error.details);
  }
  return {
    status: 'ok',
    data: {
      agentic_human_review_provider_readiness: providerReadiness.readiness,
      boundary: providerReadiness.readiness.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewDogfoodReadiness(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const provider = resolveProviderDescriptor(options.provider, context);
  if (!provider.ok) {
    return errorResult(provider.error.code, provider.error.message, provider.error.details);
  }
  const setupReadiness = buildAgenticDogfoodSetupReadiness({ provider: provider.provider, context });
  const readiness = redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_dogfood_readiness',
    readiness_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    generated_at: now.toISOString(),
    status: provider.provider.transport === 'provider_api'
      ? 'manual_live_dogfood_ready_when_env_configured'
      : 'local_provider_no_live_dogfood_required',
    provider: {
      id: provider.provider.id,
      kind: provider.provider.kind,
      transport: provider.provider.transport,
      capability_hash: agenticProviderCapabilityHash(provider.provider),
      manual_live_dogfood_supported: provider.provider.transport === 'provider_api'
    },
    dogfood_set: dogfoodSetSummary(),
    setup: setupReadiness,
    human_review_maturity_plan: buildHumanReviewLongitudinalDogfoodPlan({
      providerId: provider.provider.id
    }),
    required_owner_controls: [
      'choose benchmark case',
      'create proposal and plan',
      'verify transfer approval preview',
      'run with matching plan hash, exact transfer flags, --execute, and manual live dogfood opt-in'
    ],
    next_commands: {
      provider_readiness: `${CLI_NAME} agentic review provider-readiness --provider ${provider.provider.id} --json`,
      dogfood_plan: `${CLI_NAME} agentic review dogfood plan --case ${DOGFOOD_SET.case_ids[0]} --provider ${provider.provider.id} --json`
    },
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      provider_call_performed: false,
      api_call_performed: false,
      credential_values_read: false,
      credential_values_recorded: false,
      external_evidence_transfer: false
    }),
    advisory_only: true,
    gate_effect: 'none'
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_dogfood_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewDogfoodPlan(options = {}, context = {}) {
  const now = materializeNow(context.now);
  const benchmarkCase = resolveBenchmarkCase(options.case);
  if (!benchmarkCase) {
    return errorResult('AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND', 'No agentic human review benchmark case matched the requested id.', {
      case: options.case,
      available_cases: BENCHMARK_CASES.map((item) => item.case_id)
    });
  }
  const provider = resolveProviderDescriptor(options.provider, context);
  if (!provider.ok) {
    return errorResult(provider.error.code, provider.error.message, provider.error.details);
  }
  const rubricProfile = resolveRubricProfile({ profileId: options['rubric-profile'], benchmarkCase, reviewPackage: null });
  const dogfoodPlan = redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_dogfood_plan',
    dogfood_plan_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    generated_at: now.toISOString(),
    case: benchmarkCase,
    rubric_profile: rubricProfile,
    provider: {
      id: provider.provider.id,
      kind: provider.provider.kind,
      transport: provider.provider.transport,
      capability_hash: agenticProviderCapabilityHash(provider.provider)
    },
    dogfood_set: dogfoodSetSummary(),
    human_review_maturity_plan: buildHumanReviewLongitudinalDogfoodPlan({
      providerId: provider.provider.id,
      activeCaseId: benchmarkCase.case_id
    }),
    workflow: {
      proposal: `${CLI_NAME} agentic review propose --brief <human-review-request> --benchmark-case ${benchmarkCase.case_id} --provider ${provider.provider.id} --json`,
      plan: `${CLI_NAME} agentic review plan --proposal <proposal.json> --benchmark-case ${benchmarkCase.case_id} --json`,
      run: `${CLI_NAME} agentic review run --plan <plan.json> --plan-hash <sha256> <exact transfer flags> --execute --json`,
      calibrate: `${CLI_NAME} agentic review calibrate --result <result.json> --case ${benchmarkCase.case_id} --json`,
      compare: `${CLI_NAME} agentic review compare --baseline <direct-review-result.json> --candidate <tracecue-result.json> --comparison-kind direct-vs-tracecue --json`
    },
    evaluation_focus: {
      required_dimensions: benchmarkCase.required_dimensions,
      required_mentions: benchmarkCase.required_mentions,
      forbidden_claims: benchmarkCase.forbidden_claims,
      thresholds: benchmarkCase.thresholds
    },
    manual_live_provider_policy: {
      live_dogfood_env: AGENTIC_REVIEW_LIVE_DOGFOOD_ENV,
      manual_live_provider_default: false,
      ci_live_provider_default: false,
      provider_call_performed_by_plan: false,
      api_call_performed_by_plan: false,
      external_evidence_transfer_by_plan: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false
    },
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      provider_call_performed: false,
      api_call_performed: false,
      external_evidence_transfer: false
    }),
    advisory_only: true,
    gate_effect: 'none'
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_dogfood_plan: dogfoodPlan,
      boundary: dogfoodPlan.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewReportQuality(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const resultRead = await readWorkspaceJson({
    cwd,
    inputPath: options.result,
    label: 'agentic human review result',
    maxBytes: maxBytes.value
  });
  if (!resultRead.ok) {
    return errorResult(resultRead.error.code, resultRead.error.message, resultRead.error.details);
  }
  const resultValidation = validateAdvisoryResultArtifact({
    result: resultRead.value,
    resultPath: resultRead.relativePath
  });
  if (!resultValidation.ok) {
    return errorResult(resultValidation.error.code, resultValidation.error.message, resultValidation.error.details);
  }
  let execution = null;
  if (options.execution) {
    const executionRead = await readWorkspaceJson({
      cwd,
      inputPath: options.execution,
      label: 'agentic human review execution',
      maxBytes: maxBytes.value
    });
    if (!executionRead.ok) {
      return errorResult(executionRead.error.code, executionRead.error.message, executionRead.error.details);
    }
    const executionValidation = validateReportQualityExecutionMatch({
      result: resultRead.value,
      resultPath: resultRead.relativePath,
      execution: executionRead.value,
      executionPath: executionRead.relativePath
    });
    if (!executionValidation.ok) {
      return errorResult(executionValidation.error.code, executionValidation.error.message, executionValidation.error.details);
    }
    execution = executionRead.value;
  }
  let evaluatorPolicy = null;
  if (options['evaluator-policy']) {
    const policyRead = await readOptionalPolicyInput({
      cwd,
      inputPath: options['evaluator-policy'],
      label: 'agentic human review evaluator policy',
      maxBytes: maxBytes.value
    });
    if (!policyRead.ok) {
      return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
    }
    evaluatorPolicy = normalizeEvaluatorPolicy(policyRead.value);
  }
  const quality = buildReportQuality({
    result: resultRead.value,
    resultPath: resultRead.relativePath,
    execution,
    evaluatorPolicy,
    now: materializeNow(context.now)
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_report_quality: quality,
      boundary: quality.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewBenchmarkList(options = {}, context = {}) {
  const now = materializeNow(context.now);
  return {
    status: 'ok',
    data: {
      agentic_human_review_benchmark_cases: {
        schema_version: SCHEMA_VERSION,
        type: 'agentic_human_review_benchmark_cases',
        benchmark_version: HUMAN_REVIEW_CALIBRATION_VERSION,
        generated_at: now.toISOString(),
        cases: BENCHMARK_CASES.map(cloneBenchmarkCase),
        summary: {
          total: BENCHMARK_CASES.length,
          fixture_types: [...new Set(BENCHMARK_CASES.map((item) => item.fixture_type))].sort(),
          advisory_only: true,
          gate_effect: 'none'
        },
        benchmark_completion_readiness: buildBenchmarkCompletionReadiness(),
        boundary: agenticHumanReviewBoundary({ read_only: true })
      },
      boundary: agenticHumanReviewBoundary({ read_only: true })
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewBenchmarkShow(options = {}, context = {}) {
  const benchmarkCase = resolveBenchmarkCase(options.case);
  if (!benchmarkCase) {
    return errorResult('AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND', 'No agentic human review benchmark case matched the requested id.', {
      case: options.case,
      available_cases: BENCHMARK_CASES.map((item) => item.case_id)
    });
  }
  const rubricProfile = resolveRubricProfile({ profileId: benchmarkCase.rubric_profile_id, benchmarkCase, reviewPackage: null });
  return {
    status: 'ok',
    data: {
      agentic_human_review_benchmark_case: {
        schema_version: SCHEMA_VERSION,
        type: 'agentic_human_review_benchmark_case',
        benchmark_version: HUMAN_REVIEW_CALIBRATION_VERSION,
        case: benchmarkCase,
        rubric_profile: rubricProfile,
        calibration_contract: buildCalibrationContractForCase(benchmarkCase, rubricProfile),
        benchmark_completion_readiness: buildBenchmarkCompletionReadiness({ benchmarkCase, rubricProfile }),
        boundary: agenticHumanReviewBoundary({ read_only: true })
      },
      boundary: agenticHumanReviewBoundary({ read_only: true })
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewCalibrate(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const benchmarkCase = resolveBenchmarkCase(options.case);
  if (!benchmarkCase) {
    return errorResult('AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND', 'No agentic human review benchmark case matched the requested id.', {
      case: options.case,
      available_cases: BENCHMARK_CASES.map((item) => item.case_id)
    });
  }
  const resultRead = await readWorkspaceJson({
    cwd,
    inputPath: options.result,
    label: 'agentic human review result',
    maxBytes: maxBytes.value
  });
  if (!resultRead.ok) {
    return errorResult(resultRead.error.code, resultRead.error.message, resultRead.error.details);
  }
  const validation = validateAdvisoryResultArtifact({ result: resultRead.value, resultPath: resultRead.relativePath });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }
  const calibration = buildCalibrationResult({
    result: resultRead.value,
    resultPath: resultRead.relativePath,
    benchmarkCase,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_calibration: calibration,
      boundary: calibration.boundary
    },
    warnings: calibration.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewCompare(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const baselineRead = await readWorkspaceJson({
    cwd,
    inputPath: options.baseline,
    label: 'baseline agentic human review result',
    maxBytes: maxBytes.value
  });
  if (!baselineRead.ok) {
    return errorResult(baselineRead.error.code, baselineRead.error.message, baselineRead.error.details);
  }
  const candidateRead = await readWorkspaceJson({
    cwd,
    inputPath: options.candidate,
    label: 'candidate agentic human review result',
    maxBytes: maxBytes.value
  });
  if (!candidateRead.ok) {
    return errorResult(candidateRead.error.code, candidateRead.error.message, candidateRead.error.details);
  }
  for (const [label, read] of [['baseline', baselineRead], ['candidate', candidateRead]]) {
    const validation = validateAdvisoryResultArtifact({ result: read.value, resultPath: read.relativePath });
    if (!validation.ok) {
      return errorResult(validation.error.code, validation.error.message, { ...validation.error.details, role: label });
    }
  }
  const comparison = buildComparisonResult({
    baseline: baselineRead.value,
    baselinePath: baselineRead.relativePath,
    candidate: candidateRead.value,
    candidatePath: candidateRead.relativePath,
    now,
    comparisonKind: options['comparison-kind']
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_comparison: comparison,
      boundary: comparison.boundary
    },
    warnings: comparison.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewEvidenceSetValidate(options = {}, context = {}) {
  return runAgenticHumanReviewEvidenceSet(options, context, 'validate');
}

export async function runAgenticHumanReviewEvidenceSetSummarize(options = {}, context = {}) {
  return runAgenticHumanReviewEvidenceSet(options, context, 'summarize');
}

export async function runAgenticHumanReviewHumanBaselineValidate(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const baselineRead = await readWorkspaceJson({
    cwd,
    inputPath: options.input,
    label: 'agentic human review owner-labeled human baseline',
    maxBytes: maxBytes.value
  });
  if (!baselineRead.ok) {
    return errorResult(baselineRead.error.code, baselineRead.error.message, baselineRead.error.details);
  }
  const baseline = buildHumanBaselineValidation({
    input: baselineRead.value,
    inputPath: baselineRead.relativePath,
    inputHash: hashText(baselineRead.text),
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline: baseline,
      boundary: baseline.boundary
    },
    warnings: baseline.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineCompare(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const baselineRead = await readWorkspaceJson({
    cwd,
    inputPath: options.baseline,
    label: 'agentic human review owner-labeled human baseline',
    maxBytes: maxBytes.value
  });
  if (!baselineRead.ok) {
    return errorResult(baselineRead.error.code, baselineRead.error.message, baselineRead.error.details);
  }
  const resultRead = await readWorkspaceJson({
    cwd,
    inputPath: options.result,
    label: 'agentic human review candidate result',
    maxBytes: maxBytes.value
  });
  if (!resultRead.ok) {
    return errorResult(resultRead.error.code, resultRead.error.message, resultRead.error.details);
  }
  const resultValidation = validateAdvisoryResultArtifact({ result: resultRead.value, resultPath: resultRead.relativePath });
  if (!resultValidation.ok) {
    return errorResult(resultValidation.error.code, resultValidation.error.message, resultValidation.error.details);
  }
  const baseline = buildHumanBaselineValidation({
    input: baselineRead.value,
    inputPath: baselineRead.relativePath,
    inputHash: hashText(baselineRead.text),
    now
  });
  const comparison = buildHumanBaselineComparison({
    baseline,
    result: resultRead.value,
    resultPath: resultRead.relativePath,
    resultHash: hashText(resultRead.text),
    requestedCaseId: options.case,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_comparison: comparison,
      boundary: comparison.boundary
    },
    warnings: comparison.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineRegistry(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const registryRead = options.input
    ? await readWorkspaceJson({
        cwd,
        inputPath: options.input,
        label: 'agentic human review human-baseline registry',
        maxBytes: maxBytes.value
      })
    : null;
  if (registryRead && !registryRead.ok) {
    return errorResult(registryRead.error.code, registryRead.error.message, registryRead.error.details);
  }
  const registry = buildHumanBaselineRegistry({
    input: registryRead?.value ?? null,
    inputPath: registryRead?.relativePath ?? null,
    inputHash: registryRead ? hashText(registryRead.text) : null,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_registry: registry,
      boundary: registry.boundary
    },
    warnings: registry.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineOverlay(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const registryRead = options.registry
    ? await readWorkspaceJson({
        cwd,
        inputPath: options.registry,
        label: 'agentic human review human-baseline registry',
        maxBytes: maxBytes.value
      })
    : null;
  if (registryRead && !registryRead.ok) {
    return errorResult(registryRead.error.code, registryRead.error.message, registryRead.error.details);
  }
  const overlayRead = options.input
    ? await readWorkspaceJson({
        cwd,
        inputPath: options.input,
        label: 'agentic human review case overlay',
        maxBytes: maxBytes.value
      })
    : null;
  if (overlayRead && !overlayRead.ok) {
    return errorResult(overlayRead.error.code, overlayRead.error.message, overlayRead.error.details);
  }
  const registry = buildHumanBaselineRegistry({
    input: registryRead?.value ?? null,
    inputPath: registryRead?.relativePath ?? null,
    inputHash: registryRead ? hashText(registryRead.text) : null,
    now
  });
  const overlay = buildHumanBaselineCaseOverlay({
    registry,
    caseId: options.case,
    input: overlayRead?.value ?? null,
    inputPath: overlayRead?.relativePath ?? null,
    inputHash: overlayRead ? hashText(overlayRead.text) : null,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_overlay: overlay,
      boundary: overlay.boundary
    },
    warnings: overlay.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineDraft(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const overlayRead = await readWorkspaceJson({
    cwd,
    inputPath: options.overlay,
    label: 'agentic human review case overlay',
    maxBytes: maxBytes.value
  });
  if (!overlayRead.ok) {
    return errorResult(overlayRead.error.code, overlayRead.error.message, overlayRead.error.details);
  }
  const registryRead = options.registry
    ? await readWorkspaceJson({
        cwd,
        inputPath: options.registry,
        label: 'agentic human review human-baseline registry',
        maxBytes: maxBytes.value
      })
    : null;
  if (registryRead && !registryRead.ok) {
    return errorResult(registryRead.error.code, registryRead.error.message, registryRead.error.details);
  }
  const registry = buildHumanBaselineRegistry({
    input: registryRead?.value ?? null,
    inputPath: registryRead?.relativePath ?? null,
    inputHash: registryRead ? hashText(registryRead.text) : null,
    now
  });
  const draft = buildHumanBaselineDraft({
    registry,
    overlayInput: overlayRead.value,
    overlayPath: overlayRead.relativePath,
    overlayHash: hashText(overlayRead.text),
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_draft: draft,
      boundary: draft.boundary
    },
    warnings: draft.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineApproval(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const draftRead = await readWorkspaceJson({
    cwd,
    inputPath: options.draft,
    label: 'agentic human review human-baseline draft',
    maxBytes: maxBytes.value
  });
  if (!draftRead.ok) {
    return errorResult(draftRead.error.code, draftRead.error.message, draftRead.error.details);
  }
  const packet = buildHumanBaselineApprovalPacket({
    draftInput: draftRead.value,
    draftPath: draftRead.relativePath,
    draftHash: hashText(draftRead.text),
    options,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_approval_packet: packet,
      boundary: packet.boundary
    },
    warnings: packet.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewHumanBaselineClaimReadiness(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const evidenceSetRead = await readWorkspaceJson({
    cwd,
    inputPath: options['evidence-set'],
    label: 'agentic human review evidence set',
    maxBytes: maxBytes.value
  });
  if (!evidenceSetRead.ok) {
    return errorResult(evidenceSetRead.error.code, evidenceSetRead.error.message, evidenceSetRead.error.details);
  }
  const policyRead = options.policy
    ? await readWorkspaceJson({
        cwd,
        inputPath: options.policy,
        label: 'agentic human review claim policy',
        maxBytes: maxBytes.value
      })
    : null;
  if (policyRead && !policyRead.ok) {
    return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
  }
  const evidenceSet = isEvidenceSetOutput(evidenceSetRead.value)
    ? evidenceSetRead.value
    : await buildEvidenceSetSummary({
        cwd,
        manifest: evidenceSetRead.value,
        manifestPath: evidenceSetRead.relativePath,
        manifestHash: hashText(evidenceSetRead.text),
        now,
        maxBytes: maxBytes.value,
        mode: 'summarize'
      });
  const readiness = buildHumanBaselineClaimReadiness({
    evidenceSet,
    evidenceSetPath: evidenceSetRead.relativePath,
    evidenceSetHash: hashText(evidenceSetRead.text),
    policy: normalizeClaimPolicy(policyRead?.value ?? null),
    policyPath: policyRead?.relativePath ?? null,
    policyHash: policyRead ? hashText(policyRead.text) : null,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_human_baseline_claim_readiness: readiness,
      boundary: readiness.boundary
    },
    warnings: readiness.warnings,
    errors: [],
    artifacts: []
  };
}

async function runAgenticHumanReviewEvidenceSet(options = {}, context = {}, mode = 'validate') {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const manifestRead = await readWorkspaceJson({
    cwd,
    inputPath: options.input,
    label: 'agentic human review evidence set',
    maxBytes: maxBytes.value
  });
  if (!manifestRead.ok) {
    return errorResult(manifestRead.error.code, manifestRead.error.message, manifestRead.error.details);
  }
  const evidenceSet = await buildEvidenceSetSummary({
    cwd,
    manifest: manifestRead.value,
    manifestPath: manifestRead.relativePath,
    manifestHash: hashText(manifestRead.text),
    now,
    maxBytes: maxBytes.value,
    mode
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_evidence_set: evidenceSet,
      boundary: evidenceSet.boundary
    },
    warnings: evidenceSet.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewCompareBatch(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const datasetRead = await readWorkspaceJson({
    cwd,
    inputPath: options.dataset,
    label: 'agentic human review batch comparison dataset',
    maxBytes: maxBytes.value
  });
  if (!datasetRead.ok) {
    return errorResult(datasetRead.error.code, datasetRead.error.message, datasetRead.error.details);
  }
  const batch = await buildBatchComparison({
    cwd,
    dataset: datasetRead.value,
    datasetPath: datasetRead.relativePath,
    datasetHash: hashText(datasetRead.text),
    now,
    maxBytes: maxBytes.value
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_batch_comparison: batch,
      boundary: batch.boundary
    },
    warnings: batch.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewEvaluatorPolicy(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const policyRead = options.input
    ? await readOptionalPolicyInput({
        cwd,
        inputPath: options.input,
        label: 'agentic human review evaluator policy',
        maxBytes: maxBytes.value
      })
    : { ok: true, value: null, relativePath: null, hash: null };
  if (!policyRead.ok) {
    return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
  }
  const policy = normalizeEvaluatorPolicy(policyRead.value);
  const report = {
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_evaluator_policy',
    policy_version: HUMAN_REVIEW_EVALUATOR_POLICY_VERSION,
    generated_at: now.toISOString(),
    input_path: policyRead.relativePath,
    input_hash: policyRead.hash,
    policy,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  };
  return {
    status: 'ok',
    data: {
      agentic_human_review_evaluator_policy: report,
      boundary: report.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewXhighPlan(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const planRead = await readWorkspaceJson({
    cwd,
    inputPath: options.plan,
    label: 'agentic human review xhigh plan input',
    maxBytes: maxBytes.value
  });
  if (!planRead.ok) {
    return errorResult(planRead.error.code, planRead.error.message, planRead.error.details);
  }
  const validation = validatePlanArtifact({ plan: planRead.value, planPath: planRead.relativePath });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }
  const xhighPlan = buildXhighRoundPlanReport({
    plan: planRead.value,
    planPath: planRead.relativePath,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_xhigh_plan: xhighPlan,
      boundary: xhighPlan.boundary
    },
    warnings: xhighPlan.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewXhighSimulate(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const planRead = await readWorkspaceJson({
    cwd,
    inputPath: options.plan,
    label: 'agentic human review xhigh plan input',
    maxBytes: maxBytes.value
  });
  if (!planRead.ok) {
    return errorResult(planRead.error.code, planRead.error.message, planRead.error.details);
  }
  const validation = validatePlanArtifact({ plan: planRead.value, planPath: planRead.relativePath });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }
  const roundInputRead = await readWorkspaceJson({
    cwd,
    inputPath: options['round-input'],
    label: 'agentic human review xhigh round input',
    maxBytes: maxBytes.value
  });
  if (!roundInputRead.ok) {
    return errorResult(roundInputRead.error.code, roundInputRead.error.message, roundInputRead.error.details);
  }
  const simulation = buildXhighSimulationReport({
    plan: planRead.value,
    planPath: planRead.relativePath,
    roundInput: roundInputRead.value,
    roundInputPath: roundInputRead.relativePath,
    roundInputHash: hashText(roundInputRead.text),
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_xhigh_simulation: simulation,
      boundary: simulation.boundary
    },
    warnings: simulation.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewLongitudinalQuality(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const manifestRead = await readWorkspaceJson({
    cwd,
    inputPath: options['evidence-set'],
    label: 'agentic human review longitudinal evidence set',
    maxBytes: maxBytes.value
  });
  if (!manifestRead.ok) {
    return errorResult(manifestRead.error.code, manifestRead.error.message, manifestRead.error.details);
  }
  const evidenceSet = await buildEvidenceSetSummary({
    cwd,
    manifest: manifestRead.value,
    manifestPath: manifestRead.relativePath,
    manifestHash: hashText(manifestRead.text),
    now,
    maxBytes: maxBytes.value,
    mode: 'longitudinal'
  });
  const longitudinal = buildLongitudinalQualityRollup({
    evidenceSet,
    evidenceSetPath: manifestRead.relativePath,
    evidenceSetHash: hashText(manifestRead.text),
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_longitudinal_quality: longitudinal,
      boundary: longitudinal.boundary
    },
    warnings: longitudinal.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewClaimPolicy(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const policyRead = options.input
    ? await readOptionalPolicyInput({
        cwd,
        inputPath: options.input,
        label: 'agentic human review claim policy',
        maxBytes: maxBytes.value
      })
    : { ok: true, value: null, relativePath: null, hash: null };
  if (!policyRead.ok) {
    return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
  }
  const policyReport = {
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_claim_policy',
    policy_version: HUMAN_REVIEW_CLAIM_POLICY_VERSION,
    generated_at: now.toISOString(),
    input_path: policyRead.relativePath,
    input_hash: policyRead.hash,
    policy: normalizeClaimPolicy(policyRead.value),
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  };
  return {
    status: 'ok',
    data: {
      agentic_human_review_claim_policy: policyReport,
      boundary: policyReport.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runAgenticHumanReviewClaimStandardGate(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const evidenceSetRead = await readWorkspaceJson({
    cwd,
    inputPath: options['evidence-set'],
    label: 'agentic human review claim standard evidence set',
    maxBytes: maxBytes.value
  });
  if (!evidenceSetRead.ok) {
    return errorResult(evidenceSetRead.error.code, evidenceSetRead.error.message, evidenceSetRead.error.details);
  }
  const policyRead = options.policy
    ? await readOptionalPolicyInput({
        cwd,
        inputPath: options.policy,
        label: 'agentic human review claim standard policy',
        maxBytes: maxBytes.value
      })
    : { ok: true, value: null, relativePath: null, hash: null };
  if (!policyRead.ok) {
    return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
  }
  const evidenceSet = isEvidenceSetOutput(evidenceSetRead.value)
    ? normalizeEvidenceSetOutput(evidenceSetRead.value)
    : await buildEvidenceSetSummary({
        cwd,
        manifest: evidenceSetRead.value,
        manifestPath: evidenceSetRead.relativePath,
        manifestHash: hashText(evidenceSetRead.text),
        now,
        maxBytes: maxBytes.value,
        mode: 'claim-standard-gate'
      });
  const policy = normalizeClaimPolicy(policyRead.value);
  const readiness = buildHumanBaselineClaimReadiness({
    evidenceSet,
    evidenceSetPath: evidenceSetRead.relativePath,
    evidenceSetHash: hashText(evidenceSetRead.text),
    policy,
    policyPath: policyRead.relativePath,
    policyHash: policyRead.hash,
    now
  });
  const longitudinal = buildLongitudinalQualityRollup({
    evidenceSet,
    evidenceSetPath: evidenceSetRead.relativePath,
    evidenceSetHash: hashText(evidenceSetRead.text),
    now
  });
  const claimAuditSummary = await buildClaimStandardClaimAuditSummary({
    cwd,
    evidenceSet,
    policy,
    now,
    maxBytes: maxBytes.value
  });
  const gate = buildClaimStandardGate({
    evidenceSet,
    evidenceSetPath: evidenceSetRead.relativePath,
    evidenceSetHash: hashText(evidenceSetRead.text),
    policy,
    policyInput: policyRead.value,
    policyPath: policyRead.relativePath,
    policyHash: policyRead.hash,
    readiness,
    longitudinal,
    claimAuditSummary,
    now
  });
  return {
    status: gate.passed ? 'ok' : 'error',
    data: {
      agentic_human_review_claim_standard_gate: gate,
      boundary: gate.boundary
    },
    warnings: gate.warnings,
    errors: gate.passed
      ? []
      : [{
          code: 'AHR_CLAIM_STANDARD_GATE_FAILED',
          message: 'The Agentic Human Review claim-standard gate did not pass.',
          details: { status: gate.status, blocker_count: gate.blockers.length }
        }],
    artifacts: []
  };
}

export async function runAgenticHumanReviewClaimAudit(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const now = materializeNow(context.now);
  const maxBytes = parseMaxBytes(options['max-bytes']);
  if (!maxBytes.ok) {
    return errorResult('AGENTIC_REVIEW_INVALID_MAX_BYTES', maxBytes.message, { max_bytes: options['max-bytes'] });
  }
  const resultRead = await readWorkspaceJson({
    cwd,
    inputPath: options.result,
    label: 'agentic human review claim audit result',
    maxBytes: maxBytes.value
  });
  if (!resultRead.ok) {
    return errorResult(resultRead.error.code, resultRead.error.message, resultRead.error.details);
  }
  const validation = validateAdvisoryResultArtifact({ result: resultRead.value, resultPath: resultRead.relativePath });
  if (!validation.ok) {
    return errorResult(validation.error.code, validation.error.message, validation.error.details);
  }
  const policyRead = options.policy
    ? await readOptionalPolicyInput({
        cwd,
        inputPath: options.policy,
        label: 'agentic human review claim policy',
        maxBytes: maxBytes.value
      })
    : { ok: true, value: null, relativePath: null, hash: null };
  if (!policyRead.ok) {
    return errorResult(policyRead.error.code, policyRead.error.message, policyRead.error.details);
  }
  const audit = buildClaimAudit({
    result: resultRead.value,
    resultPath: resultRead.relativePath,
    resultHash: hashText(resultRead.text),
    policy: normalizeClaimPolicy(policyRead.value),
    policyPath: policyRead.relativePath,
    policyHash: policyRead.hash,
    now
  });
  return {
    status: 'ok',
    data: {
      agentic_human_review_claim_audit: audit,
      boundary: audit.boundary
    },
    warnings: audit.warnings,
    errors: [],
    artifacts: []
  };
}

async function readOptionalPolicyInput({ cwd, inputPath, label, maxBytes }) {
  const read = await readWorkspaceJson({ cwd, inputPath, label, maxBytes: maxBytes ?? DEFAULT_MAX_BYTES });
  if (!read.ok) {
    return read;
  }
  return {
    ok: true,
    value: read.value,
    relativePath: read.relativePath,
    hash: hashText(read.text)
  };
}

async function buildEvidenceSetSummary({ cwd, manifest, manifestPath, manifestHash, now, maxBytes, mode }) {
  const warnings = [];
  const resultEntries = evidenceSetEntries(manifest, 'results', ['result_path', 'path', 'artifact_path']);
  const calibrationEntries = evidenceSetEntries(manifest, 'calibrations', ['calibration_path', 'path', 'artifact_path']);
  const comparisonEntries = evidenceSetEntries(manifest, 'comparisons', ['comparison_path', 'path', 'artifact_path']);
  const humanBaselineEntries = evidenceSetEntries(manifest, 'human_baselines', ['baseline_path', 'human_baseline_path', 'owner_label_set_path', 'path', 'artifact_path']);
  const results = [];
  for (const entry of resultEntries) {
    const resultRead = await readEvidenceSetArtifact({ cwd, entry, label: 'agentic human review evidence-set result', maxBytes });
    if (!resultRead.ok) {
      warnings.push(resultRead.warning);
      continue;
    }
    const validation = validateAdvisoryResultArtifact({ result: resultRead.value, resultPath: resultRead.relativePath });
    if (!validation.ok) {
      warnings.push({
        code: validation.error.code,
        message: validation.error.message,
        details: validation.error.details
      });
      continue;
    }
    results.push(evidenceSetResultRecord({
      entry,
      result: resultRead.value,
      resultPath: resultRead.relativePath,
      resultHash: hashText(resultRead.text)
    }));
  }
  const calibrations = [];
  for (const entry of calibrationEntries) {
    const calibrationRead = await readEvidenceSetArtifact({
      cwd,
      entry,
      label: 'agentic human review evidence-set calibration',
      maxBytes,
      artifactDataKeys: EVIDENCE_SET_ARTIFACT_DATA_KEYS.calibration
    });
    if (!calibrationRead.ok) {
      warnings.push(calibrationRead.warning);
      continue;
    }
    calibrations.push(evidenceSetCalibrationRecord({
      entry,
      calibration: calibrationRead.value,
      calibrationPath: calibrationRead.relativePath,
      calibrationHash: hashText(calibrationRead.text)
    }));
  }
  const comparisons = [];
  for (const entry of comparisonEntries) {
    const comparisonRead = await readEvidenceSetArtifact({
      cwd,
      entry,
      label: 'agentic human review evidence-set comparison',
      maxBytes,
      artifactDataKeys: EVIDENCE_SET_ARTIFACT_DATA_KEYS.comparison
    });
    if (!comparisonRead.ok) {
      warnings.push(comparisonRead.warning);
      continue;
    }
    comparisons.push(evidenceSetComparisonRecord({
      entry,
      comparison: comparisonRead.value,
      comparisonPath: comparisonRead.relativePath,
      comparisonHash: hashText(comparisonRead.text)
    }));
  }
  const humanBaselines = [];
  for (const entry of humanBaselineEntries) {
    const baselineRead = await readEvidenceSetArtifact({
      cwd,
      entry,
      label: 'agentic human review evidence-set human baseline',
      maxBytes,
      artifactDataKeys: EVIDENCE_SET_ARTIFACT_DATA_KEYS.humanBaseline
    });
    if (!baselineRead.ok) {
      warnings.push(baselineRead.warning);
      continue;
    }
    const baseline = buildHumanBaselineValidation({
      input: baselineRead.value,
      inputPath: baselineRead.relativePath,
      inputHash: hashText(baselineRead.text),
      now
    });
    humanBaselines.push(evidenceSetHumanBaselineRecord({
      entry,
      baseline
    }));
    if (!baseline.validation.owner_labeled_baseline_verified) {
      warnings.push({
        code: 'AHR_EVIDENCE_SET_HUMAN_BASELINE_INVALID',
        message: 'An owner-labeled human baseline did not satisfy the validation contract.',
        details: {
          path: baseline.input_path,
          case_id: baseline.baseline.case_id,
          warning_codes: baseline.warnings.map((warning) => warning.code)
        }
      });
    }
  }
  const summary = evidenceSetCoverageSummary({ results, calibrations, comparisons, humanBaselines });
  warnings.push(...evidenceSetCoverageWarnings(summary));
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_evidence_set',
    evidence_set_version: HUMAN_REVIEW_EVIDENCE_SET_VERSION,
    generated_at: now.toISOString(),
    mode,
    input_path: manifestPath,
    input_hash: manifestHash,
    manifest: {
      id: stringOrNull(manifest.id ?? manifest.set_id),
      declared_type: stringOrNull(manifest.type),
      declared_version: stringOrNull(manifest.version ?? manifest.set_version)
    },
    summary,
    results,
    calibrations,
    comparisons,
    human_baselines: humanBaselines,
    validation: {
      valid_json: true,
      referenced_result_count: resultEntries.length,
      readable_result_count: results.length,
      referenced_calibration_count: calibrationEntries.length,
      readable_calibration_count: calibrations.length,
      referenced_comparison_count: comparisonEntries.length,
      readable_comparison_count: comparisons.length,
      referenced_human_baseline_count: humanBaselineEntries.length,
      readable_human_baseline_count: humanBaselines.length,
      complete_for_human_equivalence_claim: false,
      reason: 'Evidence sets organize owner-review evidence, but do not authorize human-equivalent or human-superior claims.'
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function evidenceSetEntries(manifest, key, pathKeys) {
  const direct = Array.isArray(manifest?.[key]) ? manifest[key] : [];
  const aliases = key === 'human_baselines'
    ? [
        ...(Array.isArray(manifest?.baselines) ? manifest.baselines : []),
        ...(Array.isArray(manifest?.owner_label_sets) ? manifest.owner_label_sets : [])
      ]
    : [];
  const artifacts = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.filter((artifact) => {
        const kind = String(artifact?.kind ?? artifact?.type ?? '').replace(/-/g, '_');
        return key === 'results'
          ? /result|advisory/.test(kind)
          : key === 'calibrations'
            ? /calibration/.test(kind)
            : key === 'human_baselines'
              ? /human.*baseline|owner.*label|baseline/.test(kind)
              : /comparison/.test(kind);
      })
    : [];
  return [...direct, ...aliases, ...artifacts].map((entry) => ({
    ...entry,
    path: firstPresentPath(entry, pathKeys)
  })).filter((entry) => entry.path);
}

function firstPresentPath(entry, keys) {
  for (const key of keys) {
    if (entry?.[key]) {
      return entry[key];
    }
  }
  return null;
}

async function readEvidenceSetArtifact({ cwd, entry, label, maxBytes, artifactDataKeys = [] }) {
  const read = await readWorkspaceJson({
    cwd,
    inputPath: entry.path,
    label,
    maxBytes
  });
  if (read.ok) {
    return {
      ...read,
      value: unwrapEvidenceSetRuntimeResultArtifact(read.value, artifactDataKeys)
    };
  }
  return {
    ok: false,
    warning: {
      code: read.error.code,
      message: read.error.message,
      details: read.error.details
    }
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapEvidenceSetRuntimeResultArtifact(value, dataKeys = []) {
  if (!isPlainObject(value) || !isPlainObject(value.data)) {
    return value;
  }
  const looksLikeCliRuntimeResult = typeof value.command === 'string'
    && typeof value.status === 'string'
    && Array.isArray(value.warnings)
    && Array.isArray(value.errors)
    && Array.isArray(value.artifacts);
  const looksLikeApiRuntimeResult = typeof value.status === 'string'
    && Array.isArray(value.warnings)
    && Array.isArray(value.errors)
    && Array.isArray(value.artifacts);
  if (!looksLikeCliRuntimeResult && !looksLikeApiRuntimeResult) {
    return value;
  }
  for (const key of dataKeys) {
    const nested = value.data[key];
    if (isPlainObject(nested)) {
      return nested;
    }
  }
  return value;
}

function evidenceSetResultRecord({ entry, result, resultPath, resultHash }) {
  const effort = normalizeObservedReviewEffort(entry.effort ?? result.agentic_human_review_advisory?.review_effort);
  const caseId = entry.case_id
    ?? result.calibration_metadata?.benchmark_case_id
    ?? result.benchmark_requirement_coverage?.case_id
    ?? result.benchmark_completion_readiness?.active_case_id
    ?? result.dogfood_metadata?.case_id
    ?? null;
  const proofEligibility = resultProofEligibility({
    entry,
    result,
    providerId: entry.provider_id ?? result.provider?.id ?? null
  });
  return {
    path: resultPath,
    hash: resultHash,
    result_id: result.id ?? null,
    effort,
    case_id: caseId,
    fixture_type: entry.fixture_type ?? result.benchmark_requirement_coverage?.fixture_type ?? result.benchmark_completion_readiness?.active_fixture_type ?? null,
    provider_id: entry.provider_id ?? result.provider?.id ?? null,
    model_id: entry.model_id ?? result.model?.id ?? null,
    api_call_performed: Boolean(result.execution?.api_call_performed),
    external_evidence_transfer: Boolean(result.execution?.external_evidence_transfer),
    origin_kind: proofEligibility.origin_kind,
    provider_execution_class: proofEligibility.provider_execution_class,
    claim_numerator_eligible: proofEligibility.claim_numerator_eligible,
    strict_claim_numerator_eligible: proofEligibility.strict_claim_numerator_eligible,
    mechanical_contract_satisfied: proofEligibility.mechanical_contract_satisfied,
    strict_eligibility_checks: proofEligibility.strict_eligibility_checks,
    proof_eligible: false,
    excluded_from_claim_reason: proofEligibility.excluded_from_claim_reason,
    xhigh_completion_status: result.xhigh_multi_round_review?.status ?? null,
    calibration_status: result.review_quality_evaluation?.status ?? null,
    benchmark_requirement_coverage_status: result.benchmark_requirement_coverage?.status ?? 'not_enabled',
    quality_scores: comparableQualityScores(result),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function resultProofEligibility({ entry, result, providerId }) {
  const apiCallPerformed = Boolean(result.execution?.api_call_performed);
  const externalEvidenceTransfer = Boolean(result.execution?.external_evidence_transfer);
  const provider = stringOrNull(providerId);
  const originKind = stringOrNull(entry.origin_kind ?? entry.fixture_kind ?? result.origin_kind)
    ?? (provider === 'fake-agent' ? 'deterministic_fake_provider' : null)
    ?? (provider === 'injected-agent' ? 'injected_local_runner' : null)
    ?? (apiCallPerformed && externalEvidenceTransfer ? 'real_provider_dogfood' : 'local_or_fixture_result');
  const fakeOrLocal = originKind.includes('fake')
    || originKind.includes('fixture')
    || originKind.includes('synthetic')
    || originKind.includes('injected')
    || originKind.includes('local_or_fixture')
    || provider === 'fake-agent'
    || provider === 'injected-agent';
  const reviewEffort = normalizeObservedReviewEffort(entry.effort ?? result.agentic_human_review_advisory?.review_effort);
  const xhighRequired = reviewEffort === 'xhigh';
  const xhighComplete = !xhighRequired || result.xhigh_multi_round_review?.status === 'complete';
  const roleCoverageSatisfied = Number(result.role_instruction_coverage?.reported_role_count ?? 0) > 0
    || Number(result.role_instruction_coverage?.coverage_score ?? 0) > 0;
  const advisoryOnly = result.boundary?.advisory_only !== false
    && result.advisory_only !== false
    && result.agentic_human_review_advisory?.gate_effect === 'none'
    && (result.gate_effect ?? 'none') === 'none';
  const noRawProviderResponse = result.execution?.raw_provider_response_stored !== true
    && result.boundary?.raw_provider_response_stored !== true;
  const noCredentialValues = result.execution?.credential_values_recorded !== true
    && result.boundary?.credential_values_recorded !== true;
  const planHashPresent = Boolean(result.agentic_human_review_advisory?.plan_hash ?? result.plan_hash ?? entry.plan_hash);
  const benchmarkReady = result.benchmark_requirement_coverage?.enabled === true
    ? result.benchmark_requirement_coverage?.status === 'passed'
      && Number(result.benchmark_requirement_coverage?.summary?.evidence_ref_backed_record_score ?? 0) === 1
    : true;
  const mechanicalContractSatisfied = roleCoverageSatisfied && xhighComplete && benchmarkReady;
  const strictChecks = {
    api_call_performed: apiCallPerformed,
    external_evidence_transfer: externalEvidenceTransfer,
    non_synthetic_origin: !fakeOrLocal,
    advisory_only: advisoryOnly,
    no_raw_provider_response: noRawProviderResponse,
    no_credential_values: noCredentialValues,
    plan_hash_present: planHashPresent,
    role_contract_satisfied: roleCoverageSatisfied,
    xhigh_contract_satisfied: xhighComplete,
    benchmark_contract_satisfied: benchmarkReady,
    mechanical_contract_satisfied: mechanicalContractSatisfied
  };
  const strictClaimNumeratorEligible = Object.values(strictChecks).every(Boolean);
  const claimNumeratorEligible = strictClaimNumeratorEligible;
  const failedChecks = Object.entries(strictChecks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  return {
    origin_kind: originKind,
    provider_execution_class: claimNumeratorEligible ? 'real_external_provider' : (fakeOrLocal ? 'synthetic_or_local' : 'not_external_provider'),
    claim_numerator_eligible: claimNumeratorEligible,
    strict_claim_numerator_eligible: strictClaimNumeratorEligible,
    mechanical_contract_satisfied: mechanicalContractSatisfied,
    strict_eligibility_checks: strictChecks,
    excluded_from_claim_reason: claimNumeratorEligible
      ? null
      : `Only real external provider dogfood results with approved transfer and satisfied TraceCue mechanical contracts can count toward a future claim numerator. Failed check(s): ${failedChecks.join(', ')}.`
  };
}

function evidenceSetCalibrationRecord({ entry, calibration, calibrationPath, calibrationHash }) {
  return {
    path: calibrationPath,
    hash: calibrationHash,
    result_path: calibration.result_path ?? entry.result_path ?? null,
    result_id: calibration.result_id ?? null,
    case_id: calibration.case_id ?? entry.case_id ?? null,
    effort: normalizeObservedReviewEffort(calibration.effort ?? entry.effort),
    passed: calibration.passed === true,
    scores: calibration.scores ?? {},
    warning_count: Array.isArray(calibration.warnings) ? calibration.warnings.length : 0,
    advisory_only: calibration.advisory_only !== false,
    gate_effect: calibration.gate_effect ?? 'none'
  };
}

function evidenceSetComparisonRecord({ entry, comparison, comparisonPath, comparisonHash }) {
  const caseId = entry.case_id
    ?? comparison.baseline?.case_id
    ?? comparison.candidate?.case_id
    ?? null;
  return {
    path: comparisonPath,
    hash: comparisonHash,
    comparison_kind: comparison.comparison_kind ?? entry.comparison_kind ?? null,
    case_id: caseId,
    baseline_case_id: comparison.baseline?.case_id ?? null,
    candidate_case_id: comparison.candidate?.case_id ?? null,
    baseline_result_id: comparison.baseline?.result_id ?? null,
    candidate_result_id: comparison.candidate?.result_id ?? null,
    deltas: comparison.deltas ?? {},
    regressed_score_count: Number(comparison.summary?.regressed_score_count ?? 0),
    improved_score_count: Number(comparison.summary?.improved_score_count ?? 0),
    human_baseline_overall_alignment_score: Number(comparison.scores?.overall_alignment_score ?? 0),
    human_baseline_ready_for_owner_review: comparison.summary?.ready_for_owner_review === true,
    human_baseline_candidate_matches_owner_baseline: comparison.summary?.candidate_matches_owner_baseline === true,
    human_baseline_owner_labeled_baseline_verified: comparison.summary?.owner_labeled_baseline_verified === true
      || comparison.baseline?.owner_labeled_baseline_verified === true,
    candidate_mechanical_contract_satisfied: comparison.summary?.candidate_mechanical_contract_satisfied === true
      || comparison.candidate?.mechanical_contract_satisfied === true,
    human_baseline_must_not_miss_miss_count: Number(comparison.scores?.must_not_miss_miss_count ?? 0),
    human_baseline_miss_count: Number(comparison.scores?.miss_count ?? comparison.matches?.classifications?.misses?.length ?? 0),
    human_baseline_over_report_count: Number(comparison.scores?.over_report_count ?? comparison.matches?.classifications?.over_reports?.length ?? 0),
    human_baseline_severity_mismatch_count: Number(comparison.scores?.severity_mismatch_count ?? comparison.matches?.classifications?.severity_mismatches?.length ?? 0),
    human_baseline_insufficient_evidence_count: Number(comparison.scores?.insufficient_evidence_count ?? comparison.matches?.classifications?.insufficient_evidence?.length ?? 0),
    advisory_only: comparison.advisory_only !== false,
    gate_effect: comparison.gate_effect ?? 'none'
  };
}

function evidenceSetHumanBaselineRecord({ entry, baseline }) {
  return {
    path: baseline.input_path,
    hash: baseline.input_hash,
    baseline_id: baseline.baseline.baseline_id,
    case_id: entry.case_id ?? baseline.baseline.case_id,
    fixture_type: entry.fixture_type ?? baseline.baseline.fixture_type,
    owner_labeled: baseline.validation.owner_labeled === true,
    owner_labeled_baseline_verified: baseline.validation.owner_labeled_baseline_verified === true,
    reviewer_id: baseline.baseline.owner_label_set.reviewer_id,
    label_count: baseline.summary.label_count,
    evidence_ref_count: baseline.summary.evidence_ref_count,
    required_dimension_count: baseline.summary.required_dimension_count,
    required_mention_count: baseline.summary.required_mention_count,
    warning_count: baseline.warnings.length,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function evidenceSetCoverageSummary({ results, calibrations, comparisons, humanBaselines = [] }) {
  const observedEfforts = uniqueSorted(results.map((result) => result.effort).filter(Boolean));
  const observedCaseIds = uniqueSorted([
    ...results.map((result) => result.case_id),
    ...calibrations.map((calibration) => calibration.case_id)
  ].filter(Boolean));
  const observedComparisonKinds = uniqueSorted(comparisons.map((comparison) => comparison.comparison_kind).filter(Boolean));
  const claimEligibleResultIds = new Set(results
    .filter((result) => result.claim_numerator_eligible)
    .map((result) => result.result_id)
    .filter(Boolean));
  const humanBaselineComparisonCount = comparisons.filter((comparison) => comparison.comparison_kind === 'owner-labeled-human-baseline').length;
  const humanBaselineComparisonReadyCount = comparisons.filter((comparison) => comparison.human_baseline_ready_for_owner_review && claimEligibleResultIds.has(comparison.candidate_result_id)).length;
  const readyHumanBaselineComparisonCaseIds = uniqueSorted(comparisons
    .filter((comparison) => comparison.comparison_kind === 'owner-labeled-human-baseline'
      && comparison.human_baseline_ready_for_owner_review
      && claimEligibleResultIds.has(comparison.candidate_result_id))
    .map((comparison) => comparison.case_id ?? comparison.baseline_case_id ?? comparison.candidate_case_id)
    .filter(Boolean));
  const requiredBenchmarkCaseIds = BENCHMARK_CASES.map((item) => item.case_id);
  const realProviderClaimNumeratorMatrix = buildCaseEffortMatrix({
    records: results.filter((result) => result.claim_numerator_eligible),
    requiredCaseIds: requiredBenchmarkCaseIds,
    requiredEfforts: HUMAN_REVIEW_CLAIM_EFFORTS
  });
  const mechanicalContractMatrix = buildCaseEffortMatrix({
    records: results.filter((result) => result.mechanical_contract_satisfied),
    requiredCaseIds: requiredBenchmarkCaseIds,
    requiredEfforts: HUMAN_REVIEW_CLAIM_EFFORTS
  });
  const calibrationPassMatrix = buildCalibrationPassMatrix({
    results,
    calibrations,
    requiredCaseIds: requiredBenchmarkCaseIds,
    requiredEfforts: HUMAN_REVIEW_CLAIM_EFFORTS
  });
  const comparisonCaseMatrix = buildComparisonCaseMatrix({
    comparisons,
    requiredCaseIds: requiredBenchmarkCaseIds
  });
  const proofReadinessBlockers = buildProofReadinessBlockers({
    results,
    calibrations,
    requiredCaseIds: requiredBenchmarkCaseIds,
    requiredEfforts: HUMAN_REVIEW_CLAIM_EFFORTS,
    comparisonCaseMatrix
  });
  const observedHumanBaselineCaseIds = uniqueSorted(humanBaselines
    .filter((baseline) => baseline.owner_labeled_baseline_verified)
    .map((baseline) => baseline.case_id)
    .filter(Boolean));
  const observedReadyHumanBaselineCaseIds = observedHumanBaselineCaseIds.filter((caseId) => readyHumanBaselineComparisonCaseIds.includes(caseId));
  const missingEfforts = HUMAN_REVIEW_CLAIM_EFFORTS.filter((effort) => !observedEfforts.includes(effort));
  const missingCaseIds = requiredBenchmarkCaseIds.filter((caseId) => !observedCaseIds.includes(caseId));
  const missingComparisonKinds = HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS.filter((kind) => !observedComparisonKinds.includes(kind));
  const missingHumanBaselineCaseIds = requiredBenchmarkCaseIds.filter((caseId) => !observedHumanBaselineCaseIds.includes(caseId));
  const missingReadyHumanBaselineComparisonCaseIds = requiredBenchmarkCaseIds.filter((caseId) => !readyHumanBaselineComparisonCaseIds.includes(caseId));
  const qualityScores = results.map((result) => result.quality_scores);
  const realProviderClaimNumeratorRequiredCount = requiredBenchmarkCaseIds.length * HUMAN_REVIEW_CLAIM_EFFORTS.length;
  const claimNumeratorEligibleResultCount = results.filter((result) => result.claim_numerator_eligible).length;
  const mechanicalContractSatisfiedResultCount = results.filter((result) => result.mechanical_contract_satisfied).length;
  return {
    result_count: results.length,
    calibration_count: calibrations.length,
    comparison_count: comparisons.length,
    human_baseline_comparison_count: humanBaselineComparisonCount,
    human_baseline_comparison_ready_count: humanBaselineComparisonReadyCount,
    human_baseline_comparison_ready_case_count: readyHumanBaselineComparisonCaseIds.length,
    human_baseline_count: humanBaselines.length,
    owner_labeled_baseline_count: humanBaselines.filter((baseline) => baseline.owner_labeled_baseline_verified).length,
    claim_numerator_eligible_result_count: claimNumeratorEligibleResultCount,
    strict_claim_numerator_eligible_result_count: results.filter((result) => result.strict_claim_numerator_eligible).length,
    mechanical_contract_satisfied_result_count: mechanicalContractSatisfiedResultCount,
    claim_excluded_result_count: results.filter((result) => !result.claim_numerator_eligible).length,
    real_provider_claim_numerator_required_count: realProviderClaimNumeratorRequiredCount,
    real_provider_claim_numerator_matrix: realProviderClaimNumeratorMatrix,
    missing_real_provider_claim_numerator_case_efforts: realProviderClaimNumeratorMatrix.missing_case_efforts,
    mechanical_contract_matrix: mechanicalContractMatrix,
    mechanical_contract_matrix_complete: mechanicalContractMatrix.complete,
    missing_mechanical_contract_case_efforts: mechanicalContractMatrix.missing_case_efforts,
    required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
    observed_efforts: observedEfforts,
    missing_efforts: missingEfforts,
    required_benchmark_case_ids: requiredBenchmarkCaseIds,
    observed_benchmark_case_ids: observedCaseIds,
    missing_benchmark_case_ids: missingCaseIds,
    owner_labeled_baseline_required: true,
    observed_human_baseline_case_ids: observedHumanBaselineCaseIds,
    missing_human_baseline_case_ids: missingHumanBaselineCaseIds,
    ready_human_baseline_comparison_case_ids: readyHumanBaselineComparisonCaseIds,
    observed_ready_human_baseline_case_ids: observedReadyHumanBaselineCaseIds,
    missing_human_baseline_comparison_case_ids: missingReadyHumanBaselineComparisonCaseIds,
    required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    observed_comparison_kinds: observedComparisonKinds,
    missing_comparison_kinds: missingComparisonKinds,
    comparison_case_matrix: comparisonCaseMatrix,
    missing_comparison_case_matrix: comparisonCaseMatrix.missing_case_comparisons,
    missing_direct_vs_tracecue_case_ids: comparisonCaseMatrix.rows.find((row) => row.comparison_kind === 'direct-vs-tracecue')?.missing_case_ids ?? requiredBenchmarkCaseIds,
    calibration_pass_count: calibrations.filter((calibration) => calibration.passed).length,
    calibration_required_count: realProviderClaimNumeratorRequiredCount,
    calibration_pass_matrix: calibrationPassMatrix,
    calibration_pass_matrix_complete: calibrationPassMatrix.complete,
    missing_calibration_case_efforts: calibrationPassMatrix.missing_case_efforts,
    proof_readiness_blockers: proofReadinessBlockers,
    missing_result_case_efforts: proofReadinessBlockers.missing_result_case_efforts,
    mechanical_incomplete_case_efforts: proofReadinessBlockers.mechanical_incomplete_case_efforts,
    calibration_failed_case_efforts: proofReadinessBlockers.calibration_failed_case_efforts,
    comparison_missing_case_matrix: proofReadinessBlockers.comparison_missing_case_matrix,
    xhigh_complete_count: results.filter((result) => result.xhigh_completion_status === 'complete').length,
    xhigh_mechanically_complete_count: results.filter((result) => result.effort === 'xhigh' && result.mechanical_contract_satisfied).length,
    live_provider_dogfood_count: results.filter((result) => result.api_call_performed && result.external_evidence_transfer).length,
    average_quality_scores: averageQualityScores(qualityScores),
    real_provider_claim_numerator_matrix_complete: realProviderClaimNumeratorMatrix.complete,
    complete_for_owner_labeled_human_baseline_review: missingHumanBaselineCaseIds.length === 0 && missingReadyHumanBaselineComparisonCaseIds.length === 0,
    complete_for_longitudinal_owner_review: missingEfforts.length === 0
      && missingCaseIds.length === 0
      && missingComparisonKinds.length === 0
      && comparisonCaseMatrix.complete
      && missingHumanBaselineCaseIds.length === 0
      && missingReadyHumanBaselineComparisonCaseIds.length === 0
      && realProviderClaimNumeratorMatrix.complete
      && mechanicalContractMatrix.complete
      && calibrationPassMatrix.complete
      && results.length > 1,
    human_equivalent_claim_allowed: false,
    human_superior_claim_allowed: false
  };
}

function buildProofReadinessBlockers({ results, calibrations, requiredCaseIds, requiredEfforts, comparisonCaseMatrix }) {
  const resultCells = new Set(results
    .filter((result) => result.case_id && result.effort)
    .map((result) => `${result.case_id}\u0000${result.effort}`));
  const mechanicalCells = new Set(results
    .filter((result) => result.case_id && result.effort && result.mechanical_contract_satisfied)
    .map((result) => `${result.case_id}\u0000${result.effort}`));
  const claimEligibleCells = new Set(results
    .filter((result) => result.case_id && result.effort && result.claim_numerator_eligible)
    .map((result) => `${result.case_id}\u0000${result.effort}`));
  const passedCalibrationCells = new Set(calibrations
    .filter((calibration) => calibration.case_id && calibration.effort && calibration.passed)
    .map((calibration) => `${calibration.case_id}\u0000${calibration.effort}`));
  const allRequiredCells = requiredCaseIds.flatMap((caseId) => requiredEfforts.map((effort) => ({ case_id: caseId, effort })));
  const missingResultCaseEfforts = allRequiredCells.filter((cell) => !resultCells.has(`${cell.case_id}\u0000${cell.effort}`));
  const mechanicalIncompleteCaseEfforts = allRequiredCells
    .filter((cell) => resultCells.has(`${cell.case_id}\u0000${cell.effort}`) && !mechanicalCells.has(`${cell.case_id}\u0000${cell.effort}`));
  const claimIneligibleCaseEfforts = allRequiredCells
    .filter((cell) => resultCells.has(`${cell.case_id}\u0000${cell.effort}`) && !claimEligibleCells.has(`${cell.case_id}\u0000${cell.effort}`));
  const calibrationFailedCaseEfforts = allRequiredCells
    .filter((cell) => resultCells.has(`${cell.case_id}\u0000${cell.effort}`) && !passedCalibrationCells.has(`${cell.case_id}\u0000${cell.effort}`));
  const comparisonMissingCaseMatrix = Array.isArray(comparisonCaseMatrix?.missing_case_comparisons)
    ? comparisonCaseMatrix.missing_case_comparisons
    : [];
  return {
    missing_result_case_efforts: missingResultCaseEfforts,
    mechanical_incomplete_case_efforts: mechanicalIncompleteCaseEfforts,
    claim_ineligible_case_efforts: claimIneligibleCaseEfforts,
    calibration_failed_case_efforts: calibrationFailedCaseEfforts,
    comparison_missing_case_matrix: comparisonMissingCaseMatrix,
    categories: {
      missing_result_count: missingResultCaseEfforts.length,
      mechanical_incomplete_count: mechanicalIncompleteCaseEfforts.length,
      claim_ineligible_count: claimIneligibleCaseEfforts.length,
      calibration_failed_count: calibrationFailedCaseEfforts.length,
      comparison_missing_count: comparisonMissingCaseMatrix.length
    }
  };
}

function buildCaseEffortMatrix({ records, requiredCaseIds, requiredEfforts }) {
  const rows = requiredCaseIds.map((caseId) => {
    const caseRecords = records.filter((record) => record.case_id === caseId);
    const observedEfforts = uniqueSorted(caseRecords.map((record) => record.effort).filter(Boolean));
    const missingEfforts = requiredEfforts.filter((effort) => !observedEfforts.includes(effort));
    return {
      case_id: caseId,
      required_efforts: [...requiredEfforts],
      observed_efforts: observedEfforts,
      observed_count: caseRecords.length,
      missing_efforts: missingEfforts,
      complete: missingEfforts.length === 0
    };
  });
  const missingCaseEfforts = rows.flatMap((row) => row.missing_efforts.map((effort) => ({
    case_id: row.case_id,
    effort
  })));
  return {
    required_case_ids: [...requiredCaseIds],
    required_efforts: [...requiredEfforts],
    rows,
    missing_case_efforts: missingCaseEfforts,
    complete: missingCaseEfforts.length === 0
  };
}

function buildCalibrationPassMatrix({ results, calibrations, requiredCaseIds, requiredEfforts }) {
  const resultByPath = new Map(results.map((result) => [result.path, result]));
  const resultById = new Map(results.map((result) => [result.result_id, result]).filter(([id]) => Boolean(id)));
  const passedRecords = calibrations
    .filter((calibration) => calibration.passed)
    .map((calibration) => {
      const matchedResult = resultByPath.get(calibration.result_path) ?? resultById.get(calibration.result_id) ?? null;
      if (!matchedResult?.claim_numerator_eligible) {
        return null;
      }
      const caseId = calibration.case_id ?? matchedResult?.case_id ?? null;
      const effort = calibration.effort ?? matchedResult?.effort ?? null;
      if (matchedResult && ((caseId && matchedResult.case_id && caseId !== matchedResult.case_id) || (effort && matchedResult.effort && effort !== matchedResult.effort))) {
        return null;
      }
      return {
        case_id: caseId,
        effort
      };
    })
    .filter((record) => record?.case_id && record?.effort);
  return buildCaseEffortMatrix({
    records: passedRecords,
    requiredCaseIds,
    requiredEfforts
  });
}

function buildComparisonCaseMatrix({ comparisons, requiredCaseIds }) {
  const rows = HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS.map((kind) => {
    const observedCaseIds = uniqueSorted(comparisons
      .filter((comparison) => comparison.comparison_kind === kind && comparisonCaseCoverageEligible(comparison, kind))
      .map((comparison) => comparison.case_id ?? comparison.baseline_case_id ?? comparison.candidate_case_id)
      .filter(Boolean));
    const missingCaseIds = requiredCaseIds.filter((caseId) => !observedCaseIds.includes(caseId));
    return {
      comparison_kind: kind,
      observed_case_ids: observedCaseIds,
      missing_case_ids: missingCaseIds,
      complete: missingCaseIds.length === 0
    };
  });
  const missingCaseComparisons = rows.flatMap((row) => row.missing_case_ids.map((caseId) => ({
    comparison_kind: row.comparison_kind,
    case_id: caseId
  })));
  return {
    required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    rows,
    missing_case_comparisons: missingCaseComparisons,
    complete: missingCaseComparisons.length === 0
  };
}

function comparisonCaseCoverageEligible(comparison, kind) {
  const caseId = comparison.case_id ?? comparison.baseline_case_id ?? comparison.candidate_case_id ?? null;
  if (!caseId) {
    return false;
  }
  if (comparison.baseline_case_id && comparison.candidate_case_id && comparison.baseline_case_id !== comparison.candidate_case_id) {
    return false;
  }
  if (comparison.baseline_case_id && caseId !== comparison.baseline_case_id) {
    return false;
  }
  if (comparison.candidate_case_id && caseId !== comparison.candidate_case_id) {
    return false;
  }
  if (kind === 'owner-labeled-human-baseline') {
    return comparison.human_baseline_ready_for_owner_review === true;
  }
  return comparison.advisory_only !== false && (comparison.gate_effect ?? 'none') === 'none';
}

function evidenceSetCoverageWarnings(summary) {
  const warnings = [];
  if (summary.missing_efforts.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_EFFORT_MATRIX_INCOMPLETE', message: 'The evidence set is missing required review efforts.', details: { missing_efforts: summary.missing_efforts } });
  }
  if (summary.missing_benchmark_case_ids.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_CASE_MATRIX_INCOMPLETE', message: 'The evidence set is missing benchmark cases.', details: { missing_benchmark_case_ids: summary.missing_benchmark_case_ids } });
  }
  if (summary.missing_comparison_kinds.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_COMPARISONS_INCOMPLETE', message: 'The evidence set is missing required comparison kinds.', details: { missing_comparison_kinds: summary.missing_comparison_kinds } });
  }
  if (Array.isArray(summary.missing_comparison_case_matrix) && summary.missing_comparison_case_matrix.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_COMPARISON_CASE_MATRIX_INCOMPLETE', message: 'Required comparison coverage is incomplete by benchmark case.', details: { missing_case_comparisons: summary.missing_comparison_case_matrix } });
  }
  if (summary.missing_human_baseline_case_ids.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_HUMAN_BASELINE_MATRIX_INCOMPLETE', message: 'The evidence set is missing owner-labeled human baselines for required benchmark cases.', details: { missing_human_baseline_case_ids: summary.missing_human_baseline_case_ids } });
  }
  if (summary.owner_labeled_baseline_count > 0 && summary.human_baseline_comparison_ready_count < summary.owner_labeled_baseline_count) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_HUMAN_BASELINE_COMPARISON_INCOMPLETE', message: 'The evidence set is missing ready owner-labeled baseline comparisons.', details: { ready_comparison_count: summary.human_baseline_comparison_ready_count, owner_labeled_baseline_count: summary.owner_labeled_baseline_count } });
  }
  if (Array.isArray(summary.missing_human_baseline_comparison_case_ids) && summary.missing_human_baseline_comparison_case_ids.length > 0) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_HUMAN_BASELINE_COMPARISON_CASE_MATRIX_INCOMPLETE', message: 'Ready owner-labeled baseline comparisons are incomplete by benchmark case.', details: { missing_case_ids: summary.missing_human_baseline_comparison_case_ids } });
  }
  if (summary.real_provider_claim_numerator_matrix_complete === false) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_REAL_PROVIDER_CLAIM_NUMERATOR_INCOMPLETE', message: 'The evidence set does not yet contain the required real-provider dogfood result matrix for future claim review.', details: { eligible_result_count: summary.claim_numerator_eligible_result_count, required_result_count: summary.real_provider_claim_numerator_required_count, missing_case_efforts: summary.missing_real_provider_claim_numerator_case_efforts ?? [], blockers: summary.proof_readiness_blockers ?? {} } });
  }
  if (summary.mechanical_contract_matrix_complete === false) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_MECHANICAL_CONTRACT_MATRIX_INCOMPLETE', message: 'TraceCue mechanical contract coverage is incomplete for the required benchmark case and effort matrix.', details: { satisfied_result_count: summary.mechanical_contract_satisfied_result_count, missing_case_efforts: summary.missing_mechanical_contract_case_efforts ?? [], mechanical_incomplete_case_efforts: summary.mechanical_incomplete_case_efforts ?? [] } });
  }
  if (summary.calibration_pass_matrix_complete === false) {
    warnings.push({ code: 'AHR_EVIDENCE_SET_CALIBRATION_MATRIX_INCOMPLETE', message: 'Evidence-backed calibration pass coverage is incomplete for the required benchmark case and effort matrix.', details: { missing_case_efforts: summary.missing_calibration_case_efforts ?? [], calibration_failed_case_efforts: summary.calibration_failed_case_efforts ?? [] } });
  }
  return warnings;
}

async function buildBatchComparison({ cwd, dataset, datasetPath, datasetHash, now, maxBytes }) {
  const warnings = [];
  const pairEntries = Array.isArray(dataset?.pairs)
    ? dataset.pairs
    : Array.isArray(dataset?.comparison_pairs)
      ? dataset.comparison_pairs
      : [];
  const comparisons = [];
  for (const [index, pair] of pairEntries.entries()) {
    const baselinePath = pair.baseline ?? pair.baseline_path;
    const candidatePath = pair.candidate ?? pair.candidate_path;
    if (!baselinePath || !candidatePath) {
      warnings.push({ code: 'AHR_BATCH_COMPARISON_PAIR_PATH_MISSING', message: 'A batch comparison pair is missing baseline or candidate path.', details: { index } });
      continue;
    }
    const baselineRead = await readWorkspaceJson({ cwd, inputPath: baselinePath, label: 'batch comparison baseline result', maxBytes });
    const candidateRead = await readWorkspaceJson({ cwd, inputPath: candidatePath, label: 'batch comparison candidate result', maxBytes });
    if (!baselineRead.ok || !candidateRead.ok) {
      const failed = baselineRead.ok ? candidateRead : baselineRead;
      warnings.push({ code: failed.error.code, message: failed.error.message, details: { ...failed.error.details, index } });
      continue;
    }
    const baselineValidation = validateAdvisoryResultArtifact({ result: baselineRead.value, resultPath: baselineRead.relativePath });
    const candidateValidation = validateAdvisoryResultArtifact({ result: candidateRead.value, resultPath: candidateRead.relativePath });
    if (!baselineValidation.ok || !candidateValidation.ok) {
      const failed = baselineValidation.ok ? candidateValidation : baselineValidation;
      warnings.push({ code: failed.error.code, message: failed.error.message, details: { ...failed.error.details, index } });
      continue;
    }
    comparisons.push(buildComparisonResult({
      baseline: baselineRead.value,
      baselinePath: baselineRead.relativePath,
      candidate: candidateRead.value,
      candidatePath: candidateRead.relativePath,
      now,
      comparisonKind: pair.comparison_kind ?? pair['comparison-kind'] ?? dataset.comparison_kind
    }));
  }
  if (comparisons.length === 0) {
    warnings.push({ code: 'AHR_BATCH_COMPARISON_NO_COMPARABLE_PAIRS', message: 'No readable comparison pairs were available in the dataset.', details: { pair_count: pairEntries.length } });
  }
  const comparisonKinds = uniqueSorted(comparisons.map((comparison) => comparison.comparison_kind));
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_batch_comparison',
    batch_comparison_version: HUMAN_REVIEW_BATCH_COMPARISON_VERSION,
    generated_at: now.toISOString(),
    dataset_path: datasetPath,
    dataset_hash: datasetHash,
    pair_count: pairEntries.length,
    compared_pair_count: comparisons.length,
    comparison_kinds: comparisonKinds,
    average_deltas: averageQualityScores(comparisons.map((comparison) => comparison.deltas)),
    regression_count: comparisons.filter((comparison) => comparison.summary.regressed_score_count > 0).length,
    improvement_count: comparisons.filter((comparison) => comparison.summary.improved_score_count > comparison.summary.regressed_score_count).length,
    comparisons: comparisons.map((comparison) => ({
      comparison_kind: comparison.comparison_kind,
      baseline: comparison.baseline,
      candidate: comparison.candidate,
      deltas: comparison.deltas,
      summary: comparison.summary,
      warnings: comparison.warnings
    })),
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true, dogfood_comparison_performed: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeEvaluatorPolicy(input) {
  const policy = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    schema_version: SCHEMA_VERSION,
    policy_version: HUMAN_REVIEW_EVALUATOR_POLICY_VERSION,
    scoring_weights: {
      human_review_coverage: Number(policy.scoring_weights?.human_review_coverage ?? 0.2),
      actionability: Number(policy.scoring_weights?.actionability ?? 0.2),
      verification: Number(policy.scoring_weights?.verification ?? 0.15),
      role_instruction_coverage: Number(policy.scoring_weights?.role_instruction_coverage ?? 0.2),
      consensus_alignment: Number(policy.scoring_weights?.consensus_alignment ?? 0.1),
      benchmark_requirement_coverage: Number(policy.scoring_weights?.benchmark_requirement_coverage ?? 0.15)
    },
    minimum_scores: {
      calibration_ready_score: Number(policy.minimum_scores?.calibration_ready_score ?? 0.75),
      benchmark_requirement_coverage_score: Number(policy.minimum_scores?.benchmark_requirement_coverage_score ?? 0.75),
      verification_score: Number(policy.minimum_scores?.verification_score ?? 0.75),
      actionability_score: Number(policy.minimum_scores?.actionability_score ?? 0.6)
    },
    required_outputs: {
      structured_benchmark_requirement_coverage: policy.required_outputs?.structured_benchmark_requirement_coverage !== false,
      critique_or_verification: policy.required_outputs?.critique_or_verification !== false,
      owner_decision_requests: policy.required_outputs?.owner_decision_requests !== false,
      role_independent_opinions: policy.required_outputs?.role_independent_opinions !== false
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighRoundPlanReport({ plan, planPath, now }) {
  const plannedRounds = xhighPlannedRounds(plan);
  const plannedRoles = (plan.sub_agents ?? []).map((agent) => agent.role);
  const critiqueRoles = (plan.sub_agents ?? [])
    .filter((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role))
    .map((agent) => agent.role);
  const synthesisPresent = plannedRoles.includes('synthesis_agent');
  const missingConditions = [];
  if (plan.review_effort?.mode !== 'xhigh') {
    missingConditions.push('review_effort is not xhigh');
  }
  if (plannedRounds.length < 3) {
    missingConditions.push('xhigh needs at least three planned review rounds');
  }
  if (critiqueRoles.length < 2) {
    missingConditions.push('xhigh needs dedicated critic and verification roles');
  }
  if (!synthesisPresent) {
    missingConditions.push('xhigh needs a synthesis role');
  }
  const report = {
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_xhigh_plan',
    xhigh_round_plan_version: HUMAN_REVIEW_XHIGH_ROUND_PLAN_VERSION,
    generated_at: now.toISOString(),
    plan_path: planPath,
    plan_id: plan.id ?? null,
    plan_hash: plan.plan_hash ?? null,
    review_effort: plan.review_effort?.mode ?? null,
    status: missingConditions.length === 0 ? 'ready_for_local_round_simulation' : 'round_plan_incomplete',
    xhigh_mechanical_enforcement: {
      schema_version: SCHEMA_VERSION,
      completion_version: HUMAN_REVIEW_XHIGH_COMPLETION_VERSION,
      required: plan.review_effort?.mode === 'xhigh',
      mechanical_contract_enforced: true,
      required_roles: plannedRoles,
      required_rounds: (plan.rounds ?? []).map(Number),
      required_critique_roles: critiqueRoles,
      synthesis_required: true,
      synthesis_planned: synthesisPresent,
      missing_conditions: missingConditions,
      strict_output_contract: plan.strict_output_contract ?? null,
      provider_effort_binding: plan.provider_effort_binding ?? null,
      advisory_only: true,
      gate_effect: 'none'
    },
    rounds: plannedRounds,
    expected_merge_contract: {
      role_opinions_required: true,
      critique_records_required: true,
      integration_record_required: true,
      benchmark_requirement_coverage_preserved: plan.review_quality_benchmark?.enabled === true,
      deterministic_gate_mutation_allowed: false
    },
    execution_boundary: {
      live_multi_call_execution_performed: false,
      live_multi_call_execution_authorized_by_plan: false,
      provider_call_performed: false,
      api_call_performed: false,
      external_evidence_transfer: false,
      mcp_execution_exposed: false
    },
    warnings: missingConditions.map((condition) => ({
      code: 'AHR_XHIGH_ROUND_PLAN_CONDITION_MISSING',
      message: condition
    })),
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  };
  return redact(report);
}

function xhighPlannedRounds(plan) {
  const agentsByRound = new Map();
  for (const agent of plan.sub_agents ?? []) {
    const round = Number(agent.round ?? 1);
    if (!agentsByRound.has(round)) {
      agentsByRound.set(round, []);
    }
    agentsByRound.get(round).push({
      role: agent.role,
      display_name: agent.display_name,
      effort: agent.effort,
      independent_review: agent.independent_review !== false
    });
  }
  return [...agentsByRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, agents]) => ({
    round,
    role_count: agents.length,
    roles: agents,
    depends_on_rounds: round > 1 ? [round - 1] : [],
    expected_output_sections: round > 1
      ? ['role_opinions', 'critique_records', 'rebuttal_records', 'integration_record']
      : ['role_opinions', 'findings', 'review_claims'],
    provider_call_policy: 'not_executed_by_round_plan'
  }));
}

function buildXhighSimulationReport({ plan, planPath, roundInput, roundInputPath, roundInputHash, now }) {
  const planned = buildXhighRoundPlanReport({ plan, planPath, now });
  const opinions = normalizeRoleOpinions(roundInput.role_opinions ?? roundInput.agentic_human_review_advisory?.role_opinions, plan.sub_agents);
  const findings = normalizeFindings(roundInput.findings ?? roundInput.agentic_human_review_findings, roundInput.id ?? 'xhigh-simulation');
  const claims = buildReviewClaims({ resultId: roundInput.id ?? 'xhigh-simulation', input: roundInput, findings, roleOpinions: opinions });
  const roundRecords = buildRoundRecords({ plan, roleOpinions: opinions });
  const critiqueRecordsForCompletion = buildCritiqueRecords({ plan, claims, roleOpinions: opinions });
  const integrationRecordForCompletion = buildIntegrationRecord({
    roleOpinions: opinions,
    findings,
    critiqueRecords: critiqueRecordsForCompletion,
    input: roundInput
  });
  const roleInstructionCoverage = buildRoleInstructionCoverage({ plan, roleOpinions: opinions });
  const completion = buildXhighCompletionAssessment({
    plan,
    roleOpinions: opinions,
    roundRecords,
    critiqueRecords: critiqueRecordsForCompletion,
    integrationRecord: integrationRecordForCompletion,
    roleInstructionCoverage
  });
  const reportedRoles = new Set(reportedRoleOpinions(opinions).map((opinion) => opinion.role));
  const plannedRoles = (plan.sub_agents ?? []).map((agent) => agent.role);
  const missingRoles = plannedRoles.filter((role) => !reportedRoles.has(role));
  const critiqueRecords = Array.isArray(roundInput.critique_records) ? roundInput.critique_records : [];
  const integrationRecord = roundInput.integration_record ?? null;
  const simulation = {
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_xhigh_simulation',
    xhigh_round_plan_version: HUMAN_REVIEW_XHIGH_ROUND_PLAN_VERSION,
    generated_at: now.toISOString(),
    plan_path: planPath,
    round_input_path: roundInputPath,
    round_input_hash: roundInputHash,
    status: completion.status === 'complete' ? 'simulation_complete' : 'simulation_incomplete',
    planned_round_count: planned.rounds.length,
    planned_role_count: plannedRoles.length,
    reported_role_count: reportedRoles.size,
    missing_roles: missingRoles,
    critique_record_count: critiqueRecords.length,
    integration_record_present: Boolean(integrationRecord),
    benchmark_requirement_coverage_present: Boolean(roundInput.benchmark_requirement_coverage),
    xhigh_mechanical_enforcement: completion,
    true_multi_call_execution_performed: false,
    provider_call_performed: false,
    warnings: [
      ...missingRoles.map((role) => ({ code: 'AHR_XHIGH_SIMULATION_ROLE_MISSING', message: 'A planned role was not present in the round input.', details: { role } })),
      ...(critiqueRecords.length > 0 ? [] : [{ code: 'AHR_XHIGH_SIMULATION_CRITIQUE_MISSING', message: 'No critique records were present in the round input.' }]),
      ...(integrationRecord ? [] : [{ code: 'AHR_XHIGH_SIMULATION_INTEGRATION_MISSING', message: 'No integration record was present in the round input.' }])
    ],
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  };
  return redact(simulation);
}

function buildLongitudinalQualityRollup({ evidenceSet, evidenceSetPath, evidenceSetHash, now }) {
  const summary = evidenceSet.summary;
  const resultsByCase = groupCount(evidenceSet.results.map((result) => result.case_id).filter(Boolean));
  const resultsByEffort = groupCount(evidenceSet.results.map((result) => result.effort).filter(Boolean));
  const repeatedCaseCount = Object.values(resultsByCase).filter((count) => count > 1).length;
  const averageQuality = summary.average_quality_scores ?? {};
  const stabilityScore = clampScore(
    (summary.observed_efforts.length / HUMAN_REVIEW_CLAIM_EFFORTS.length * 0.3)
    + (summary.observed_benchmark_case_ids.length / summary.required_benchmark_case_ids.length * 0.3)
    + (summary.observed_comparison_kinds.length / HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS.length * 0.2)
    + (summary.mechanical_contract_matrix_complete ? 0.1 : 0)
    + (repeatedCaseCount > 0 ? 0.05 : 0)
    + (summary.calibration_pass_count > 0 ? 0.05 : 0)
  );
  const warnings = [
    ...evidenceSet.warnings,
    ...(repeatedCaseCount > 0 ? [] : [{ code: 'AHR_LONGITUDINAL_NO_REPEATED_CASES', message: 'No benchmark case has repeated observations yet.' }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_longitudinal_quality',
    longitudinal_quality_version: HUMAN_REVIEW_LONGITUDINAL_QUALITY_VERSION,
    generated_at: now.toISOString(),
    evidence_set_path: evidenceSetPath,
    evidence_set_hash: evidenceSetHash,
    status: summary.complete_for_longitudinal_owner_review && repeatedCaseCount > 0 ? 'ready_for_owner_longitudinal_review' : 'longitudinal_evidence_incomplete',
    result_count: summary.result_count,
    results_by_case: resultsByCase,
    results_by_effort: resultsByEffort,
    owner_labeled_baseline_count: summary.owner_labeled_baseline_count ?? 0,
    observed_human_baseline_case_ids: summary.observed_human_baseline_case_ids ?? [],
    missing_human_baseline_case_ids: summary.missing_human_baseline_case_ids ?? [],
    mechanical_contract: {
      matrix_complete: summary.mechanical_contract_matrix_complete === true,
      satisfied_result_count: Number(summary.mechanical_contract_satisfied_result_count ?? 0),
      missing_case_efforts: summary.missing_mechanical_contract_case_efforts ?? [],
      xhigh_mechanically_complete_count: Number(summary.xhigh_mechanically_complete_count ?? 0)
    },
    repeated_case_count: repeatedCaseCount,
    observed_comparison_kinds: summary.observed_comparison_kinds,
    average_quality_scores: averageQuality,
    longitudinal_stability_score: stabilityScore,
    claim_policy: {
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false,
      owner_labeled_evidence_required: true,
      reason: 'Longitudinal quality rollups support owner review, but claims remain disallowed until a separately approved claim standard is met.'
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function isEvidenceSetOutput(value) {
  return value?.type === 'agentic_human_review_evidence_set'
    || value?.data?.agentic_human_review_evidence_set?.type === 'agentic_human_review_evidence_set';
}

function normalizeEvidenceSetOutput(value) {
  return value?.data?.agentic_human_review_evidence_set ?? value;
}

function buildHumanBaselineClaimReadiness({ evidenceSet, evidenceSetPath, evidenceSetHash, policy, policyPath, policyHash, now }) {
  const normalizedEvidenceSet = normalizeEvidenceSetOutput(evidenceSet);
  const summary = normalizedEvidenceSet.summary ?? {};
  const requiredCaseIds = Array.isArray(summary.required_benchmark_case_ids)
    ? summary.required_benchmark_case_ids
    : BENCHMARK_CASES.map((item) => item.case_id);
  const missing = {
    efforts: Array.isArray(summary.missing_efforts) ? summary.missing_efforts : [...HUMAN_REVIEW_CLAIM_EFFORTS],
    benchmark_cases: Array.isArray(summary.missing_benchmark_case_ids) ? summary.missing_benchmark_case_ids : requiredCaseIds,
    owner_labeled_baselines: Array.isArray(summary.missing_human_baseline_case_ids) ? summary.missing_human_baseline_case_ids : requiredCaseIds,
    comparison_kinds: Array.isArray(summary.missing_comparison_kinds) ? summary.missing_comparison_kinds : [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    human_baseline_comparisons: Array.isArray(summary.missing_human_baseline_comparison_case_ids)
      ? summary.missing_human_baseline_comparison_case_ids
      : (Number(summary.human_baseline_comparison_ready_count ?? 0) >= requiredCaseIds.length ? [] : requiredCaseIds),
    real_provider_claim_numerator_results: summary.real_provider_claim_numerator_matrix_complete === true
      ? []
      : (Array.isArray(summary.missing_real_provider_claim_numerator_case_efforts) ? summary.missing_real_provider_claim_numerator_case_efforts : requiredCaseIds),
    mechanical_contract_case_efforts: summary.mechanical_contract_matrix_complete === true
      ? []
      : (Array.isArray(summary.missing_mechanical_contract_case_efforts) ? summary.missing_mechanical_contract_case_efforts : requiredCaseIds),
    calibration_case_efforts: summary.calibration_pass_matrix_complete === true
      ? []
      : (Array.isArray(summary.missing_calibration_case_efforts) ? summary.missing_calibration_case_efforts : requiredCaseIds),
    comparison_case_matrix: Array.isArray(summary.missing_comparison_case_matrix) ? summary.missing_comparison_case_matrix : [],
    direct_vs_tracecue_comparison_cases: Array.isArray(summary.missing_direct_vs_tracecue_case_ids) ? summary.missing_direct_vs_tracecue_case_ids : requiredCaseIds,
    proof_readiness_blockers: isPlainObject(summary.proof_readiness_blockers) ? summary.proof_readiness_blockers : {}
  };
  const conditions = {
    standard_deep_xhigh_complete: missing.efforts.length === 0,
    benchmark_case_matrix_complete: missing.benchmark_cases.length === 0,
    owner_labeled_baseline_matrix_complete: missing.owner_labeled_baselines.length === 0,
    required_comparison_kinds_complete: missing.comparison_kinds.length === 0,
    comparison_case_matrix_complete: missing.comparison_case_matrix.length === 0,
    direct_vs_tracecue_case_matrix_complete: missing.direct_vs_tracecue_comparison_cases.length === 0,
    human_baseline_comparisons_ready: missing.human_baseline_comparisons.length === 0,
    real_provider_claim_numerator_matrix_complete: missing.real_provider_claim_numerator_results.length === 0,
    mechanical_contract_matrix_complete: missing.mechanical_contract_case_efforts.length === 0,
    calibration_pass_matrix_complete: missing.calibration_case_efforts.length === 0,
    repeated_observations_present: Number(normalizedEvidenceSet.summary?.result_count ?? 0) > requiredCaseIds.length,
    policy_keeps_claim_flags_false: policy.equality_or_superiority_claims_allowed === false
  };
  const warnings = [
    ...(conditions.standard_deep_xhigh_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_EFFORT_MATRIX_INCOMPLETE', message: 'standard/deep/xhigh evidence is incomplete.', details: { missing_efforts: missing.efforts } }]),
    ...(conditions.benchmark_case_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_CASE_MATRIX_INCOMPLETE', message: 'Benchmark case coverage is incomplete.', details: { missing_case_ids: missing.benchmark_cases } }]),
    ...(conditions.owner_labeled_baseline_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_BASELINE_MATRIX_INCOMPLETE', message: 'Owner-labeled human baseline coverage is incomplete.', details: { missing_case_ids: missing.owner_labeled_baselines } }]),
    ...(conditions.required_comparison_kinds_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_COMPARISONS_INCOMPLETE', message: 'Required comparison kinds are incomplete.', details: { missing_comparison_kinds: missing.comparison_kinds } }]),
    ...(conditions.comparison_case_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_COMPARISON_CASE_MATRIX_INCOMPLETE', message: 'Required comparison coverage is incomplete by benchmark case.', details: { missing_case_comparisons: missing.comparison_case_matrix } }]),
    ...(conditions.direct_vs_tracecue_case_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_DIRECT_VS_TRACECUE_CASES_INCOMPLETE', message: 'Direct-vs-TraceCue comparison coverage is incomplete by benchmark case.', details: { missing_case_ids: missing.direct_vs_tracecue_comparison_cases } }]),
    ...(conditions.human_baseline_comparisons_ready ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_BASELINE_COMPARISONS_NOT_READY', message: 'Owner-labeled human baseline comparisons are not all ready for owner review.', details: { missing_case_ids: missing.human_baseline_comparisons } }]),
    ...(conditions.real_provider_claim_numerator_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_REAL_PROVIDER_MATRIX_INCOMPLETE', message: 'Real-provider dogfood results are incomplete for future claim review.', details: { missing_case_efforts: missing.real_provider_claim_numerator_results } }]),
    ...(conditions.mechanical_contract_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_MECHANICAL_CONTRACT_MATRIX_INCOMPLETE', message: 'TraceCue mechanical contract coverage is incomplete for future claim review.', details: { missing_case_efforts: missing.mechanical_contract_case_efforts } }]),
    ...(conditions.calibration_pass_matrix_complete ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_CALIBRATION_MATRIX_INCOMPLETE', message: 'Evidence-backed calibration pass coverage is incomplete for future claim review.', details: { missing_case_efforts: missing.calibration_case_efforts } }]),
    ...(conditions.repeated_observations_present ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_READINESS_LONGITUDINAL_HISTORY_THIN', message: 'Repeated observations are required before a long-term quality claim can be reviewed.' }]),
    ...(conditions.policy_keeps_claim_flags_false ? [] : [{ code: 'AHR_HUMAN_BASELINE_CLAIM_POLICY_TOO_PERMISSIVE', message: 'The claim policy must keep equality and superiority claims disabled.' }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_claim_readiness',
    human_baseline_operations_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    generated_at: now.toISOString(),
    evidence_set_path: evidenceSetPath,
    evidence_set_hash: evidenceSetHash,
    policy_path: policyPath,
    policy_hash: policyHash,
    status: warnings.length === 0 ? 'ready_for_separate_owner_claim_standard_review' : 'claim_readiness_incomplete',
    evidence_set: {
      path: evidenceSetPath,
      hash: evidenceSetHash,
      type: normalizedEvidenceSet.type ?? null,
      generated_at: normalizedEvidenceSet.generated_at ?? null
    },
    requirements: {
      required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
      required_benchmark_case_ids: requiredCaseIds,
      required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
      owner_labeled_baseline_required: true,
      human_baseline_comparison_required: true,
      real_provider_claim_numerator_required: true,
      repeated_observations_required: true,
      equality_or_superiority_claims_allowed: false
    },
    conditions,
    missing,
    blocker_summary: {
      missing_result_case_efforts: missing.proof_readiness_blockers.missing_result_case_efforts ?? [],
      mechanical_incomplete_case_efforts: missing.proof_readiness_blockers.mechanical_incomplete_case_efforts ?? [],
      calibration_failed_case_efforts: missing.proof_readiness_blockers.calibration_failed_case_efforts ?? [],
      comparison_missing_case_matrix: missing.proof_readiness_blockers.comparison_missing_case_matrix ?? [],
      categories: missing.proof_readiness_blockers.categories ?? {}
    },
    summary: {
      result_count: Number(summary.result_count ?? 0),
      owner_labeled_baseline_count: Number(summary.owner_labeled_baseline_count ?? 0),
      human_baseline_comparison_ready_count: Number(summary.human_baseline_comparison_ready_count ?? 0),
      human_baseline_comparison_ready_case_count: Number(summary.human_baseline_comparison_ready_case_count ?? 0),
      claim_numerator_eligible_result_count: Number(summary.claim_numerator_eligible_result_count ?? 0),
      mechanical_contract_satisfied_result_count: Number(summary.mechanical_contract_satisfied_result_count ?? 0),
      real_provider_claim_numerator_required_count: Number(summary.real_provider_claim_numerator_required_count ?? requiredCaseIds.length * HUMAN_REVIEW_CLAIM_EFFORTS.length),
      calibration_pass_count: Number(summary.calibration_pass_count ?? 0),
      calibration_required_count: Number(summary.calibration_required_count ?? requiredCaseIds.length * HUMAN_REVIEW_CLAIM_EFFORTS.length),
      required_case_count: requiredCaseIds.length,
      observed_comparison_kinds: summary.observed_comparison_kinds ?? [],
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false
    },
    claim_policy: {
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false,
      owner_labeled_evidence_required: true,
      reason: 'This readiness report can identify evidence prerequisites, but equality or superiority claims remain disabled until a separately approved claim standard is met.'
    },
    policy,
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

async function buildClaimStandardClaimAuditSummary({ cwd, evidenceSet, policy, now, maxBytes }) {
  const normalizedEvidenceSet = normalizeEvidenceSetOutput(evidenceSet);
  const resultRecords = Array.isArray(normalizedEvidenceSet.results) ? normalizedEvidenceSet.results : [];
  const failures = [];
  const audits = [];
  for (const resultRecord of resultRecords) {
    if (!resultRecord.path) {
      failures.push({
        code: 'AHR_CLAIM_STANDARD_GATE_RESULT_PATH_MISSING',
        message: 'A result could not be audited because the evidence-set record did not include a path.',
        details: { result_id: resultRecord.result_id ?? null, case_id: resultRecord.case_id ?? null, effort: resultRecord.effort ?? null }
      });
      continue;
    }
    const resultRead = await readWorkspaceJson({
      cwd,
      inputPath: resultRecord.path,
      label: 'agentic human review claim standard audited result',
      maxBytes
    });
    if (!resultRead.ok) {
      failures.push({
        code: 'AHR_CLAIM_STANDARD_GATE_RESULT_AUDIT_READ_FAILED',
        message: 'A result could not be read for claim audit.',
        details: { path: resultRecord.path, reason: resultRead.error.message }
      });
      continue;
    }
    const validation = validateAdvisoryResultArtifact({ result: resultRead.value, resultPath: resultRead.relativePath });
    if (!validation.ok) {
      failures.push({
        code: 'AHR_CLAIM_STANDARD_GATE_RESULT_AUDIT_CONTRACT_FAILED',
        message: 'A result could not be audited because it did not satisfy the advisory-result contract.',
        details: validation.error.details
      });
      continue;
    }
    const audit = buildClaimAudit({
      result: resultRead.value,
      resultPath: resultRead.relativePath,
      resultHash: hashText(resultRead.text),
      policy,
      policyPath: null,
      policyHash: null,
      now
    });
    audits.push(audit);
    if (audit.forbidden_claim_matches.length > 0 || audit.missing_evidence_claim_count > 0 || audit.equality_or_superiority_text_present) {
      failures.push({
        code: 'AHR_CLAIM_STANDARD_GATE_RESULT_CLAIM_AUDIT_FAILED',
        message: 'A result claim audit found forbidden, unsupported, or evidence-missing claim text.',
        details: {
          path: resultRead.relativePath,
          result_id: audit.result_id ?? null,
          forbidden_claim_match_count: audit.forbidden_claim_matches.length,
          missing_evidence_claim_count: audit.missing_evidence_claim_count,
          equality_or_superiority_text_present: audit.equality_or_superiority_text_present
        }
      });
    }
  }
  return {
    audited_result_count: audits.length,
    failed_result_count: failures.length,
    forbidden_claim_match_count: audits.reduce((sum, audit) => sum + audit.forbidden_claim_matches.length, 0),
    missing_evidence_claim_count: audits.reduce((sum, audit) => sum + Number(audit.missing_evidence_claim_count ?? 0), 0),
    equality_or_superiority_text_present_count: audits.filter((audit) => audit.equality_or_superiority_text_present).length,
    failures
  };
}

function buildClaimStandardGate({
  evidenceSet,
  evidenceSetPath,
  evidenceSetHash,
  policy,
  policyInput,
  policyPath,
  policyHash,
  readiness,
  longitudinal,
  claimAuditSummary,
  now
}) {
  const normalizedEvidenceSet = normalizeEvidenceSetOutput(evidenceSet);
  const summary = normalizedEvidenceSet.summary ?? {};
  const results = Array.isArray(normalizedEvidenceSet.results) ? normalizedEvidenceSet.results : [];
  const comparisons = Array.isArray(normalizedEvidenceSet.comparisons) ? normalizedEvidenceSet.comparisons : [];
  const humanBaselines = Array.isArray(normalizedEvidenceSet.human_baselines) ? normalizedEvidenceSet.human_baselines : [];
  const evidenceWarnings = Array.isArray(normalizedEvidenceSet.warnings) ? normalizedEvidenceSet.warnings : [];
  const policyDiagnostics = claimStandardPolicyInputDiagnostics(policyInput);
  const directRegressions = comparisons.filter((comparison) => comparison.comparison_kind === 'direct-vs-tracecue' && Number(comparison.regressed_score_count ?? 0) > 0);
  const providerOrBenchmarkRegressions = comparisons.filter((comparison) => ['provider-dogfood', 'benchmark-regression'].includes(comparison.comparison_kind) && Number(comparison.regressed_score_count ?? 0) > 0);
  const ownerBaselineComparisonBlockers = comparisons
    .filter((comparison) => comparison.comparison_kind === 'owner-labeled-human-baseline')
    .filter((comparison) => comparison.human_baseline_ready_for_owner_review !== true
      || comparison.human_baseline_candidate_matches_owner_baseline !== true
      || comparison.human_baseline_owner_labeled_baseline_verified !== true
      || comparison.candidate_mechanical_contract_satisfied !== true
      || Number(comparison.human_baseline_must_not_miss_miss_count ?? 0) > 0
      || Number(comparison.human_baseline_miss_count ?? 0) > 0
      || Number(comparison.human_baseline_insufficient_evidence_count ?? 0) > 0);
  const invalidBaselines = humanBaselines.filter((baseline) => baseline.owner_labeled_baseline_verified !== true);
  const ineligibleResults = results.filter((result) => result.claim_numerator_eligible !== true || result.strict_claim_numerator_eligible !== true);
  const incompleteXhighResults = results.filter((result) => result.effort === 'xhigh' && (result.xhigh_completion_status !== 'complete' || result.mechanical_contract_satisfied !== true));
  const nonAdvisoryRecords = [
    ...results.filter((result) => result.advisory_only !== true || result.gate_effect !== 'none').map((result) => ({ kind: 'result', path: result.path, case_id: result.case_id, effort: result.effort })),
    ...comparisons.filter((comparison) => comparison.advisory_only !== true || comparison.gate_effect !== 'none').map((comparison) => ({ kind: 'comparison', path: comparison.path, case_id: comparison.case_id, comparison_kind: comparison.comparison_kind })),
    ...humanBaselines.filter((baseline) => baseline.advisory_only !== true || baseline.gate_effect !== 'none').map((baseline) => ({ kind: 'human_baseline', path: baseline.path, case_id: baseline.case_id }))
  ];
  const conditions = {
    evidence_set_has_no_warnings: evidenceWarnings.length === 0,
    readiness_ready_for_owner_claim_standard_review: readiness.status === 'ready_for_separate_owner_claim_standard_review',
    longitudinal_ready_for_owner_review: longitudinal.status === 'ready_for_owner_longitudinal_review',
    standard_deep_xhigh_complete: readiness.conditions?.standard_deep_xhigh_complete === true,
    benchmark_case_matrix_complete: readiness.conditions?.benchmark_case_matrix_complete === true,
    owner_labeled_baseline_matrix_complete: readiness.conditions?.owner_labeled_baseline_matrix_complete === true,
    required_comparison_kinds_complete: readiness.conditions?.required_comparison_kinds_complete === true,
    comparison_case_matrix_complete: readiness.conditions?.comparison_case_matrix_complete === true,
    direct_vs_tracecue_case_matrix_complete: readiness.conditions?.direct_vs_tracecue_case_matrix_complete === true,
    human_baseline_comparisons_ready: readiness.conditions?.human_baseline_comparisons_ready === true,
    real_provider_claim_numerator_matrix_complete: readiness.conditions?.real_provider_claim_numerator_matrix_complete === true,
    mechanical_contract_matrix_complete: readiness.conditions?.mechanical_contract_matrix_complete === true,
    calibration_pass_matrix_complete: readiness.conditions?.calibration_pass_matrix_complete === true,
    repeated_observations_present: readiness.conditions?.repeated_observations_present === true,
    policy_keeps_claim_flags_false: readiness.conditions?.policy_keeps_claim_flags_false === true && policy.equality_or_superiority_claims_allowed === false,
    policy_input_does_not_attempt_equality_or_superiority: policyDiagnostics.authorization_attempts.length === 0,
    all_results_claim_numerator_eligible: results.length > 0 && ineligibleResults.length === 0,
    all_xhigh_results_mechanically_complete: incompleteXhighResults.length === 0,
    all_records_advisory_only: nonAdvisoryRecords.length === 0,
    direct_vs_tracecue_has_no_regressions: directRegressions.length === 0,
    provider_and_benchmark_comparisons_have_no_regressions: providerOrBenchmarkRegressions.length === 0,
    owner_baseline_comparisons_match: ownerBaselineComparisonBlockers.length === 0,
    owner_baselines_verified: invalidBaselines.length === 0,
    claim_audits_passed: claimAuditSummary.failed_result_count === 0
  };
  const blockers = [
    ...(conditions.evidence_set_has_no_warnings ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_EVIDENCE_SET_WARNINGS_PRESENT', 'The evidence-set summary has warnings that must be resolved before owner claim review can pass.', { warning_codes: evidenceWarnings.map((warning) => warning.code) })]),
    ...(conditions.readiness_ready_for_owner_claim_standard_review ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_READINESS_INCOMPLETE', 'Human-baseline claim-readiness is not ready for owner claim-standard review.', { readiness_status: readiness.status, warning_codes: readiness.warnings.map((warning) => warning.code) })]),
    ...(conditions.longitudinal_ready_for_owner_review ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_LONGITUDINAL_INCOMPLETE', 'Longitudinal quality evidence is not ready for owner review.', { longitudinal_status: longitudinal.status, warning_codes: longitudinal.warnings.map((warning) => warning.code) })]),
    ...claimStandardConditionBlockers(readiness),
    ...(conditions.policy_input_does_not_attempt_equality_or_superiority ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_POLICY_TOO_PERMISSIVE', 'The raw policy input attempted to authorize equality or superiority claims.', { authorization_attempts: policyDiagnostics.authorization_attempts })]),
    ...(conditions.all_results_claim_numerator_eligible ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_RESULT_CLAIM_NUMERATOR_INELIGIBLE', 'At least one result is not eligible for the future claim numerator.', { results: ineligibleResults.map(claimStandardResultDetails) })]),
    ...(conditions.all_xhigh_results_mechanically_complete ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_XHIGH_INCOMPLETE', 'At least one xhigh result does not expose a complete mechanical effort contract.', { results: incompleteXhighResults.map(claimStandardResultDetails) })]),
    ...(conditions.all_records_advisory_only ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_NON_ADVISORY_RECORD', 'Every claim-standard evidence record must remain advisory-only with no gate effect.', { records: nonAdvisoryRecords })]),
    ...(conditions.direct_vs_tracecue_has_no_regressions ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_DIRECT_REGRESSION_PRESENT', 'Direct-vs-TraceCue comparison contains at least one regressed score.', { comparisons: directRegressions.map(claimStandardComparisonDetails) })]),
    ...(conditions.provider_and_benchmark_comparisons_have_no_regressions ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_DOGFOOD_REGRESSION_PRESENT', 'Provider dogfood or benchmark-regression comparison contains at least one regressed score.', { comparisons: providerOrBenchmarkRegressions.map(claimStandardComparisonDetails) })]),
    ...(conditions.owner_baseline_comparisons_match ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_OWNER_BASELINE_COMPARISON_NOT_MATCHED', 'At least one owner-labeled human baseline comparison is not ready or does not match the owner baseline.', { comparisons: ownerBaselineComparisonBlockers.map(claimStandardComparisonDetails) })]),
    ...(conditions.owner_baselines_verified ? [] : [claimStandardBlocker('AHR_CLAIM_STANDARD_GATE_OWNER_BASELINE_INVALID', 'At least one human baseline is not verified owner-labeled evidence.', { baselines: invalidBaselines.map((baseline) => ({ path: baseline.path, case_id: baseline.case_id, baseline_id: baseline.baseline_id })) })]),
    ...(conditions.claim_audits_passed ? [] : claimAuditSummary.failures)
  ];
  const passed = Object.values(conditions).every(Boolean) && blockers.length === 0;
  const equalityPolicyBlocker = claimStandardBlocker(
    'AHR_CLAIM_STANDARD_EQUALITY_OR_SUPERIORITY_DISABLED',
    'Human-equivalent and human-superior claims remain disabled by policy even when owner claim-review evidence is ready.',
    { equality_or_superiority_claims_allowed: false }
  );
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_claim_standard_gate',
    claim_standard_gate_version: HUMAN_REVIEW_CLAIM_STANDARD_VERSION,
    generated_at: now.toISOString(),
    status: passed ? 'owner_claim_review_ready' : 'not_ready',
    passed,
    evidence_set: {
      path: evidenceSetPath,
      hash: evidenceSetHash,
      type: normalizedEvidenceSet.type ?? null,
      generated_at: normalizedEvidenceSet.generated_at ?? null
    },
    policy: {
      path: policyPath,
      hash: policyHash,
      normalized: policy,
      input_diagnostics: policyDiagnostics
    },
    readiness: {
      status: readiness.status,
      conditions: readiness.conditions,
      blocker_summary: readiness.blocker_summary,
      summary: readiness.summary
    },
    longitudinal_quality: {
      status: longitudinal.status,
      repeated_case_count: longitudinal.repeated_case_count,
      longitudinal_stability_score: longitudinal.longitudinal_stability_score,
      warning_count: longitudinal.warnings.length
    },
    claim_audit_summary: claimAuditSummary,
    conditions,
    claim_states: {
      owner_claim_review_ready: {
        allowed: passed,
        passed,
        blockers
      },
      human_equivalent_candidate: {
        allowed: false,
        passed: false,
        blocked_by_policy: true,
        blockers: [equalityPolicyBlocker, ...blockers]
      },
      human_superior_candidate: {
        allowed: false,
        passed: false,
        blocked_by_policy: true,
        blockers: [equalityPolicyBlocker, ...blockers]
      }
    },
    summary: {
      result_count: Number(summary.result_count ?? 0),
      calibration_count: Number(summary.calibration_count ?? 0),
      comparison_count: Number(summary.comparison_count ?? 0),
      owner_labeled_baseline_count: Number(summary.owner_labeled_baseline_count ?? 0),
      claim_numerator_eligible_result_count: Number(summary.claim_numerator_eligible_result_count ?? 0),
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false
    },
    blockers,
    warnings: [
      ...evidenceWarnings,
      ...readiness.warnings,
      ...longitudinal.warnings
    ],
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function claimStandardConditionBlockers(readiness) {
  const conditionMessages = [
    ['standard_deep_xhigh_complete', 'AHR_CLAIM_STANDARD_GATE_EFFORT_MATRIX_INCOMPLETE', 'standard/deep/xhigh evidence is incomplete.', { missing_efforts: readiness.missing?.efforts ?? [] }],
    ['benchmark_case_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_CASE_MATRIX_INCOMPLETE', 'Benchmark case coverage is incomplete.', { missing_case_ids: readiness.missing?.benchmark_cases ?? [] }],
    ['owner_labeled_baseline_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_OWNER_BASELINE_MATRIX_INCOMPLETE', 'Owner-labeled human baseline coverage is incomplete.', { missing_case_ids: readiness.missing?.owner_labeled_baselines ?? [] }],
    ['required_comparison_kinds_complete', 'AHR_CLAIM_STANDARD_GATE_COMPARISON_KINDS_INCOMPLETE', 'Required comparison kinds are incomplete.', { missing_comparison_kinds: readiness.missing?.comparison_kinds ?? [] }],
    ['comparison_case_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_COMPARISON_CASE_MATRIX_INCOMPLETE', 'Required comparison coverage is incomplete by benchmark case.', { missing_case_comparisons: readiness.missing?.comparison_case_matrix ?? [] }],
    ['direct_vs_tracecue_case_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_DIRECT_CASE_MATRIX_INCOMPLETE', 'Direct-vs-TraceCue comparison coverage is incomplete by benchmark case.', { missing_case_ids: readiness.missing?.direct_vs_tracecue_comparison_cases ?? [] }],
    ['human_baseline_comparisons_ready', 'AHR_CLAIM_STANDARD_GATE_OWNER_BASELINE_COMPARISONS_NOT_READY', 'Owner-labeled human baseline comparisons are not all ready for owner review.', { missing_case_ids: readiness.missing?.human_baseline_comparisons ?? [] }],
    ['real_provider_claim_numerator_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_REAL_PROVIDER_MATRIX_INCOMPLETE', 'Real-provider claim-numerator coverage is incomplete.', { missing_case_efforts: readiness.missing?.real_provider_claim_numerator_results ?? [] }],
    ['mechanical_contract_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_MECHANICAL_CONTRACT_MATRIX_INCOMPLETE', 'Mechanical contract coverage is incomplete.', { missing_case_efforts: readiness.missing?.mechanical_contract_case_efforts ?? [] }],
    ['calibration_pass_matrix_complete', 'AHR_CLAIM_STANDARD_GATE_CALIBRATION_MATRIX_INCOMPLETE', 'Calibration pass coverage is incomplete.', { missing_case_efforts: readiness.missing?.calibration_case_efforts ?? [] }],
    ['repeated_observations_present', 'AHR_CLAIM_STANDARD_GATE_LONGITUDINAL_HISTORY_THIN', 'Repeated observations are required before owner claim review can pass.', {}],
    ['policy_keeps_claim_flags_false', 'AHR_CLAIM_STANDARD_GATE_POLICY_FLAGS_NOT_FALSE', 'The normalized claim policy must keep equality and superiority flags false.', {}]
  ];
  return conditionMessages.flatMap(([condition, code, message, details]) => readiness.conditions?.[condition] === true
    ? []
    : [claimStandardBlocker(code, message, details)]);
}

function claimStandardPolicyInputDiagnostics(policyInput) {
  const authorizationAttempts = [];
  collectClaimStandardPolicyAuthorizationAttempts(policyInput, [], authorizationAttempts);
  return {
    authorization_attempted: authorizationAttempts.length > 0,
    authorization_attempts: authorizationAttempts
  };
}

function collectClaimStandardPolicyAuthorizationAttempts(value, pathParts, attempts) {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectClaimStandardPolicyAuthorizationAttempts(item, [...pathParts, String(index)], attempts);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = [...pathParts, key];
      const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');
      const keyLooksLikeClaimAuthorization = normalizedKey.includes('humanequivalent')
        || normalizedKey.includes('humansuperior')
        || normalizedKey.includes('equalityorsuperiority')
        || normalizedKey.includes('equalorsuperior')
        || (normalizedKey.includes('claim') && (normalizedKey.includes('allow') || normalizedKey.includes('authoriz') || normalizedKey.includes('permit')));
      if (keyLooksLikeClaimAuthorization && item === true) {
        attempts.push({ path: nextPath.join('.'), value: true });
      }
      if (keyLooksLikeClaimAuthorization && typeof item === 'string' && /human[-\s]?(equivalent|superior)|better than human/i.test(item)) {
        attempts.push({ path: nextPath.join('.'), value: secretSafeText(item, 200) });
      }
      collectClaimStandardPolicyAuthorizationAttempts(item, nextPath, attempts);
    }
  }
}

function claimStandardBlocker(code, message, details = {}) {
  return { code, message, details };
}

function claimStandardResultDetails(result) {
  return {
    path: result.path,
    result_id: result.result_id ?? null,
    case_id: result.case_id ?? null,
    effort: result.effort ?? null,
    origin_kind: result.origin_kind ?? null,
    provider_execution_class: result.provider_execution_class ?? null,
    excluded_from_claim_reason: result.excluded_from_claim_reason ?? null,
    strict_eligibility_checks: result.strict_eligibility_checks ?? {}
  };
}

function claimStandardComparisonDetails(comparison) {
  return {
    path: comparison.path,
    comparison_kind: comparison.comparison_kind,
    case_id: comparison.case_id ?? comparison.baseline_case_id ?? comparison.candidate_case_id ?? null,
    regressed_score_count: Number(comparison.regressed_score_count ?? 0),
    improved_score_count: Number(comparison.improved_score_count ?? 0),
    ready_for_owner_review: comparison.human_baseline_ready_for_owner_review ?? null,
    candidate_matches_owner_baseline: comparison.human_baseline_candidate_matches_owner_baseline ?? null,
    owner_labeled_baseline_verified: comparison.human_baseline_owner_labeled_baseline_verified ?? null,
    candidate_mechanical_contract_satisfied: comparison.candidate_mechanical_contract_satisfied ?? null,
    must_not_miss_miss_count: Number(comparison.human_baseline_must_not_miss_miss_count ?? 0),
    miss_count: Number(comparison.human_baseline_miss_count ?? 0),
    insufficient_evidence_count: Number(comparison.human_baseline_insufficient_evidence_count ?? 0)
  };
}

function normalizeClaimPolicy(input) {
  const policy = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    schema_version: SCHEMA_VERSION,
    policy_version: HUMAN_REVIEW_CLAIM_POLICY_VERSION,
    forbidden_claim_patterns: normalizeStringArray(policy.forbidden_claim_patterns).length > 0
      ? normalizeStringArray(policy.forbidden_claim_patterns)
      : [
          'human-equivalent',
          'human equivalent',
          'human-superior',
          'human superior',
          'better than human',
          'release is approved',
          'provider output changed the gate',
          'credentials were used from artifacts',
          'medical legal or financial advice was verified'
        ],
    required_evidence_for_claims: policy.required_evidence_for_claims !== false,
    equality_or_superiority_claims_allowed: false,
    owner_labeled_evidence_required: true,
    required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
    required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    required_benchmark_case_ids: BENCHMARK_CASES.map((item) => item.case_id),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildClaimAudit({ result, resultPath, resultHash, policy, policyPath, policyHash, now }) {
  const claimRecords = normalizeReviewClaims(result.review_claims);
  const claimTexts = [
    ...claimRecords.map((claim) => claim.claim),
    result.non_engineer_summary?.main_takeaway,
    result.human_report_v3?.plain_language_takeaway,
    result.human_report_v3?.highest_priority_fix
  ].filter(Boolean);
  const forbiddenMatches = [];
  for (const pattern of policy.forbidden_claim_patterns) {
    const matched = claimTexts.filter((text) => textIncludesLoose(String(text).toLowerCase(), pattern));
    if (matched.length > 0) {
      forbiddenMatches.push({ pattern, match_count: matched.length });
    }
  }
  const missingEvidenceClaims = policy.required_evidence_for_claims
    ? claimRecords.filter((claim) => claim.evidence_refs.length === 0 && claim.supported_by_roles.length === 0)
    : [];
  const equalityTextPresent = claimTexts.some((text) => /\bhuman[-\s]?(equivalent|superior)\b|better than human/i.test(String(text)));
  const warnings = [
    ...forbiddenMatches.map((match) => ({ code: 'AHR_CLAIM_POLICY_FORBIDDEN_CLAIM_PRESENT', message: 'A forbidden claim pattern was present.', details: match })),
    ...missingEvidenceClaims.map((claim) => ({ code: 'AHR_CLAIM_POLICY_EVIDENCE_MISSING', message: 'A review claim has no evidence refs or supporting roles.', details: { claim_id: claim.id } })),
    ...(equalityTextPresent ? [{ code: 'AHR_CLAIM_POLICY_EQUALITY_OR_SUPERIORITY_UNSUPPORTED', message: 'Human-equivalent or human-superior wording is not supported by this result.' }] : [])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_claim_audit',
    claim_policy_version: HUMAN_REVIEW_CLAIM_POLICY_VERSION,
    generated_at: now.toISOString(),
    result_path: resultPath,
    result_hash: resultHash,
    result_id: result.id ?? null,
    policy_path: policyPath,
    policy_hash: policyHash,
    claim_count: claimRecords.length,
    forbidden_claim_matches: forbiddenMatches,
    missing_evidence_claim_count: missingEvidenceClaims.length,
    equality_or_superiority_text_present: equalityTextPresent,
    status: warnings.length === 0 ? 'claim_policy_passed_for_advisory_result' : 'claim_policy_warnings_present',
    human_equivalent_claim_allowed: false,
    human_superior_claim_allowed: false,
    policy,
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function averageQualityScores(records) {
  const keys = uniqueSorted(records.flatMap((record) => Object.keys(record ?? {})));
  if (records.length === 0) {
    return {};
  }
  return Object.fromEntries(keys.map((key) => {
    const values = records.map((record) => Number(record?.[key])).filter((value) => Number.isFinite(value));
    const average = values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
    return [key, Number(average.toFixed(6))];
  }));
}

function groupCount(values) {
  return values.reduce((accumulator, value) => {
    const key = String(value);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))].sort();
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
    dom_summary_transferred: false,
    url_metadata_transferred: false,
    artifact_refs_transferred: false,
    accessibility_summary_transferred: false,
    raw_dom_transferred: false,
    request_bytes: null,
    response_bytes: null,
    provider_status_code: null,
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
    dogfood_comparison_performed: false,
    report_quality_gate_effect: 'none',
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
    || packet?.type === 'agentic_human_review_proposal'
    || packet?.proposal_kind === 'agentic_human_review_proposal'
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
  const visibleTextProvenance = buildVisibleTextProvenance({ textSnippets, review });
  const route = stringOrNull(review.review?.final_url ?? review.review?.input_url ?? review.final_url ?? review.input_url);
  const viewport = review.review?.viewport ?? review.environment?.viewport ?? null;
  return redact({
    schema_version: SCHEMA_VERSION,
    package_version: AGENTIC_HUMAN_REVIEW_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
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
    human_review_input_contract: buildHumanReviewContract({
      intent,
      targetAudience,
      expectedImpression
    }),
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
    visual_evidence_package_v2: buildVisualEvidencePackageV2({
      artifactRefs,
      review,
      viewport
    }),
    content_evidence: {
      text_snippet_count: textSnippets.length,
      text_snippets: textSnippets,
      page_text_included_as_bounded_summary: textSnippets.length > 0,
      raw_dom_included: false,
      raw_report_body_included: false
    },
    visible_text_provenance: visibleTextProvenance,
    visible_text_reading_contract: buildVisibleTextReadingContract({
      textSnippets,
      review,
      intent,
      visibleTextProvenance
    }),
    screen_text_understanding_contract: buildScreenTextUnderstandingContract({
      textSnippets,
      intent,
      visibleTextProvenance
    }),
    semantic_evidence: {
      accessibility_summary: summarizeAccessibility(review),
      information_architecture_summary: summarizeInformationArchitecture(review),
      next_action_summary: summarizeNextActions(review)
    },
    technical_evidence: summarizeTechnicalEvidence(review),
    mechanical_review_summary: summarizeMechanicalReview(review),
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

function buildVisualEvidencePackageV2({ artifactRefs, review, viewport }) {
  const visualRefs = artifactRefs.filter(isVisualReference).slice(0, MAX_EVIDENCE_REFS);
  const metrics = review.metrics ?? {};
  const qualitySignals = review.quality_signals ?? {};
  return {
    schema_version: SCHEMA_VERSION,
    evidence_package_version: HUMAN_REVIEW_EVIDENCE_PACKAGE_VERSION,
    reference_count: visualRefs.length,
    references: visualRefs.map((ref, index) => ({
      id: `visual-reference-${index + 1}`,
      type: ref.type,
      path: ref.path,
      description: ref.description,
      local_reference: true,
      raw_bytes_embedded: false,
      raw_bytes_read_by_planning: false
    })),
    viewport_summary: viewport ?? null,
    visual_state_summary: {
      horizontal_overflow: Boolean(metrics.horizontal_overflow),
      broken_image_count: Number(metrics.broken_images ?? metrics.broken_image_count ?? 0),
      loading_indicator_count: Number(metrics.loading_indicators ?? metrics.loading_indicator_count ?? 0),
      empty_data_container_count: Number(metrics.empty_data_containers ?? metrics.empty_data_container_count ?? 0),
      visual_hierarchy_status: stringOrNull(qualitySignals.visual_hierarchy?.status),
      rendered_state_status: stringOrNull(qualitySignals.rendered_state?.status)
    },
    review_focus: [
      'first impression',
      'visual hierarchy',
      'scanability',
      'layout friction',
      'image or media trust cues',
      'what visual state makes a person hesitate'
    ],
    raw_pixel_policy: {
      raw_pixel_bytes_available_from_json: false,
      raw_pixel_bytes_embedded_in_json: false,
      raw_pixel_bytes_read_by_planning: false,
      raw_pixel_bytes_require_explicit_run_transfer_flag: true
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildVisibleTextProvenance({ textSnippets, review }) {
  const visibleText = stringOrNull(review.evidence_summary?.visible_text ?? review.page?.visible_text);
  const headings = visibleTextItems(review.evidence_summary?.headings ?? review.layout?.headings);
  const actionTexts = visibleTextItems(review.evidence_summary?.action_texts ?? review.action_candidates);
  const sources = [
    visibleText
      ? {
          source: 'dom_visible_text_bounded_summary',
          item_count: 1,
          character_count: visibleText.length,
          bounded: true,
          content_included: true
        }
      : null,
    headings.length > 0
      ? {
          source: 'heading_text',
          item_count: headings.length,
          character_count: headings.join(' ').length,
          bounded: true,
          content_included: true
        }
      : null,
    actionTexts.length > 0
      ? {
          source: 'action_text',
          item_count: actionTexts.length,
          character_count: actionTexts.join(' ').length,
          bounded: true,
          content_included: true
        }
      : null,
    textSnippets.length > 0
      ? {
          source: 'deterministic_review_summary',
          item_count: textSnippets.length,
          character_count: textSnippets.map((item) => item.text).join(' ').length,
          bounded: true,
          content_included: true
        }
      : null
  ].filter(Boolean);
  return {
    schema_version: SCHEMA_VERSION,
    provenance_version: HUMAN_REVIEW_TEXT_PROVENANCE_VERSION,
    source_count: sources.length,
    sources,
    source_separation: {
      dom_visible_text_included_as_bounded_summary: Boolean(visibleText),
      headings_included: headings.length > 0,
      action_text_included: actionTexts.length > 0,
      deterministic_review_text_included: textSnippets.length > 0,
      local_ocr_performed: false,
      provider_ocr_performed: false,
      raw_dom_included: false,
      raw_report_body_included: false
    },
    ocr_status: {
      external_ocr_performed: false,
      local_ocr_performed: false,
      provider_ocr_performed: false,
      provider_ocr_requires_approved_visual_transfer: true
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildVisibleTextReadingContract({ textSnippets, review, intent, visibleTextProvenance }) {
  const headings = visibleTextItems(review.evidence_summary?.headings ?? review.layout?.headings)
    .slice(0, 20)
    .map((text) => truncateText(text, 180));
  const actionTexts = visibleTextItems(review.evidence_summary?.action_texts ?? review.action_candidates)
    .slice(0, 20)
    .map((text) => truncateText(text, 180));
  return {
    schema_version: SCHEMA_VERSION,
    reading_contract_version: HUMAN_REVIEW_EVIDENCE_PACKAGE_VERSION,
    text_provenance_version: visibleTextProvenance?.provenance_version ?? HUMAN_REVIEW_TEXT_PROVENANCE_VERSION,
    intent: truncateText(intent, 900),
    snippet_count: textSnippets.length,
    bounded_text_snippets: textSnippets.slice(0, MAX_TEXT_SNIPPETS),
    source_provenance: visibleTextProvenance ?? null,
    heading_summary: {
      count: headings.length,
      items: headings
    },
    action_text_summary: {
      count: actionTexts.length,
      items: actionTexts
    },
    required_reading_tasks: [
      'summarize what the visible text tells a normal reader',
      'identify likely misunderstanding, vague wording, missing proof, and terminology risk',
      'separate content value from UI or technical value loss',
      'prioritize practical copy or structure improvements'
    ],
    ocr_boundary: {
      external_ocr_performed: false,
      provider_ocr_allowed_only_after_approved_visual_transfer: true,
      raw_dom_included: false,
      raw_report_body_included: false
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildScreenTextUnderstandingContract({ textSnippets, intent, visibleTextProvenance }) {
  return {
    schema_version: SCHEMA_VERSION,
    contract_version: HUMAN_REVIEW_TEXT_PROVENANCE_VERSION,
    intent: truncateText(intent, 900),
    snippet_count: textSnippets.length,
    text_source_count: visibleTextProvenance?.source_count ?? 0,
    reviewer_tasks: [
      'read the bounded visible text before making subjective claims',
      'separate what the page says from how the UI makes that message feel',
      'call out likely reader confusion, trust gaps, and missing context',
      'state when OCR or raw-pixel inspection was not performed'
    ],
    source_requirements: {
      distinguish_dom_visible_text_from_review_summary: true,
      distinguish_heading_and_action_text: true,
      do_not_claim_ocr_when_external_ocr_performed_is_false: true
    },
    external_ocr_performed: false,
    provider_ocr_allowed_only_after_approved_visual_transfer: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function resolveBenchmarkCase(caseId) {
  if (!caseId) {
    return null;
  }
  const match = BENCHMARK_CASES.find((item) => item.case_id === caseId);
  return match ? cloneBenchmarkCase(match) : null;
}

function cloneBenchmarkCase(benchmarkCase) {
  return {
    case_id: benchmarkCase.case_id,
    fixture_type: benchmarkCase.fixture_type,
    rubric_profile_id: benchmarkCase.rubric_profile_id,
    target_audience: benchmarkCase.target_audience,
    required_dimensions: [...benchmarkCase.required_dimensions],
    required_mentions: [...benchmarkCase.required_mentions],
    forbidden_claims: [...benchmarkCase.forbidden_claims],
    thresholds: { ...benchmarkCase.thresholds },
    allowed_evidence_classes: [...benchmarkCase.allowed_evidence_classes],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildHumanBaselineRegistry({ input = null, inputPath = null, inputHash = null, now }) {
  const normalized = normalizeHumanBaselineRegistryInput(input);
  const commonRubric = normalized.common_rubric ?? defaultHumanBaselineCommonRubric();
  const targetTypeTemplates = normalized.target_type_templates.length > 0
    ? normalized.target_type_templates
    : defaultHumanBaselineTargetTypeTemplates();
  const benchmarkCases = normalized.benchmark_cases.length > 0
    ? normalized.benchmark_cases
    : BENCHMARK_CASES.map(cloneBenchmarkCase);
  const registryCore = {
    registry_version: stringOrNull(normalized.registry_version) ?? HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    common_rubric: commonRubric,
    target_type_templates: targetTypeTemplates,
    benchmark_cases: benchmarkCases
  };
  const warnings = [
    ...(normalized.warnings ?? []),
    ...(targetTypeTemplates.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_REGISTRY_TEMPLATES_MISSING', message: 'No target-type templates were available.' }]),
    ...(benchmarkCases.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_REGISTRY_CASES_MISSING', message: 'No benchmark cases were available.' }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_registry',
    human_baseline_operations_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    generated_at: now.toISOString(),
    input_path: inputPath,
    input_hash: inputHash,
    registry_hash: hashJson(registryCore),
    ...registryCore,
    summary: {
      target_type_template_count: targetTypeTemplates.length,
      benchmark_case_count: benchmarkCases.length,
      dimension_count: Array.isArray(commonRubric.dimensions) ? commonRubric.dimensions.length : 0,
      source: input ? 'workspace_registry_input' : 'packaged_defaults'
    },
    validation: {
      status: warnings.length === 0 ? 'valid_human_baseline_registry' : 'human_baseline_registry_warnings_present',
      configurable_registry: true,
      draft_proof_allowed: false,
      owner_labeled_evidence_required: true
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeHumanBaselineRegistryInput(input) {
  const source = input?.data?.agentic_human_review_human_baseline_registry
    ?? input?.agentic_human_review_human_baseline_registry
    ?? input?.human_baseline_registry
    ?? input?.registry
    ?? input
    ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {
      common_rubric: null,
      target_type_templates: [],
      benchmark_cases: [],
      warnings: []
    };
  }
  return {
    registry_version: source.registry_version ?? source.human_baseline_operations_version,
    common_rubric: normalizeCommonRubric(source.common_rubric ?? source.rubric),
    target_type_templates: normalizeTargetTypeTemplates(source.target_type_templates ?? source.templates),
    benchmark_cases: normalizeRegistryBenchmarkCases(source.benchmark_cases ?? source.cases),
    warnings: []
  };
}

function defaultHumanBaselineCommonRubric() {
  return {
    rubric_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    dimensions: HUMAN_REVIEW_DIMENSIONS.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      purpose: dimension.purpose,
      required_fields: [...dimension.required_fields]
    })),
    reusable_criteria: [
      'Tie every important judgment to local evidence references or explicit uncertainty.',
      'Separate subjective reader perception from deterministic release or gate status.',
      'Record must-not-miss risks and severity so future comparisons can score misses.',
      'Keep suggested fixes concrete enough for a product owner to accept, edit, or reject.'
    ],
    proof_policy: {
      ai_draft_is_proof: false,
      owner_approval_required: true,
      deterministic_gate_effect_allowed: false
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function defaultHumanBaselineTargetTypeTemplates() {
  return RUBRIC_PROFILES.map((profile) => ({
    template_id: profile.id,
    template_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    label: profile.label,
    fixture_types: [...profile.fixture_types],
    emphasis: [...profile.emphasis],
    evidence_priority: [...profile.evidence_priority],
    required_label_fields: ['id', 'dimension', 'summary', 'severity', 'evidence_refs'],
    approval_requirements: ['decision', 'approver_id', 'approved_at', 'draft_hash', 'overlay_hash', 'edit_diff'],
    advisory_only: true,
    gate_effect: 'none'
  }));
}

function normalizeCommonRubric(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const suppliedProofPolicy = value.proof_policy && typeof value.proof_policy === 'object'
    ? value.proof_policy
    : {};
  return {
    rubric_version: stringOrNull(value.rubric_version) ?? HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    human_review_schema_version: stringOrNull(value.human_review_schema_version) ?? HUMAN_REVIEW_SCHEMA_VERSION,
    dimensions: normalizeRubricDimensions(value.dimensions),
    reusable_criteria: normalizeStringArray(value.reusable_criteria ?? value.criteria),
    proof_policy: {
      ...suppliedProofPolicy,
      ai_draft_is_proof: false,
      owner_approval_required: true,
      deterministic_gate_effect_allowed: false
    },
    advisory_only: value.advisory_only !== false,
    gate_effect: value.gate_effect ?? 'none'
  };
}

function normalizeRubricDimensions(values) {
  if (!Array.isArray(values)) {
    return HUMAN_REVIEW_DIMENSIONS.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      purpose: dimension.purpose,
      required_fields: [...dimension.required_fields]
    }));
  }
  return values.slice(0, 30).map((value, index) => ({
    id: normalizeHumanReviewDimensionId(value?.id ?? value?.dimension ?? value?.name) ?? `dimension_${index + 1}`,
    label: truncateText(value?.label ?? value?.name ?? value?.id ?? `Dimension ${index + 1}`, 120),
    purpose: secretSafeText(value?.purpose ?? value?.description ?? '', 500),
    required_fields: normalizeStringArray(value?.required_fields)
  }));
}

function normalizeTargetTypeTemplates(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 50).map((value, index) => ({
    template_id: truncateText(value?.template_id ?? value?.id ?? `target-template-${index + 1}`, 120),
    template_version: stringOrNull(value?.template_version ?? value?.version) ?? HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    label: truncateText(value?.label ?? value?.name ?? `Target template ${index + 1}`, 160),
    fixture_types: normalizeStringArray(value?.fixture_types ?? value?.target_types),
    emphasis: normalizeStringArray(value?.emphasis),
    evidence_priority: normalizeStringArray(value?.evidence_priority),
    required_label_fields: normalizeStringArray(value?.required_label_fields).length > 0
      ? normalizeStringArray(value?.required_label_fields)
      : ['id', 'dimension', 'summary', 'severity', 'evidence_refs'],
    approval_requirements: normalizeStringArray(value?.approval_requirements).length > 0
      ? normalizeStringArray(value?.approval_requirements)
      : ['decision', 'approver_id', 'approved_at', 'draft_hash', 'overlay_hash', 'edit_diff'],
    advisory_only: value?.advisory_only !== false,
    gate_effect: value?.gate_effect ?? 'none'
  }));
}

function normalizeRegistryBenchmarkCases(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 100).map((value, index) => ({
    case_id: truncateText(value?.case_id ?? value?.id ?? `case-${index + 1}`, 120),
    fixture_type: truncateText(value?.fixture_type ?? value?.target_type ?? 'general', 120),
    rubric_profile_id: truncateText(value?.rubric_profile_id ?? value?.template_id ?? 'general-human-review', 120),
    target_audience: secretSafeText(value?.target_audience ?? '', 500),
    required_dimensions: normalizeStringArray(value?.required_dimensions),
    required_mentions: normalizeStringArray(value?.required_mentions),
    forbidden_claims: normalizeStringArray(value?.forbidden_claims),
    thresholds: {
      coverage_score: Number(value?.thresholds?.coverage_score ?? 0.75),
      actionability_score: Number(value?.thresholds?.actionability_score ?? 0.6),
      forbidden_claim_score: Number(value?.thresholds?.forbidden_claim_score ?? 1)
    },
    allowed_evidence_classes: normalizeStringArray(value?.allowed_evidence_classes),
    advisory_only: true,
    gate_effect: 'none'
  }));
}

function buildHumanBaselineCaseOverlay({ registry, caseId, input = null, inputPath = null, inputHash = null, now }) {
  const overlayInput = normalizeHumanBaselineOverlaySource(input);
  const selectedCaseId = stringOrNull(caseId ?? overlayInput.case_id);
  const benchmarkCase = registry.benchmark_cases.find((item) => item.case_id === selectedCaseId)
    ?? resolveBenchmarkCase(selectedCaseId);
  const template = registry.target_type_templates.find((item) => item.template_id === (benchmarkCase?.rubric_profile_id ?? overlayInput.template_id))
    ?? registry.target_type_templates.find((item) => item.fixture_types.includes(benchmarkCase?.fixture_type))
    ?? registry.target_type_templates[0]
    ?? null;
  const requiredDimensions = uniqueSorted([
    ...(benchmarkCase?.required_dimensions ?? []),
    ...normalizeStringArray(overlayInput.required_dimensions)
  ].map(normalizeHumanReviewDimensionId).filter(Boolean));
  const requiredMentions = uniqueSorted([
    ...(benchmarkCase?.required_mentions ?? []),
    ...normalizeStringArray(overlayInput.required_mentions)
  ]);
  const forbiddenClaims = uniqueSorted([
    ...(benchmarkCase?.forbidden_claims ?? []),
    ...normalizeStringArray(overlayInput.forbidden_claims)
  ]);
  const mustNotMissCriteria = normalizeMustNotMissCriteria(overlayInput.must_not_miss_criteria, requiredDimensions, requiredMentions);
  const overlayCore = {
    case_id: selectedCaseId,
    fixture_type: stringOrNull(overlayInput.fixture_type ?? benchmarkCase?.fixture_type),
    target_type_template_id: template?.template_id ?? null,
    target_audience: secretSafeText(overlayInput.target_audience ?? benchmarkCase?.target_audience ?? '', 500),
    required_dimensions: requiredDimensions,
    required_mentions: requiredMentions,
    forbidden_claims: forbiddenClaims,
    must_not_miss_criteria: mustNotMissCriteria,
    acceptance_conditions: normalizeStringArray(overlayInput.acceptance_conditions).length > 0
      ? normalizeStringArray(overlayInput.acceptance_conditions)
      : [
          'Every required owner label must either match the candidate result or be explicitly recorded as a miss.',
          'Every high or critical owner label must include at least one local evidence reference.',
          'Forbidden claims must remain absent from the candidate result.'
        ],
    evidence_requirements: {
      local_evidence_refs_required: true,
      content_included: false,
      raw_pixels_embedded_in_json: false,
      accepted_reference_types: ['review-artifact-index', 'screenshot-reference', 'text-snippet-reference', 'owner-note-reference']
    }
  };
  const warnings = [
    ...(selectedCaseId ? [] : [{ code: 'AHR_HUMAN_BASELINE_OVERLAY_CASE_MISSING', message: 'A case overlay needs a case id.' }]),
    ...(benchmarkCase ? [] : [{ code: 'AHR_HUMAN_BASELINE_OVERLAY_CASE_UNKNOWN', message: 'The case overlay does not match a known registry benchmark case.', details: { case_id: selectedCaseId } }]),
    ...(requiredDimensions.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_OVERLAY_DIMENSIONS_MISSING', message: 'The case overlay has no required dimensions.' }]),
    ...(requiredMentions.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_OVERLAY_MENTIONS_MISSING', message: 'The case overlay has no required mentions.' }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_overlay',
    human_baseline_operations_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    generated_at: now.toISOString(),
    input_path: inputPath,
    input_hash: inputHash,
    registry_hash: registry.registry_hash,
    case_overlay: overlayCore,
    overlay_hash: hashJson(overlayCore),
    validation: {
      status: warnings.length === 0 ? 'valid_case_overlay' : 'case_overlay_warnings_present',
      ready_for_ai_draft: warnings.length === 0,
      owner_labeled: false,
      proof_allowed: false
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeHumanBaselineOverlaySource(input) {
  const source = input?.data?.agentic_human_review_human_baseline_overlay
    ?? input?.agentic_human_review_human_baseline_overlay
    ?? input?.case_overlay
    ?? input?.overlay
    ?? input
    ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }
  return source.case_overlay && typeof source.case_overlay === 'object'
    ? { ...source, ...source.case_overlay }
    : source;
}

function normalizeMustNotMissCriteria(values, requiredDimensions, requiredMentions) {
  const explicit = Array.isArray(values) ? values : [];
  if (explicit.length > 0) {
    return explicit.slice(0, 50).map((value, index) => ({
      id: truncateText(value?.id ?? `must-not-miss-${index + 1}`, 120),
      dimension: normalizeHumanReviewDimensionId(value?.dimension) ?? null,
      summary: secretSafeText(value?.summary ?? value?.description ?? value?.label ?? `Must-not-miss criterion ${index + 1}`, 500),
      severity: SEVERITIES.has(value?.severity) ? value.severity : 'high',
      match_terms: normalizeStringArray(value?.match_terms ?? value?.keywords),
      evidence_refs: normalizeHumanBaselineEvidenceRefs(value?.evidence_refs ?? value?.evidence ?? value?.artifacts),
      target_specific: value?.target_specific !== false,
      source_kind: truncateText(value?.source_kind ?? value?.source ?? 'target_specific_overlay', 120)
    }));
  }
  return [
    ...requiredDimensions.map((dimension) => ({
      id: `dimension-${dimension}`,
      dimension,
      summary: `Candidate review must cover ${dimension}.`,
      severity: 'high',
      match_terms: [dimension],
      target_specific: false,
      source_kind: 'generic_requirement'
    })),
    ...requiredMentions.map((mention, index) => ({
      id: `mention-${index + 1}`,
      dimension: null,
      summary: `Candidate review must address ${mention}.`,
      severity: 'medium',
      match_terms: [mention],
      target_specific: false,
      source_kind: 'generic_requirement'
    }))
  ].slice(0, 50);
}

function buildHumanBaselineDraft({ registry, overlayInput, overlayPath, overlayHash, now }) {
  const overlay = normalizeHumanBaselineOverlaySource(overlayInput);
  const caseOverlay = overlay.case_overlay ?? overlay;
  const caseId = stringOrNull(caseOverlay.case_id);
  const draftLabels = normalizeDraftLabelsFromOverlay(caseOverlay);
  const draftCore = {
    baseline_id: `draft-${caseId ?? 'case'}`,
    case_id: caseId,
    fixture_type: stringOrNull(caseOverlay.fixture_type),
    rubric_profile_id: stringOrNull(caseOverlay.target_type_template_id),
    rubric_version: registry.common_rubric?.rubric_version ?? HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    template_version: registry.target_type_templates.find((item) => item.template_id === caseOverlay.target_type_template_id)?.template_version ?? HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    overlay_hash: overlayHash,
    owner_labeled: false,
    proof_allowed: false,
    required_dimensions: normalizeStringArray(caseOverlay.required_dimensions),
    required_mentions: normalizeStringArray(caseOverlay.required_mentions),
    forbidden_claims: normalizeStringArray(caseOverlay.forbidden_claims),
    must_not_miss_criteria: Array.isArray(caseOverlay.must_not_miss_criteria) ? caseOverlay.must_not_miss_criteria : [],
    owner_label_set: {
      owner_labeled: false,
      labels: draftLabels,
      advisory_only: true,
      gate_effect: 'none'
    },
    human_review_instructions: [
      'Review this draft as preparation only.',
      'Accept, edit, or reject each proposed label before it can become owner-labeled evidence.',
      'Add local evidence references without embedding raw pixels, raw DOM, credential values, or report bodies.'
    ],
    advisory_only: true,
    gate_effect: 'none'
  };
  const warnings = [
    ...(caseId ? [] : [{ code: 'AHR_HUMAN_BASELINE_DRAFT_CASE_MISSING', message: 'The draft has no case id.' }]),
    ...(draftLabels.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_DRAFT_LABELS_MISSING', message: 'The draft has no proposed labels.' }]),
    { code: 'AHR_HUMAN_BASELINE_DRAFT_NOT_OWNER_EVIDENCE', message: 'AI baseline drafts are not owner-labeled evidence and cannot support equality or superiority claims.' }
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_draft',
    human_baseline_operations_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    generated_at: now.toISOString(),
    overlay_path: overlayPath,
    overlay_hash: hashJson(caseOverlay),
    source_overlay_hash: overlayHash,
    draft_hash: hashJson(draftCore),
    draft: draftCore,
    validation: {
      status: 'draft_for_owner_review',
      owner_labeled: false,
      proof_allowed: false,
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeDraftLabelsFromOverlay(caseOverlay) {
  const criteria = Array.isArray(caseOverlay.must_not_miss_criteria) ? caseOverlay.must_not_miss_criteria : [];
  return criteria.slice(0, MAX_HUMAN_BASELINE_LABELS).map((criterion, index) => ({
    id: truncateText(criterion?.id ?? `draft-label-${index + 1}`, 120),
    dimension: normalizeHumanReviewDimensionId(criterion?.dimension) ?? null,
    summary: secretSafeText(criterion?.summary ?? criterion?.description ?? `Draft label ${index + 1}`, 700),
    severity: SEVERITIES.has(criterion?.severity) ? criterion.severity : 'medium',
    required: true,
    match_terms: normalizeStringArray(criterion?.match_terms).length > 0
      ? normalizeStringArray(criterion?.match_terms)
      : normalizeStringArray([criterion?.summary, criterion?.dimension]),
    evidence_refs: normalizeHumanBaselineEvidenceRefs(criterion?.evidence_refs),
    confidence: 'inconclusive',
    owner_review_status: 'draft',
    must_not_miss_criterion_id: truncateText(criterion?.id ?? `draft-label-${index + 1}`, 120),
    criteria_refs: [truncateText(criterion?.id ?? `draft-label-${index + 1}`, 120)],
    target_specific: isTargetSpecificMustNotMissCriterion(criterion)
  }));
}

function buildHumanBaselineApprovalPacket({ draftInput, draftPath, draftHash, options, now }) {
  const draft = normalizeHumanBaselineDraftSource(draftInput);
  const decision = normalizeApprovalDecision(options.decision);
  const approval = normalizeHumanBaselineApproval({
    decision,
    approver_id: options.approver,
    approved_at: options['approved-at'],
    draft_hash: draftHash,
    overlay_hash: draft.overlay_hash,
    rubric_version: draft.rubric_version,
    template_version: draft.template_version,
    edit_diff: options['edit-diff']
  });
  const approvalWarnings = humanBaselineApprovalWarnings(approval);
  const labels = normalizeHumanBaselineLabels(draft.owner_label_set?.labels ?? draft.labels);
  const mustNotMissCriteria = normalizeHumanBaselineMustNotMissCriteria(draft.must_not_miss_criteria);
  const mustNotMissVerification = evaluateHumanBaselineMustNotMissCriteria({
    criteria: mustNotMissCriteria,
    labels,
    requireEvidenceRefs: true
  });
  const mustNotMissWarnings = approval.decision === 'approved' ? mustNotMissVerification.warnings : [];
  const approved = approvalWarnings.length === 0
    && mustNotMissWarnings.length === 0
    && approval.decision === 'approved';
  const approvedBaseline = {
    type: 'agentic_human_review_human_baseline_input',
    baseline_id: truncateText(options['baseline-id'] ?? draft.baseline_id ?? `approved-${draft.case_id ?? 'case'}`, 120),
    case_id: draft.case_id,
    fixture_type: draft.fixture_type,
    rubric_profile_id: draft.rubric_profile_id,
    rubric_version: approval.rubric_version,
    template_version: approval.template_version,
    overlay_hash: approval.overlay_hash,
    draft_hash: approval.draft_hash,
    owner_labeled: approved,
    approval,
    required_dimensions: normalizeStringArray(draft.required_dimensions),
    required_mentions: normalizeStringArray(draft.required_mentions),
    forbidden_claims: normalizeStringArray(draft.forbidden_claims),
    must_not_miss_criteria: mustNotMissCriteria,
    owner_label_set: {
      reviewer_id: approval.approver_id,
      reviewed_at: approval.approved_at,
      rubric_version: approval.rubric_version,
      case_id: draft.case_id,
      owner_labeled: approved,
      labels,
      advisory_only: true,
      gate_effect: 'none'
    },
    advisory_only: true,
    gate_effect: 'none'
  };
  const warnings = [
    ...approvalWarnings,
    ...mustNotMissWarnings,
    ...(approved ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVAL_NOT_APPROVED', message: 'The approval packet did not create owner-labeled evidence.' }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_approval_packet',
    human_baseline_operations_version: HUMAN_REVIEW_HUMAN_BASELINE_OPERATIONS_VERSION,
    generated_at: now.toISOString(),
    draft_path: draftPath,
    draft_hash: draftHash,
    approval,
    approved_baseline: approvedBaseline,
    target_specific_must_not_miss: mustNotMissVerification.summary,
    validation: {
      decision,
      approval_metadata_complete: approvalWarnings.length === 0,
      target_specific_must_not_miss_criteria_complete: mustNotMissVerification.complete,
      must_not_miss_criteria_verified: mustNotMissVerification.complete,
      owner_labeled_baseline_ready: approved,
      proof_allowed: false,
      baseline_comparison_input_allowed: approved,
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeHumanBaselineDraftSource(input) {
  const source = input?.data?.agentic_human_review_human_baseline_draft
    ?? input?.agentic_human_review_human_baseline_draft
    ?? input?.draft
    ?? input
    ?? {};
  const draft = source.draft && typeof source.draft === 'object' ? source.draft : source;
  return draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {};
}

function normalizeApprovalDecision(value) {
  const decision = String(value ?? '').trim();
  return HUMAN_BASELINE_APPROVAL_DECISIONS.has(decision) ? decision : 'needs-edits';
}

function buildCalibrationContractForCase(benchmarkCase, rubricProfile) {
  return {
    schema_version: SCHEMA_VERSION,
    calibration_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    case_id: benchmarkCase.case_id,
    rubric_profile_id: rubricProfile.id,
    required_dimensions: [...benchmarkCase.required_dimensions],
    required_mentions: [...benchmarkCase.required_mentions],
    forbidden_claims: [...benchmarkCase.forbidden_claims],
    thresholds: { ...benchmarkCase.thresholds },
    scoring: {
      structured_record_completeness: 'fraction of required benchmark records explicitly returned in benchmark_requirement_coverage',
      required_mention_coverage: 'fraction of benchmark-required mentions covered by structured evidence-backed records',
      forbidden_claim_score: '1 means no forbidden claim was found',
      dimension_coverage: 'fraction of required dimensions covered by structured evidence-backed records',
      actionability_score: 'normalized report-quality actionability score'
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildProviderDeclaredBenchmarkRequirementCoverage({ plan, input }) {
  const benchmarkCase = resolveBenchmarkCase(plan.review_quality_benchmark?.case_id ?? plan.dogfood_metadata?.case_id);
  if (!benchmarkCase) {
    return null;
  }
  return {
    schema_version: SCHEMA_VERSION,
    coverage_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    source: 'deterministic_fake_provider_contract',
    case_id: benchmarkCase.case_id,
    rubric_profile_id: benchmarkCase.rubric_profile_id,
    required_mentions: benchmarkCase.required_mentions.map((mention, index) => ({
      mention,
      status: 'covered',
      present: true,
      evidence: benchmarkRequirementEvidenceText({ kind: 'mention', id: mention, input }),
      evidence_refs: [benchmarkRequirementEvidenceReference({ plan, kind: 'mention', id: mention, index })]
    })),
    required_dimensions: benchmarkCase.required_dimensions.map((dimension, index) => ({
      dimension,
      status: 'covered',
      present: true,
      evidence: benchmarkRequirementEvidenceText({ kind: 'dimension', id: dimension, input }),
      evidence_refs: [benchmarkRequirementEvidenceReference({ plan, kind: 'dimension', id: dimension, index })]
    })),
    forbidden_claims: benchmarkCase.forbidden_claims.map((claim, index) => ({
      claim,
      status: 'absent',
      present: false,
      evidence: `The deterministic advisory output makes no benchmark-forbidden claim: ${claim}.`,
      evidence_refs: [benchmarkRequirementEvidenceReference({ plan, kind: 'forbidden_claim', id: claim, index })]
    })),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function benchmarkRequirementEvidenceText({ kind, id, input }) {
  const summary = secretSafeText(input.summary ?? input.human_report_v3?.summary ?? 'Advisory output reviewed this benchmark requirement.', 360);
  return `${kind} "${id}" is addressed by the advisory summary, reader-experience review, role opinions, and owner-review action plan. ${summary}`;
}

function benchmarkRequirementEvidenceReference({ plan, kind, id, index }) {
  return {
    type: 'agentic_human_review_package',
    path: safeArtifactReferencePath(plan.package_path ?? plan.plan_path),
    description: secretSafeText(`Local deterministic ${kind} benchmark evidence reference for "${id}".`, 220),
    ref_id: truncateText(`benchmark-${kind}-${index + 1}`, 80),
    content_included: false,
    local_reference: true
  };
}

function buildDeterministicFakeBenchmarkFindings({ plan }) {
  const benchmarkCase = resolveBenchmarkCase(plan.review_quality_benchmark?.case_id ?? plan.dogfood_metadata?.case_id);
  if (!benchmarkCase) {
    return [];
  }
  const dimensionFindings = benchmarkCase.required_dimensions.map((dimension, index) => ({
    id: truncateText(`fake-benchmark-dimension-${index + 1}`, 120),
    category: normalizeHumanReviewDimensionId(dimension) ?? 'human_review_advisory',
    severity: 'high',
    message: `Candidate review must cover ${dimension}.`,
    recommendation: `Use real owner review to confirm the ${dimension} judgment before treating it as evidence.`,
    evidence_refs: [benchmarkRequirementEvidenceReference({ plan, kind: 'dimension', id: dimension, index })],
    synthetic_fixture: true,
    claim_numerator_eligible: false
  }));
  const mentionFindings = benchmarkCase.required_mentions.map((mention, index) => ({
    id: truncateText(`fake-benchmark-mention-${index + 1}`, 120),
    category: 'benchmark_requirement',
    severity: 'medium',
    message: `Candidate review must address ${mention}.`,
    recommendation: `Use a real provider or owner-reviewed result to validate the ${mention} judgment.`,
    evidence_refs: [benchmarkRequirementEvidenceReference({ plan, kind: 'mention', id: mention, index })],
    synthetic_fixture: true,
    claim_numerator_eligible: false
  }));
  return [...dimensionFindings, ...mentionFindings].slice(0, MAX_FINDINGS);
}

function buildBenchmarkRequirementCoverage({ plan = null, input = {}, humanReviewCoverage = null, readerExperienceReview = null, benchmarkCase = null } = {}) {
  const contract = plan?.review_quality_benchmark ?? null;
  const resolvedCase = benchmarkCase
    ?? resolveBenchmarkCase(contract?.case_id ?? plan?.dogfood_metadata?.case_id ?? input?.calibration_metadata?.benchmark_case_id ?? input?.dogfood_metadata?.case_id);
  const enabled = Boolean(contract?.enabled || resolvedCase);
  const requiredMentions = normalizeStringArray(contract?.required_mentions ?? resolvedCase?.required_mentions);
  const requiredDimensions = normalizeStringArray(contract?.required_dimensions ?? resolvedCase?.required_dimensions);
  const forbiddenClaims = normalizeStringArray(contract?.forbidden_claims ?? resolvedCase?.forbidden_claims);
  const thresholds = {
    coverage_score: Number(contract?.thresholds?.coverage_score ?? resolvedCase?.thresholds?.coverage_score ?? 0.75),
    actionability_score: Number(contract?.thresholds?.actionability_score ?? resolvedCase?.thresholds?.actionability_score ?? 0.6),
    forbidden_claim_score: Number(contract?.thresholds?.forbidden_claim_score ?? resolvedCase?.thresholds?.forbidden_claim_score ?? 1)
  };
  if (!enabled) {
    return {
      schema_version: SCHEMA_VERSION,
      coverage_version: HUMAN_REVIEW_CALIBRATION_VERSION,
      enabled: false,
      status: 'not_enabled',
      case_id: null,
      rubric_profile_id: null,
      required_mentions: [],
      required_dimensions: [],
      forbidden_claims: [],
      summary: {
        required_mention_coverage_score: 0,
        dimension_coverage_score: 0,
        forbidden_claim_score: 1,
        structured_record_completeness_score: 1,
        evidence_backed_record_score: 1,
        evidence_ref_backed_record_score: 1
      },
      advisory_only: true,
      gate_effect: 'none'
    };
  }
  const rawCoverage = input?.benchmark_requirement_coverage
    ?? input?.benchmark_calibration_evidence
    ?? input?.calibration_evidence
    ?? null;
  const normalizedCoverage = normalizeProviderBenchmarkRequirementCoverage(rawCoverage);
  const text = calibrationSearchText(input);
  const humanCoveredDimensions = new Set((humanReviewCoverage?.dimensions ?? input?.human_review_coverage?.dimensions ?? [])
    .filter((dimension) => dimension.status === 'covered')
    .map((dimension) => dimension.id));
  const requiredMentionRecords = requiredMentions.map((mention) => {
    const providerRecord = findBenchmarkCoverageRecord(normalizedCoverage.required_mentions, mention, ['mention', 'requirement', 'required_mention', 'id', 'name', 'label', 'text']);
    const diagnosticTextPresent = textIncludesLoose(text, mention);
    const evidence = secretSafeText(providerRecord?.evidence ?? providerRecord?.reason ?? '', 700);
    const evidenceRefs = normalizeArtifactReferences(providerRecord?.evidence_refs ?? providerRecord?.artifacts);
    const structuredPresent = Boolean(providerRecord);
    const evidenceBacked = structuredPresent && evidence.length > 0;
    const evidenceRefBacked = evidenceRefs.length > 0;
    const present = evidenceBacked && benchmarkRecordIsPresent(providerRecord);
    return {
      mention,
      present,
      status: present ? 'covered' : (structuredPresent ? 'missing_evidence_or_not_covered' : 'missing_structured_record'),
      evidence,
      evidence_refs: evidenceRefs,
      structured_record_present: structuredPresent,
      evidence_backed: evidenceBacked,
      evidence_ref_backed: evidenceRefBacked,
      diagnostic_text_present: diagnosticTextPresent
    };
  });
  const requiredDimensionRecords = requiredDimensions.map((dimension) => {
    const providerRecord = findBenchmarkCoverageRecord(normalizedCoverage.required_dimensions, dimension, ['dimension', 'required_dimension', 'id', 'name', 'label', 'text']);
    const evidence = secretSafeText(providerRecord?.evidence ?? providerRecord?.reason ?? '', 700);
    const evidenceRefs = normalizeArtifactReferences(providerRecord?.evidence_refs ?? providerRecord?.artifacts);
    const structuredPresent = Boolean(providerRecord);
    const evidenceBacked = structuredPresent && evidence.length > 0;
    const evidenceRefBacked = evidenceRefs.length > 0;
    const present = evidenceBacked && benchmarkRecordIsPresent(providerRecord);
    return {
      dimension,
      present,
      status: present ? 'covered' : (structuredPresent ? 'missing_evidence_or_not_covered' : 'missing_structured_record'),
      evidence,
      evidence_refs: evidenceRefs,
      structured_record_present: structuredPresent,
      evidence_backed: evidenceBacked,
      evidence_ref_backed: evidenceRefBacked,
      human_review_coverage_present: humanCoveredDimensions.has(dimension),
      reader_experience_present: benchmarkDimensionReaderExperiencePresent({ dimension, readerExperienceReview, input })
    };
  });
  const forbiddenClaimRecords = forbiddenClaims.map((claim) => {
    const providerRecord = findBenchmarkCoverageRecord(normalizedCoverage.forbidden_claims, claim, ['claim', 'forbidden_claim', 'id', 'name', 'label', 'text']);
    const diagnosticTextPresent = textIncludesLoose(text, claim);
    const structuredPresent = Boolean(providerRecord);
    const absenceConfirmed = structuredPresent ? benchmarkForbiddenClaimAbsenceConfirmed(providerRecord) : false;
    const present = structuredPresent ? benchmarkForbiddenClaimPresent(providerRecord) : diagnosticTextPresent;
    const presenceContradiction = structuredPresent && present && absenceConfirmed;
    const evidenceRefs = normalizeArtifactReferences(providerRecord?.evidence_refs ?? providerRecord?.artifacts);
    return {
      claim,
      present,
      status: present
        ? (presenceContradiction ? 'forbidden_claim_present_with_absence_text' : 'forbidden_claim_present')
        : (structuredPresent ? 'absent' : 'absent_but_missing_structured_record'),
      evidence: secretSafeText(providerRecord?.evidence ?? providerRecord?.reason ?? '', 700),
      evidence_refs: evidenceRefs,
      structured_record_present: structuredPresent,
      evidence_backed: structuredPresent && secretSafeText(providerRecord?.evidence ?? providerRecord?.reason ?? '', 700).length > 0,
      evidence_ref_backed: evidenceRefs.length > 0,
      forbidden_claim_absence_confirmed: absenceConfirmed,
      forbidden_claim_presence_contradiction: presenceContradiction,
      diagnostic_text_present: diagnosticTextPresent
    };
  });
  const allRequiredRecords = [
    ...requiredMentionRecords,
    ...requiredDimensionRecords,
    ...forbiddenClaimRecords
  ];
  const structuredRecordCompleteness = fractionPresent(allRequiredRecords.map((record) => ({ present: record.structured_record_present })));
  const evidenceBackedRecordScore = fractionPresent(allRequiredRecords.map((record) => ({ present: record.evidence_backed })));
  const evidenceRefBackedRecordScore = fractionPresent(allRequiredRecords.map((record) => ({ present: record.evidence_ref_backed })));
  const requiredMentionCoverage = fractionPresent(requiredMentionRecords);
  const dimensionCoverage = fractionPresent(requiredDimensionRecords);
  const forbiddenClaimScore = forbiddenClaimRecords.some((record) => record.present) ? 0 : 1;
  const passed = structuredRecordCompleteness === 1
    && evidenceBackedRecordScore === 1
    && evidenceRefBackedRecordScore === 1
    && requiredMentionCoverage >= thresholds.coverage_score
    && dimensionCoverage >= thresholds.coverage_score
    && forbiddenClaimScore >= thresholds.forbidden_claim_score;
  return redact({
    schema_version: SCHEMA_VERSION,
    coverage_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    enabled: true,
    status: passed ? 'passed' : 'incomplete',
    case_id: resolvedCase?.case_id ?? contract?.case_id ?? null,
    fixture_type: resolvedCase?.fixture_type ?? contract?.fixture_type ?? null,
    rubric_profile_id: contract?.rubric_profile_id ?? resolvedCase?.rubric_profile_id ?? null,
    source: rawCoverage ? 'provider_structured_coverage' : 'missing_provider_structured_coverage',
    thresholds,
    required_mentions: requiredMentionRecords,
    required_dimensions: requiredDimensionRecords,
    forbidden_claims: forbiddenClaimRecords,
    summary: {
      required_mention_coverage_score: requiredMentionCoverage,
      dimension_coverage_score: dimensionCoverage,
      forbidden_claim_score: forbiddenClaimScore,
      structured_record_completeness_score: structuredRecordCompleteness,
      evidence_backed_record_score: evidenceBackedRecordScore,
      evidence_ref_backed_record_score: evidenceRefBackedRecordScore,
      human_review_dimension_diagnostic_score: clampScore(Number(humanReviewCoverage?.coverage_score ?? input?.human_review_coverage?.coverage_score ?? 0))
    },
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeProviderBenchmarkRequirementCoverage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      required_mentions: [],
      required_dimensions: [],
      forbidden_claims: []
    };
  }
  return {
    required_mentions: normalizeProviderCoverageSection(firstProviderCoverageSection(value, ['required_mentions', 'mentions', 'required_mention_coverage', 'mention_coverage', 'requirements']), 'mention'),
    required_dimensions: normalizeProviderCoverageSection(firstProviderCoverageSection(value, ['required_dimensions', 'dimensions', 'required_dimension_coverage', 'dimension_coverage']), 'dimension'),
    forbidden_claims: normalizeProviderCoverageSection(firstProviderCoverageSection(value, ['forbidden_claims', 'forbidden_claim_coverage', 'forbidden_claim_checks', 'claims']), 'claim')
  };
}

function firstProviderCoverageSection(value, keys) {
  for (const key of keys) {
    if (value[key] !== undefined) {
      return value[key];
    }
  }
  return [];
}

function normalizeProviderCoverageSection(value, labelKey) {
  if (Array.isArray(value)) {
    return value.map((record) => typeof record === 'string' ? { [labelKey]: record } : record).filter((record) => record && typeof record === 'object');
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).map(([key, nested]) => nested && typeof nested === 'object' && !Array.isArray(nested)
    ? { [labelKey]: key, ...nested }
    : { [labelKey]: key, evidence: nested }).filter((record) => record && typeof record === 'object');
}

function findBenchmarkCoverageRecord(records, expected, keys) {
  const expectedKey = normalizeCoverageKey(expected);
  return records.find((record) => keys.some((key) => normalizeCoverageKey(record?.[key]) === expectedKey));
}

function normalizeCoverageKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');
}

function benchmarkRecordIsPresent(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }
  if (record.present === true || record.covered === true) {
    return true;
  }
  const status = normalizeCoverageKey(record.status);
  return ['covered', 'present', 'met', 'addressed', 'absent'].includes(status) && status !== 'absent';
}

function benchmarkForbiddenClaimPresent(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }
  if (record.claim_present === true || record.detected === true || record.found === true) {
    return true;
  }
  if (record.present === true) {
    return true;
  }
  const status = normalizeCoverageKey(record.status);
  return [
    'forbidden claim present',
    'claim present',
    'present',
    'detected',
    'found'
  ].includes(status);
}

function benchmarkForbiddenClaimAbsenceConfirmed(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }
  if (
    record.present === false
    || record.claim_present === false
    || record.detected === false
    || record.found === false
    || record.forbidden_claim_absence_confirmed === true
  ) {
    return true;
  }
  const status = normalizeCoverageKey(record.status);
  if ([
    'absent',
    'not present',
    'not detected',
    'not found',
    'not claimed',
    'none'
  ].includes(status)) {
    return true;
  }
  const evidence = `${record.evidence ?? ''} ${record.reason ?? ''} ${record.rationale ?? ''}`;
  return /\b(no|not|without|absent|absence|none|avoids|omits|omitted|does not claim|did not claim|not claimed)\b/i.test(evidence);
}

function benchmarkDimensionReaderExperiencePresent({ dimension, readerExperienceReview, input }) {
  const source = readerExperienceReview ?? input?.reader_experience_review ?? {};
  if (dimension === 'first_impression') {
    return normalizeStringArray(source.first_impression ?? input?.subjective_perception?.first_impression).length > 0;
  }
  if (dimension === 'reader_emotion') {
    return normalizeStringArray(source.likely_viewer_feeling ?? input?.subjective_perception?.emotional_reception).length > 0;
  }
  if (dimension === 'content_comprehension') {
    return normalizeStringArray(source.content_takeaway ?? input?.readability_comprehension?.meaning_gaps).length > 0;
  }
  if (dimension === 'trust_and_credibility') {
    return normalizeStringArray(source.trust_assessment ?? input?.subjective_perception?.trust_and_credibility).length > 0;
  }
  if (dimension === 'visual_ux') {
    return normalizeStringArray(source.visual_ux_assessment).length > 0;
  }
  if (dimension === 'accessibility_comprehension') {
    return normalizeStringArray(source.accessibility_comprehension ?? input?.readability_comprehension?.meaning_gaps).length > 0;
  }
  if (dimension === 'risk_and_misleading_content') {
    return normalizeStringArray(source.risk_and_misleading_content ?? input?.readability_comprehension?.terminology_risk ?? input?.subjective_perception?.likely_user_questions).length > 0;
  }
  if (dimension === 'improvement_priority') {
    return normalizeStringArray(source.priority_recommendation ?? input?.improvement_suggestions).length > 0;
  }
  return false;
}

function buildCalibrationResult({ result, resultPath, benchmarkCase, now }) {
  const benchmarkRequirementCoverage = buildBenchmarkRequirementCoverage({
    input: result,
    humanReviewCoverage: result.human_review_coverage ?? null,
    readerExperienceReview: result.reader_experience_review ?? null,
    benchmarkCase
  });
  const requiredMentionHits = benchmarkRequirementCoverage.required_mentions;
  const forbiddenClaimHits = benchmarkRequirementCoverage.forbidden_claims;
  const requiredDimensionHits = benchmarkRequirementCoverage.required_dimensions;
  const requiredMentionCoverage = benchmarkRequirementCoverage.summary.required_mention_coverage_score;
  const forbiddenClaimScore = benchmarkRequirementCoverage.summary.forbidden_claim_score;
  const dimensionCoverage = benchmarkRequirementCoverage.summary.dimension_coverage_score;
  const structuredRecordCompleteness = benchmarkRequirementCoverage.summary.structured_record_completeness_score;
  const evidenceBackedRecordScore = benchmarkRequirementCoverage.summary.evidence_backed_record_score;
  const evidenceRefBackedRecordScore = benchmarkRequirementCoverage.summary.evidence_ref_backed_record_score;
  const actionabilityScore = clampScore(result.report_quality?.actionability_score ?? 0);
  const coverageThreshold = Number(benchmarkCase.thresholds.coverage_score ?? 0.75);
  const actionabilityThreshold = Number(benchmarkCase.thresholds.actionability_score ?? 0.6);
  const passed = structuredRecordCompleteness === 1
    && evidenceBackedRecordScore === 1
    && evidenceRefBackedRecordScore === 1
    && requiredMentionCoverage >= coverageThreshold
    && dimensionCoverage >= coverageThreshold
    && actionabilityScore >= actionabilityThreshold
    && forbiddenClaimScore >= Number(benchmarkCase.thresholds.forbidden_claim_score ?? 1);
  const warnings = [
    ...(structuredRecordCompleteness === 1 ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_STRUCTURED_COVERAGE_INCOMPLETE',
      message: 'The result did not include a complete benchmark_requirement_coverage record set.',
      details: { structured_record_completeness: structuredRecordCompleteness, threshold: 1 }
    }]),
    ...(evidenceBackedRecordScore === 1 ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_STRUCTURED_EVIDENCE_THIN',
      message: 'The structured benchmark coverage records were missing evidence text.',
      details: { evidence_backed_record_score: evidenceBackedRecordScore, threshold: 1 }
    }]),
    ...(evidenceRefBackedRecordScore === 1 ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_STRUCTURED_EVIDENCE_REFS_THIN',
      message: 'The structured benchmark coverage records were missing local evidence references.',
      details: { evidence_ref_backed_record_score: evidenceRefBackedRecordScore, threshold: 1 }
    }]),
    ...(requiredMentionCoverage >= coverageThreshold ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_REQUIRED_MENTIONS_THIN',
      message: 'The result did not cover enough benchmark-required human-review mentions.',
      details: { required_mention_coverage: requiredMentionCoverage, threshold: coverageThreshold }
    }]),
    ...(dimensionCoverage >= coverageThreshold ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_DIMENSION_COVERAGE_THIN',
      message: 'The result did not cover enough benchmark-required human-review dimensions.',
      details: { dimension_coverage: dimensionCoverage, threshold: coverageThreshold }
    }]),
    ...(forbiddenClaimScore === 1 ? [] : [{
      code: 'AGENTIC_REVIEW_CALIBRATION_FORBIDDEN_CLAIM_PRESENT',
      message: 'The result includes a claim that the benchmark forbids.',
      details: { forbidden_claims: forbiddenClaimHits.filter((item) => item.present).map((item) => item.claim) }
    }])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_calibration_result',
    calibration_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    generated_at: now.toISOString(),
    result_path: resultPath,
    result_id: result.id ?? null,
    case_id: benchmarkCase.case_id,
    fixture_type: benchmarkCase.fixture_type,
    rubric_profile_id: benchmarkCase.rubric_profile_id,
    scores: {
      required_mention_coverage: requiredMentionCoverage,
      forbidden_claim_score: forbiddenClaimScore,
      dimension_coverage: dimensionCoverage,
      structured_record_completeness_score: structuredRecordCompleteness,
      evidence_backed_record_score: evidenceBackedRecordScore,
      evidence_ref_backed_record_score: evidenceRefBackedRecordScore,
      actionability_score: actionabilityScore,
      human_review_coverage_score: clampScore(result.report_quality?.human_review_coverage_score ?? result.human_review_coverage?.coverage_score ?? 0),
      role_instruction_coverage_score: clampScore(result.role_instruction_coverage?.coverage_score ?? 0)
    },
    required_mentions: requiredMentionHits,
    forbidden_claims: forbiddenClaimHits,
    required_dimensions: requiredDimensionHits,
    benchmark_requirement_coverage: benchmarkRequirementCoverage,
    benchmark_completion_readiness: buildBenchmarkCompletionReadiness({
      benchmarkCase,
      rubricProfile: { id: benchmarkCase.rubric_profile_id }
    }),
    passed,
    warnings,
    advisory_only: true,
    gate_effect: 'none',
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      dogfood_comparison_performed: true,
      report_quality_gate_effect: 'none'
    })
  });
}

function buildComparisonResult({ baseline, baselinePath, candidate, candidatePath, now, comparisonKind = 'quality-delta' }) {
  const normalizedComparisonKind = normalizeComparisonKind(comparisonKind);
  const baselineQuality = comparableQualityScores(baseline);
  const candidateQuality = comparableQualityScores(candidate);
  const deltas = Object.fromEntries(Object.keys(candidateQuality).map((key) => [
    key,
    clampDelta(candidateQuality[key] - baselineQuality[key])
  ]));
  const improved = Object.values(deltas).filter((value) => value > 0.0001).length;
  const regressed = Object.values(deltas).filter((value) => value < -0.0001).length;
  const directVsTraceCueAnalysis = buildDirectVsTraceCueAnalysis({
    baseline,
    candidate,
    deltas,
    comparisonKind: normalizedComparisonKind
  });
  const warnings = [
    ...(regressed > 0 ? [{
    code: 'AGENTIC_REVIEW_COMPARISON_REGRESSION_PRESENT',
    message: 'The candidate result regressed on at least one comparable quality score.',
    details: { regressed_score_count: regressed }
    }] : []),
    ...(directVsTraceCueAnalysis?.warnings ?? [])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_comparison',
    comparison_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    comparison_kind: normalizedComparisonKind,
    generated_at: now.toISOString(),
    baseline: {
      result_path: baselinePath,
      result_id: baseline.id ?? null,
      quality_scores: baselineQuality
    },
    candidate: {
      result_path: candidatePath,
      result_id: candidate.id ?? null,
      quality_scores: candidateQuality
    },
    deltas,
    summary: {
      improved_score_count: improved,
      regressed_score_count: regressed,
      candidate_quality_improved: improved > regressed,
      direct_vs_tracecue_comparison: normalizedComparisonKind === 'direct-vs-tracecue',
      advisory_only: true,
      gate_effect: 'none'
    },
    direct_vs_tracecue_analysis: directVsTraceCueAnalysis,
    warnings,
    advisory_only: true,
    gate_effect: 'none',
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      dogfood_comparison_performed: true,
      report_quality_gate_effect: 'none'
    })
  });
}

function buildHumanBaselineValidation({ input, inputPath, inputHash, now }) {
  const source = normalizeHumanBaselineSource(input);
  const ownerLabelSet = normalizeHumanBaselineOwnerLabelSet(source);
  const approval = normalizeHumanBaselineApproval(source.approval ?? source.human_approval ?? source.approval_packet ?? ownerLabelSet.approval);
  const approvalWarnings = ownerLabelSet.owner_labeled ? humanBaselineApprovalWarnings(approval) : [];
  const caseId = stringOrNull(source.case_id ?? source.benchmark_case_id ?? ownerLabelSet.case_id);
  const benchmarkCase = resolveBenchmarkCase(caseId);
  const requiredDimensions = normalizeHumanBaselineDimensions({
    source,
    ownerLabelSet,
    labels: ownerLabelSet.labels,
    benchmarkCase
  });
  const requiredMentions = normalizeHumanBaselineRequirementList({
    source,
    ownerLabelSet,
    key: 'required_mentions',
    fallback: benchmarkCase?.required_mentions
  });
  const forbiddenClaims = normalizeHumanBaselineRequirementList({
    source,
    ownerLabelSet,
    key: 'forbidden_claims',
    fallback: benchmarkCase?.forbidden_claims
  });
  const mustNotMissCriteria = normalizeHumanBaselineMustNotMissCriteria(source.must_not_miss_criteria ?? ownerLabelSet.must_not_miss_criteria);
  const mustNotMissVerification = evaluateHumanBaselineMustNotMissCriteria({
    criteria: mustNotMissCriteria,
    labels: ownerLabelSet.labels,
    requireEvidenceRefs: true
  });
  const evidenceRefCount = ownerLabelSet.labels.reduce((sum, label) => sum + label.evidence_refs.length, 0);
  const advisoryOnly = source.advisory_only !== false && input?.advisory_only !== false;
  const gateEffect = source.gate_effect ?? input?.gate_effect ?? 'none';
  const syntheticWarnings = humanBaselineSyntheticEvidenceWarnings({ source, ownerLabelSet, approval });
  const warnings = [
    ...(ownerLabelSet.owner_labeled ? [] : [{ code: 'AHR_HUMAN_BASELINE_OWNER_LABEL_MISSING', message: 'The human baseline must be explicitly owner-labeled.' }]),
    ...approvalWarnings,
    ...(ownerLabelSet.owner_labeled ? mustNotMissVerification.warnings : []),
    ...syntheticWarnings,
    ...(caseId ? [] : [{ code: 'AHR_HUMAN_BASELINE_CASE_MISSING', message: 'The human baseline must declare a benchmark case id.' }]),
    ...(caseId && !benchmarkCase ? [{ code: 'AHR_HUMAN_BASELINE_CASE_UNKNOWN', message: 'The human baseline references an unknown benchmark case id.', details: { case_id: caseId } }] : []),
    ...(ownerLabelSet.labels.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_LABELS_MISSING', message: 'The human baseline must include at least one owner label or expected finding.' }]),
    ...(evidenceRefCount > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_EVIDENCE_REFS_MISSING', message: 'The human baseline must include local evidence references for owner labels.' }]),
    ...(requiredDimensions.length > 0 ? [] : [{ code: 'AHR_HUMAN_BASELINE_DIMENSIONS_MISSING', message: 'The human baseline must declare required human-review dimensions or a known benchmark case.' }]),
    ...(advisoryOnly ? [] : [{ code: 'AHR_HUMAN_BASELINE_NON_ADVISORY', message: 'The human baseline must remain advisory-only.' }]),
    ...(gateEffect === 'none' ? [] : [{ code: 'AHR_HUMAN_BASELINE_GATE_EFFECT_NOT_NONE', message: 'The human baseline must not carry deterministic gate effect.', details: { gate_effect: gateEffect } }])
  ];
  const ownerLabeledBaselineVerified = warnings.length === 0;
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline',
    human_baseline_version: HUMAN_REVIEW_HUMAN_BASELINE_VERSION,
    generated_at: now.toISOString(),
    input_path: inputPath,
    input_hash: inputHash,
    baseline: {
      baseline_id: stringOrNull(source.baseline_id ?? source.id ?? input?.baseline_id ?? input?.id),
      case_id: caseId,
      fixture_type: stringOrNull(source.fixture_type ?? benchmarkCase?.fixture_type),
      rubric_profile_id: stringOrNull(source.rubric_profile_id ?? benchmarkCase?.rubric_profile_id),
      review_artifact_ref: safeArtifactReferencePath(source.review_artifact_ref ?? source.review_artifact_path ?? input?.review_artifact_ref),
      reviewed_at: stringOrNull(source.reviewed_at ?? source.created_at ?? ownerLabelSet.reviewed_at),
      rubric_version: stringOrNull(source.rubric_version ?? ownerLabelSet.rubric_version ?? HUMAN_REVIEW_SCHEMA_VERSION),
      required_dimensions: requiredDimensions,
      required_mentions: requiredMentions,
      forbidden_claims: forbiddenClaims,
      must_not_miss_criteria: mustNotMissCriteria,
      owner_label_set: ownerLabelSet,
      approval
    },
    summary: {
      label_count: ownerLabelSet.labels.length,
      evidence_ref_count: evidenceRefCount,
      required_dimension_count: requiredDimensions.length,
      required_mention_count: requiredMentions.length,
      forbidden_claim_count: forbiddenClaims.length,
      must_not_miss_criterion_count: mustNotMissVerification.summary.criterion_count,
      target_specific_must_not_miss_criterion_count: mustNotMissVerification.summary.target_specific_criterion_count,
      must_not_miss_owner_label_count: mustNotMissVerification.summary.covered_criterion_count,
      must_not_miss_evidence_backed_label_count: mustNotMissVerification.summary.evidence_backed_criterion_count,
      approval_metadata_complete: approvalWarnings.length === 0 && ownerLabelSet.owner_labeled === true,
      target_specific_must_not_miss_criteria_complete: mustNotMissVerification.complete,
      synthetic_or_fixture_only_marker_present: syntheticWarnings.length > 0
    },
    validation: {
      owner_labeled: ownerLabelSet.owner_labeled,
      owner_labeled_baseline_verified: ownerLabeledBaselineVerified,
      status: ownerLabeledBaselineVerified ? 'valid_owner_labeled_human_baseline' : 'human_baseline_warnings_present',
      complete_for_human_baseline_comparison: ownerLabeledBaselineVerified,
      approval_metadata_complete: approvalWarnings.length === 0 && ownerLabelSet.owner_labeled === true,
      target_specific_must_not_miss_criteria_complete: mustNotMissVerification.complete,
      must_not_miss_criteria_verified: mustNotMissVerification.complete,
      synthetic_or_fixture_only_marker_present: syntheticWarnings.length > 0,
      draft_proof_allowed: false,
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false,
      advisory_only: advisoryOnly,
      gate_effect: gateEffect
    },
    warnings,
    boundary: agenticHumanReviewBoundary({ read_only: true }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

async function readOwnerBaselineRequirementContract({
  cwd,
  options,
  maxBytes,
  now,
  benchmarkCase = null
} = {}) {
  const inputPath = options?.['human-baseline'];
  if (!inputPath) {
    return { ok: true, contract: null, relativePath: null, warnings: [] };
  }
  const baselineRead = await readWorkspaceJson({
    cwd,
    inputPath,
    label: 'agentic human review owner-approved human baseline',
    maxBytes
  });
  if (!baselineRead.ok) {
    return baselineRead;
  }
  const humanBaseline = buildHumanBaselineValidation({
    input: baselineRead.value,
    inputPath: baselineRead.relativePath,
    inputHash: hashText(baselineRead.text),
    now: materializeNow(now)
  });
  if (humanBaseline.validation.owner_labeled_baseline_verified !== true) {
    return {
      ok: false,
      error: {
        code: 'AHR_HUMAN_BASELINE_OWNER_LABEL_NOT_VERIFIED',
        message: 'agentic review planning requires an owner-approved human baseline before it can become a provider requirement contract.',
        details: {
          input: baselineRead.relativePath,
          status: humanBaseline.validation.status,
          warning_codes: humanBaseline.warnings.map((warning) => warning.code),
          advisory_only: true,
          gate_effect: 'none'
        }
      }
    };
  }
  if (benchmarkCase && humanBaseline.baseline.case_id && benchmarkCase.case_id !== humanBaseline.baseline.case_id) {
    return {
      ok: false,
      error: {
        code: 'AHR_HUMAN_BASELINE_CASE_MISMATCH',
        message: 'The requested benchmark case does not match the owner-approved human baseline case.',
        details: {
          requested_case_id: benchmarkCase.case_id,
          human_baseline_case_id: humanBaseline.baseline.case_id,
          input: baselineRead.relativePath
        }
      }
    };
  }
  return {
    ok: true,
    contract: buildOwnerBaselineRequirementContract({
      humanBaseline,
      inputHash: hashText(baselineRead.text)
    }),
    relativePath: baselineRead.relativePath,
    warnings: []
  };
}

function buildOwnerBaselineRequirementContract({ humanBaseline, inputHash }) {
  const baseline = humanBaseline?.baseline ?? {};
  const approval = baseline.approval ?? {};
  const targetCriteria = normalizeHumanBaselineMustNotMissCriteria(baseline.must_not_miss_criteria)
    .filter(isTargetSpecificMustNotMissCriterion);
  const ownerLabels = normalizeHumanBaselineLabels(baseline.owner_label_set?.labels)
    .filter((label) => label.required !== false);
  return redact({
    schema_version: SCHEMA_VERSION,
    contract_version: HUMAN_REVIEW_HUMAN_BASELINE_VERSION,
    type: 'agentic_human_review_owner_baseline_requirement_contract',
    baseline_id: baseline.baseline_id ?? null,
    case_id: baseline.case_id ?? null,
    fixture_type: baseline.fixture_type ?? null,
    rubric_profile_id: baseline.rubric_profile_id ?? null,
    input_hash: inputHash,
    input_path_included: false,
    local_evidence_paths_included: false,
    approval: {
      decision: approval.decision ?? null,
      approved_at: approval.approved_at ?? null,
      rubric_version: approval.rubric_version ?? null,
      template_version: approval.template_version ?? null,
      overlay_hash: approval.overlay_hash ?? null,
      draft_hash: approval.draft_hash ?? null,
      edit_diff_present: Boolean(approval.edit_diff),
      advisory_only: approval.advisory_only !== false,
      gate_effect: approval.gate_effect ?? 'none'
    },
    required_dimensions: normalizeStringArray(baseline.required_dimensions),
    required_mentions: normalizeStringArray(baseline.required_mentions),
    forbidden_claims: normalizeStringArray(baseline.forbidden_claims),
    must_not_miss_criteria: targetCriteria.map((criterion) => ({
      id: criterion.id,
      dimension: criterion.dimension,
      summary: criterion.summary,
      severity: criterion.severity,
      match_terms: criterion.match_terms,
      target_specific: true
    })),
    owner_labels: ownerLabels.map((label) => ({
      id: label.id,
      dimension: label.dimension,
      summary: label.summary,
      severity: label.severity,
      match_terms: label.match_terms,
      must_not_miss_criterion_id: label.must_not_miss_criterion_id,
      criteria_refs: label.criteria_refs,
      target_specific: label.target_specific,
      evidence_ref_count: label.evidence_refs.length
    })),
    required_structured_finding_fields: [
      'id',
      'message',
      'recommendation',
      'evidence_refs',
      'must_not_miss_criterion_id or criteria_refs',
      'owner_label_ids'
    ],
    target_specific_must_not_miss_required: targetCriteria.length > 0,
    owner_labeled_baseline_verified: humanBaseline?.validation?.owner_labeled_baseline_verified === true,
    advisory_only: true,
    gate_effect: 'none'
  });
}

function buildHumanBaselineComparison({ baseline, result, resultPath, resultHash, requestedCaseId, now }) {
  const baselineCaseId = baseline.baseline.case_id;
  const resultCaseId = result.calibration_metadata?.benchmark_case_id
    ?? result.benchmark_requirement_coverage?.case_id
    ?? result.benchmark_completion_readiness?.active_case_id
    ?? result.dogfood_metadata?.case_id
    ?? null;
  const requested = stringOrNull(requestedCaseId);
  const caseMismatch = Boolean(requested && baselineCaseId && requested !== baselineCaseId)
    || Boolean(requested && resultCaseId && requested !== resultCaseId)
    || Boolean(baselineCaseId && resultCaseId && baselineCaseId !== resultCaseId);
  const dimensionMatches = compareHumanBaselineDimensions({
    requiredDimensions: baseline.baseline.required_dimensions,
    result
  });
  const labelMatches = compareHumanBaselineLabels({
    labels: baseline.baseline.owner_label_set.labels,
    result
  });
  const mustNotMissMatches = compareHumanBaselineMustNotMissCriteria({
    criteria: baseline.baseline.must_not_miss_criteria,
    labelMatches
  });
  const mentionMatches = compareHumanBaselineRequiredMentions({
    requiredMentions: baseline.baseline.required_mentions,
    result
  });
  const forbiddenClaimMatches = compareHumanBaselineForbiddenClaims({
    forbiddenClaims: baseline.baseline.forbidden_claims,
    result
  });
  const classification = classifyHumanBaselineComparison({
    labels: baseline.baseline.owner_label_set.labels,
    result
  });
  const dimensionScore = fractionPresent(dimensionMatches);
  const labelScore = fractionPresent(labelMatches);
  const mustNotMissScore = fractionPresent(mustNotMissMatches);
  const mentionScore = fractionPresent(mentionMatches);
  const forbiddenClaimScore = forbiddenClaimMatches.length === 0
    ? 1
    : clampScore(forbiddenClaimMatches.filter((item) => item.present === false).length / forbiddenClaimMatches.length);
  const candidateEligibility = resultProofEligibility({
    entry: { effort: result.agentic_human_review_advisory?.review_effort },
    result,
    providerId: result.provider?.id ?? null
  });
  const overallAlignmentScore = clampScore(
    (dimensionScore * 0.3)
    + (labelScore * 0.3)
    + (mentionScore * 0.25)
    + (forbiddenClaimScore * 0.15)
  );
  const warnings = [
    ...baseline.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      details: warning.details
    })),
    ...(caseMismatch ? [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_CASE_MISMATCH',
      message: 'The requested, baseline, and result benchmark case ids do not align.',
      details: { requested_case_id: requested, baseline_case_id: baselineCaseId, result_case_id: resultCaseId }
    }] : []),
    ...(labelMatches.length > 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_LABELS_MISSING',
      message: 'No owner labels were available for baseline comparison.'
    }]),
    ...(overallAlignmentScore >= 0.75 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_ALIGNMENT_LOW',
      message: 'The candidate result did not align strongly with the owner-labeled human baseline.',
      details: { overall_alignment_score: overallAlignmentScore, threshold: 0.75 }
    }]),
    ...(mustNotMissMatches.length > 0 && mustNotMissScore === 1 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_MUST_NOT_MISS_INCOMPLETE',
      message: 'The candidate result did not satisfy every target-specific must-not-miss criterion.',
      details: {
        must_not_miss_criterion_coverage_score: mustNotMissScore,
        missing_criterion_ids: mustNotMissMatches.filter((item) => !item.present).map((item) => item.id)
      }
    }]),
    ...(classification.insufficient_evidence.length === 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_INSUFFICIENT_EVIDENCE',
      message: 'The candidate matched owner labels through text but did not provide structured findings with local evidence references.',
      details: { insufficient_evidence_count: classification.insufficient_evidence.length }
    }]),
    ...(candidateEligibility.mechanical_contract_satisfied ? [] : [{
      code: 'AHR_HUMAN_BASELINE_COMPARISON_CANDIDATE_MECHANICAL_CONTRACT_INCOMPLETE',
      message: 'The candidate result does not satisfy the TraceCue mechanical review contract required for ready baseline comparison evidence.',
      details: {
        excluded_from_claim_reason: candidateEligibility.excluded_from_claim_reason,
        strict_eligibility_checks: candidateEligibility.strict_eligibility_checks
      }
    }])
  ];
  const ownerBaselineVerified = baseline.validation.owner_labeled_baseline_verified === true && !caseMismatch;
  const evidenceBackedOwnerLabelMatches = classification.insufficient_evidence.length === 0;
  const readyForOwnerReview = ownerBaselineVerified
    && overallAlignmentScore >= 0.75
    && mustNotMissScore === 1
    && forbiddenClaimScore === 1
    && classification.misses.length === 0
    && evidenceBackedOwnerLabelMatches
    && candidateEligibility.mechanical_contract_satisfied;
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_human_baseline_comparison',
    human_baseline_comparison_version: HUMAN_REVIEW_HUMAN_BASELINE_COMPARISON_VERSION,
    generated_at: now.toISOString(),
    comparison_kind: 'owner-labeled-human-baseline',
    baseline: {
      input_path: baseline.input_path,
      input_hash: baseline.input_hash,
      baseline_id: baseline.baseline.baseline_id,
      case_id: baselineCaseId,
      fixture_type: baseline.baseline.fixture_type,
      owner_labeled_baseline_verified: baseline.validation.owner_labeled_baseline_verified
    },
    candidate: {
      result_path: resultPath,
      result_hash: resultHash,
      result_id: result.id ?? null,
      case_id: resultCaseId,
      provider_id: result.provider?.id ?? null,
      model_id: result.model?.id ?? null,
      quality_scores: comparableQualityScores(result),
      mechanical_contract_satisfied: candidateEligibility.mechanical_contract_satisfied,
      strict_claim_numerator_eligible: candidateEligibility.strict_claim_numerator_eligible,
      strict_eligibility_checks: candidateEligibility.strict_eligibility_checks
    },
    scores: {
      required_dimension_coverage_score: dimensionScore,
      owner_label_coverage_score: labelScore,
      must_not_miss_criterion_coverage_score: mustNotMissScore,
      required_mention_coverage_score: mentionScore,
      forbidden_claim_score: forbiddenClaimScore,
      overall_alignment_score: overallAlignmentScore,
      must_not_miss_miss_count: mustNotMissMatches.filter((item) => !item.present).length,
      miss_count: classification.misses.length,
      over_report_count: classification.over_reports.length,
      severity_mismatch_count: classification.severity_mismatches.length,
      insufficient_evidence_count: classification.insufficient_evidence.length
    },
    matches: {
      required_dimensions: dimensionMatches,
      owner_labels: labelMatches,
      must_not_miss_criteria: mustNotMissMatches,
      required_mentions: mentionMatches,
      forbidden_claims: forbiddenClaimMatches,
      classifications: classification
    },
    summary: {
      owner_labeled_baseline_verified: ownerBaselineVerified,
      ready_for_owner_review: readyForOwnerReview,
      candidate_matches_owner_baseline: readyForOwnerReview,
      candidate_mechanical_contract_satisfied: candidateEligibility.mechanical_contract_satisfied,
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false,
      advisory_only: true,
      gate_effect: 'none'
    },
    warnings,
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      dogfood_comparison_performed: true,
      report_quality_gate_effect: 'none'
    }),
    advisory_only: true,
    gate_effect: 'none'
  });
}

function normalizeComparisonKind(value) {
  const normalized = String(value ?? 'quality-delta').trim() || 'quality-delta';
  return ['quality-delta', 'direct-vs-tracecue', 'provider-dogfood', 'benchmark-regression'].includes(normalized)
    ? normalized
    : 'quality-delta';
}

function buildDirectVsTraceCueAnalysis({ baseline, candidate, deltas, comparisonKind }) {
  if (comparisonKind !== 'direct-vs-tracecue') {
    return null;
  }
  const mechanicalContextPresent = Boolean(candidate.mechanical_vs_human_review)
    || Number(candidate.mechanical_vs_human_review?.deterministic_finding_count ?? 0) > 0
    || Boolean(candidate.evidence_plan)
    || Boolean(candidate.privacy_disclosure_audit);
  const baselineTraceCueMarkersPresent = Boolean(baseline.agentic_human_review_advisory?.plan_hash)
    || Boolean(baseline.execution?.plan_hash)
    || Boolean(baseline.privacy_disclosure_audit)
    || Boolean(baseline.xhigh_multi_round_review);
  const candidateTraceCueMarkersPresent = mechanicalContextPresent
    || Boolean(candidate.agentic_human_review_advisory?.plan_hash)
    || Boolean(candidate.execution?.plan_hash)
    || Boolean(candidate.xhigh_multi_round_review);
  const warnings = [
    ...(baselineTraceCueMarkersPresent ? [{
      code: 'AHR_DIRECT_VS_TRACECUE_BASELINE_NOT_DIRECT_REVIEW_LIKE',
      message: 'The baseline carries TraceCue workflow markers, so this direct-vs-TraceCue comparison may not be a clean direct-review baseline.'
    }] : []),
    ...(candidateTraceCueMarkersPresent ? [] : [{
      code: 'AHR_DIRECT_VS_TRACECUE_CANDIDATE_TRACE_CUE_MARKERS_MISSING',
      message: 'The candidate result does not expose TraceCue workflow markers expected for a direct-vs-TraceCue comparison.'
    }])
  ];
  return {
    schema_version: SCHEMA_VERSION,
    analysis_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    baseline_role: 'direct_or_unstructured_human_like_review',
    candidate_role: 'tracecue_agentic_human_review_workflow',
    baseline_result_id: baseline.id ?? null,
    candidate_result_id: candidate.id ?? null,
    tracecue_mechanical_context_present: mechanicalContextPresent,
    tracecue_plan_hash_present: Boolean(candidate.agentic_human_review_advisory?.plan_hash),
    baseline_direct_review_like: !baselineTraceCueMarkersPresent,
    candidate_tracecue_workflow_markers_present: candidateTraceCueMarkersPresent,
    tracecue_release_gate_effect: candidate.agentic_human_review_advisory?.gate_effect ?? candidate.gate_effect ?? 'none',
    comparative_reading: {
      human_review_coverage_delta: deltas.human_review_coverage_score ?? 0,
      actionability_delta: deltas.actionability_score ?? 0,
      role_instruction_coverage_delta: deltas.role_instruction_coverage_score ?? 0,
      calibration_ready_delta: deltas.calibration_ready_score ?? 0
    },
    interpretation: [
      'Positive deltas suggest the TraceCue workflow preserved more structured evidence, role coverage, or actionability.',
      'Negative deltas suggest the direct review captured human nuance that the TraceCue run did not yet preserve.',
      'This comparison is advisory and must not approve releases or mutate deterministic findings.'
    ],
    warnings,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function normalizeHumanBaselineSource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const validatedBaseline = input.data?.agentic_human_review_human_baseline
    ?? input.agentic_human_review_human_baseline
    ?? null;
  if (validatedBaseline?.baseline && typeof validatedBaseline.baseline === 'object' && !Array.isArray(validatedBaseline.baseline)) {
    return {
      ...input,
      ...validatedBaseline.baseline,
      validation: validatedBaseline.validation ?? input.validation,
      approval: validatedBaseline.baseline.approval ?? input.approval,
      advisory_only: validatedBaseline.advisory_only ?? input.advisory_only,
      gate_effect: validatedBaseline.gate_effect ?? input.gate_effect
    };
  }
  const packet = input.data?.agentic_human_review_human_baseline_approval_packet
    ?? input.agentic_human_review_human_baseline_approval_packet
    ?? input.approval_packet
    ?? null;
  const nested = packet?.approved_baseline
    ?? input.approved_baseline
    ?? input.human_baseline
    ?? input.baseline
    ?? input.owner_labeled_human_baseline;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? { ...input, ...nested, approval: nested.approval ?? packet?.approval ?? input.approval }
    : input;
}

function normalizeHumanBaselineOwnerLabelSet(source) {
  const ownerLabelSet = source.owner_label_set
    ?? source.owner_labels
    ?? source.human_labels
    ?? {};
  const labels = normalizeHumanBaselineLabels(
    ownerLabelSet.labels
      ?? ownerLabelSet.expected_findings
      ?? source.labels
      ?? source.expected_findings
      ?? source.findings
  );
  return {
    reviewer_id: stringOrNull(ownerLabelSet.reviewer_id ?? ownerLabelSet.owner_id ?? source.reviewer_id ?? source.owner_id),
    reviewed_at: stringOrNull(ownerLabelSet.reviewed_at ?? source.reviewed_at),
    rubric_version: stringOrNull(ownerLabelSet.rubric_version ?? source.rubric_version),
    case_id: stringOrNull(ownerLabelSet.case_id ?? source.case_id ?? source.benchmark_case_id),
    owner_labeled: ownerLabelSet.owner_labeled === true || source.owner_labeled === true,
    required_dimensions: normalizeStringArray(ownerLabelSet.required_dimensions),
    required_mentions: normalizeStringArray(ownerLabelSet.required_mentions),
    forbidden_claims: normalizeStringArray(ownerLabelSet.forbidden_claims),
    must_not_miss_criteria: normalizeHumanBaselineMustNotMissCriteria(ownerLabelSet.must_not_miss_criteria),
    labels,
    approval: ownerLabelSet.approval ?? source.approval ?? null,
    advisory_only: ownerLabelSet.advisory_only !== false,
    gate_effect: ownerLabelSet.gate_effect ?? 'none'
  };
}

function normalizeHumanBaselineApproval(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    decision: normalizeApprovalDecision(source.decision),
    approver_id: stringOrNull(source.approver_id ?? source.approver ?? source.reviewer_id),
    approved_at: stringOrNull(source.approved_at ?? source.reviewed_at),
    rubric_version: stringOrNull(source.rubric_version),
    template_version: stringOrNull(source.template_version),
    overlay_hash: stringOrNull(source.overlay_hash),
    draft_hash: stringOrNull(source.draft_hash),
    edit_diff: stringOrNull(source.edit_diff ?? source.diff ?? source.change_summary),
    edited: source.edited === true || Boolean(source.edit_diff ?? source.diff),
    advisory_only: source.advisory_only !== false,
    gate_effect: source.gate_effect ?? 'none'
  };
}

function humanBaselineApprovalWarnings(approval) {
  return [
    ...(approval.decision === 'approved' ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVAL_NOT_APPROVED', message: 'Owner-labeled baseline evidence requires an approved decision.', details: { decision: approval.decision } }]),
    ...(approval.approver_id ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVER_MISSING', message: 'Owner-labeled baseline evidence requires an approver id.' }]),
    ...(approval.approved_at ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVED_AT_MISSING', message: 'Owner-labeled baseline evidence requires an approval timestamp.' }]),
    ...(approval.rubric_version ? [] : [{ code: 'AHR_HUMAN_BASELINE_RUBRIC_VERSION_MISSING', message: 'Owner-labeled baseline evidence requires a rubric version.' }]),
    ...(approval.template_version ? [] : [{ code: 'AHR_HUMAN_BASELINE_TEMPLATE_VERSION_MISSING', message: 'Owner-labeled baseline evidence requires a template version.' }]),
    ...(approval.overlay_hash ? [] : [{ code: 'AHR_HUMAN_BASELINE_OVERLAY_HASH_MISSING', message: 'Owner-labeled baseline evidence requires overlay provenance.' }]),
    ...(approval.draft_hash ? [] : [{ code: 'AHR_HUMAN_BASELINE_DRAFT_HASH_MISSING', message: 'Owner-labeled baseline evidence requires draft provenance.' }]),
    ...(approval.edit_diff ? [] : [{ code: 'AHR_HUMAN_BASELINE_EDIT_DIFF_MISSING', message: 'Owner-labeled baseline evidence requires an edit diff or explicit no-change record.' }]),
    ...(approval.advisory_only ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVAL_NON_ADVISORY', message: 'Human baseline approval metadata must remain advisory-only.' }]),
    ...(approval.gate_effect === 'none' ? [] : [{ code: 'AHR_HUMAN_BASELINE_APPROVAL_GATE_EFFECT_NOT_NONE', message: 'Human baseline approval metadata must not carry deterministic gate effect.', details: { gate_effect: approval.gate_effect } }])
  ];
}

function humanBaselineSyntheticEvidenceWarnings({ source, ownerLabelSet, approval }) {
  const markerSources = [
    source.synthetic,
    source.synthetic_fixture,
    source.synthetic_owner_labeled_fixture,
    source.fixture_only,
    source.local_pipeline_validation_only,
    source.proof_boundary,
    source.baseline_id,
    source.id,
    source.origin_kind,
    source.fixture_kind,
    source.source,
    ownerLabelSet?.reviewer_id,
    approval?.approver_id,
    approval?.edit_diff
  ];
  for (const label of ownerLabelSet?.labels ?? []) {
    markerSources.push(label.summary, label.id);
    for (const reference of label.evidence_refs ?? []) {
      markerSources.push(reference.description, reference.path, reference.type);
    }
  }
  const markerPresent = markerSources.some(hasSyntheticEvidenceMarker);
  return markerPresent
    ? [{
      code: 'AHR_HUMAN_BASELINE_SYNTHETIC_OWNER_LABEL_NOT_PROOF',
      message: 'Synthetic, deterministic, or fixture-only baseline markers cannot verify as owner-labeled human evidence.',
      details: {
        owner_labeled_baseline_verified: false,
        baseline_comparison_input_allowed: false
      }
    }]
    : [];
}

function hasSyntheticEvidenceMarker(value) {
  if (value === true) {
    return true;
  }
  const text = stringOrNull(value);
  if (!text) {
    return false;
  }
  const normalized = text.toLowerCase();
  return normalized.includes('synthetic')
    || normalized.includes('deterministic fixture')
    || normalized.includes('fixture-only')
    || normalized.includes('fixture only')
    || normalized.includes('local pipeline validation only')
    || normalized.includes('pipeline validation only');
}

function normalizeHumanBaselineLabels(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, MAX_HUMAN_BASELINE_LABELS).map((value, index) => {
    const summary = secretSafeText(
      value?.summary
        ?? value?.label
        ?? value?.finding
        ?? value?.claim
        ?? value?.expected
        ?? value?.description
        ?? `Owner label ${index + 1}`,
      700
    );
    return {
      id: truncateText(value?.id ?? `owner-label-${index + 1}`, 120),
      dimension: normalizeHumanReviewDimensionId(value?.dimension ?? value?.category),
      summary,
      severity: SEVERITIES.has(value?.severity) ? value.severity : 'medium',
      required: value?.required !== false,
      match_terms: normalizeHumanBaselineMatchTerms(value, summary),
      evidence_refs: normalizeHumanBaselineEvidenceRefs(value?.evidence_refs ?? value?.evidence ?? value?.artifacts),
      confidence: normalizeConfidence(value?.confidence),
      must_not_miss_criterion_id: truncateText(value?.must_not_miss_criterion_id ?? value?.criterion_id ?? value?.must_not_miss_id, 120),
      criteria_refs: normalizeStringArray(value?.criteria_refs ?? value?.criterion_refs ?? value?.must_not_miss_criteria_refs),
      target_specific: value?.target_specific === true
    };
  });
}

function normalizeHumanBaselineMustNotMissCriteria(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 50).map((value, index) => ({
    id: truncateText(value?.id ?? value?.criterion_id ?? `must-not-miss-${index + 1}`, 120),
    dimension: normalizeHumanReviewDimensionId(value?.dimension) ?? null,
    summary: secretSafeText(value?.summary ?? value?.description ?? value?.label ?? `Must-not-miss criterion ${index + 1}`, 500),
    severity: SEVERITIES.has(value?.severity) ? value.severity : 'high',
    match_terms: normalizeStringArray(value?.match_terms ?? value?.keywords),
    evidence_refs: normalizeHumanBaselineEvidenceRefs(value?.evidence_refs ?? value?.evidence ?? value?.artifacts),
    target_specific: isTargetSpecificMustNotMissCriterion(value),
    source_kind: truncateText(value?.source_kind ?? value?.source ?? (isTargetSpecificMustNotMissCriterion(value) ? 'target_specific_overlay' : 'generic_requirement'), 120)
  }));
}

function isTargetSpecificMustNotMissCriterion(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (value.target_specific === true) {
    return true;
  }
  if (value.target_specific === false) {
    return false;
  }
  const sourceText = [
    value.source_kind,
    value.source,
    value.origin,
    value.origin_kind,
    value.criteria_scope
  ].map((item) => String(item ?? '').toLowerCase()).join(' ');
  if (sourceText.includes('target') || sourceText.includes('page') || sourceText.includes('owner')) {
    return true;
  }
  if (sourceText.includes('generic') || sourceText.includes('registry') || sourceText.includes('benchmark')) {
    return false;
  }
  return false;
}

function evaluateHumanBaselineMustNotMissCriteria({ criteria, labels, requireEvidenceRefs }) {
  const normalizedCriteria = normalizeHumanBaselineMustNotMissCriteria(criteria);
  const normalizedLabels = normalizeHumanBaselineLabels(labels);
  const targetSpecificCriteria = normalizedCriteria.filter(isTargetSpecificMustNotMissCriterion);
  const criterionMatches = targetSpecificCriteria.map((criterion) => {
    const coveringLabels = normalizedLabels.filter((label) => label.required !== false && humanBaselineLabelCoversCriterion(label, criterion));
    const evidenceBackedLabels = coveringLabels.filter((label) => label.evidence_refs.length > 0);
    return {
      id: criterion.id,
      dimension: criterion.dimension,
      severity: criterion.severity,
      covered_by_owner_label: coveringLabels.length > 0,
      evidence_backed: evidenceBackedLabels.length > 0,
      owner_label_ids: coveringLabels.map((label) => label.id)
    };
  });
  const missingLabelCriteria = criterionMatches.filter((item) => !item.covered_by_owner_label);
  const missingEvidenceCriteria = criterionMatches.filter((item) => item.covered_by_owner_label && !item.evidence_backed);
  const warnings = [
    ...(normalizedCriteria.length > 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_MUST_NOT_MISS_CRITERIA_MISSING',
      message: 'Owner-approved human baselines require target-specific must-not-miss criteria before they can verify as owner-labeled evidence.'
    }]),
    ...(targetSpecificCriteria.length > 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_TARGET_SPECIFIC_MUST_NOT_MISS_REQUIRED',
      message: 'Owner-approved human baselines require at least one target-specific must-not-miss criterion in addition to reusable generic criteria.'
    }]),
    ...(missingLabelCriteria.length === 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_MUST_NOT_MISS_LABEL_MISSING',
      message: 'Every target-specific must-not-miss criterion must be linked to a required owner label.',
      details: { missing_criterion_ids: missingLabelCriteria.map((item) => item.id) }
    }]),
    ...(!requireEvidenceRefs || missingEvidenceCriteria.length === 0 ? [] : [{
      code: 'AHR_HUMAN_BASELINE_MUST_NOT_MISS_EVIDENCE_REFS_MISSING',
      message: 'Every target-specific must-not-miss criterion must be linked to an owner label with local evidence references.',
      details: { missing_criterion_ids: missingEvidenceCriteria.map((item) => item.id) }
    }])
  ];
  return {
    complete: warnings.length === 0,
    criteria: normalizedCriteria,
    target_specific_criteria: targetSpecificCriteria,
    matches: criterionMatches,
    warnings,
    summary: {
      criterion_count: normalizedCriteria.length,
      target_specific_criterion_count: targetSpecificCriteria.length,
      covered_criterion_count: criterionMatches.filter((item) => item.covered_by_owner_label).length,
      evidence_backed_criterion_count: criterionMatches.filter((item) => item.evidence_backed).length,
      missing_label_criterion_ids: missingLabelCriteria.map((item) => item.id),
      missing_evidence_ref_criterion_ids: missingEvidenceCriteria.map((item) => item.id)
    }
  };
}

function humanBaselineLabelCoversCriterion(label, criterion) {
  const criterionId = stringOrNull(criterion?.id);
  if (!criterionId) {
    return false;
  }
  return label.id === criterionId
    || label.must_not_miss_criterion_id === criterionId
    || label.criteria_refs.includes(criterionId);
}

function normalizeHumanBaselineMatchTerms(value, summary) {
  const explicit = normalizeStringArray(value?.match_terms ?? value?.keywords ?? value?.required_terms);
  if (explicit.length > 0) {
    return explicit.slice(0, 12);
  }
  const text = stringOrNull(summary);
  return text && text.length >= 12 ? [text] : [];
}

function normalizeHumanBaselineEvidenceRefs(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, MAX_EVIDENCE_REFS).map((value, index) => {
    if (typeof value === 'string') {
      return {
        type: null,
        path: safeArtifactReferencePath(value),
        description: null,
        ref_id: truncateText(`evidence-${index + 1}`, 80),
        content_included: false,
        local_reference: true
      };
    }
    const [reference] = normalizeArtifactReferences([value]);
    return {
      ...reference,
      ref_id: truncateText(value?.id ?? value?.ref_id ?? `evidence-${index + 1}`, 80)
    };
  }).filter((reference) => reference.path || reference.description || reference.ref_id);
}

function normalizeHumanBaselineDimensions({ source, ownerLabelSet, labels, benchmarkCase }) {
  const declared = normalizeStringArray(source.required_dimensions ?? ownerLabelSet.required_dimensions);
  const labelDimensions = labels.map((label) => label.dimension).filter(Boolean);
  const fallback = Array.isArray(benchmarkCase?.required_dimensions) ? benchmarkCase.required_dimensions : [];
  return uniqueSorted([...declared, ...labelDimensions, ...fallback].map(normalizeHumanReviewDimensionId).filter(Boolean));
}

function normalizeHumanBaselineRequirementList({ source, ownerLabelSet, key, fallback }) {
  return uniqueSorted([
    ...normalizeStringArray(source[key]),
    ...normalizeStringArray(ownerLabelSet[key]),
    ...(Array.isArray(fallback) ? fallback : [])
  ]);
}

function normalizeHumanReviewDimensionId(value) {
  const text = stringOrNull(value);
  if (!text) {
    return null;
  }
  return text.toLowerCase().replace(/[\s-]+/g, '_');
}

function compareHumanBaselineDimensions({ requiredDimensions, result }) {
  const dimensions = Array.isArray(result.human_review_coverage?.dimensions)
    ? result.human_review_coverage.dimensions
    : [];
  return requiredDimensions.map((dimension) => {
    const candidate = dimensions.find((item) => normalizeHumanReviewDimensionId(item?.id) === dimension);
    return {
      dimension,
      present: candidate?.status === 'covered',
      candidate_status: candidate?.status ?? 'missing',
      evidence_required: candidate?.evidence_required !== false
    };
  });
}

function compareHumanBaselineLabels({ labels, result }) {
  const searchText = calibrationSearchText(result);
  const findings = normalizeFindings(result.agentic_human_review_findings, result.id ?? 'candidate');
  return labels.map((label) => {
    const terms = label.match_terms.length > 0 ? label.match_terms : [label.summary].filter(Boolean);
    const matchedTerms = terms.filter((term) => textIncludesLoose(searchText, term));
    const match = findEvidenceBackedOwnerLabelMatch({ label, findings, result });
    const evidenceBacked = Boolean(match.evidence_refs.length > 0);
    return {
      id: label.id,
      dimension: label.dimension,
      required: label.required,
      must_not_miss_criterion_id: label.must_not_miss_criterion_id,
      criteria_refs: label.criteria_refs,
      target_specific: label.target_specific,
      present: evidenceBacked,
      match_strategy: label.match_terms.length > 0 ? 'owner_declared_match_terms' : 'owner_label_summary_text',
      matched_term_count: matchedTerms.length,
      diagnostic_text_present: matchedTerms.length > 0,
      structured_finding_present: Boolean(match.finding),
      structured_coverage_record_present: Boolean(match.coverage_record),
      candidate_finding_id: match.finding?.id ?? null,
      candidate_coverage_record_id: match.coverage_record?.id ?? null,
      match_source: match.source,
      evidence_backed: evidenceBacked,
      candidate_evidence_ref_count: match.evidence_refs.length,
      evidence_ref_count: label.evidence_refs.length,
      severity: label.severity
    };
  });
}

function compareHumanBaselineMustNotMissCriteria({ criteria, labelMatches }) {
  const normalizedCriteria = normalizeHumanBaselineMustNotMissCriteria(criteria)
    .filter(isTargetSpecificMustNotMissCriterion);
  return normalizedCriteria.map((criterion) => {
    const matches = labelMatches.filter((label) => humanBaselineLabelCoversCriterion(label, criterion));
    const evidenceBackedMatches = matches.filter((label) => label.present && label.evidence_backed);
    return {
      id: criterion.id,
      dimension: criterion.dimension,
      severity: criterion.severity,
      present: evidenceBackedMatches.length > 0,
      owner_label_ids: matches.map((label) => label.id),
      evidence_backed_owner_label_ids: evidenceBackedMatches.map((label) => label.id)
    };
  });
}

function compareHumanBaselineRequiredMentions({ requiredMentions, result }) {
  const searchText = calibrationSearchText(result);
  const structured = Array.isArray(result.benchmark_requirement_coverage?.required_mentions)
    ? result.benchmark_requirement_coverage.required_mentions
    : [];
  return requiredMentions.map((mention) => {
    const record = structured.find((item) => textIncludesLoose(item?.mention, mention));
    return {
      mention,
      present: Boolean(record && record.evidence_backed === true && (record.present === true || record.diagnostic_text_present === true)),
      structured_record_present: Boolean(record?.structured_record_present),
      evidence_backed: Boolean(record?.evidence_backed),
      diagnostic_text_present: record ? Boolean(record.diagnostic_text_present) : textIncludesLoose(searchText, mention),
      source: record ? 'benchmark_requirement_coverage' : 'candidate_text_search_diagnostic'
    };
  });
}

function compareHumanBaselineForbiddenClaims({ forbiddenClaims, result }) {
  const searchText = calibrationSearchText(result);
  const structured = Array.isArray(result.benchmark_requirement_coverage?.forbidden_claims)
    ? result.benchmark_requirement_coverage.forbidden_claims
    : [];
  return forbiddenClaims.map((claim) => {
    const record = structured.find((item) => textIncludesLoose(item?.claim ?? item?.mention, claim));
    const present = record ? record.present === true : textIncludesLoose(searchText, claim);
    return {
      claim,
      present,
      structured_record_present: Boolean(record?.structured_record_present),
      source: record ? 'benchmark_requirement_coverage' : 'candidate_text_search'
    };
  });
}

function classifyHumanBaselineComparison({ labels, result }) {
  const findings = normalizeFindings(result.agentic_human_review_findings, result.id ?? 'candidate');
  const searchText = calibrationSearchText(result);
  const matches = [];
  const misses = [];
  const severityMismatches = [];
  const insufficientEvidence = [];
  const matchedFindingIds = new Set();
  for (const label of labels) {
    const match = findEvidenceBackedOwnerLabelMatch({ label, findings, result });
    const finding = match.finding;
    if (!match.found) {
      const terms = label.match_terms.length > 0 ? label.match_terms : [label.summary].filter(Boolean);
      const textMatched = terms.some((term) => textIncludesLoose(searchText, term));
      if (textMatched) {
        matches.push({
          owner_label_id: label.id,
          candidate_finding_id: null,
          match_source: 'candidate_text_search',
          dimension: label.dimension,
          severity: label.severity,
          candidate_severity: null
        });
        insufficientEvidence.push({
          owner_label_id: label.id,
          candidate_finding_id: null,
          reason: 'The candidate text matched the owner label but did not expose a structured finding with local evidence references.'
        });
        continue;
      }
      misses.push({
        owner_label_id: label.id,
        dimension: label.dimension,
        severity: label.severity,
        summary: label.summary,
        reason: 'No candidate finding matched the owner-declared label terms.'
      });
      continue;
    }
    if (finding?.id) {
      matchedFindingIds.add(finding.id);
    }
    matches.push({
      owner_label_id: label.id,
      candidate_finding_id: finding?.id ?? null,
      candidate_coverage_record_id: match.coverage_record?.id ?? null,
      match_source: match.source,
      dimension: label.dimension,
      severity: label.severity,
      candidate_severity: finding?.severity ?? null
    });
    if (finding && severityDistance(label.severity, finding.severity) >= 2) {
      severityMismatches.push({
        owner_label_id: label.id,
        candidate_finding_id: finding.id,
        owner_severity: label.severity,
        candidate_severity: finding.severity
      });
    }
    if (match.evidence_refs.length === 0) {
      insufficientEvidence.push({
        owner_label_id: label.id,
        candidate_finding_id: finding?.id ?? null,
        candidate_coverage_record_id: match.coverage_record?.id ?? null,
        reason: 'The candidate matched the owner label but did not carry local evidence references.'
      });
    }
  }
  const overReports = findings
    .filter((finding) => !matchedFindingIds.has(finding.id))
    .map((finding) => ({
      candidate_finding_id: finding.id,
      severity: finding.severity,
      category: finding.category,
      reason: 'Candidate finding did not match any owner-labeled baseline item.'
    }));
  return {
    matches,
    misses,
    over_reports: overReports,
    severity_mismatches: severityMismatches,
    insufficient_evidence: insufficientEvidence
  };
}

function findEvidenceBackedOwnerLabelMatch({ label, findings, result }) {
  const finding = findMatchingCandidateFinding({ label, findings });
  if (finding) {
    return {
      found: true,
      source: 'agentic_human_review_findings',
      finding,
      coverage_record: null,
      evidence_refs: finding.evidence_refs
    };
  }
  const coverageRecord = findMatchingStructuredCoverageRecord({ label, result });
  if (coverageRecord) {
    return {
      found: true,
      source: coverageRecord.source,
      finding: null,
      coverage_record: coverageRecord,
      evidence_refs: coverageRecord.evidence_refs
    };
  }
  return { found: false, source: 'none', finding: null, coverage_record: null, evidence_refs: [] };
}

function findMatchingCandidateFinding({ label, findings }) {
  const terms = label.match_terms.length > 0 ? label.match_terms : [label.summary].filter(Boolean);
  return findings.find((finding) => {
    if (label.id && finding.owner_label_ids.includes(label.id)) {
      return true;
    }
    if (label.must_not_miss_criterion_id && finding.must_not_miss_criterion_id === label.must_not_miss_criterion_id) {
      return true;
    }
    if (label.must_not_miss_criterion_id && finding.criteria_refs.includes(label.must_not_miss_criterion_id)) {
      return true;
    }
    if (label.criteria_refs.some((criterionId) => finding.criteria_refs.includes(criterionId) || finding.must_not_miss_criterion_id === criterionId)) {
      return true;
    }
    const text = `${finding.message} ${finding.recommendation} ${finding.category}`.toLowerCase();
    return terms.some((term) => textIncludesLoose(text, term));
  }) ?? null;
}

function findMatchingStructuredCoverageRecord({ label, result }) {
  const terms = label.match_terms.length > 0 ? label.match_terms : [label.summary].filter(Boolean);
  const normalizedTerms = terms.map((term) => String(term ?? '').trim()).filter(Boolean);
  if (normalizedTerms.length === 0) {
    return null;
  }
  const sections = [
    ['benchmark_requirement_coverage.required_mentions', result.benchmark_requirement_coverage?.required_mentions, ['mention', 'label', 'id', 'name']],
    ['benchmark_requirement_coverage.required_dimensions', result.benchmark_requirement_coverage?.required_dimensions, ['dimension', 'label', 'id', 'name']],
    ['benchmark_requirement_coverage.forbidden_claims', result.benchmark_requirement_coverage?.forbidden_claims, ['claim', 'label', 'id', 'name']]
  ];
  for (const [source, records, keys] of sections) {
    for (const record of Array.isArray(records) ? records : []) {
      const labelText = keys.map((key) => record?.[key]).filter(Boolean).join(' ');
      if (!normalizedTerms.some((term) => textIncludesLoose(labelText, term))) {
        continue;
      }
      const evidenceRefs = normalizeArtifactReferences(record?.evidence_refs ?? record?.artifacts);
      if (record?.evidence_ref_backed === false || record?.evidence_backed !== true || evidenceRefs.length === 0) {
        continue;
      }
      return {
        id: truncateText(record?.id ?? record?.mention ?? record?.dimension ?? record?.claim ?? source, 120),
        source,
        evidence_refs: evidenceRefs
      };
    }
  }
  return null;
}

function severityDistance(left, right) {
  const order = ['info', 'low', 'medium', 'high', 'critical'];
  const l = order.indexOf(left);
  const r = order.indexOf(right);
  if (l < 0 || r < 0) {
    return 0;
  }
  return Math.abs(l - r);
}

function calibrationSearchText(result) {
  return JSON.stringify({
    non_engineer_summary: result.non_engineer_summary,
    subjective_perception: result.subjective_perception,
    reader_experience_review: result.reader_experience_review,
    mechanical_vs_human_review: result.mechanical_vs_human_review,
    action_plan: result.agentic_human_review_action_plan,
    benchmark_requirement_coverage: result.benchmark_requirement_coverage,
    calibration_metadata: result.calibration_metadata,
    human_report_v3: result.human_report_v3,
    claims: result.review_claims,
    findings: result.agentic_human_review_findings,
    owner_decision_requests: result.owner_decision_requests
  }).toLowerCase();
}

function textIncludesLoose(text, phrase) {
  const normalized = String(phrase ?? '').toLowerCase().replace(/[-_]+/g, ' ').trim();
  if (!normalized) {
    return false;
  }
  return String(text ?? '').toLowerCase().replace(/[-_]+/g, ' ').includes(normalized);
}

function fractionPresent(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return 0;
  }
  return clampScore(records.filter((item) => item.present).length / records.length);
}

function comparableQualityScores(result) {
  return {
    completeness_score: clampScore(result.report_quality?.completeness_score ?? 0),
    evidence_coverage_score: clampScore(result.report_quality?.evidence_coverage_score ?? 0),
    verification_score: clampScore(result.report_quality?.verification_score ?? 0),
    human_review_coverage_score: clampScore(result.report_quality?.human_review_coverage_score ?? result.human_review_coverage?.coverage_score ?? 0),
    actionability_score: clampScore(result.report_quality?.actionability_score ?? 0),
    role_instruction_coverage_score: clampScore(result.role_instruction_coverage?.coverage_score ?? 0),
    calibration_ready_score: clampScore(result.review_quality_evaluation?.calibration_ready_score ?? 0),
    benchmark_required_mention_coverage_score: clampScore(result.benchmark_requirement_coverage?.summary?.required_mention_coverage_score ?? result.report_quality?.benchmark_required_mention_coverage_score ?? 0),
    benchmark_dimension_coverage_score: clampScore(result.benchmark_requirement_coverage?.summary?.dimension_coverage_score ?? result.report_quality?.benchmark_dimension_coverage_score ?? 0),
    benchmark_structured_record_completeness_score: clampScore(result.benchmark_requirement_coverage?.summary?.structured_record_completeness_score ?? result.report_quality?.benchmark_structured_record_completeness_score ?? 0),
    benchmark_forbidden_claim_score: clampScore(result.benchmark_requirement_coverage?.summary?.forbidden_claim_score ?? result.report_quality?.benchmark_forbidden_claim_score ?? 1)
  };
}

function clampDelta(value) {
  return Number(Number(value).toFixed(6));
}

function resolveRubricProfile({ profileId, benchmarkCase, reviewPackage }) {
  const requested = profileId ?? benchmarkCase?.rubric_profile_id ?? inferRubricProfileId(reviewPackage);
  const profile = RUBRIC_PROFILES.find((item) => item.id === requested)
    ?? RUBRIC_PROFILES.find((item) => item.id === 'general-human-review');
  return {
    schema_version: SCHEMA_VERSION,
    profile_version: HUMAN_REVIEW_SCHEMA_VERSION,
    id: profile.id,
    label: profile.label,
    fixture_types: [...profile.fixture_types],
    emphasis: [...profile.emphasis],
    evidence_priority: [...profile.evidence_priority],
    benchmark_case_id: benchmarkCase?.case_id ?? null,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function inferRubricProfileId(reviewPackage) {
  const text = [
    reviewPackage?.task?.intent,
    reviewPackage?.source?.review_mode,
    reviewPackage?.source?.route,
    ...(reviewPackage?.content_evidence?.text_snippets ?? []).map((item) => item.text)
  ].filter(Boolean).join(' ').toLowerCase();
  if (/\b(blog|article|post|readability|copy|content)\b/.test(text)) {
    return 'blog-content';
  }
  if (/\b(landing|signup|subscribe|conversion|trust)\b/.test(text)) {
    return 'landing-trust';
  }
  if (/\b(product|price|cart|checkout|commerce|buy)\b/.test(text)) {
    return 'commerce-confidence';
  }
  if (/\b(dashboard|admin|status|operator|empty state)\b/.test(text)) {
    return 'dashboard-comprehension';
  }
  return 'general-human-review';
}

function buildEvidencePlan({ reviewPackage, intent, provider, rubricProfile, mode }) {
  const planMode = normalizeEvidencePlanMode(mode);
  const intentWantsText = /\b(copy|content|text|read|readability|comprehension|meaning|tone|文章|文言|読解|内容)\b/i.test(intent);
  const providerClasses = new Set(Array.isArray(provider?.transferable_evidence_classes)
    ? provider.transferable_evidence_classes
    : TRANSFER_CLASSES.map((item) => item.id));
  const profilePriority = new Set(rubricProfile?.evidence_priority ?? []);
  const hasVisualReference = Number(reviewPackage.visual_evidence?.reference_count ?? 0) > 0;
  const hasText = Number(reviewPackage.content_evidence?.text_snippet_count ?? 0) > 0;
  const hasRoute = Boolean(reviewPackage.source?.route);
  const hasArtifacts = Number(reviewPackage.source?.artifact_count ?? 0) > 0;
  const classInputs = {
    raw_pixels: {
      available: hasVisualReference,
      needed: hasVisualReference && (profilePriority.has('raw_pixels') || planMode === 'visual_strict'),
      reason: hasVisualReference ? 'Visual references are available for human-like first-impression and layout review.' : 'No visual artifact reference was available.'
    },
    page_text: {
      available: hasText,
      needed: hasText || intentWantsText || profilePriority.has('page_text'),
      reason: hasText ? 'Bounded visible text snippets are available for comprehension and copy review.' : 'Text review was requested but no bounded text snippets were available.'
    },
    dom_summary: {
      available: Boolean(reviewPackage.disclosure?.dom_summary_included),
      needed: profilePriority.has('dom_summary') && Boolean(reviewPackage.disclosure?.dom_summary_included),
      reason: 'Semantic structure can support comprehension review when available.'
    },
    url: {
      available: hasRoute,
      needed: hasRoute && profilePriority.has('url'),
      reason: hasRoute ? 'URL or route metadata can help interpret context without including credentials.' : 'No route metadata was available.'
    },
    artifact_refs: {
      available: hasArtifacts,
      needed: hasArtifacts && profilePriority.has('artifact_refs'),
      reason: hasArtifacts ? 'Local artifact references can anchor claims without embedding raw artifact content.' : 'No local artifact references were available.'
    },
    accessibility_summary: {
      available: true,
      needed: profilePriority.has('accessibility_summary') || planMode === 'accessibility_strict',
      reason: 'Accessibility and comprehension summaries support cognitive-load and readability judgment.'
    }
  };
  const classes = Object.fromEntries(TRANSFER_CLASSES.map((item) => {
    const record = classInputs[item.id] ?? { available: false, needed: false, reason: 'No evidence plan rule.' };
    return [item.id, {
      id: item.id,
      flag: item.flag,
      available: Boolean(record.available),
      needed: Boolean(record.needed),
      provider_transfer_supported: providerClasses.has(item.id),
      requires_runtime_flag: Boolean(record.needed && provider?.external_evidence_transfer === true && providerClasses.has(item.id)),
      reason: record.reason,
      raw_bytes_included_by_plan: false
    }];
  }));
  return {
    schema_version: SCHEMA_VERSION,
    evidence_plan_version: HUMAN_REVIEW_SCHEMA_VERSION,
    visual_evidence_package_version: HUMAN_REVIEW_EVIDENCE_PACKAGE_VERSION,
    visible_text_reading_contract_version: HUMAN_REVIEW_EVIDENCE_PACKAGE_VERSION,
    mode: planMode,
    rubric_profile_id: rubricProfile?.id ?? null,
    provider_id: provider?.id ?? null,
    classes,
    visual_reference_policy: {
      references_allowed: hasVisualReference,
      raw_pixel_bytes_embedded_in_json: false,
      raw_pixels_read_by_planning: false,
      distinction: 'Visual references may identify local artifacts; raw image bytes are not embedded in JSON.'
    },
    content_policy: {
      bounded_text_snippets_allowed: hasText,
      raw_dom_allowed: false,
      raw_report_body_allowed: false
    },
    privacy_boundary: {
      credentials_allowed: false,
      raw_provider_response_storage_allowed: false,
      mcp_execution_allowed: false,
      deterministic_review_mutation_allowed: false,
      gate_effect: 'none'
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function normalizeEvidencePlanMode(value) {
  const mode = String(value ?? 'balanced').trim() || 'balanced';
  return ['balanced', 'text_strict', 'visual_strict', 'accessibility_strict', 'minimal'].includes(mode) ? mode : 'balanced';
}

function buildPrivacyDisclosureAudit({ stage, provider, evidencePlan, transferPermissions, executionBoundary }) {
  const requiredFlags = normalizeStringArray(transferPermissions?.required_flags);
  const classes = Object.fromEntries(TRANSFER_CLASSES.map((item) => {
    const planClass = evidencePlan?.classes?.[item.id] ?? {};
    const permissionClass = transferPermissions?.classes?.[item.id] ?? {};
    return [item.id, {
      planned: Boolean(planClass.needed),
      included_in_local_package_metadata: Boolean(permissionClass.included ?? planClass.available),
      runtime_flag_required: requiredFlags.includes(item.flag),
      raw_bytes_included: false,
      external_transfer_performed: false
    }];
  }));
  return {
    schema_version: SCHEMA_VERSION,
    audit_version: HUMAN_REVIEW_SCHEMA_VERSION,
    stage,
    provider_id: provider?.id ?? null,
    provider_external_evidence_transfer: provider?.external_evidence_transfer === true,
    classes,
    controls: {
      plan_hash_required_before_run: stage !== 'proposal',
      exact_transfer_flags_required: true,
      credentials_env_only: provider?.credential_mode === 'environment_variable_only' || provider?.credential_mode === 'none',
      credential_values_recorded: false,
      raw_provider_response_stored: false,
      raw_pixel_bytes_embedded_in_json: false,
      deterministic_findings_mutated: false,
      release_gate_mutated: false,
      mcp_execution_exposed: false
    },
    execution_boundary: executionBoundary ?? agenticHumanReviewBoundary(),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildRoleInstructionContracts({ orchestration, rubricProfile, evidencePlan }) {
  return (orchestration.sub_agents ?? []).slice(0, MAX_ROLE_OPINIONS).map((agent) => ({
    schema_version: SCHEMA_VERSION,
    instruction_contract_version: HUMAN_REVIEW_ORCHESTRATION_VERSION,
    role: agent.role,
    display_name: agent.display_name,
    effort: agent.effort,
    round: agent.round,
    independent_review: agent.independent_review !== false,
    rubric_profile_id: rubricProfile?.id ?? null,
    required_focus: roleFocusForContract(agent.role, rubricProfile),
    evidence_plan_classes: Object.values(evidencePlan?.classes ?? {})
      .filter((item) => item.needed)
      .map((item) => item.id),
    must_report: [
      'one plain-language human-reader observation',
      'evidence or uncertainty for each important claim',
      'how the observation affects trust, comprehension, feeling, or action'
    ],
    must_not: [
      'approve release gates',
      'mutate deterministic findings',
      'claim raw credentials or provider responses were stored'
    ],
    advisory_only: true,
    gate_effect: 'none'
  }));
}

function roleFocusForContract(roleId, rubricProfile) {
  const profileEmphasis = rubricProfile?.emphasis ?? [];
  if (/visual|ux/.test(roleId)) {
    return ['visual hierarchy', 'first impression', 'layout and interaction clarity', ...profileEmphasis].slice(0, 8);
  }
  if (/content/.test(roleId)) {
    return ['visible text', 'meaning', 'copy tone', 'reader comprehension', ...profileEmphasis].slice(0, 8);
  }
  if (/accessibility/.test(roleId)) {
    return ['accessibility basics', 'cognitive load', 'comprehension risk', ...profileEmphasis].slice(0, 8);
  }
  if (/critic|verification/.test(roleId)) {
    return ['contradictions', 'weak evidence', 'overclaim risk', 'missed uncertainty', ...profileEmphasis].slice(0, 8);
  }
  if (/synthesis/.test(roleId)) {
    return ['consensus', 'dissent', 'prioritized improvements', 'owner decisions', ...profileEmphasis].slice(0, 8);
  }
  return ['first impression', 'reader feeling', 'trust', 'comprehension', ...profileEmphasis].slice(0, 8);
}

function buildOrchestrationContract({ orchestration, roleInstructionContracts }) {
  const roundPlanV2 = buildXhighRoundPlanV2({ orchestration });
  return {
    schema_version: SCHEMA_VERSION,
    orchestration_version: HUMAN_REVIEW_ORCHESTRATION_VERSION,
    round_plan_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    mode: orchestration.review_effort?.mode ?? DEFAULT_REVIEW_EFFORT,
    role_count: orchestration.review_effort?.role_count ?? 0,
    round_count: orchestration.review_effort?.rounds ?? 1,
    rounds: orchestration.rounds ?? [],
    round_plan_v2: roundPlanV2,
    provider_round_execution_mode: 'single_provider_call_with_required_multi_role_round_output',
    independent_first_round_required: true,
    critic_or_verifier_included: orchestration.review_effort?.critic_or_verifier_included === true,
    synthesis_required: true,
    role_instruction_contract_hash: hashJson(roleInstructionContracts),
    required_outputs: [
      'role_opinions',
      'review_claims',
      'consensus_summary',
      'dissent_summary',
      'critique_records',
      'integration_record'
    ],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildEffortExecutionContract({
  orchestration,
  roleInstructionContracts,
  providerCapabilityContract,
  provider,
  model,
  benchmarkCase = null
}) {
  const effort = orchestration.review_effort.mode;
  const effortCapability = providerCapabilityContract?.effort_capability ?? {};
  const supportedReviewEfforts = normalizeStringArray(effortCapability.supported_review_efforts);
  const nativeBinding = buildProviderEffortBinding({
    effort,
    providerCapabilityContract,
    provider,
    model
  });
  const strictOutputContract = buildStrictOutputContract({
    orchestration,
    roleInstructionContracts,
    providerCapabilityContract,
    benchmarkCase
  });
  const repairRetryContract = buildRepairRetryContract({
    effort,
    providerCapabilityContract,
    strictOutputContract
  });
  const xhighMultiStepContract = buildXhighMultiStepContract({
    orchestration,
    providerCapabilityContract
  });
  const unsupportedConditions = [
    ...(supportedReviewEfforts.includes(effort) ? [] : [`Provider capability does not declare support for review effort "${effort}".`]),
    ...(effort === 'xhigh' && effortCapability.xhigh_supported !== true ? ['Provider capability does not declare xhigh support.'] : []),
    ...(nativeBinding.native_effort_supported || effort !== 'xhigh' ? [] : ['Provider-native reasoning effort is not available for xhigh; TraceCue contract validation remains required.'])
  ];
  return redact({
    schema_version: SCHEMA_VERSION,
    effort_contract_version: HUMAN_REVIEW_EFFORT_CONTRACT_VERSION,
    review_effort: effort,
    xhigh_required: effort === 'xhigh',
    provider_id: provider?.id ?? null,
    model_id: model?.id ?? null,
    provider_capability_hash: provider ? agenticProviderCapabilityHash(provider) : providerCapabilityContract?.capability_hash ?? null,
    supported_review_efforts: supportedReviewEfforts,
    provider_effort_binding: nativeBinding,
    strict_output_contract: strictOutputContract,
    repair_retry_contract: repairRetryContract,
    xhigh_multi_step_contract: xhighMultiStepContract,
    required_roles: orchestration.sub_agents.map((agent) => agent.role),
    required_rounds: orchestration.rounds,
    required_critic_or_verifier_roles: orchestration.sub_agents
      .filter((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role))
      .map((agent) => agent.role),
    synthesis_required: orchestration.review_effort.synthesis_required === true,
    benchmark_requirement_coverage_required: Boolean(benchmarkCase),
    unsupported_conditions: unsupportedConditions,
    status: unsupportedConditions.length === 0 ? 'ready' : 'ready_with_tracecue_validation',
    tracecue_contract_validation_required: true,
    advisory_only: true,
    gate_effect: 'none'
  });
}

function buildProviderEffortBinding({ effort, providerCapabilityContract, provider, model }) {
  const binding = providerCapabilityContract?.effort_capability?.native_effort_binding ?? {};
  const effortMap = binding.effort_map && typeof binding.effort_map === 'object' && !Array.isArray(binding.effort_map)
    ? binding.effort_map
    : {};
  const appliedValue = typeof effortMap[effort] === 'string' && effortMap[effort].trim()
    ? effortMap[effort].trim()
    : null;
  return {
    schema_version: SCHEMA_VERSION,
    binding_version: HUMAN_REVIEW_PROVIDER_EFFORT_BINDING_VERSION,
    requested_review_effort: effort,
    provider_id: provider?.id ?? providerCapabilityContract?.provider_id ?? null,
    model_id: model?.id ?? null,
    native_effort_supported: binding.supported === true && Boolean(binding.request_field) && Boolean(appliedValue),
    native_effort_request_field: binding.request_field ?? null,
    native_effort_applied_value: appliedValue,
    lossy_mapping: effort === 'xhigh' && appliedValue !== 'xhigh',
    unsupported_behavior: binding.unsupported_behavior ?? 'record_not_supported_and_continue_with_tracecue_contract_validation',
    tracecue_contract_validation_required: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildStrictOutputContract({ orchestration, roleInstructionContracts, providerCapabilityContract, benchmarkCase = null }) {
  const structuredOutput = providerCapabilityContract?.effort_capability?.structured_output_contract ?? {};
  const requiredRoleContracts = roleInstructionContracts.map((contract) => ({
    role: contract.role,
    round: contract.round,
    required_focus: contract.required_focus ?? [],
    must_report: contract.must_report ?? []
  }));
  return {
    schema_version: SCHEMA_VERSION,
    strict_output_contract_version: HUMAN_REVIEW_STRICT_OUTPUT_CONTRACT_VERSION,
    provider_json_schema_supported: structuredOutput.json_schema_supported !== false,
    provider_strict_schema_supported: structuredOutput.strict_schema_supported === true,
    tracecue_post_validation_required: structuredOutput.tracecue_post_validation_required !== false,
    required_output_sections: [
      'summary',
      'role_opinions',
      'agentic_human_review_findings',
      ...(benchmarkCase ? ['benchmark_requirement_coverage'] : []),
      ...(orchestration.review_effort.mode === 'xhigh' ? ['critique_records', 'integration_record'] : [])
    ],
    required_roles: requiredRoleContracts,
    required_rounds: orchestration.rounds,
    required_critique_roles: orchestration.sub_agents
      .filter((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role))
      .map((agent) => agent.role),
    synthesis_role: orchestration.sub_agents.find((agent) => agent.role === 'synthesis_agent')?.role ?? null,
    benchmark_requirement_coverage_required: Boolean(benchmarkCase),
    placeholder_output_counts_as_provider_output: false,
    unknown_evidence_refs_allowed_for_completion: false,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildRepairRetryContract({ effort, providerCapabilityContract, strictOutputContract }) {
  const xhighExecution = providerCapabilityContract?.effort_capability?.xhigh_execution_contract ?? {};
  return {
    schema_version: SCHEMA_VERSION,
    repair_retry_version: HUMAN_REVIEW_REPAIR_RETRY_VERSION,
    enabled_for_effort: effort === 'xhigh',
    provider_declares_repair_retry_supported: xhighExecution.repair_retry_supported === true,
    repair_retry_automatic_provider_calls_enabled: false,
    repairable_missing_sections: strictOutputContract.required_output_sections,
    retry_scope: 'missing_or_invalid_contract_sections_only',
    retry_requires_same_plan_hash_and_transfer_flags: true,
    fallback_behavior: 'mark_incomplete_and_emit_repair_plan',
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighMultiStepContract({ orchestration, providerCapabilityContract }) {
  const xhighExecution = providerCapabilityContract?.effort_capability?.xhigh_execution_contract ?? {};
  const steps = orchestration.rounds.map((round) => {
    const agents = orchestration.sub_agents.filter((agent) => Number(agent.round) === Number(round));
    return {
      round,
      roles: agents.map((agent) => agent.role),
      provider_call_policy: 'planned_step_not_auto_executed',
      depends_on_rounds: round > 1 ? [round - 1] : [],
      expected_output_sections: round > 1
        ? ['role_opinions', 'critique_records', 'integration_record']
        : ['role_opinions', 'agentic_human_review_findings', 'review_claims']
    };
  });
  return {
    schema_version: SCHEMA_VERSION,
    multi_step_xhigh_version: HUMAN_REVIEW_MULTI_STEP_XHIGH_VERSION,
    xhigh_required: orchestration.review_effort.mode === 'xhigh',
    provider_declares_true_multi_step_supported: xhighExecution.true_multi_step_execution_supported === true,
    true_multi_step_execution_default: xhighExecution.true_multi_step_execution_default === true,
    live_multi_call_execution_performed_by_plan: false,
    automatic_live_multi_call_enabled: false,
    execution_surface: xhighExecution.execution_surface ?? 'not_declared',
    steps,
    synthesis_step: steps.find((step) => step.roles.includes('synthesis_agent')) ?? null,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighRoundPlanV2({ orchestration }) {
  const subAgents = orchestration.sub_agents ?? [];
  return (orchestration.rounds ?? [1]).map((round) => {
    const roles = subAgents.filter((agent) => Number(agent.round) === Number(round));
    return {
      round: Number(round),
      phase: round === 1 ? 'independent_review' : round === 2 ? 'critique_and_verification' : 'synthesis',
      roles: roles.map((agent) => agent.role),
      independent_output_required: round === 1,
      contradiction_check_required: round >= 2,
      synthesis_required: round === Math.max(...(orchestration.rounds ?? [1])),
      required_output: round === 1
        ? 'separate role opinion with evidence, uncertainty, and human-reader judgment'
        : round === 2
          ? 'challenge weak claims, missing evidence, and overconfident subjective conclusions'
          : 'integrated consensus, dissent, prioritized fixes, and owner decisions',
      advisory_only: true,
      gate_effect: 'none'
    };
  });
}

function buildTransferPermissions({ reviewPackage, intent, provider = null, evidencePlan = null }) {
  const intentWantsText = /\b(copy|content|text|read|readability|comprehension|meaning|tone|文章|文言|読解|内容)\b/i.test(intent);
  const rawPixelsRequired = Number(reviewPackage.visual_evidence?.reference_count ?? 0) > 0;
  const pageTextRequired = intentWantsText || Number(reviewPackage.content_evidence?.text_snippet_count ?? 0) > 0;
  const providerExternal = provider?.external_evidence_transfer === true;
  const providerClasses = new Set(Array.isArray(provider?.transferable_evidence_classes)
    ? provider.transferable_evidence_classes
    : TRANSFER_CLASSES.map((item) => item.id));
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
    const requiredForExecution = providerExternal
      ? included && providerClasses.has(transferClass.id)
      : transferClass.id === 'raw_pixels'
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
      evidence_plan_required: evidencePlan?.classes?.[transferClass.id]?.needed === true,
      evidence_plan_reason: evidencePlan?.classes?.[transferClass.id]?.reason ?? null,
      transfer_performed_by_planning: false,
      transfer_performed_by_fake_provider: false,
      external_provider_transfer_class: providerExternal && providerClasses.has(transferClass.id)
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
    default_external_transfer: providerExternal,
    evidence_plan_hash: evidencePlan ? hashJson(evidencePlan) : null,
    mcp_transfer_allowed: false
  };
}

function buildTransferApprovalPreview({ transferPermissions, provider, evidencePlan }) {
  const requiredClasses = TRANSFER_CLASSES
    .filter((item) => transferPermissions.classes[item.id]?.required_for_execution)
    .map((item) => ({
      id: item.id,
      label: item.label,
      flag: `--${item.flag}`,
      reason: transferPermissions.classes[item.id]?.evidence_plan_reason ?? evidencePlan?.classes?.[item.id]?.reason ?? null
    }));
  const deniedClasses = TRANSFER_CLASSES
    .filter((item) => !transferPermissions.classes[item.id]?.required_for_execution)
    .map((item) => item.id);
  return {
    schema_version: SCHEMA_VERSION,
    approval_preview_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    provider_id: provider?.id ?? null,
    provider_external_evidence_transfer: provider?.external_evidence_transfer === true,
    exact_match_required: true,
    required_flags: transferPermissions.required_flags.map((flag) => `--${flag}`),
    required_classes: requiredClasses,
    denied_or_not_required_classes: deniedClasses,
    owner_confirmation_text: requiredClasses.length > 0
      ? `Approve only these transfer classes before running: ${requiredClasses.map((item) => item.label).join(', ')}.`
      : 'No external evidence transfer classes are required by this plan.',
    safety_controls: {
      plan_hash_required: true,
      execute_flag_required: true,
      extra_transfer_flags_rejected: true,
      raw_pixel_bytes_embedded_in_json: false,
      credential_values_recorded: false,
      raw_provider_response_stored: false,
      mcp_execution_allowed: false
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function dogfoodSetSummary() {
  return {
    set_id: DOGFOOD_SET.set_id,
    set_version: DOGFOOD_SET.set_version,
    case_ids: [...DOGFOOD_SET.case_ids],
    required_review_modes: [...DOGFOOD_SET.required_review_modes],
    manual_live_provider_default: DOGFOOD_SET.manual_live_provider_default,
    ci_live_provider_default: DOGFOOD_SET.ci_live_provider_default,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildHumanReviewLongitudinalDogfoodPlan({ providerId, activeCaseId = null }) {
  const activeCases = activeCaseId
    ? BENCHMARK_CASES.filter((benchmarkCase) => benchmarkCase.case_id === activeCaseId)
    : BENCHMARK_CASES;
  const caseMatrix = activeCases.map((benchmarkCase) => ({
    case_id: benchmarkCase.case_id,
    fixture_type: benchmarkCase.fixture_type,
    rubric_profile_id: benchmarkCase.rubric_profile_id,
    required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
    required_dimensions: [...benchmarkCase.required_dimensions],
    quality_thresholds: { ...benchmarkCase.thresholds },
    plan_commands: HUMAN_REVIEW_CLAIM_EFFORTS.map((effort) => ({
      effort,
      proposal: `${CLI_NAME} agentic review propose --brief <human-review-request> --benchmark-case ${benchmarkCase.case_id} --effort ${effort} --provider ${providerId} --json`,
      plan: `${CLI_NAME} agentic review plan --proposal <proposal-${benchmarkCase.case_id}-${effort}.json> --benchmark-case ${benchmarkCase.case_id} --effort ${effort} --provider ${providerId} --json`,
      run: `${CLI_NAME} agentic review run --plan <plan-${benchmarkCase.case_id}-${effort}.json> --plan-hash <sha256> <exact transfer flags> --execute --json`,
      report_quality: `${CLI_NAME} agentic review report-quality --result <result-${benchmarkCase.case_id}-${effort}.json> --json`,
      calibrate: `${CLI_NAME} agentic review calibrate --result <result-${benchmarkCase.case_id}-${effort}.json> --case ${benchmarkCase.case_id} --json`
    }))
  }));
  return {
    schema_version: SCHEMA_VERSION,
    maturity_version: HUMAN_REVIEW_MATURITY_VERSION,
    active_case_id: activeCaseId,
    required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
    required_benchmark_case_ids: BENCHMARK_CASES.map((benchmarkCase) => benchmarkCase.case_id),
    active_case_matrix: caseMatrix,
    required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    comparison_workflow: {
      direct_vs_tracecue: `${CLI_NAME} agentic review compare --baseline <direct-review-result.json> --candidate <tracecue-result.json> --comparison-kind direct-vs-tracecue --json`,
      provider_dogfood: `${CLI_NAME} agentic review compare --baseline <previous-provider-result.json> --candidate <current-provider-result.json> --comparison-kind provider-dogfood --json`,
      benchmark_regression: `${CLI_NAME} agentic review compare --baseline <previous-benchmark-result.json> --candidate <current-benchmark-result.json> --comparison-kind benchmark-regression --json`
    },
    continuous_quality_evaluation: {
      repeat_report_quality_per_result: true,
      repeat_calibration_per_case: true,
      compare_across_efforts: true,
      owner_review_required_before_claim: true,
      release_gate_mutated: false
    },
    human_equivalence_claim: {
      human_equivalent_claim_allowed_by_plan: false,
      human_superior_claim_allowed_by_plan: false,
      reason: 'This is a dogfood evidence plan only. It does not authorize a claim that TraceCue is equal or superior to human reviewers.'
    },
    advisory_only: true,
    gate_effect: 'none'
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

async function executeAgenticProvider({ provider, model, surface, plan, planPath, transferFlags, execution, maxBytes, resultId, now, context }) {
  if (provider.id === 'fake-agent') {
    return fakeAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now });
  }
  if (provider.id === 'injected-runner') {
    return injectedAgenticReviewResult({ provider, model, surface, plan, planPath, transferFlags, execution, resultId, now, context });
  }
  if (provider.transport === 'provider_api' || provider.external_evidence_transfer === true) {
    const reviewPackageRead = await readReviewPackageForExecution({
      cwd: context.cwd ?? process.cwd(),
      plan,
      maxBytes: maxBytes ?? DEFAULT_MAX_BYTES
    });
    if (!reviewPackageRead.ok) {
      return providerFailure({
        status: 'blocked',
        code: reviewPackageRead.error.code,
        message: reviewPackageRead.error.message,
        details: reviewPackageRead.error.details,
        provider
      });
    }
    const providerResult = await executeAgenticHumanReviewApiProvider({
      provider,
      model,
      surface,
      plan,
      planPath,
      reviewPackage: reviewPackageRead.value,
      transferFlags,
      execution,
      context
    });
    if (!providerResult.ok) {
      return providerResult;
    }
    return {
      ok: true,
      status: providerResult.status,
      result: normalizeAgenticAdvisoryResult({
        id: resultId,
        now,
        plan,
        planPath,
        input: providerResult.input,
        provider,
        model,
        surface,
        transferFlags,
        execution,
        boundary: providerResult.boundary
      }),
      boundary: providerResult.boundary,
      warnings: providerResult.warnings
    };
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
    reader_experience_review: {
      first_impression: ['The first impression should be checked from visual hierarchy, screen text, and the most obvious next action.'],
      likely_viewer_feeling: ['A viewer may feel reassured when content is specific and visually easy to scan, or uncertain when the page is noisy or technically degraded.'],
      content_takeaway: ['The reviewer should identify what useful message, story, or decision support the reader can actually take away.'],
    trust_assessment: ['Trust should be judged from specificity, evidence, working media, accessible text, and whether technical issues undermine confidence.'],
    visual_ux_assessment: ['Visual and UX value loss should be separated from the intrinsic value of the content.'],
    accessibility_comprehension: ['Accessibility issues should be translated into practical comprehension risks for real people.'],
    risk_and_misleading_content: ['Risks should identify uncertainty, terminology hazards, missing proof, or wording that could mislead a reader.'],
    lost_value_summary: ['Technical or UI friction can make otherwise useful content feel harder to trust or act on.'],
    priority_recommendation: ['Prioritize changes that make the existing content value easier to see, understand, and trust.']
    },
    mechanical_vs_human_review: {
      balanced_takeaways: ['The deterministic layer identifies objective risks; the human-review layer explains what those risks mean for reader perception.']
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
    findings: buildDeterministicFakeBenchmarkFindings({ plan }),
    strengths: ['The review workflow keeps subjective judgment separate from deterministic findings.'],
    improvement_suggestions: ['Run an approved human or provider review when substantive visual, textual, and audience judgment is required.'],
    owner_decision_requests: [{
      id: 'agentic-owner-review-required',
      question: 'Does the owner approve acting on this advisory result after reviewing the evidence and uncertainty?',
      reason: 'Agentic human review is advisory-only and cannot change release gates by itself.'
    }]
  };
  input.benchmark_requirement_coverage = buildProviderDeclaredBenchmarkRequirementCoverage({ plan, input });
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
  const claims = buildReviewClaims({ resultId: id, input, findings, roleOpinions });
  const roundRecords = buildRoundRecords({ plan, roleOpinions });
  const critiqueRecords = buildCritiqueRecords({ plan, claims, roleOpinions });
  const rebuttalRecords = buildRebuttalRecords({ critiqueRecords });
  const integrationRecord = buildIntegrationRecord({ roleOpinions, findings, critiqueRecords, input });
  const readerExperienceReview = buildReaderExperienceReview({ input, plan, findings, roleOpinions });
  const mechanicalVsHumanReview = buildMechanicalVsHumanReview({ input, plan, findings, readerExperienceReview });
  const humanReviewCoverage = buildHumanReviewCoverage({
    input,
    findings,
    roleOpinions,
    readerExperienceReview,
    actionPlan: input.agentic_human_review_action_plan
  });
  const dogfoodMetadata = buildDogfoodMetadata({ plan, resultId: id });
  const benchmarkCase = resolveBenchmarkCase(plan.review_quality_benchmark?.case_id ?? plan.dogfood_metadata?.case_id);
  const benchmarkCompletionReadiness = buildBenchmarkCompletionReadiness({
    benchmarkCase,
    rubricProfile: plan.rubric_profile ?? null,
    dogfoodMetadata: plan.dogfood_metadata ?? null
  });
  const benchmarkRequirementCoverage = buildBenchmarkRequirementCoverage({
    plan,
    input,
    humanReviewCoverage,
    readerExperienceReview,
    benchmarkCase
  });
  const roleInstructionCoverage = buildRoleInstructionCoverage({ plan, roleOpinions });
  const consensusAnalysis = buildConsensusAnalysis({ roleOpinions, findings, claims, input });
  const dissentAnalysis = buildDissentAnalysis({ roleOpinions, claims, critiqueRecords, input });
  const xhighCompletion = buildXhighCompletionAssessment({
    plan,
    roleOpinions,
    roundRecords,
    critiqueRecords,
    integrationRecord,
    roleInstructionCoverage
  });
  const qualityPreview = buildReportQualityFromParts({
    roleOpinions,
    findings,
    ownerDecisions,
    claims,
    critiqueRecords,
    integrationRecord,
    humanReviewCoverage,
    readerExperienceReview,
    benchmarkRequirementCoverage
  });
  const reviewQualityEvaluation = buildReviewQualityEvaluation({
    quality: qualityPreview,
    roleInstructionCoverage,
    consensusAnalysis,
    dissentAnalysis,
    xhighCompletion,
    plan,
    benchmarkRequirementCoverage
  });
  const calibrationMetadata = buildCalibrationMetadata({
    plan,
    input,
    quality: qualityPreview,
    benchmarkRequirementCoverage
  });
  const humanReportV3 = buildHumanReportV3({
    input,
    plan,
    readerExperienceReview,
    mechanicalVsHumanReview,
    quality: qualityPreview,
    reviewQualityEvaluation
  });
  const privacyDisclosureAudit = buildPrivacyDisclosureAudit({
    stage: 'result',
    provider,
    evidencePlan: plan.evidence_plan,
    transferPermissions: transferFlags,
    executionBoundary: boundary
  });
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
    orchestration_version: plan.orchestration_version ?? HUMAN_REVIEW_ORCHESTRATION_VERSION,
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
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
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
    reader_experience_review: readerExperienceReview,
    mechanical_vs_human_review: mechanicalVsHumanReview,
    human_review_coverage: humanReviewCoverage,
    rubric_profile: plan.rubric_profile ?? null,
    evidence_plan: plan.evidence_plan ?? null,
    orchestration_contract: plan.orchestration_contract ?? null,
    effort_execution_contract: plan.effort_execution_contract ?? null,
    provider_effort_binding: plan.provider_effort_binding ?? plan.effort_execution_contract?.provider_effort_binding ?? null,
    strict_output_contract: plan.strict_output_contract ?? plan.effort_execution_contract?.strict_output_contract ?? null,
    repair_retry_contract: plan.repair_retry_contract ?? plan.effort_execution_contract?.repair_retry_contract ?? null,
    xhigh_multi_step_contract: plan.xhigh_multi_step_contract ?? plan.effort_execution_contract?.xhigh_multi_step_contract ?? null,
    role_instruction_coverage: roleInstructionCoverage,
    role_opinions: roleOpinions,
    role_execution_records: buildRoleExecutionRecords({ plan, roleOpinions, boundary }),
    review_claims: claims,
    round_records: roundRecords,
    critique_records: critiqueRecords,
    rebuttal_records: rebuttalRecords,
    integration_record: integrationRecord,
    dogfood_metadata: dogfoodMetadata,
    live_dogfood_execution_gate: transferFlags.live_dogfood_execution_gate ?? plan.live_dogfood_execution_gate ?? null,
    benchmark_completion_readiness: benchmarkCompletionReadiness,
    benchmark_requirement_coverage: benchmarkRequirementCoverage,
    calibration_metadata: calibrationMetadata,
    report_quality: qualityPreview,
    review_quality_evaluation: reviewQualityEvaluation,
    xhigh_multi_round_review: xhighCompletion,
    xhigh_mechanical_enforcement: {
      schema_version: SCHEMA_VERSION,
      completion_version: HUMAN_REVIEW_XHIGH_COMPLETION_VERSION,
      status: xhighCompletion.status,
      required: xhighCompletion.required,
      mechanical_contract_enforced: xhighCompletion.mechanical_contract_enforced === true,
      completion_score: xhighCompletion.completion_score,
      missing_conditions: xhighCompletion.missing_conditions,
      repair_plan: xhighCompletion.repair_plan,
      multi_step_plan: xhighCompletion.multi_step_plan,
      evidence_provenance: xhighCompletion.evidence_provenance,
      advisory_only: true,
      gate_effect: 'none'
    },
    human_report_v3: humanReportV3,
    consensus_summary: buildConsensusSummary({ roleOpinions, findings, input }),
    dissent_summary: buildDissentSummary({ roleOpinions, input }),
    consensus_analysis: consensusAnalysis,
    dissent_analysis: dissentAnalysis,
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
      transport: provider.transport,
      capability_hash: agenticProviderCapabilityHash(provider),
      capability_contract_included: false
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
      raw_pixels_transferred: boundary.raw_pixels_transferred,
      page_text_transferred: boundary.page_text_transferred,
      dom_summary_transferred: boundary.dom_summary_transferred,
      url_metadata_transferred: boundary.url_metadata_transferred,
      artifact_refs_transferred: boundary.artifact_refs_transferred,
      accessibility_summary_transferred: boundary.accessibility_summary_transferred,
      raw_provider_response_stored: false
    },
    privacy_disclosure_audit: privacyDisclosureAudit,
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
    provider_capability_hash: plan.provider_capability_hash ?? agenticProviderCapabilityHash(provider),
    provider,
    model,
    surface: surfaceSummary(surface),
    transfer_permissions: transferFlags,
    live_dogfood_execution_gate: transferFlags.live_dogfood_execution_gate ?? null,
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
        request_bytes: boundary.request_bytes,
        response_bytes: boundary.response_bytes,
        provider_status_code: boundary.provider_status_code,
        raw_provider_response_stored: false,
        failure_diagnostics: providerResult.failure_diagnostics ?? null
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
    raw_pixels_transferred: boundary.raw_pixels_transferred,
    page_text_transferred: boundary.page_text_transferred,
    dom_summary_transferred: boundary.dom_summary_transferred,
    url_metadata_transferred: boundary.url_metadata_transferred,
    artifact_refs_transferred: boundary.artifact_refs_transferred,
    accessibility_summary_transferred: boundary.accessibility_summary_transferred,
    request_bytes: boundary.request_bytes,
    response_bytes: boundary.response_bytes,
    provider_status_code: boundary.provider_status_code,
    failure_diagnostics: providerResult.failure_diagnostics ?? null,
    deterministic_findings_mutated: false,
    metrics_finding_count_mutated: false,
    existing_review_mutated: false,
    release_gate_mutated: false,
    mcp_execution_exposed: false,
    boundary
  });
}

function validatePlanArtifact({ plan, planPath }) {
  if (plan?.type !== 'agentic_human_review_plan' || plan?.result_contract?.required_output_schema !== 'agentic_human_review_advisory') {
    return validationError('AGENTIC_REVIEW_PLAN_CONTRACT_MISMATCH', 'The input plan is not an agentic_human_review_plan artifact.', {
      plan: planPath,
      type: plan?.type ?? null,
      required_output_schema: plan?.result_contract?.required_output_schema ?? null
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
  return { ok: true, planHash: recomputedHash };
}

function validateAdvisoryResultArtifact({ result, resultPath }) {
  if (result?.result_type !== 'agentic_human_review_advisory') {
    return validationError('AGENTIC_REVIEW_RESULT_CONTRACT_MISMATCH', 'agentic review report-quality requires an agentic_human_review_advisory result artifact.', {
      result: resultPath,
      result_type: result?.result_type ?? null
    });
  }
  if (result.agentic_human_review_advisory?.gate_effect !== 'none' || result.boundary?.advisory_only === false) {
    return validationError('AGENTIC_REVIEW_RESULT_BOUNDARY_MISMATCH', 'agentic review report-quality requires an advisory-only result with no gate effect.', {
      result: resultPath,
      gate_effect: result.agentic_human_review_advisory?.gate_effect ?? null,
      advisory_only: result.boundary?.advisory_only ?? null
    });
  }
  return { ok: true };
}

function validateReportQualityExecutionMatch({ result, resultPath, execution, executionPath }) {
  if (execution?.mode !== 'agentic_human_review_run') {
    return validationError('AGENTIC_REVIEW_EXECUTION_CONTRACT_MISMATCH', 'agentic review report-quality execution metadata must be an agentic_human_review_run execution artifact.', {
      execution: executionPath,
      mode: execution?.mode ?? null
    });
  }
  const resultExecutionId = result.execution?.id ?? null;
  if (resultExecutionId && execution.id && resultExecutionId !== execution.id) {
    return validationError('AGENTIC_REVIEW_RESULT_EXECUTION_MISMATCH', 'The supplied result and execution artifacts refer to different agentic review executions.', {
      result: resultPath,
      execution: executionPath,
      result_execution_id: resultExecutionId,
      execution_id: execution.id
    });
  }
  if (execution.result_path && resultPath !== execution.result_path) {
    return validationError('AGENTIC_REVIEW_RESULT_PATH_MISMATCH', 'The supplied result path does not match the execution metadata result path.', {
      result: resultPath,
      execution: executionPath,
      expected_result_path: execution.result_path
    });
  }
  return { ok: true };
}

function validateRunRequest({ plan, planPath, suppliedPlanHash, options, context }) {
  const planValidation = validatePlanArtifact({ plan, planPath });
  if (!planValidation.ok) {
    return planValidation;
  }
  const recomputedHash = planValidation.planHash;
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
  const currentCapabilityHash = agenticProviderCapabilityHash(provider.provider);
  if (plan.provider_capability_hash && plan.provider_capability_hash !== currentCapabilityHash) {
    return validationError('AGENTIC_REVIEW_PROVIDER_CAPABILITY_DRIFT', 'The current provider capability contract no longer matches the approved plan.', {
      provider: provider.provider.id,
      plan_provider_capability_hash: plan.provider_capability_hash,
      current_provider_capability_hash: currentCapabilityHash
    });
  }
  const liveDogfoodExecutionGate = buildAgenticLiveDogfoodExecutionGate({
    provider: provider.provider,
    plan,
    context,
    phase: 'run'
  });
  if (liveDogfoodExecutionGate.status === 'blocked_manual_live_dogfood_opt_in_required') {
    return validationError('AGENTIC_REVIEW_LIVE_DOGFOOD_OPT_IN_REQUIRED', 'Real provider dogfood execution requires explicit live dogfood opt-in before the provider API can be called.', {
      provider: provider.provider.id,
      live_dogfood_env: liveDogfoodExecutionGate.live_dogfood_env,
      benchmark_case_id: liveDogfoodExecutionGate.benchmark_case_id,
      provider_call_performed: false,
      api_call_performed: false,
      raw_provider_response_stored: false
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
      mcp_transfer_allowed: false,
      live_dogfood_execution_gate: liveDogfoodExecutionGate
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
    external_evidence_transfer_authorized: execution.external_evidence_transfer,
    required_transfer_flags: transferFlags.required_flags,
    supplied_transfer_flags: transferFlags.supplied_flags,
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
    raw_pixels_transferred: execution.raw_pixels_transferred,
    page_text_transferred: execution.page_text_transferred,
    dom_summary_transferred: execution.dom_summary_transferred,
    url_metadata_transferred: execution.url_metadata_transferred,
    artifact_refs_transferred: execution.artifact_refs_transferred,
    accessibility_summary_transferred: execution.accessibility_summary_transferred,
    request_bytes: execution.request_bytes,
    response_bytes: execution.response_bytes,
    provider_status_code: execution.provider_status_code,
    raw_response_stored: false,
    raw_provider_response_stored: false,
    existing_review_mutated: false,
    deterministic_findings_mutated: false,
    metrics_finding_count_mutated: false,
    release_gate_mutated: false,
    mcp_execution_exposed: false,
    provider_error_code: providerResult.error?.code ?? null,
    failure_diagnostics: providerResult.failure_diagnostics ?? null,
    live_dogfood_execution_gate: execution.live_dogfood_execution_gate ?? null,
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
    '## Viewer Feeling And Comprehension',
    '',
    ...normalizeStringArray(result.reader_experience_review?.likely_viewer_feeling).map((item) => `- ${item}`),
    ...normalizeStringArray(result.subjective_perception?.emotional_reception).map((item) => `- ${item}`),
    ...normalizeStringArray(result.subjective_perception?.trust_and_credibility).map((item) => `- ${item}`),
    ...normalizeStringArray(result.readability_comprehension?.meaning_gaps).map((item) => `- ${item}`),
    '',
    '## Content And Trust',
    '',
    ...normalizeStringArray(result.reader_experience_review?.content_takeaway).map((item) => `- ${item}`),
    ...normalizeStringArray(result.reader_experience_review?.trust_assessment).map((item) => `- ${item}`),
    '',
    '## Human Report V3',
    '',
    result.human_report_v3?.reader_story ?? '',
    '',
    `Priority fix: ${result.human_report_v3?.highest_priority_fix ?? 'owner review required'}`,
    '',
    ...normalizeStringArray(result.human_report_v3?.what_works).map((item) => `- Works: ${item}`),
    ...normalizeStringArray(result.human_report_v3?.what_gets_lost).map((item) => `- Lost value: ${item}`),
    '',
    '## Mechanical Review Compared With Human Review',
    '',
    ...normalizeStringArray(result.mechanical_vs_human_review?.balanced_takeaways).map((item) => `- ${item}`),
    '',
    '## Role Opinions',
    '',
    ...normalizeRoleOpinions(result.role_opinions).map((item) => `- ${item.display_name}: ${item.summary}`),
    '',
    '## Evidence Claims',
    '',
    ...normalizeReviewClaimsForReport(result.review_claims).map((item) => `- ${item.claim}`),
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
    '## Owner Decisions',
    '',
    ...normalizeOwnerDecisionRequests(result.owner_decision_requests).map((item) => `- ${item.question}`),
    '',
    '## Report Quality',
    '',
    `Completeness: ${result.report_quality?.completeness_score ?? 'unknown'}`,
    `Evidence coverage: ${result.report_quality?.evidence_coverage_score ?? 'unknown'}`,
    `Verification coverage: ${result.report_quality?.verification_score ?? 'unknown'}`,
    `Human-review coverage: ${result.report_quality?.human_review_coverage_score ?? 'unknown'}`,
    `Actionability: ${result.report_quality?.actionability_score ?? 'unknown'}`,
    `Evaluator: ${result.report_quality?.quality_evaluator_version ?? result.review_quality_evaluation?.evaluator_version ?? 'unknown'}`,
    '',
    '## Quality Evaluation',
    '',
    `Calibration readiness: ${result.review_quality_evaluation?.calibration_ready_score ?? 'unknown'}`,
    `Human likeness: ${result.review_quality_evaluation?.human_likeness_score ?? 'unknown'}`,
    `Content reading: ${result.review_quality_evaluation?.content_reading_score ?? 'unknown'}`,
    `Sensibility: ${result.review_quality_evaluation?.sensibility_score ?? 'unknown'}`,
    `Role coverage: ${result.role_instruction_coverage?.coverage_score ?? 'unknown'}`,
    `Weak claims: ${result.dissent_analysis?.weak_claim_count ?? 'unknown'}`,
    '',
    '## Calibration And Privacy',
    '',
    `Benchmark case: ${result.calibration_metadata?.benchmark_case_id ?? 'none'}`,
    `Rubric profile: ${result.rubric_profile?.id ?? 'none'}`,
    `Raw provider response stored: ${result.privacy_disclosure_audit?.controls?.raw_provider_response_stored ?? false}`,
    `Raw pixel bytes embedded in JSON: ${result.privacy_disclosure_audit?.controls?.raw_pixel_bytes_embedded_in_json ?? false}`,
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

function computeProposalHash(proposal) {
  return hashText(canonicalStringify(hashableProposal(proposal)));
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

function hashableProposal(proposal) {
  const clone = structuredCloneSafe(proposal);
  delete clone.proposal_hash;
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

function buildPlanCommand({ proposalPath, reviewIndexPath }) {
  return buildPlanCommandArgs({ proposalPath, reviewIndexPath }).join(' ');
}

function buildPlanCommandArgs({ proposalPath, reviewIndexPath }) {
  const parts = [
    CLI_NAME,
    'agentic',
    'review',
    'plan'
  ];
  if (proposalPath) {
    parts.push('--proposal', proposalPath);
  }
  if (reviewIndexPath) {
    parts.push('--review-index', reviewIndexPath);
  }
  parts.push('--json');
  return parts;
}

function collectTransferFlags(options) {
  return Object.fromEntries(TRANSFER_CLASSES.map((item) => [item.flag, options[item.flag] === true]));
}

function resolveProviderDescriptor(providerId, context = {}) {
  return resolveAgenticHumanReviewProvider({ providerId: providerId ?? DEFAULT_PROVIDER_ID, context });
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

async function resolveProposalBrief(options, context) {
  const fallback = 'Review this page, image, or screen as a human would, including first impression, visual clarity, text comprehension, trust, emotional reception, and improvement suggestions.';
  if (options.brief) {
    return { ok: true, brief: truncateText(options.brief, 2000), inputMode: 'brief', warnings: [] };
  }
  if (options.intent) {
    return { ok: true, brief: truncateText(options.intent, 2000), inputMode: 'intent', warnings: [] };
  }
  if (options.input === '-') {
    return { ok: true, brief: truncateText(context.stdinText ?? fallback, 2000), inputMode: 'stdin', warnings: [] };
  }
  if (options.input && String(options.input).startsWith('@')) {
    const fileRead = await readWorkspaceText({
      cwd: context.cwd ?? process.cwd(),
      inputPath: String(options.input).slice(1),
      label: 'agentic review proposal brief',
      maxBytes: MAX_PROPOSAL_BRIEF_BYTES
    });
    if (!fileRead.ok) {
      return { ok: false, error: fileRead.error };
    }
    return {
      ok: true,
      brief: truncateText(fileRead.text, 2000),
      inputMode: 'file',
      warnings: []
    };
  }
  if (options.input) {
    return { ok: true, brief: truncateText(options.input, 2000), inputMode: 'input', warnings: [] };
  }
  return {
    ok: true,
    brief: fallback,
    inputMode: 'fallback',
    warnings: [{
      code: 'AGENTIC_REVIEW_PROPOSAL_BRIEF_DEFAULTED',
      message: 'No explicit proposal brief was provided, so the default human-review request was used.',
      details: {}
    }]
  };
}

function inferReviewEffort(brief) {
  const text = String(brief ?? '').toLowerCase();
  if (/\b(xhigh|highest|multi-round|multiple round|critic|rebuttal|反論|検証|精査|複数ラウンド)\b/.test(text)) {
    return 'xhigh';
  }
  if (/\b(deep|thorough|comprehensive|detailed|詳しく|網羅)\b/.test(text)) {
    return 'deep';
  }
  if (/\b(quick|brief|first impression|短時間|第一印象)\b/.test(text)) {
    return 'quick';
  }
  return DEFAULT_REVIEW_EFFORT;
}

function buildStructuredIntent({ brief, targetAudience, expectedImpression }) {
  return {
    purpose: truncateText(brief, 1200),
    target_audience: truncateText(targetAudience ?? 'The intended viewer or user of the reviewed page, image, or screen.', 500),
    expected_impression: truncateText(expectedImpression ?? 'Judge what a person is likely to notice, understand, trust, feel, and want to do next.', 700),
    requested_review_areas: RUBRIC_AREAS.map((area) => ({
      id: area,
      subjective_judgment_allowed: true,
      evidence_required: true
    }))
  };
}

function buildHumanReviewContract({ intent, targetAudience, expectedImpression } = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    review_model: 'agentic_human_review_v2',
    intent: truncateText(intent ?? 'Human-like review of visual, UX, content, comprehension, trust, feeling, and improvements.', 1200),
    target_audience: truncateText(targetAudience ?? 'The intended viewer or user of the reviewed page, image, or screen.', 500),
    expected_impression: truncateText(expectedImpression ?? 'Judge what a person is likely to notice, understand, trust, feel, and want to do next.', 700),
    dimensions: HUMAN_REVIEW_DIMENSIONS.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      purpose: dimension.purpose,
      required_fields: [...dimension.required_fields],
      subjective_judgment_allowed: true,
      evidence_required: true,
      uncertainty_required: true
    })),
    required_distinctions: [
      'separate deterministic technical findings from subjective human interpretation',
      'separate content value from UI or technical value loss',
      'separate evidence-backed observations from uncertain impressions',
      'separate consensus from dissent'
    ],
    output_requirements: {
      reader_feeling_required: true,
      content_comprehension_required: true,
      mechanical_vs_human_review_required: true,
      improvement_priority_required: true,
      advisory_only: true,
      gate_effect: 'none'
    }
  };
}

async function buildProposalReviewIndexPreview({ cwd, options, artifactRootInput, id, now, brief, maxBytes, provider }) {
  if (!options['review-index']) {
    const emptyPackage = {
      visual_evidence: { reference_count: 0 },
      content_evidence: { text_snippet_count: 0 },
      source: { route: null, artifact_count: 0 }
    };
    return {
      ok: true,
      reviewIndexPath: null,
      reviewIndexHash: null,
      transferPermissions: buildTransferPermissions({ reviewPackage: emptyPackage, intent: brief, provider }),
      warnings: [{
        code: 'AGENTIC_REVIEW_PROPOSAL_REVIEW_INDEX_MISSING',
        message: 'The proposal was created without a review index; planning will require --review-index later.',
        details: {}
      }]
    };
  }
  const reviewIndexRead = await readWorkspaceJson({
    cwd,
    inputPath: options['review-index'],
    label: 'review artifact index',
    maxBytes
  });
  if (!reviewIndexRead.ok) {
    return { ok: false, error: reviewIndexRead.error };
  }
  const reviewArtifact = await readLinkedReviewArtifact({
    cwd,
    reviewIndex: reviewIndexRead.value,
    maxBytes
  });
  const packageRel = artifactRelPath(artifactRootInput, 'agentic-human-review-packages', id, 'package.json');
  const reviewPackage = buildReviewPackage({
    id,
    now,
    packagePath: packageRel,
    reviewIndex: reviewIndexRead.value,
    reviewIndexPath: reviewIndexRead.relativePath,
    reviewIndexHash: hashText(reviewIndexRead.text),
    reviewArtifact,
    intent: brief,
    targetAudience: options['target-audience'],
    expectedImpression: options['expected-impression']
  });
  return {
    ok: true,
    reviewIndexPath: reviewIndexRead.relativePath,
    reviewIndexHash: hashText(reviewIndexRead.text),
    transferPermissions: buildTransferPermissions({ reviewPackage, intent: brief, provider }),
    warnings: reviewArtifact.warnings
  };
}

function buildDogfoodMetadataFromOptions(options) {
  const hasDogfood = options['benchmark-case']
    || options['case-id']
    || options['fixture-id']
    || options['baseline-snapshot-hash']
    || options['comparison-run-id'];
  if (!hasDogfood) {
    return null;
  }
  return {
    case_id: stringOrNull(options['benchmark-case'] ?? options['case-id']),
    legacy_case_id: stringOrNull(options['case-id']),
    fixture_id: stringOrNull(options['fixture-id']),
    baseline_snapshot_hash: stringOrNull(options['baseline-snapshot-hash']),
    comparison_run_id: stringOrNull(options['comparison-run-id']),
    repeatable_quality_check: true,
    gate_effect: 'none'
  };
}

function explainProposal({ structuredIntent, orchestration, transferPermissions }) {
  return [
    `This proposal turns the request into a candidate review with ${orchestration.review_effort.role_count} reviewer role(s).`,
    `It will ask reviewers to judge first impression, UI/UX, visual understanding, written content, comprehension, trust, feeling, risks, and improvements.`,
    `No provider execution is authorized by this proposal; agentic review plan must create a fresh plan hash before any run.`,
    `Potential transfer flags are: ${transferPermissions.required_flags.map((flag) => `--${flag}`).join(', ') || 'none'}.`,
    `Purpose: ${truncateText(structuredIntent.purpose, 260)}`
  ].join(' ');
}

async function readProposalForPlan({ cwd, options, maxBytes }) {
  if (!options.proposal) {
    return { ok: true, proposal: null, relativePath: null };
  }
  const proposalRead = await readWorkspaceJson({
    cwd,
    inputPath: options.proposal,
    label: 'agentic human review proposal',
    maxBytes
  });
  if (!proposalRead.ok) {
    return { ok: false, error: proposalRead.error };
  }
  const validation = validateProposalArtifact({ proposal: proposalRead.value, proposalPath: proposalRead.relativePath });
  if (!validation.ok) {
    return validation;
  }
  return {
    ok: true,
    proposal: proposalRead.value,
    relativePath: proposalRead.relativePath
  };
}

function validateProposalArtifact({ proposal, proposalPath }) {
  if (proposal?.type !== 'agentic_human_review_proposal') {
    return validationError('AGENTIC_REVIEW_PROPOSAL_CONTRACT_MISMATCH', 'agentic review plan --proposal requires an agentic_human_review_proposal artifact.', {
      proposal: proposalPath,
      type: proposal?.type ?? null
    });
  }
  const recomputedHash = computeProposalHash(proposal);
  if (proposal.proposal_hash !== recomputedHash) {
    return validationError('AGENTIC_REVIEW_PROPOSAL_MODIFIED', 'The agentic review proposal content no longer matches its stored proposal_hash.', {
      proposal: proposalPath,
      stored_proposal_hash: proposal.proposal_hash ?? null,
      recomputed_proposal_hash: recomputedHash
    });
  }
  if (proposal.approval?.provider_execution_authorized === true || proposal.approval?.transfer_authorized === true) {
    return validationError('AGENTIC_REVIEW_PROPOSAL_APPROVAL_INVALID', 'A proposal cannot authorize provider execution or evidence transfer.', {
      proposal: proposalPath
    });
  }
  return { ok: true };
}

function applyProposalDefaults(options, proposal) {
  if (!proposal) {
    return { ...options };
  }
  const candidate = proposal.plan_candidate ?? {};
  return {
    ...options,
    'review-index': options['review-index'] ?? candidate.review_index_path ?? proposal.source_request?.review_index_path ?? undefined,
    intent: options.intent ?? candidate.intent ?? proposal.structured_intent?.purpose,
    effort: options.effort ?? options['review-effort'] ?? candidate.effort,
    'review-effort': options['review-effort'] ?? options.effort ?? candidate.effort,
    'default-subagent-effort': options['default-subagent-effort'] ?? candidate.default_subagent_effort,
    'role-efforts': options['role-efforts'] ?? serializeRoleEfforts(candidate.role_efforts),
    provider: options.provider ?? candidate.provider_id,
    model: options.model ?? candidate.model_id,
    surface: options.surface ?? candidate.surface_id,
    'target-audience': options['target-audience'] ?? candidate.target_audience,
    'expected-impression': options['expected-impression'] ?? candidate.expected_impression,
    'benchmark-case': options['benchmark-case'] ?? candidate.benchmark_case_id,
    'human-baseline': options['human-baseline'] ?? candidate.human_baseline_path,
    'rubric-profile': options['rubric-profile'] ?? candidate.rubric_profile_id,
    'evidence-plan-mode': options['evidence-plan-mode'] ?? candidate.evidence_plan_mode,
    'case-id': options['case-id'] ?? candidate.dogfood_metadata?.case_id,
    'fixture-id': options['fixture-id'] ?? candidate.dogfood_metadata?.fixture_id,
    'baseline-snapshot-hash': options['baseline-snapshot-hash'] ?? candidate.dogfood_metadata?.baseline_snapshot_hash,
    'comparison-run-id': options['comparison-run-id'] ?? candidate.dogfood_metadata?.comparison_run_id
  };
}

function serializeRoleEfforts(roleEfforts) {
  if (!Array.isArray(roleEfforts) || roleEfforts.length === 0) {
    return undefined;
  }
  return roleEfforts
    .map((item) => `${item.role}:${item.effort}`)
    .join(',');
}

async function readReviewPackageForExecution({ cwd, plan, maxBytes }) {
  const packageRead = await readWorkspaceJson({
    cwd,
    inputPath: plan.package_path,
    label: 'agentic human review package',
    maxBytes
  });
  if (!packageRead.ok) {
    return { ok: false, error: packageRead.error };
  }
  const packageHash = hashJson(packageRead.value);
  if (plan.package_hash && packageHash !== plan.package_hash) {
    return {
      ok: false,
      error: {
        code: 'AGENTIC_REVIEW_PACKAGE_MODIFIED',
        message: 'The agentic review package content no longer matches the package hash stored in the plan.',
        details: {
          package_path: packageRead.relativePath,
          stored_package_hash: plan.package_hash,
          recomputed_package_hash: packageHash
        }
      }
    };
  }
  return {
    ok: true,
    value: packageRead.value,
    relativePath: packageRead.relativePath
  };
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
    id: truncateText(artifact?.id ?? artifact?.ref_id ?? artifact?.reference_id ?? artifact?.evidence_id, 120),
    ref_id: truncateText(artifact?.ref_id ?? artifact?.id ?? artifact?.reference_id ?? artifact?.evidence_id, 120),
    type: stringOrNull(artifact?.type),
    path: safeArtifactReferencePath(artifact?.path),
    description: stringOrNull(artifact?.description),
    content_included: false,
    local_reference: true
  }));
}

function safeArtifactReferencePath(value) {
  const text = stringOrNull(value);
  if (!text) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || path.isAbsolute(text) || text.includes('\0') || text.split(/[\\/]+/).includes('..')) {
    return null;
  }
  return text.replace(/\\/g, '/');
}

function isVisualReference(artifact) {
  const type = String(artifact?.type ?? '');
  const artifactPath = String(artifact?.path ?? '');
  return type.includes('visual') || type.includes('screenshot') || type.includes('image') || artifactPath.includes('/visual-evidence/') || artifactPath.includes('/screenshots/');
}

function extractTextSnippets(review) {
  const snippets = [];
  const visibleText = truncateText(review.evidence_summary?.visible_text ?? review.page?.visible_text ?? '', 400);
  if (visibleText) {
    snippets.push({ source: 'dom_visible_text_bounded_summary', text: visibleText, content_included: true });
  }
  for (const text of visibleTextItems(review.evidence_summary?.headings ?? review.layout?.headings).slice(0, 5)) {
    snippets.push({ source: 'heading_text', text: truncateText(text, 220), content_included: true });
  }
  for (const text of visibleTextItems(review.evidence_summary?.action_texts ?? review.action_candidates).slice(0, 5)) {
    snippets.push({ source: 'action_text', text: truncateText(text, 220), content_included: true });
  }
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

function visibleTextItems(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }
      return value?.text ?? value?.accessible_name ?? value?.label ?? value?.name ?? null;
    })
    .map((value) => truncateText(value ?? '', 300))
    .filter(Boolean);
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

function summarizeTechnicalEvidence(review) {
  const metrics = review.metrics ?? {};
  const findings = Array.isArray(review.findings) ? review.findings : [];
  return {
    finding_count: Number(metrics.finding_count ?? findings.length ?? 0),
    severity_counts: normalizeRecordNumbers(metrics.by_severity),
    category_counts: normalizeRecordNumbers(metrics.by_category),
    failed_request_count: Number(metrics.failed_requests ?? 0),
    console_message_count: Number(metrics.console_messages ?? 0),
    action_candidate_count: Number(metrics.action_candidates ?? 0),
    horizontal_overflow: Boolean(metrics.horizontal_overflow),
    local_release_gate: stringOrNull(
      review.quality_signals?.release_readiness?.local_gate
      ?? review.action_plan?.release_gate
    ),
    quality_statuses: summarizeQualitySignalStatuses(review.quality_signals)
  };
}

function summarizeMechanicalReview(review) {
  const technical = summarizeTechnicalEvidence(review);
  const advisorySummary = truncateText(review.review_advisory?.summary ?? '', 700);
  return {
    status: technical.local_release_gate ?? 'unknown',
    technical_issue_count: technical.finding_count,
    highest_known_severity: highestSeverity(technical.severity_counts),
    browser_health_count: Number(technical.category_counts.browser_health ?? 0),
    accessibility_count: Number(technical.category_counts.accessibility_basics ?? 0),
    interaction_count: Number(technical.category_counts.interaction_quality ?? 0),
    summary: advisorySummary || 'The deterministic review should be treated as objective technical evidence, not as the full human reader impression.'
  };
}

function summarizeQualitySignalStatuses(qualitySignals) {
  if (!qualitySignals || typeof qualitySignals !== 'object') {
    return {};
  }
  const output = {};
  for (const [key, value] of Object.entries(qualitySignals)) {
    if (value && typeof value === 'object' && typeof value.status === 'string') {
      output[key] = value.status;
    }
  }
  return output;
}

function normalizeRecordNumbers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value).map(([key, count]) => [key, Number(count) || 0]));
}

function highestSeverity(counts) {
  for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
    if (Number(counts?.[severity] ?? 0) > 0) {
      return severity;
    }
  }
  return 'none';
}

function buildSourceEvidenceSummary(reviewPackage) {
  return {
    review_id: reviewPackage.source?.review_id ?? null,
    route_present: Boolean(reviewPackage.source?.route),
    viewport_present: Boolean(reviewPackage.source?.viewport),
    visual_reference_count: Number(reviewPackage.visual_evidence?.reference_count ?? 0),
    text_snippet_count: Number(reviewPackage.content_evidence?.text_snippet_count ?? 0),
    artifact_reference_count: Number(reviewPackage.source?.artifact_count ?? 0),
    deterministic_finding_count: Number(reviewPackage.existing_review_state?.findings_count ?? 0),
    local_release_gate: reviewPackage.existing_review_state?.local_release_gate ?? null,
    has_technical_evidence: Boolean(reviewPackage.technical_evidence),
    has_mechanical_review_summary: Boolean(reviewPackage.mechanical_review_summary)
  };
}

function humanReviewRubric() {
  return {
    schema_version: SCHEMA_VERSION,
    rubric_version: AGENTIC_HUMAN_REVIEW_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    output_schema: 'agentic_human_review_advisory',
    areas: RUBRIC_AREAS.map((area) => ({
      id: area,
      required: true,
      evidence_required: true,
      subjective_judgment_allowed: true,
      uncertainty_required: true
    })),
    dimensions: HUMAN_REVIEW_DIMENSIONS.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      purpose: dimension.purpose,
      required_fields: [...dimension.required_fields]
    })),
    required_sections: [
      'reader_experience_review',
      'mechanical_vs_human_review',
      'human_review_coverage',
      'consensus_summary',
      'dissent_summary',
      'agentic_human_review_action_plan'
    ],
    confidence_model: ['low', 'medium', 'high', 'inconclusive'],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildProviderInstructionContract({
  intent,
  reviewPackage,
  orchestration,
  rubricProfile = null,
  evidencePlan = null,
  roleInstructionContracts = [],
  benchmarkCase = null,
  ownerBaselineRequirementContract = null
}) {
  const benchmarkRequirements = benchmarkCase ? {
    case_id: benchmarkCase.case_id,
    rubric_profile_id: rubricProfile?.id ?? benchmarkCase.rubric_profile_id ?? null,
    required_dimensions: [...benchmarkCase.required_dimensions],
    required_mentions: [...benchmarkCase.required_mentions],
    forbidden_claims: [...benchmarkCase.forbidden_claims],
    thresholds: { ...benchmarkCase.thresholds }
  } : null;
  const ownerBaselineRequirements = ownerBaselineRequirementContract ? {
    baseline_id: ownerBaselineRequirementContract.baseline_id ?? null,
    case_id: ownerBaselineRequirementContract.case_id ?? null,
    required_dimensions: ownerBaselineRequirementContract.required_dimensions ?? [],
    required_mentions: ownerBaselineRequirementContract.required_mentions ?? [],
    forbidden_claims: ownerBaselineRequirementContract.forbidden_claims ?? [],
    must_not_miss_criteria: ownerBaselineRequirementContract.must_not_miss_criteria ?? [],
    owner_labels: ownerBaselineRequirementContract.owner_labels ?? [],
    target_specific_must_not_miss_required: ownerBaselineRequirementContract.target_specific_must_not_miss_required === true,
    required_structured_finding_fields: ownerBaselineRequirementContract.required_structured_finding_fields ?? []
  } : null;
  return {
    schema_version: SCHEMA_VERSION,
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    contract_kind: 'stable_agentic_human_review_instruction',
    intent: truncateText(intent, 1200),
    role_count: orchestration.review_effort?.role_count ?? 0,
    round_count: orchestration.review_effort?.rounds ?? 1,
    required_behavior: [
      'review the target like a skilled human reviewer, not only as a technical validator',
      'read visible text and summarize how a person would understand it',
      'judge likely viewer feeling, trust, motivation, and confusion as advisory subjective output',
      'compare deterministic technical issues with content value and reader impact',
      'preserve evidence, uncertainty, dissent, and owner-decision needs',
      'when review_quality_benchmark is enabled, return benchmark_requirement_coverage with one evidence-backed record for every required mention, required dimension, and forbidden claim',
      'when owner_baseline_requirement_contract is present, return structured agentic_human_review_findings for every target-specific must-not-miss criterion, using criterion ids and owner label ids from the contract',
      'return findings or agentic_human_review_findings with local evidence_refs for material owner-label and benchmark matches instead of relying only on advisory text search',
      'return normalized JSON matching agentic_human_review_advisory'
    ],
    input_summary: buildSourceEvidenceSummary(reviewPackage),
    benchmark_requirement_contract: benchmarkRequirements,
    owner_baseline_requirement_contract: ownerBaselineRequirements,
    evidence_plan_hash: evidencePlan ? hashJson(evidencePlan) : null,
    role_instruction_contract_count: Array.isArray(roleInstructionContracts) ? roleInstructionContracts.length : 0,
    output_sections: [
      'non_engineer_summary',
      'subjective_perception',
      'readability_comprehension',
      'reader_experience_review',
      'mechanical_vs_human_review',
      'benchmark_requirement_coverage',
      'role_opinions',
      'consensus_summary',
      'dissent_summary',
      'findings',
      'agentic_human_review_findings',
      'review_claims',
      'owner_decision_requests'
    ],
    prohibited_behavior: [
      'do not claim deterministic release approval',
      'do not mutate or reinterpret gate status as provider authority',
      'do not ask for credentials',
      'do not include raw provider response metadata in advisory text'
    ],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildReviewQualityBenchmarkContract({
  dogfoodMetadata = null,
  benchmarkCase = null,
  rubricProfile = null,
  ownerBaselineRequirementContract = null
} = {}) {
  const caseId = benchmarkCase?.case_id ?? dogfoodMetadata?.case_id ?? null;
  return {
    schema_version: SCHEMA_VERSION,
    benchmark_version: HUMAN_REVIEW_SCHEMA_VERSION,
    enabled: Boolean(caseId),
    case_id: caseId,
    fixture_id: dogfoodMetadata?.fixture_id ?? null,
    fixture_type: benchmarkCase?.fixture_type ?? null,
    rubric_profile_id: rubricProfile?.id ?? benchmarkCase?.rubric_profile_id ?? null,
    supported_fixture_types: ['blog', 'landing_page', 'commerce_page', 'dashboard', 'article_page', 'image_or_screenshot'],
    quality_dimensions: [
      'human_review_dimension_coverage',
      'reader_emotion_specificity',
      'content_comprehension_specificity',
      'mechanical_vs_human_distinction',
      'evidence_support',
      'dissent_or_uncertainty',
      'actionability'
    ],
    required_dimensions: benchmarkCase?.required_dimensions ?? [],
    required_mentions: benchmarkCase?.required_mentions ?? [],
    forbidden_claims: benchmarkCase?.forbidden_claims ?? [],
    owner_baseline_requirement_contract: ownerBaselineRequirementContract ? {
      baseline_id: ownerBaselineRequirementContract.baseline_id ?? null,
      case_id: ownerBaselineRequirementContract.case_id ?? null,
      must_not_miss_criteria: ownerBaselineRequirementContract.must_not_miss_criteria ?? [],
      owner_labels: ownerBaselineRequirementContract.owner_labels ?? [],
      required_structured_finding_fields: ownerBaselineRequirementContract.required_structured_finding_fields ?? []
    } : null,
    target_specific_must_not_miss_required: Boolean(ownerBaselineRequirementContract?.must_not_miss_criteria?.length),
    thresholds: benchmarkCase?.thresholds ?? { coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 },
    allowed_evidence_classes: benchmarkCase?.allowed_evidence_classes ?? [],
    required_output_section: caseId ? 'benchmark_requirement_coverage' : null,
    structured_coverage_required_for_calibration: Boolean(caseId),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildBenchmarkCompletionReadiness({ benchmarkCase = null, rubricProfile = null, dogfoodMetadata = null } = {}) {
  const requiredFixtureTypes = ['blog', 'landing_page', 'commerce_page', 'dashboard', 'article_page', 'image_or_screenshot'];
  const coveredFixtureTypes = [...new Set(BENCHMARK_CASES.map((item) => item.fixture_type))]
    .filter((item) => requiredFixtureTypes.includes(item))
    .sort();
  const missingFixtureTypes = requiredFixtureTypes.filter((item) => !coveredFixtureTypes.includes(item));
  const thresholds = benchmarkCase?.thresholds ?? { coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 };
  const activeCaseId = benchmarkCase?.case_id ?? dogfoodMetadata?.case_id ?? null;
  return {
    schema_version: SCHEMA_VERSION,
    completion_version: HUMAN_REVIEW_BENCHMARK_COMPLETION_VERSION,
    status: missingFixtureTypes.length === 0 ? 'benchmark_corpus_ready' : 'benchmark_corpus_incomplete',
    active_case_id: activeCaseId,
    active_fixture_type: benchmarkCase?.fixture_type ?? null,
    active_rubric_profile_id: rubricProfile?.id ?? benchmarkCase?.rubric_profile_id ?? null,
    corpus_coverage: {
      required_fixture_types: requiredFixtureTypes,
      covered_fixture_types: coveredFixtureTypes,
      missing_fixture_types: missingFixtureTypes,
      case_count: BENCHMARK_CASES.length
    },
    active_case_requirements: benchmarkCase
      ? {
          required_dimensions: benchmarkCase.required_dimensions,
          required_mentions: benchmarkCase.required_mentions,
          forbidden_claims: benchmarkCase.forbidden_claims,
          allowed_evidence_classes: benchmarkCase.allowed_evidence_classes
        }
      : null,
    quality_thresholds: {
      coverage_score: Number(thresholds.coverage_score ?? 0.75),
      actionability_score: Number(thresholds.actionability_score ?? 0.6),
      forbidden_claim_score: Number(thresholds.forbidden_claim_score ?? 1)
    },
    live_provider_dogfood_policy: {
      manual_live_provider_required_for_real_provider_dogfood: true,
      manual_live_provider_default: false,
      ci_live_provider_default: false,
      live_dogfood_env: AGENTIC_REVIEW_LIVE_DOGFOOD_ENV
    },
    release_gate_policy: {
      advisory_only: true,
      deterministic_gate_unchanged: true,
      release_gate_mutated: false,
      blocks_release: false,
      gate_effect: 'none'
    },
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
  const actualValues = Array.isArray(values) && values.length > 0 ? values : [];
  const inputValues = actualValues.length > 0
    ? actualValues
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
  const plannedByRole = new Map(plannedAgents.map((agent) => [agent.role, agent]));
  return inputValues.slice(0, MAX_ROLE_OPINIONS).map((value, index) => {
    const role = truncateText(value.role ?? plannedAgents[index]?.role ?? `reviewer_${index + 1}`, 120);
    const planned = plannedByRole.get(role) ?? plannedAgents[index] ?? null;
    const round = Number.isFinite(Number(value.round))
      ? Number(value.round)
      : Number(planned?.round ?? 1);
    const placeholderGenerated = actualValues.length === 0 || value.placeholder_generated === true || value.reported_by_provider === false;
    const reportedByProvider = !placeholderGenerated;
    return {
      role,
      display_name: truncateText(value.display_name ?? planned?.display_name ?? 'Reviewer', 160),
      effort: normalizeSubagentEffort(value.effort ?? planned?.effort).value ?? DEFAULT_SUBAGENT_EFFORT,
      round,
      planned_round: Number.isFinite(Number(planned?.round)) ? Number(planned.round) : null,
      round_matches_plan: planned ? Number(planned.round) === Number(round) : null,
      planned_role: Boolean(planned),
      reported_by_provider: reportedByProvider,
      placeholder_generated: placeholderGenerated,
      summary: secretSafeText(value.summary ?? 'Role-specific advisory review.', 900),
      findings: normalizeFindings(value.findings, `${value.role ?? 'role'}-${index + 1}`).slice(0, 8),
      uncertainties: normalizeStringArray(value.uncertainties),
      confidence: normalizeConfidence(value.confidence)
    };
  });
}

function isReportedRoleOpinion(opinion) {
  return Boolean(opinion) && opinion.reported_by_provider !== false && opinion.placeholder_generated !== true;
}

function reportedRoleOpinions(roleOpinions) {
  return (roleOpinions ?? []).filter(isReportedRoleOpinion);
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
    must_not_miss_criterion_id: truncateText(finding?.must_not_miss_criterion_id ?? finding?.criterion_id ?? finding?.must_not_miss_id, 120),
    criteria_refs: normalizeStringArray(finding?.criteria_refs ?? finding?.criterion_refs ?? finding?.must_not_miss_criteria_refs).slice(0, 12),
    owner_label_ids: normalizeStringArray(finding?.owner_label_ids ?? finding?.owner_labels ?? finding?.label_ids).slice(0, 12),
    target_specific: finding?.target_specific === true,
    subjective_judgment: finding?.subjective_judgment !== false,
    owner_decision_required: finding?.owner_decision_required !== false,
    origin_kind: finding?.synthetic_fixture === true ? 'deterministic_fake_provider' : truncateText(finding?.origin_kind ?? 'provider_output', 120),
    claim_numerator_eligible: finding?.claim_numerator_eligible === true,
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

function buildReaderExperienceReview({ input, plan, findings, roleOpinions }) {
  const explicit = input.reader_experience_review ?? {};
  const firstOpinionSummary = reportedRoleOpinions(roleOpinions).find((opinion) => opinion.summary)?.summary;
  const firstFinding = findings[0]?.message;
  return {
    first_impression: normalizeStringArray(explicit.first_impression ?? input.subjective_perception?.first_impression).slice(0, 6),
    likely_viewer_feeling: normalizeStringArray(explicit.likely_viewer_feeling ?? input.subjective_perception?.emotional_reception).slice(0, 8),
    content_takeaway: normalizeStringArray(explicit.content_takeaway ?? input.content_takeaway ?? [input.summary, firstOpinionSummary].filter(Boolean)).slice(0, 8),
    trust_assessment: normalizeStringArray(explicit.trust_assessment ?? input.subjective_perception?.trust_and_credibility).slice(0, 8),
    visual_ux_assessment: normalizeStringArray(explicit.visual_ux_assessment ?? input.visual_ux_assessment ?? [firstFinding].filter(Boolean)).slice(0, 8),
    accessibility_comprehension: normalizeStringArray(explicit.accessibility_comprehension ?? input.accessibility_comprehension ?? input.readability_comprehension?.meaning_gaps).slice(0, 8),
    risk_and_misleading_content: normalizeStringArray(explicit.risk_and_misleading_content ?? input.risk_and_misleading_content ?? input.readability_comprehension?.terminology_risk ?? input.subjective_perception?.likely_user_questions).slice(0, 8),
    lost_value_summary: normalizeStringArray(explicit.lost_value_summary ?? input.lost_value_summary).slice(0, 8),
    priority_recommendation: normalizeStringArray(explicit.priority_recommendation ?? input.priority_recommendation ?? input.improvement_suggestions).slice(0, 8),
    intended_audience: truncateText(plan.human_review_contract?.target_audience ?? plan.intent ?? '', 500),
    expected_impression: truncateText(plan.human_review_contract?.expected_impression ?? '', 700),
    subjective_judgment: true,
    evidence_required: true,
    gate_effect: 'none'
  };
}

function buildMechanicalVsHumanReview({ input, plan, findings, readerExperienceReview }) {
  const explicit = input.mechanical_vs_human_review ?? {};
  const source = plan.source_evidence_summary ?? {};
  const technicalIssueCount = Number(source.deterministic_finding_count ?? 0);
  const findingCount = findings.length;
  const valueStatements = [
    ...normalizeStringArray(readerExperienceReview.content_takeaway),
    ...normalizeStringArray(input.strengths)
  ].slice(0, 6);
  const lossStatements = [
    ...normalizeStringArray(readerExperienceReview.lost_value_summary),
    ...normalizeStringArray(readerExperienceReview.visual_ux_assessment),
    ...findings.map((finding) => finding.message)
  ].slice(0, 6);
  return {
    deterministic_finding_count: technicalIssueCount,
    advisory_finding_count: findingCount,
    local_release_gate: source.local_release_gate ?? null,
    content_or_reader_value: normalizeStringArray(explicit.content_or_reader_value ?? valueStatements).slice(0, 8),
    technical_or_ux_value_loss: normalizeStringArray(explicit.technical_or_ux_value_loss ?? lossStatements).slice(0, 8),
    balanced_takeaways: normalizeStringArray(explicit.balanced_takeaways ?? buildBalancedTakeaways({ technicalIssueCount, valueStatements, lossStatements })).slice(0, 8),
    deterministic_layer_unchanged: true,
    subjective_layer_advisory_only: true,
    gate_effect: 'none'
  };
}

function buildBalancedTakeaways({ technicalIssueCount, valueStatements, lossStatements }) {
  const takeaways = [];
  if (technicalIssueCount > 0) {
    takeaways.push(`The deterministic review found ${technicalIssueCount} technical or structural issue(s), so technical quality still needs owner attention.`);
  }
  if (valueStatements.length > 0) {
    takeaways.push('Human review should preserve the page or content value that readers can still understand, trust, or find useful.');
  }
  if (lossStatements.length > 0) {
    takeaways.push('The priority is to reduce the UI, readability, accessibility, or technical friction that prevents that value from coming through.');
  }
  if (takeaways.length === 0) {
    takeaways.push('No strong distinction between deterministic issues and human reader impact was provided; owner review should verify both.');
  }
  return takeaways;
}

function buildHumanReviewCoverage({ input, findings, roleOpinions, readerExperienceReview, actionPlan }) {
  const available = {
    first_impression: normalizeStringArray(readerExperienceReview.first_impression).length > 0
      || normalizeStringArray(input.subjective_perception?.first_impression).length > 0,
    reader_emotion: normalizeStringArray(readerExperienceReview.likely_viewer_feeling).length > 0
      || normalizeStringArray(input.subjective_perception?.emotional_reception).length > 0,
    content_comprehension: normalizeStringArray(readerExperienceReview.content_takeaway).length > 0
      || normalizeStringArray(input.readability_comprehension?.meaning_gaps).length > 0,
    trust_and_credibility: normalizeStringArray(readerExperienceReview.trust_assessment).length > 0
      || normalizeStringArray(input.subjective_perception?.trust_and_credibility).length > 0,
    visual_ux: normalizeStringArray(readerExperienceReview.visual_ux_assessment).length > 0
      || findings.some((finding) => /visual|ux|layout|interaction|ui/i.test(finding.category)),
    accessibility_comprehension: normalizeStringArray(readerExperienceReview.accessibility_comprehension).length > 0
      || findings.some((finding) => /accessibility|comprehension|readability/i.test(finding.category)),
    risk_and_misleading_content: normalizeStringArray(readerExperienceReview.risk_and_misleading_content).length > 0
      || normalizeStringArray(input.readability_comprehension?.terminology_risk).length > 0
      || normalizeStringArray(input.subjective_perception?.likely_user_questions).length > 0
      || findings.some((finding) => /risk|misleading|safety|trust|uncertain/i.test(`${finding.category} ${finding.message}`)),
    improvement_priority: normalizeStringArray(readerExperienceReview.priority_recommendation).length > 0
      || normalizeStringArray(actionPlan?.suggested_fixes ?? input.improvement_suggestions).length > 0
  };
  const dimensions = HUMAN_REVIEW_DIMENSIONS.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    status: available[dimension.id] ? 'covered' : 'missing_or_thin',
    required_fields: [...dimension.required_fields],
    evidence_required: true,
    subjective_judgment_allowed: true
  }));
  return {
    human_review_schema_version: HUMAN_REVIEW_SCHEMA_VERSION,
    dimensions,
    coverage_score: computeDimensionCoverageScore(dimensions),
    role_count: reportedRoleOpinions(roleOpinions).length,
    advisory_finding_count: findings.length,
    missing_dimensions: dimensions.filter((dimension) => dimension.status !== 'covered').map((dimension) => dimension.id),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function computeDimensionCoverageScore(dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return 0;
  }
  return clampScore(dimensions.filter((dimension) => dimension.status === 'covered').length / dimensions.length);
}

function buildConsensusSummary({ roleOpinions, findings, input }) {
  const actualRoleCount = reportedRoleOpinions(roleOpinions).length;
  return {
    agreement_count: Number(input.consensus_summary?.agreement_count ?? (actualRoleCount > 1 ? 1 : 0)),
    corroborated_findings: normalizeStringArray(input.consensus_summary?.corroborated_findings).slice(0, 10),
    shared_positive_observations: normalizeStringArray(input.consensus_summary?.shared_positive_observations ?? input.strengths).slice(0, 10),
    shared_risks: normalizeStringArray(input.consensus_summary?.shared_risks).slice(0, 10),
    finding_count: findings.length
  };
}

function buildDissentSummary({ roleOpinions, input }) {
  const actualRoleCount = reportedRoleOpinions(roleOpinions).length;
  return {
    disagreement_count: Number(input.dissent_summary?.disagreement_count ?? 0),
    contradictions: normalizeStringArray(input.dissent_summary?.contradictions).slice(0, 10),
    minority_opinions: normalizeStringArray(input.dissent_summary?.minority_opinions).slice(0, 10),
    owner_decision_required: actualRoleCount > 1
  };
}

function buildRoleExecutionRecords({ plan, roleOpinions, boundary }) {
  const opinionByRole = new Map(roleOpinions.map((opinion) => [opinion.role, opinion]));
  return (plan.sub_agents ?? []).slice(0, MAX_ROLE_OPINIONS).map((agent) => {
    const opinion = opinionByRole.get(agent.role);
    const reported = isReportedRoleOpinion(opinion);
    const roundMatches = opinion ? Number(opinion.round) === Number(agent.round) : false;
    return {
      role: agent.role,
      display_name: agent.display_name,
      planned_effort: agent.effort,
      round: agent.round,
      status: reported && roundMatches ? 'reported' : (reported ? 'round_mismatch' : 'missing_output'),
      independent_review: agent.independent_review !== false,
      confidence: opinion?.confidence ?? { evidence: 'inconclusive', judgment: 'inconclusive', implementation: 'inconclusive' },
      finding_count: opinion?.findings?.length ?? 0,
      reported_by_provider: reported,
      placeholder_generated: opinion?.placeholder_generated === true,
      round_matches_plan: roundMatches,
      provider_call_performed: boundary.provider_call_performed,
      api_call_performed: boundary.api_call_performed,
      gate_effect: 'none'
    };
  });
}

function buildReviewClaims({ resultId, input, findings, roleOpinions }) {
  const reportedRoles = reportedRoleOpinions(roleOpinions).map((opinion) => opinion.role);
  const claimValues = Array.isArray(input.review_claims) ? input.review_claims : [];
  const explicitClaims = claimValues.slice(0, 25).map((item, index) => ({
    id: truncateText(item?.id ?? `${resultId}-claim-${index + 1}`, 120),
    claim: secretSafeText(item?.claim ?? item?.message ?? 'Agentic review claim.', 700),
    evidence_refs: normalizeArtifactReferences(item?.evidence_refs ?? item?.artifacts),
    supported_by_roles: normalizeStringArray(item?.supported_by_roles),
    confidence: normalizeConfidence(item?.confidence),
    subjective_judgment: item?.subjective_judgment !== false,
    gate_effect: 'none'
  }));
  const findingClaims = findings.slice(0, 25 - explicitClaims.length).map((finding) => ({
    id: `${finding.id}-claim`,
    claim: finding.message,
    evidence_refs: finding.evidence_refs,
    supported_by_roles: reportedRoles.slice(0, 5),
    confidence: finding.confidence,
    subjective_judgment: finding.subjective_judgment,
    gate_effect: 'none'
  }));
  return [...explicitClaims, ...findingClaims];
}

function buildRoundRecords({ plan, roleOpinions }) {
  const plannedRounds = Array.isArray(plan.rounds) && plan.rounds.length > 0
    ? plan.rounds
    : [...new Set(roleOpinions.map((item) => item.round))];
  return plannedRounds.map((round) => {
    const plannedRoles = (plan.sub_agents ?? []).filter((agent) => Number(agent.round) === Number(round)).map((agent) => agent.role);
    const opinions = reportedRoleOpinions(roleOpinions).filter((opinion) => Number(opinion.round) === Number(round));
    const reportedRoles = opinions.map((opinion) => opinion.role);
    const missingRoles = plannedRoles.filter((roleName) => !reportedRoles.includes(roleName));
    return {
      round: Number(round),
      planned_roles: plannedRoles,
      reported_roles: reportedRoles,
      missing_roles: missingRoles,
      status: plannedRoles.length > 0 && missingRoles.length === 0 ? 'reported' : (reportedRoles.length > 0 ? 'partial_output' : 'missing_output'),
      gate_effect: 'none'
    };
  });
}

function buildCritiqueRecords({ plan, claims, roleOpinions }) {
  const criticRoles = (plan.sub_agents ?? []).filter((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role));
  const weakClaimCount = claims.filter((claim) => claim.evidence_refs.length === 0 || claim.confidence.evidence === 'low').length;
  if (criticRoles.length === 0) {
    return [{
      role: 'implicit_quality_check',
      status: 'not_planned',
      critique: 'No dedicated critic or verification role was planned for this effort mode.',
      weak_claim_count: weakClaimCount,
      gate_effect: 'none'
    }];
  }
  return criticRoles.map((agent) => {
    const opinion = roleOpinions.find((item) => item.role === agent.role);
    const reported = Boolean(opinion) && isReportedRoleOpinion(opinion) && Number(opinion.round) === Number(agent.round);
    return {
      role: agent.role,
      status: reported ? 'reported' : 'missing_output',
      critique: opinion?.summary ?? 'Dedicated critique role did not return separate output.',
      weak_claim_count: weakClaimCount,
      gate_effect: 'none'
    };
  });
}

function buildRebuttalRecords({ critiqueRecords }) {
  return critiqueRecords.map((record, index) => ({
    id: `rebuttal-${index + 1}`,
    critique_role: record.role,
    status: record.status === 'reported' ? 'integrated' : 'not_available',
    response: record.status === 'reported'
      ? 'The synthesis should account for this critique before owner action.'
      : 'No separate rebuttal was available; owner review should treat this as residual uncertainty.',
    gate_effect: 'none'
  }));
}

function buildIntegrationRecord({ roleOpinions, findings, critiqueRecords, input }) {
  const reportedOpinions = reportedRoleOpinions(roleOpinions);
  const synthesisOpinion = reportedOpinions.find((opinion) => opinion.role === 'synthesis_agent');
  const explicitIntegration = input.integration_record?.summary;
  const status = synthesisOpinion || explicitIntegration ? 'integrated' : 'missing_synthesis';
  return {
    status,
    summary: secretSafeText(input.integration_record?.summary ?? input.consensus_summary?.summary ?? 'Role opinions were normalized into one advisory-only report for owner review.', 900),
    role_count: reportedOpinions.length,
    finding_count: findings.length,
    critique_count: critiqueRecords.length,
    unresolved_uncertainties: reportedOpinions.flatMap((opinion) => opinion.uncertainties).slice(0, 12),
    owner_review_required: true,
    gate_effect: 'none'
  };
}

function buildDogfoodMetadata({ plan, resultId }) {
  const metadata = plan.dogfood_metadata ?? null;
  return {
    enabled: Boolean(metadata),
    result_id: resultId,
    case_id: metadata?.case_id ?? null,
    fixture_id: metadata?.fixture_id ?? null,
    baseline_snapshot_hash: metadata?.baseline_snapshot_hash ?? null,
    comparison_run_id: metadata?.comparison_run_id ?? null,
    input_set_hash: hashText(canonicalStringify({
      plan_id: plan.id,
      plan_hash: plan.plan_hash,
      package_hash: plan.package_hash,
      dogfood_metadata: metadata
    })),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildRoleInstructionCoverage({ plan, roleOpinions }) {
  const plannedContracts = Array.isArray(plan.role_instruction_contracts) ? plan.role_instruction_contracts : [];
  const reportedRoles = new Set(reportedRoleOpinions(roleOpinions)
    .filter((item) => item.round_matches_plan !== false)
    .map((item) => item.role));
  const roleRecords = plannedContracts.map((contract) => ({
    role: contract.role,
    display_name: contract.display_name,
    round: contract.round,
    planned_focus: contract.required_focus ?? [],
    reported: reportedRoles.has(contract.role),
    must_report_count: Array.isArray(contract.must_report) ? contract.must_report.length : 0,
    gate_effect: 'none'
  }));
  return {
    schema_version: SCHEMA_VERSION,
    orchestration_version: plan.orchestration_version ?? HUMAN_REVIEW_ORCHESTRATION_VERSION,
    planned_role_count: roleRecords.length,
    reported_role_count: roleRecords.filter((item) => item.reported).length,
    coverage_score: roleRecords.length === 0 ? 0 : clampScore(roleRecords.filter((item) => item.reported).length / roleRecords.length),
    missing_roles: roleRecords.filter((item) => !item.reported).map((item) => item.role),
    roles: roleRecords,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildConsensusAnalysis({ roleOpinions, findings, claims, input }) {
  const supportedClaimCount = claims.filter((claim) => claim.supported_by_roles?.length > 0).length;
  const actualOpinions = reportedRoleOpinions(roleOpinions);
  const confidenceValues = actualOpinions.map((opinion) => opinion.confidence?.judgment ?? 'inconclusive');
  const highOrMedium = confidenceValues.filter((value) => value === 'high' || value === 'medium').length;
  return {
    schema_version: SCHEMA_VERSION,
    analysis_version: HUMAN_REVIEW_ORCHESTRATION_VERSION,
    agreement_count: Number(input.consensus_summary?.agreement_count ?? supportedClaimCount),
    supported_claim_count: supportedClaimCount,
    role_count: actualOpinions.length,
    confidence_alignment_score: actualOpinions.length === 0 ? 0 : clampScore(highOrMedium / actualOpinions.length),
    corroborated_findings: normalizeStringArray(input.consensus_summary?.corroborated_findings).slice(0, 12),
    shared_risks: normalizeStringArray(input.consensus_summary?.shared_risks).slice(0, 12),
    finding_count: findings.length,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildDissentAnalysis({ roleOpinions, claims, critiqueRecords, input }) {
  const uncertainties = reportedRoleOpinions(roleOpinions).flatMap((opinion) => normalizeStringArray(opinion.uncertainties)).slice(0, 16);
  const weakClaimCount = claims.filter((claim) => claim.evidence_refs.length === 0 && claim.supported_by_roles.length === 0).length;
  const dedicatedCritiqueReported = critiqueRecords.some((record) => record.status === 'reported' || record.status === 'integrated');
  return {
    schema_version: SCHEMA_VERSION,
    analysis_version: HUMAN_REVIEW_ORCHESTRATION_VERSION,
    disagreement_count: Number(input.dissent_summary?.disagreement_count ?? 0),
    weak_claim_count: weakClaimCount,
    dedicated_critique_reported: dedicatedCritiqueReported,
    contradictions: normalizeStringArray(input.dissent_summary?.contradictions).slice(0, 12),
    minority_opinions: normalizeStringArray(input.dissent_summary?.minority_opinions).slice(0, 12),
    residual_uncertainties: uncertainties,
    owner_review_required: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighCompletionAssessment({ plan, roleOpinions, roundRecords, critiqueRecords, integrationRecord, roleInstructionCoverage }) {
  const xhighExpected = plan.review_effort?.mode === 'xhigh';
  const plannedAgents = Array.isArray(plan.sub_agents) ? plan.sub_agents : [];
  const reported = reportedRoleOpinions(roleOpinions)
    .filter((opinion) => opinion.round_matches_plan !== false);
  const reportedByRole = new Set(reported.map((opinion) => opinion.role));
  const requiredRoles = plannedAgents.map((agent) => agent.role);
  const missingRoles = requiredRoles.filter((roleName) => !reportedByRole.has(roleName));
  const placeholderOutputCount = (roleOpinions ?? []).filter((opinion) => opinion.placeholder_generated === true || opinion.reported_by_provider === false).length;
  const roundMismatchRoles = (roleOpinions ?? [])
    .filter((opinion) => isReportedRoleOpinion(opinion) && opinion.round_matches_plan === false)
    .map((opinion) => opinion.role);
  const plannedRounds = Array.isArray(plan.rounds) ? plan.rounds.map(Number) : [];
  const missingRounds = plannedRounds.filter((round) => {
    const record = roundRecords.find((item) => Number(item.round) === Number(round));
    return !record || record.status !== 'reported';
  });
  const missingCritiqueRoles = (plan.sub_agents ?? [])
    .filter((agent) => ['critic_reviewer', 'verification_reviewer'].includes(agent.role))
    .filter((agent) => !critiqueRecords.some((record) => record.role === agent.role && record.status === 'reported'))
    .map((agent) => agent.role);
  const synthesisIntegrated = integrationRecord?.status === 'integrated';
  const missingConditions = [
    ...(plannedRounds.length >= 3 ? [] : ['xhigh requires at least three planned rounds.']),
    ...(missingRoles.length === 0 ? [] : [`Missing provider output for planned role(s): ${missingRoles.join(', ')}.`]),
    ...(missingRounds.length === 0 ? [] : [`Missing complete provider output for planned round(s): ${missingRounds.join(', ')}.`]),
    ...(roundMismatchRoles.length === 0 ? [] : [`Provider output used wrong planned round(s) for role(s): ${roundMismatchRoles.join(', ')}.`]),
    ...(placeholderOutputCount === 0 ? [] : [`Placeholder or synthesized output cannot satisfy xhigh provider role output (${placeholderOutputCount} placeholder record(s)).`]),
    ...(missingCritiqueRoles.length === 0 ? [] : [`Missing dedicated critique or verification role(s): ${missingCritiqueRoles.join(', ')}.`]),
    ...(synthesisIntegrated ? [] : ['Missing synthesis output or explicit integration record.'])
  ];
  const complete = !xhighExpected || missingConditions.length === 0;
  const repairPlan = buildXhighRepairPlan({
    plan,
    missingRoles,
    missingRounds,
    missingCritiqueRoles,
    roundMismatchRoles,
    synthesisIntegrated,
    placeholderOutputCount
  });
  const multiStepPlan = buildXhighExecutionStepPlan({ plan, missingRoles, missingRounds });
  const evidenceProvenance = buildXhighEvidenceProvenance({
    plan,
    roleOpinions,
    roundRecords,
    critiqueRecords,
    integrationRecord
  });
  return {
    schema_version: SCHEMA_VERSION,
    completion_version: HUMAN_REVIEW_XHIGH_COMPLETION_VERSION,
    strict_output_contract_version: HUMAN_REVIEW_STRICT_OUTPUT_CONTRACT_VERSION,
    repair_retry_version: HUMAN_REVIEW_REPAIR_RETRY_VERSION,
    multi_step_xhigh_version: HUMAN_REVIEW_MULTI_STEP_XHIGH_VERSION,
    evidence_provenance_version: HUMAN_REVIEW_EVIDENCE_PROVENANCE_VERSION,
    required: xhighExpected,
    status: xhighExpected ? (complete ? 'complete' : 'incomplete') : 'not_required',
    mechanical_contract_enforced: true,
    planned_role_count: requiredRoles.length,
    reported_role_count: reported.length,
    placeholder_output_count: placeholderOutputCount,
    required_roles: requiredRoles,
    missing_roles: missingRoles,
    planned_rounds: plannedRounds,
    missing_rounds: missingRounds,
    round_mismatch_roles: roundMismatchRoles,
    missing_critique_roles: missingCritiqueRoles,
    synthesis_integrated: synthesisIntegrated,
    role_instruction_coverage_score: roleInstructionCoverage.coverage_score,
    provider_round_execution_mode: plan.orchestration_contract?.provider_round_execution_mode ?? null,
    true_multi_call_execution_performed: false,
    single_call_multi_role_output_only: plan.orchestration_contract?.provider_round_execution_mode === 'single_provider_call_with_required_multi_role_round_output',
    missing_conditions: xhighExpected ? missingConditions : [],
    repair_plan: repairPlan,
    multi_step_plan: multiStepPlan,
    evidence_provenance: evidenceProvenance,
    strict_output_contract: plan.strict_output_contract ?? plan.effort_execution_contract?.strict_output_contract ?? null,
    provider_effort_binding: plan.provider_effort_binding ?? plan.effort_execution_contract?.provider_effort_binding ?? null,
    completion_score: xhighExpected
      ? clampScore([
          requiredRoles.length === 0 ? 0 : reported.length / requiredRoles.length,
          plannedRounds.length === 0 ? 0 : (plannedRounds.length - missingRounds.length) / plannedRounds.length,
          missingCritiqueRoles.length === 0 ? 1 : 0,
          synthesisIntegrated ? 1 : 0,
          placeholderOutputCount === 0 ? 1 : 0
        ].reduce((sum, value) => sum + value, 0) / 5)
      : 1,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighRepairPlan({ plan, missingRoles, missingRounds, missingCritiqueRoles, roundMismatchRoles, synthesisIntegrated, placeholderOutputCount }) {
  const missingSections = [
    ...(missingRoles.length > 0 ? ['role_opinions'] : []),
    ...(missingCritiqueRoles.length > 0 ? ['critique_records'] : []),
    ...(synthesisIntegrated ? [] : ['integration_record'])
  ];
  return {
    schema_version: SCHEMA_VERSION,
    repair_retry_version: HUMAN_REVIEW_REPAIR_RETRY_VERSION,
    required: plan.review_effort?.mode === 'xhigh' && (missingRoles.length > 0 || missingRounds.length > 0 || missingCritiqueRoles.length > 0 || roundMismatchRoles.length > 0 || !synthesisIntegrated || placeholderOutputCount > 0),
    automatic_provider_retry_performed: false,
    retry_requires_same_plan_hash: true,
    retry_requires_exact_transfer_flags: true,
    missing_sections: uniqueSorted(missingSections),
    missing_roles: missingRoles,
    missing_rounds: missingRounds,
    missing_critique_roles: missingCritiqueRoles,
    round_mismatch_roles: roundMismatchRoles,
    placeholder_output_count: placeholderOutputCount,
    next_action: missingSections.length > 0 || placeholderOutputCount > 0
      ? 'Retry or repair only the missing xhigh contract sections under the same approved plan boundary before using the result as calibration-ready evidence.'
      : 'No repair is required for xhigh completion.',
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighExecutionStepPlan({ plan, missingRoles, missingRounds }) {
  const plannedSteps = (plan.xhigh_multi_step_contract?.steps ?? xhighPlannedRounds(plan)).map((step) => ({
    round: step.round,
    roles: step.roles ?? [],
    status: missingRounds.includes(Number(step.round))
      ? 'missing_round_output'
      : ((step.roles ?? []).some((roleName) => missingRoles.includes(roleName)) ? 'missing_role_output' : 'satisfied_or_not_required'),
    provider_call_policy: step.provider_call_policy ?? 'planned_step_not_auto_executed',
    depends_on_rounds: step.depends_on_rounds ?? []
  }));
  return {
    schema_version: SCHEMA_VERSION,
    multi_step_xhigh_version: HUMAN_REVIEW_MULTI_STEP_XHIGH_VERSION,
    true_multi_step_execution_available: plan.xhigh_multi_step_contract?.provider_declares_true_multi_step_supported === true,
    true_multi_step_execution_performed: false,
    automatic_live_multi_call_enabled: false,
    steps: plannedSteps,
    incomplete_step_count: plannedSteps.filter((step) => step.status !== 'satisfied_or_not_required').length,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildXhighEvidenceProvenance({ plan, roleOpinions, roundRecords, critiqueRecords, integrationRecord }) {
  const roleRecords = (roleOpinions ?? []).map((opinion) => ({
    role: opinion.role,
    round: opinion.round,
    reported_by_provider: isReportedRoleOpinion(opinion),
    evidence_ref_count: normalizeArtifactReferences(opinion.findings?.flatMap((finding) => finding.evidence_refs) ?? []).length,
    finding_count: opinion.findings?.length ?? 0,
    placeholder_generated: opinion.placeholder_generated === true,
    gate_effect: 'none'
  }));
  return {
    schema_version: SCHEMA_VERSION,
    evidence_provenance_version: HUMAN_REVIEW_EVIDENCE_PROVENANCE_VERSION,
    plan_id: plan.id ?? null,
    plan_hash: plan.plan_hash ?? null,
    role_records: roleRecords,
    round_records: (roundRecords ?? []).map((record) => ({
      round: record.round,
      status: record.status,
      planned_roles: record.planned_roles ?? [],
      reported_roles: record.reported_roles ?? [],
      missing_roles: record.missing_roles ?? [],
      gate_effect: 'none'
    })),
    critique_record_count: (critiqueRecords ?? []).filter((record) => record.status === 'reported').length,
    integration_status: integrationRecord?.status ?? 'missing_synthesis',
    raw_provider_response_stored: false,
    credential_values_recorded: false,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildReviewQualityEvaluation({ quality, roleInstructionCoverage, consensusAnalysis, dissentAnalysis, xhighCompletion, plan, benchmarkRequirementCoverage = null }) {
  const xhighExpected = plan.review_effort?.mode === 'xhigh';
  const multiRoundSatisfied = !xhighExpected
    || xhighCompletion?.status === 'complete';
  const benchmarkEnabled = benchmarkRequirementCoverage?.enabled === true;
  const benchmarkCoverageScore = benchmarkEnabled
    ? clampScore(
        (benchmarkRequirementCoverage.summary.required_mention_coverage_score * 0.3)
        + (benchmarkRequirementCoverage.summary.dimension_coverage_score * 0.3)
        + (benchmarkRequirementCoverage.summary.structured_record_completeness_score * 0.2)
        + (benchmarkRequirementCoverage.summary.evidence_backed_record_score * 0.1)
        + (benchmarkRequirementCoverage.summary.evidence_ref_backed_record_score * 0.1)
      )
    : 1;
  const calibrationReadyScore = clampScore(
    (quality.human_review_coverage_score * 0.2)
    + (quality.actionability_score * 0.2)
    + (quality.verification_score * 0.15)
    + (roleInstructionCoverage.coverage_score * 0.2)
    + (consensusAnalysis.confidence_alignment_score * 0.1)
    + (benchmarkCoverageScore * 0.15)
  );
  return {
    schema_version: SCHEMA_VERSION,
    evaluator_version: HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION,
    calibration_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    status: calibrationReadyScore >= 0.75 && multiRoundSatisfied ? 'calibration_ready' : 'owner_review_recommended',
    calibration_ready_score: calibrationReadyScore,
    human_likeness_score: clampScore((quality.human_review_coverage_score * 0.45) + (quality.actionability_score * 0.35) + (consensusAnalysis.confidence_alignment_score * 0.2)),
    visual_specificity_score: clampScore(plan.evidence_plan?.classes?.raw_pixels?.needed ? quality.evidence_coverage_score : quality.human_review_coverage_score),
    content_reading_score: clampScore(plan.evidence_plan?.classes?.page_text?.needed ? quality.human_review_coverage_score : quality.actionability_score),
    sensibility_score: clampScore((quality.human_review_coverage_score * 0.55) + (roleInstructionCoverage.coverage_score * 0.25) + (quality.verification_score * 0.2)),
    specific_fix_score: quality.actionability_score,
    safety_boundary_score: 1,
    benchmark_requirement_coverage_score: benchmarkCoverageScore,
    benchmark_requirement_coverage_status: benchmarkRequirementCoverage?.status ?? 'not_enabled',
    multi_round_expectation_satisfied: multiRoundSatisfied,
    xhigh_completion_status: xhighCompletion?.status ?? null,
    true_multi_call_execution_performed: xhighCompletion?.true_multi_call_execution_performed ?? false,
    role_instruction_coverage_score: roleInstructionCoverage.coverage_score,
    consensus_confidence_alignment_score: consensusAnalysis.confidence_alignment_score,
    weak_claim_count: dissentAnalysis.weak_claim_count,
    quality_warnings: [
      ...normalizeStringArray(quality.quality_warnings),
      ...(multiRoundSatisfied ? [] : ['xhigh review expected complete provider output for planned roles, critique/verification, and synthesis.']),
      ...(benchmarkEnabled && benchmarkRequirementCoverage?.status !== 'passed' ? ['Benchmark requirement coverage is incomplete or missing structured evidence.'] : []),
      ...normalizeStringArray(xhighCompletion?.missing_conditions)
    ],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildHumanReportV3({ input, plan, readerExperienceReview, mechanicalVsHumanReview, quality, reviewQualityEvaluation }) {
  const summary = secretSafeText(input.human_report_v3?.summary ?? input.summary ?? 'Agentic human review completed.', 1200);
  return {
    schema_version: SCHEMA_VERSION,
    report_version: HUMAN_REPORT_VERSION,
    audience: plan.task?.target_audience ?? plan.human_review_contract?.target_audience ?? null,
    reader_story: secretSafeText(
      input.human_report_v3?.reader_story
      ?? `A reader first tries to understand: ${truncateText(plan.intent ?? 'the reviewed target', 260)}`,
      1000
    ),
    plain_language_takeaway: summary,
    what_works: normalizeStringArray(input.human_report_v3?.what_works ?? input.strengths ?? input.non_engineer_summary?.top_strengths).slice(0, 8),
    what_gets_lost: normalizeStringArray(
      input.human_report_v3?.what_gets_lost
      ?? readerExperienceReview?.lost_value_summary
      ?? mechanicalVsHumanReview?.balanced_takeaways
    ).slice(0, 8),
    highest_priority_fix: normalizeStringArray(
      input.human_report_v3?.highest_priority_fix
      ?? readerExperienceReview?.priority_recommendation
      ?? input.improvement_suggestions
    )[0] ?? 'Review the advisory output with the owner and prioritize the clearest comprehension or trust gap.',
    quality_snapshot: {
      completeness_score: quality.completeness_score,
      human_review_coverage_score: quality.human_review_coverage_score,
      actionability_score: quality.actionability_score,
      human_likeness_score: reviewQualityEvaluation.human_likeness_score,
      sensibility_score: reviewQualityEvaluation.sensibility_score
    },
    owner_review_required: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildCalibrationMetadata({ plan, input, quality, benchmarkRequirementCoverage = null }) {
  return {
    schema_version: SCHEMA_VERSION,
    calibration_version: HUMAN_REVIEW_CALIBRATION_VERSION,
    benchmark_case_id: plan.review_quality_benchmark?.case_id ?? plan.dogfood_metadata?.case_id ?? null,
    benchmark_enabled: plan.review_quality_benchmark?.enabled === true,
    fixture_id: plan.review_quality_benchmark?.fixture_id ?? plan.dogfood_metadata?.fixture_id ?? null,
    rubric_profile_id: plan.rubric_profile?.id ?? null,
    quality_input_hash: hashJson({
      role_opinions: input.role_opinions ?? [],
      findings: input.findings ?? input.agentic_human_review_findings ?? [],
      claims: input.review_claims ?? [],
      quality,
      benchmark_requirement_coverage: benchmarkRequirementCoverage?.summary ?? null
    }),
    benchmark_requirement_coverage_status: benchmarkRequirementCoverage?.status ?? 'not_enabled',
    benchmark_requirement_coverage_scores: benchmarkRequirementCoverage?.summary ?? null,
    repeatable_quality_check: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildReportQuality({ result, resultPath, execution, evaluatorPolicy = null, now }) {
  const policy = normalizeEvaluatorPolicy(evaluatorPolicy);
  const quality = buildReportQualityFromParts({
    roleOpinions: normalizeRoleOpinions(result.role_opinions),
    findings: normalizeFindings(result.agentic_human_review_findings, result.id ?? 'agentic-result'),
    ownerDecisions: normalizeOwnerDecisionRequests(result.owner_decision_requests),
    claims: normalizeReviewClaims(result.review_claims),
    critiqueRecords: Array.isArray(result.critique_records) ? result.critique_records : [],
    integrationRecord: result.integration_record ?? null,
    humanReviewCoverage: result.human_review_coverage ?? null,
    readerExperienceReview: result.reader_experience_review ?? null,
    benchmarkRequirementCoverage: result.benchmark_requirement_coverage ?? null
  });
  const policyWarnings = reportQualityPolicyWarnings({ quality, policy });
  const humanReviewMaturity = buildHumanReviewMaturity({ result, execution, quality });
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_report_quality',
    generated_at: now.toISOString(),
    quality_evaluator_version: HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION,
    result_path: resultPath,
    result_id: result.id ?? null,
    execution_id: execution?.id ?? null,
    evaluator_policy: policy,
    ...quality,
    quality_warnings: [
      ...normalizeStringArray(quality.quality_warnings),
      ...policyWarnings.map((warning) => warning.message)
    ],
    policy_warnings: policyWarnings,
    human_review_maturity: humanReviewMaturity,
    longitudinal_quality_evaluation: humanReviewMaturity.longitudinal_quality_evaluation,
    benchmark_completion_readiness: result.benchmark_completion_readiness ?? null,
    xhigh_multi_round_review: result.xhigh_multi_round_review ?? null,
    xhigh_mechanical_enforcement: result.xhigh_mechanical_enforcement ?? (result.xhigh_multi_round_review ? {
      schema_version: SCHEMA_VERSION,
      completion_version: HUMAN_REVIEW_XHIGH_COMPLETION_VERSION,
      status: result.xhigh_multi_round_review.status,
      required: result.xhigh_multi_round_review.required === true,
      mechanical_contract_enforced: result.xhigh_multi_round_review.mechanical_contract_enforced === true,
      completion_score: result.xhigh_multi_round_review.completion_score ?? 0,
      missing_conditions: result.xhigh_multi_round_review.missing_conditions ?? [],
      repair_plan: result.xhigh_multi_round_review.repair_plan ?? null,
      multi_step_plan: result.xhigh_multi_round_review.multi_step_plan ?? null,
      evidence_provenance: result.xhigh_multi_round_review.evidence_provenance ?? null,
      advisory_only: true,
      gate_effect: 'none'
    } : null),
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      planning_only: false,
      report_quality_gate_effect: 'none'
    })
  });
}

function reportQualityPolicyWarnings({ quality, policy }) {
  const warnings = [];
  if (quality.actionability_score < policy.minimum_scores.actionability_score) {
    warnings.push({
      code: 'AHR_EVALUATOR_POLICY_ACTIONABILITY_BELOW_MINIMUM',
      message: 'Actionability score is below the evaluator policy minimum.',
      details: { score: quality.actionability_score, minimum: policy.minimum_scores.actionability_score }
    });
  }
  if (quality.verification_score < policy.minimum_scores.verification_score) {
    warnings.push({
      code: 'AHR_EVALUATOR_POLICY_VERIFICATION_BELOW_MINIMUM',
      message: 'Verification score is below the evaluator policy minimum.',
      details: { score: quality.verification_score, minimum: policy.minimum_scores.verification_score }
    });
  }
  if (quality.benchmark_requirement_coverage_score < policy.minimum_scores.benchmark_requirement_coverage_score) {
    warnings.push({
      code: 'AHR_EVALUATOR_POLICY_BENCHMARK_COVERAGE_BELOW_MINIMUM',
      message: 'Benchmark requirement coverage score is below the evaluator policy minimum.',
      details: { score: quality.benchmark_requirement_coverage_score, minimum: policy.minimum_scores.benchmark_requirement_coverage_score }
    });
  }
  return warnings;
}

function buildHumanReviewMaturity({ result, execution, quality }) {
  const observedEffort = normalizeObservedReviewEffort(result.agentic_human_review_advisory?.review_effort);
  const observedEfforts = observedEffort ? [observedEffort] : [];
  const missingEfforts = HUMAN_REVIEW_CLAIM_EFFORTS.filter((effort) => !observedEfforts.includes(effort));
  const benchmarkCaseId = result.calibration_metadata?.benchmark_case_id
    ?? result.benchmark_completion_readiness?.active_case_id
    ?? result.dogfood_metadata?.case_id
    ?? null;
  const benchmarkCase = resolveBenchmarkCase(benchmarkCaseId);
  const observedBenchmarkCaseIds = benchmarkCaseId ? [benchmarkCaseId] : [];
  const requiredBenchmarkCaseIds = BENCHMARK_CASES.map((item) => item.case_id);
  const missingBenchmarkCaseIds = requiredBenchmarkCaseIds.filter((caseId) => !observedBenchmarkCaseIds.includes(caseId));
  const xhighReview = result.xhigh_multi_round_review ?? null;
  const qualityEvaluation = result.review_quality_evaluation ?? null;
  const providerCallPerformed = Boolean(execution?.provider_call_performed ?? result.execution?.provider_call_performed);
  const apiCallPerformed = Boolean(execution?.api_call_performed ?? result.execution?.api_call_performed);
  const externalEvidenceTransfer = Boolean(execution?.external_evidence_transfer ?? result.execution?.external_evidence_transfer);
  const liveProviderDogfoodObserved = apiCallPerformed && externalEvidenceTransfer;
  const xhighComplete = xhighReview?.status === 'complete';
  const calibrationReady = qualityEvaluation?.status === 'calibration_ready';
  const singleResultScore = clampScore(
    (quality.human_review_coverage_score * 0.25)
    + (quality.actionability_score * 0.2)
    + (quality.verification_score * 0.15)
    + (quality.evidence_coverage_score * 0.15)
    + (clampScore(qualityEvaluation?.human_likeness_score ?? 0) * 0.15)
    + (xhighComplete ? 0.1 : 0)
  );
  const longitudinalEvidenceScore = clampScore(
    (observedEfforts.length / HUMAN_REVIEW_CLAIM_EFFORTS.length * 0.35)
    + (observedBenchmarkCaseIds.length / requiredBenchmarkCaseIds.length * 0.35)
    + (liveProviderDogfoodObserved ? 0.15 : 0)
    + (calibrationReady ? 0.15 : 0)
  );
  const maturityLevel = classifyHumanReviewMaturityLevel({
    observedEffort,
    quality,
    qualityEvaluation,
    xhighReview,
    singleResultScore
  });
  const gaps = buildHumanReviewMaturityGaps({
    observedEffort,
    missingEfforts,
    benchmarkCaseId,
    missingBenchmarkCaseIds,
    liveProviderDogfoodObserved,
    xhighReview,
    qualityEvaluation,
    quality
  });
  const longitudinalQualityEvaluation = {
    schema_version: SCHEMA_VERSION,
    evaluation_version: HUMAN_REVIEW_MATURITY_VERSION,
    status: gaps.length === 0 ? 'single_result_ready_for_owner_longitudinal_rollup' : 'longitudinal_evidence_incomplete',
    required_efforts: [...HUMAN_REVIEW_CLAIM_EFFORTS],
    observed_efforts: observedEfforts,
    missing_efforts: missingEfforts,
    required_benchmark_case_ids: requiredBenchmarkCaseIds,
    observed_benchmark_case_ids: observedBenchmarkCaseIds,
    missing_benchmark_case_ids: missingBenchmarkCaseIds,
    required_comparison_kinds: [...HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS],
    comparison_artifacts_observed: false,
    continuous_report_quality_history_observed: false,
    current_result_counts_as_longitudinal_series: false,
    single_result_maturity_score: singleResultScore,
    longitudinal_evidence_score: longitudinalEvidenceScore,
    advisory_only: true,
    gate_effect: 'none'
  };
  return {
    schema_version: SCHEMA_VERSION,
    maturity_version: HUMAN_REVIEW_MATURITY_VERSION,
    status: gaps.length === 0 ? 'claim_evidence_ready_for_owner_review' : 'claim_evidence_incomplete',
    maturity_level: maturityLevel,
    current_result: {
      result_id: result.id ?? null,
      observed_effort: observedEffort,
      benchmark_case_id: benchmarkCaseId,
      fixture_type: benchmarkCase?.fixture_type ?? result.benchmark_completion_readiness?.active_fixture_type ?? null,
      provider_id: result.provider?.id ?? execution?.provider?.id ?? null,
      model_id: result.model?.id ?? execution?.model?.id ?? null,
      provider_call_performed: providerCallPerformed,
      api_call_performed: apiCallPerformed,
      external_evidence_transfer: externalEvidenceTransfer,
      live_provider_dogfood_observed: liveProviderDogfoodObserved,
      xhigh_completion_status: xhighReview?.status ?? null,
      calibration_status: qualityEvaluation?.status ?? null
    },
    scorecard: {
      single_result_maturity_score: singleResultScore,
      longitudinal_evidence_score: longitudinalEvidenceScore,
      human_review_coverage_score: quality.human_review_coverage_score,
      actionability_score: quality.actionability_score,
      verification_score: quality.verification_score,
      evidence_coverage_score: quality.evidence_coverage_score,
      human_likeness_score: clampScore(qualityEvaluation?.human_likeness_score ?? 0)
    },
    real_page_dogfood_evidence: {
      standard_deep_xhigh_required: true,
      current_result_has_benchmark_case_metadata: Boolean(benchmarkCaseId),
      current_result_counts_as_manual_live_provider_dogfood: liveProviderDogfoodObserved,
      current_result_counts_as_longitudinal_series: false,
      owner_labeled_real_page_targets_required: true
    },
    longitudinal_quality_evaluation: longitudinalQualityEvaluation,
    human_equivalence_claim: {
      status: 'not_claimed',
      human_equivalent_claim_allowed: false,
      human_superior_claim_allowed: false,
      reason: 'TraceCue can collect advisory evidence toward human-like review quality, but equal-or-superior human judgment requires owner-labeled real-page dogfood across standard, deep, and xhigh efforts, multiple benchmark cases, comparison artifacts, and longitudinal quality history.',
      advisory_only: true,
      gate_effect: 'none'
    },
    gaps,
    next_recommended_actions: buildHumanReviewMaturityNextActions({ missingEfforts, missingBenchmarkCaseIds, liveProviderDogfoodObserved, xhighReview, qualityEvaluation }),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function normalizeObservedReviewEffort(value) {
  const effort = String(value ?? '').trim();
  return REVIEW_EFFORTS.has(effort) ? effort : null;
}

function classifyHumanReviewMaturityLevel({ observedEffort, quality, qualityEvaluation, xhighReview, singleResultScore }) {
  if (!observedEffort || quality.human_review_coverage_score < 0.5 || quality.actionability_score < 0.5) {
    return 'thin_advisory';
  }
  if (observedEffort === 'quick') {
    return 'quick_triage';
  }
  if (observedEffort === 'standard') {
    return singleResultScore >= 0.7 ? 'single_standard_candidate' : 'single_standard_needs_review';
  }
  if (observedEffort === 'deep') {
    return singleResultScore >= 0.75 ? 'single_deep_candidate' : 'single_deep_needs_review';
  }
  if (observedEffort === 'xhigh') {
    return xhighReview?.status === 'complete' && qualityEvaluation?.status === 'calibration_ready'
      ? 'single_xhigh_calibration_candidate'
      : 'single_xhigh_needs_verification';
  }
  return 'thin_advisory';
}

function buildHumanReviewMaturityGaps({ observedEffort, missingEfforts, benchmarkCaseId, missingBenchmarkCaseIds, liveProviderDogfoodObserved, xhighReview, qualityEvaluation, quality }) {
  const gaps = [];
  if (!observedEffort) {
    gaps.push({ code: 'AHR_MATURITY_EFFORT_UNKNOWN', message: 'The result did not record a supported review effort.', severity: 'high' });
  }
  if (missingEfforts.length > 0) {
    gaps.push({ code: 'AHR_MATURITY_EFFORT_MATRIX_INCOMPLETE', message: 'standard, deep, and xhigh dogfood evidence is not all present.', severity: 'high', missing_efforts: missingEfforts });
  }
  if (!benchmarkCaseId || missingBenchmarkCaseIds.length > 0) {
    gaps.push({ code: 'AHR_MATURITY_BENCHMARK_CASE_MATRIX_INCOMPLETE', message: 'Multiple benchmark cases are required before human-equivalent claims can be considered.', severity: 'high', missing_benchmark_case_ids: missingBenchmarkCaseIds });
  }
  if (!liveProviderDogfoodObserved) {
    gaps.push({ code: 'AHR_MATURITY_LIVE_PROVIDER_DOGFOOD_MISSING', message: 'This result does not by itself prove manual live-provider dogfood on an owner-labeled real page.', severity: 'medium' });
  }
  if (observedEffort === 'xhigh' && xhighReview?.status !== 'complete') {
    gaps.push({ code: 'AHR_MATURITY_XHIGH_INCOMPLETE', message: 'xhigh review needs complete role, critique, verification, and synthesis output.', severity: 'medium', missing_conditions: xhighReview?.missing_conditions ?? [] });
  }
  if (qualityEvaluation?.status !== 'calibration_ready') {
    gaps.push({ code: 'AHR_MATURITY_CALIBRATION_NOT_READY', message: 'The quality evaluator has not marked this result calibration-ready.', severity: 'medium', calibration_status: qualityEvaluation?.status ?? null });
  }
  if (quality.verification_score < 0.75) {
    gaps.push({ code: 'AHR_MATURITY_VERIFICATION_THIN', message: 'Dedicated critique or verification coverage is still thin.', severity: 'medium', verification_score: quality.verification_score });
  }
  gaps.push({ code: 'AHR_MATURITY_COMPARISON_HISTORY_REQUIRED', message: 'Direct-vs-TraceCue, provider-dogfood, benchmark-regression comparisons and repeated report-quality history must be reviewed by the owner before any equality or superiority claim.', severity: 'high' });
  return gaps;
}

function buildHumanReviewMaturityNextActions({ missingEfforts, missingBenchmarkCaseIds, liveProviderDogfoodObserved, xhighReview, qualityEvaluation }) {
  const actions = [];
  if (missingEfforts.length > 0) {
    actions.push(`Run approved real-page dogfood for missing efforts: ${missingEfforts.join(', ')}.`);
  }
  if (missingBenchmarkCaseIds.length > 0) {
    actions.push('Run calibration across the benchmark case matrix and compare results by case.');
  }
  if (!liveProviderDogfoodObserved) {
    actions.push('When credentials and transfer approval are explicitly provided, repeat standard/deep/xhigh dogfood with manual live-provider opt-in.');
  }
  if (xhighReview?.status !== 'complete') {
    actions.push('Require complete xhigh role, critique, verification, and synthesis output before treating a result as a high-effort candidate.');
  }
  if (qualityEvaluation?.status !== 'calibration_ready') {
    actions.push('Use report-quality, calibrate, and compare outputs to tune the rubric before promoting the result to owner review.');
  }
  actions.push('Keep all results advisory-only and store the owner-reviewed longitudinal comparison outside deterministic release gates.');
  return actions;
}

function buildReportQualityFromParts({ roleOpinions, findings, ownerDecisions, claims, critiqueRecords, integrationRecord, humanReviewCoverage = null, readerExperienceReview = null, benchmarkRequirementCoverage = null }) {
  const actualRoleOpinions = reportedRoleOpinions(roleOpinions);
  const completenessScore = clampScore(
    (actualRoleOpinions.length > 0 ? 0.25 : 0)
    + (claims.length > 0 || findings.length > 0 ? 0.25 : 0)
    + (ownerDecisions.length > 0 ? 0.2 : 0)
    + (integrationRecord ? 0.15 : 0)
    + (critiqueRecords.length > 0 ? 0.15 : 0)
  );
  const evidenceCoverageScore = clampScore(
    claims.length === 0
      ? 0
      : claims.filter((claim) => claim.evidence_refs?.length > 0 || claim.supported_by_roles?.length > 0).length / claims.length
  );
  const verificationScore = clampScore(
    critiqueRecords.some((record) => record.status === 'reported' || record.status === 'integrated') ? 1 : 0.35
  );
  const humanCoverageScore = clampScore(
    Number(humanReviewCoverage?.coverage_score)
    || computeDimensionCoverageScore(humanReviewCoverage?.dimensions)
  );
  const actionabilityScore = clampScore(
    (findings.some((finding) => finding.recommendation) ? 0.35 : 0)
    + (ownerDecisions.length > 0 ? 0.2 : 0)
    + (Array.isArray(readerExperienceReview?.priority_recommendation) && readerExperienceReview.priority_recommendation.length > 0 ? 0.25 : 0)
    + (integrationRecord ? 0.2 : 0)
  );
  const benchmarkCoverageEnabled = benchmarkRequirementCoverage?.enabled === true;
  const benchmarkRequirementCoverageScore = benchmarkCoverageEnabled
    ? clampScore(
        (benchmarkRequirementCoverage.summary?.required_mention_coverage_score * 0.3)
        + (benchmarkRequirementCoverage.summary?.dimension_coverage_score * 0.3)
        + (benchmarkRequirementCoverage.summary?.structured_record_completeness_score * 0.25)
        + (benchmarkRequirementCoverage.summary?.evidence_backed_record_score * 0.15)
      )
    : 1;
  return {
    quality_evaluator_version: HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION,
    completeness_score: completenessScore,
    evidence_coverage_score: evidenceCoverageScore,
    verification_score: verificationScore,
    human_review_coverage_score: humanCoverageScore,
    actionability_score: actionabilityScore,
    benchmark_requirement_coverage_score: benchmarkRequirementCoverageScore,
    benchmark_required_mention_coverage_score: clampScore(benchmarkRequirementCoverage?.summary?.required_mention_coverage_score ?? 0),
    benchmark_dimension_coverage_score: clampScore(benchmarkRequirementCoverage?.summary?.dimension_coverage_score ?? 0),
    benchmark_structured_record_completeness_score: clampScore(benchmarkRequirementCoverage?.summary?.structured_record_completeness_score ?? (benchmarkCoverageEnabled ? 0 : 1)),
    benchmark_forbidden_claim_score: clampScore(benchmarkRequirementCoverage?.summary?.forbidden_claim_score ?? 1),
    role_count: actualRoleOpinions.length,
    finding_count: findings.length,
    claim_count: claims.length,
    owner_decision_count: ownerDecisions.length,
    quality_warnings: reportQualityWarnings({ roleOpinions, claims, ownerDecisions, critiqueRecords, humanReviewCoverage, actionabilityScore, benchmarkRequirementCoverage }),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function reportQualityWarnings({ roleOpinions, claims, ownerDecisions, critiqueRecords, humanReviewCoverage = null, actionabilityScore = 0, benchmarkRequirementCoverage = null }) {
  const warnings = [];
  if (reportedRoleOpinions(roleOpinions).length === 0) {
    warnings.push('No role-specific opinions were present.');
  }
  if (claims.length === 0) {
    warnings.push('No explicit evidence claims were present.');
  }
  if (ownerDecisions.length === 0) {
    warnings.push('No owner decision requests were present.');
  }
  if (!critiqueRecords.some((record) => record.status === 'reported' || record.status === 'integrated')) {
    warnings.push('No dedicated critique or verification output was present.');
  }
  if (humanReviewCoverage && Number(humanReviewCoverage.coverage_score) < 0.75) {
    warnings.push('Human-review dimension coverage is incomplete.');
  }
  if (actionabilityScore < 0.5) {
    warnings.push('Recommendations may be too vague to guide product work.');
  }
  if (benchmarkRequirementCoverage?.enabled === true && benchmarkRequirementCoverage.status !== 'passed') {
    warnings.push('Benchmark requirement coverage is incomplete or lacks structured evidence.');
  }
  return warnings;
}

function normalizeReviewClaims(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(0, 25).map((value, index) => ({
    id: truncateText(value?.id ?? `claim-${index + 1}`, 120),
    claim: secretSafeText(value?.claim ?? value?.message ?? 'Agentic review claim.', 700),
    evidence_refs: normalizeArtifactReferences(value?.evidence_refs ?? value?.artifacts),
    supported_by_roles: normalizeStringArray(value?.supported_by_roles),
    confidence: normalizeConfidence(value?.confidence),
    subjective_judgment: value?.subjective_judgment !== false,
    gate_effect: 'none'
  }));
}

function normalizeReviewClaimsForReport(values) {
  return normalizeReviewClaims(values).slice(0, 12);
}

function clampScore(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value)));
}

function providerFailure({
  status,
  code,
  message,
  details,
  provider,
  providerCallPerformed = false,
  apiCallPerformed = false,
  externalEvidenceTransfer = false
}) {
  const boundary = providerBoundary({
    provider,
    providerCallPerformed,
    apiCallPerformed,
    externalEvidenceTransfer
  });
  const diagnosticDetails = redact(details ?? {});
  return {
    ok: false,
    status,
    error: { code, message, details: diagnosticDetails },
    failure_diagnostics: {
      schema_version: SCHEMA_VERSION,
      diagnostic_version: '1.0.0',
      stage: diagnosticStageForCode(code),
      code,
      provider_id: provider?.id ?? null,
      status,
      message,
      next_actions: providerFailureNextActions(code),
      provider_call_performed: Boolean(providerCallPerformed),
      api_call_performed: Boolean(apiCallPerformed),
      external_evidence_transfer: Boolean(externalEvidenceTransfer),
      credential_values_recorded: false,
      raw_provider_response_stored: false,
      advisory_only: true,
      gate_effect: 'none'
    },
    boundary,
    warnings: []
  };
}

function diagnosticStageForCode(code) {
  if (/CONFIGURATION|ENDPOINT|FETCH/.test(code)) {
    return 'setup';
  }
  if (/REQUEST|TIMEOUT|PACKAGE/.test(code)) {
    return 'request';
  }
  if (/RESPONSE|JSON|SCHEMA/.test(code)) {
    return 'response';
  }
  return 'provider';
}

function providerFailureNextActions(code) {
  if (/CONFIGURATION/.test(code)) {
    return [
      'Configure provider endpoint and credential environment variables.',
      'Run agentic review dogfood readiness before retrying.'
    ];
  }
  if (/PACKAGE/.test(code)) {
    return ['Recreate the plan and package so the package hash matches the approved plan.'];
  }
  if (/RUNNER/.test(code)) {
    return ['Configure the injected local runner or switch to another approved provider.'];
  }
  if (/PROVIDER_UNKNOWN/.test(code)) {
    return ['Select an implemented provider from provider-readiness output.'];
  }
  return ['Inspect the advisory-safe diagnostics and retry only after preserving the approved plan boundary.'];
}

function providerBoundary({
  provider,
  providerCallPerformed,
  apiCallPerformed,
  externalEvidenceTransfer,
  requestBytes = null,
  responseBytes = null,
  statusCode = null,
  rawPixelsTransferred = false,
  pageTextTransferred = false,
  domSummaryTransferred = false,
  urlMetadataTransferred = false,
  artifactRefsTransferred = false,
  accessibilitySummaryTransferred = false
}) {
  return agenticHumanReviewBoundary(providerBoundaryRecord({
    provider,
    providerCallPerformed: Boolean(providerCallPerformed),
    apiCallPerformed: Boolean(apiCallPerformed),
    externalEvidenceTransfer: Boolean(externalEvidenceTransfer),
    requestBytes,
    responseBytes,
    statusCode,
    rawPixelsTransferred,
    pageTextTransferred,
    domSummaryTransferred,
    urlMetadataTransferred,
    artifactRefsTransferred,
    accessibilitySummaryTransferred
  }));
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
    dom_summary_transferred: false,
    url_metadata_transferred: false,
    artifact_refs_transferred: false,
    accessibility_summary_transferred: false,
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
    summary.dom_summary_transferred ||= Boolean(execution.dom_summary_transferred);
    summary.url_metadata_transferred ||= Boolean(execution.url_metadata_transferred);
    summary.artifact_refs_transferred ||= Boolean(execution.artifact_refs_transferred);
    summary.accessibility_summary_transferred ||= Boolean(execution.accessibility_summary_transferred);
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
