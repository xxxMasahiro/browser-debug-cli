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

const DEFAULT_PROVIDER_ID = 'fake-agent';
const DEFAULT_MODEL_ID = 'fake-model';
const DEFAULT_REVIEW_EFFORT = 'standard';
const DEFAULT_SUBAGENT_EFFORT = 'medium';
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_SNIPPETS = 20;
const MAX_EVIDENCE_REFS = 50;
const MAX_ROLE_OPINIONS = 12;
const MAX_FINDINGS = 50;
const MAX_PROPOSAL_BRIEF_BYTES = 32 * 1024;

const REVIEW_EFFORTS = new Set(['quick', 'standard', 'deep', 'xhigh']);
const HUMAN_REVIEW_CLAIM_EFFORTS = Object.freeze(['standard', 'deep', 'xhigh']);
const HUMAN_REVIEW_REQUIRED_COMPARISON_KINDS = Object.freeze(['direct-vs-tracecue', 'provider-dogfood', 'benchmark-regression']);
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
    warnings: [...briefRead.warnings, ...reviewIndexPreview.warnings],
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
  const benchmarkCase = resolveBenchmarkCase(requestedBenchmarkCaseId);
  if (requestedBenchmarkCaseId && !benchmarkCase) {
    return errorResult('AGENTIC_REVIEW_BENCHMARK_CASE_NOT_FOUND', 'No agentic human review benchmark case matched the requested id.', {
      case: requestedBenchmarkCaseId,
      available_cases: BENCHMARK_CASES.map((item) => item.case_id)
    });
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
    role_instruction_contracts: roleInstructionContracts,
    dogfood_metadata: buildDogfoodMetadataFromOptions(planOptions),
    live_dogfood_execution_gate: buildAgenticLiveDogfoodExecutionGate({
      provider: provider.provider,
      plan: {
        dogfood_metadata: buildDogfoodMetadataFromOptions(planOptions),
        review_quality_benchmark: buildReviewQualityBenchmarkContract({
          dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions),
          benchmarkCase,
          rubricProfile
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
      roleInstructionContracts
    }),
    review_quality_benchmark: buildReviewQualityBenchmarkContract({
      dogfoodMetadata: buildDogfoodMetadataFromOptions(planOptions),
      benchmarkCase,
      rubricProfile
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
  const quality = buildReportQuality({
    result: resultRead.value,
    resultPath: resultRead.relativePath,
    execution,
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
      required_mention_coverage: 'fraction of required mentions found in summary, reader experience, action plan, claims, or findings',
      forbidden_claim_score: '1 means no forbidden claim was found',
      dimension_coverage: 'fraction of required dimensions covered by human_review_coverage',
      actionability_score: 'normalized report-quality actionability score'
    },
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildCalibrationResult({ result, resultPath, benchmarkCase, now }) {
  const text = calibrationSearchText(result);
  const requiredMentionHits = benchmarkCase.required_mentions.map((mention) => ({
    mention,
    present: textIncludesLoose(text, mention)
  }));
  const forbiddenClaimHits = benchmarkCase.forbidden_claims.map((claim) => ({
    claim,
    present: textIncludesLoose(text, claim)
  }));
  const coveredDimensions = new Set((result.human_review_coverage?.dimensions ?? [])
    .filter((dimension) => dimension.status === 'covered')
    .map((dimension) => dimension.id));
  const requiredDimensionHits = benchmarkCase.required_dimensions.map((dimension) => ({
    dimension,
    present: coveredDimensions.has(dimension)
  }));
  const requiredMentionCoverage = fractionPresent(requiredMentionHits);
  const forbiddenClaimScore = forbiddenClaimHits.some((item) => item.present) ? 0 : 1;
  const dimensionCoverage = fractionPresent(requiredDimensionHits);
  const actionabilityScore = clampScore(result.report_quality?.actionability_score ?? 0);
  const coverageThreshold = Number(benchmarkCase.thresholds.coverage_score ?? 0.75);
  const actionabilityThreshold = Number(benchmarkCase.thresholds.actionability_score ?? 0.6);
  const passed = requiredMentionCoverage >= coverageThreshold
    && dimensionCoverage >= coverageThreshold
    && actionabilityScore >= actionabilityThreshold
    && forbiddenClaimScore >= Number(benchmarkCase.thresholds.forbidden_claim_score ?? 1);
  const warnings = [
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
      actionability_score: actionabilityScore,
      human_review_coverage_score: clampScore(result.report_quality?.human_review_coverage_score ?? result.human_review_coverage?.coverage_score ?? 0),
      role_instruction_coverage_score: clampScore(result.role_instruction_coverage?.coverage_score ?? 0)
    },
    required_mentions: requiredMentionHits,
    forbidden_claims: forbiddenClaimHits,
    required_dimensions: requiredDimensionHits,
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
  const warnings = regressed > 0 ? [{
    code: 'AGENTIC_REVIEW_COMPARISON_REGRESSION_PRESENT',
    message: 'The candidate result regressed on at least one comparable quality score.',
    details: { regressed_score_count: regressed }
  }] : [];
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
    direct_vs_tracecue_analysis: buildDirectVsTraceCueAnalysis({
      baseline,
      candidate,
      deltas,
      comparisonKind: normalizedComparisonKind
    }),
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
  return {
    schema_version: SCHEMA_VERSION,
    analysis_version: HUMAN_REVIEW_COMPLETION_ROADMAP_VERSION,
    baseline_role: 'direct_or_unstructured_human_like_review',
    candidate_role: 'tracecue_agentic_human_review_workflow',
    baseline_result_id: baseline.id ?? null,
    candidate_result_id: candidate.id ?? null,
    tracecue_mechanical_context_present: mechanicalContextPresent,
    tracecue_plan_hash_present: Boolean(candidate.agentic_human_review_advisory?.plan_hash),
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
    advisory_only: true,
    gate_effect: 'none'
  };
}

function calibrationSearchText(result) {
  return JSON.stringify({
    non_engineer_summary: result.non_engineer_summary,
    subjective_perception: result.subjective_perception,
    reader_experience_review: result.reader_experience_review,
    mechanical_vs_human_review: result.mechanical_vs_human_review,
    action_plan: result.agentic_human_review_action_plan,
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
  return text.replace(/[-_]+/g, ' ').includes(normalized);
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
    calibration_ready_score: clampScore(result.review_quality_evaluation?.calibration_ready_score ?? 0)
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
    readerExperienceReview
  });
  const reviewQualityEvaluation = buildReviewQualityEvaluation({
    quality: qualityPreview,
    roleInstructionCoverage,
    consensusAnalysis,
    dissentAnalysis,
    xhighCompletion,
    plan
  });
  const calibrationMetadata = buildCalibrationMetadata({ plan, input, quality: qualityPreview });
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
    calibration_metadata: calibrationMetadata,
    report_quality: qualityPreview,
    review_quality_evaluation: reviewQualityEvaluation,
    xhigh_multi_round_review: xhighCompletion,
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

function buildProviderInstructionContract({ intent, reviewPackage, orchestration }) {
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
      'return normalized JSON matching agentic_human_review_advisory'
    ],
    input_summary: buildSourceEvidenceSummary(reviewPackage),
    output_sections: [
      'non_engineer_summary',
      'subjective_perception',
      'readability_comprehension',
      'reader_experience_review',
      'mechanical_vs_human_review',
      'role_opinions',
      'consensus_summary',
      'dissent_summary',
      'findings',
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

function buildReviewQualityBenchmarkContract({ dogfoodMetadata = null, benchmarkCase = null, rubricProfile = null } = {}) {
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
    thresholds: benchmarkCase?.thresholds ?? { coverage_score: 0.75, actionability_score: 0.6, forbidden_claim_score: 1 },
    allowed_evidence_classes: benchmarkCase?.allowed_evidence_classes ?? [],
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
    ...(missingCritiqueRoles.length === 0 ? [] : [`Missing dedicated critique or verification role(s): ${missingCritiqueRoles.join(', ')}.`]),
    ...(synthesisIntegrated ? [] : ['Missing synthesis output or explicit integration record.'])
  ];
  const complete = !xhighExpected || missingConditions.length === 0;
  return {
    schema_version: SCHEMA_VERSION,
    completion_version: HUMAN_REVIEW_XHIGH_COMPLETION_VERSION,
    required: xhighExpected,
    status: xhighExpected ? (complete ? 'complete' : 'incomplete') : 'not_required',
    planned_role_count: requiredRoles.length,
    reported_role_count: reported.length,
    required_roles: requiredRoles,
    missing_roles: missingRoles,
    planned_rounds: plannedRounds,
    missing_rounds: missingRounds,
    missing_critique_roles: missingCritiqueRoles,
    synthesis_integrated: synthesisIntegrated,
    role_instruction_coverage_score: roleInstructionCoverage.coverage_score,
    provider_round_execution_mode: plan.orchestration_contract?.provider_round_execution_mode ?? null,
    true_multi_call_execution_performed: false,
    single_call_multi_role_output_only: plan.orchestration_contract?.provider_round_execution_mode === 'single_provider_call_with_required_multi_role_round_output',
    missing_conditions: xhighExpected ? missingConditions : [],
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildReviewQualityEvaluation({ quality, roleInstructionCoverage, consensusAnalysis, dissentAnalysis, xhighCompletion, plan }) {
  const xhighExpected = plan.review_effort?.mode === 'xhigh';
  const multiRoundSatisfied = !xhighExpected
    || xhighCompletion?.status === 'complete';
  const calibrationReadyScore = clampScore(
    (quality.human_review_coverage_score * 0.3)
    + (quality.actionability_score * 0.2)
    + (quality.verification_score * 0.2)
    + (roleInstructionCoverage.coverage_score * 0.2)
    + (consensusAnalysis.confidence_alignment_score * 0.1)
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
    multi_round_expectation_satisfied: multiRoundSatisfied,
    xhigh_completion_status: xhighCompletion?.status ?? null,
    true_multi_call_execution_performed: xhighCompletion?.true_multi_call_execution_performed ?? false,
    role_instruction_coverage_score: roleInstructionCoverage.coverage_score,
    consensus_confidence_alignment_score: consensusAnalysis.confidence_alignment_score,
    weak_claim_count: dissentAnalysis.weak_claim_count,
    quality_warnings: [
      ...normalizeStringArray(quality.quality_warnings),
      ...(multiRoundSatisfied ? [] : ['xhigh review expected complete provider output for planned roles, critique/verification, and synthesis.']),
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

function buildCalibrationMetadata({ plan, input, quality }) {
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
      quality
    }),
    repeatable_quality_check: true,
    advisory_only: true,
    gate_effect: 'none'
  };
}

function buildReportQuality({ result, resultPath, execution, now }) {
  const quality = buildReportQualityFromParts({
    roleOpinions: normalizeRoleOpinions(result.role_opinions),
    findings: normalizeFindings(result.agentic_human_review_findings, result.id ?? 'agentic-result'),
    ownerDecisions: normalizeOwnerDecisionRequests(result.owner_decision_requests),
    claims: normalizeReviewClaims(result.review_claims),
    critiqueRecords: Array.isArray(result.critique_records) ? result.critique_records : [],
    integrationRecord: result.integration_record ?? null,
    humanReviewCoverage: result.human_review_coverage ?? null,
    readerExperienceReview: result.reader_experience_review ?? null
  });
  const humanReviewMaturity = buildHumanReviewMaturity({ result, execution, quality });
  return redact({
    schema_version: SCHEMA_VERSION,
    type: 'agentic_human_review_report_quality',
    generated_at: now.toISOString(),
    quality_evaluator_version: HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION,
    result_path: resultPath,
    result_id: result.id ?? null,
    execution_id: execution?.id ?? null,
    ...quality,
    human_review_maturity: humanReviewMaturity,
    longitudinal_quality_evaluation: humanReviewMaturity.longitudinal_quality_evaluation,
    benchmark_completion_readiness: result.benchmark_completion_readiness ?? null,
    xhigh_multi_round_review: result.xhigh_multi_round_review ?? null,
    boundary: agenticHumanReviewBoundary({
      read_only: true,
      planning_only: false,
      report_quality_gate_effect: 'none'
    })
  });
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

function buildReportQualityFromParts({ roleOpinions, findings, ownerDecisions, claims, critiqueRecords, integrationRecord, humanReviewCoverage = null, readerExperienceReview = null }) {
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
  return {
    quality_evaluator_version: HUMAN_REVIEW_QUALITY_EVALUATOR_VERSION,
    completeness_score: completenessScore,
    evidence_coverage_score: evidenceCoverageScore,
    verification_score: verificationScore,
    human_review_coverage_score: humanCoverageScore,
    actionability_score: actionabilityScore,
    role_count: actualRoleOpinions.length,
    finding_count: findings.length,
    claim_count: claims.length,
    owner_decision_count: ownerDecisions.length,
    quality_warnings: reportQualityWarnings({ roleOpinions, claims, ownerDecisions, critiqueRecords, humanReviewCoverage, actionabilityScore }),
    advisory_only: true,
    gate_effect: 'none'
  };
}

function reportQualityWarnings({ roleOpinions, claims, ownerDecisions, critiqueRecords, humanReviewCoverage = null, actionabilityScore = 0 }) {
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
