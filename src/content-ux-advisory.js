import { redact, truncateText } from './redaction.js';

const DEFAULT_MAX_SOURCE_BYTES = 32768;
const SIGNAL_LIMIT = 80;
const CONTENT_UX_FINDING_LIMIT = 80;
const SUPPORTED_BINDING_TARGETS = new Set(['text', 'attribute', 'data-state', 'data-risk']);
const KNOWN_BINDING_TARGETS = SUPPORTED_BINDING_TARGETS;
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });
const DEFAULT_STATE_ATTRIBUTES = ['data-state', 'data-status', 'aria-current', 'aria-selected', 'aria-expanded', 'aria-pressed'];
const DEFAULT_RISK_ATTRIBUTES = ['data-risk', 'data-severity', 'aria-invalid', 'aria-disabled'];
const SAFE_ATTRIBUTE_NAME = /^[a-zA-Z_][a-zA-Z0-9_:.:-]{0,119}$/;

export function normalizeContentUxAdvisoryConfig(configValue = {}, sourceDataValue = undefined) {
  const raw = configValue && typeof configValue === 'object' && !Array.isArray(configValue) ? configValue : {};
  const sourceInput = sourceDataValue === undefined ? raw.sourceData ?? raw.sources ?? [] : sourceDataValue;
  const sourceData = normalizeSourceData(sourceInput);
  return {
    enabled: raw.enabled === true,
    reviewer: 'local_content_ux_advisory',
    checks: normalizeChecks(raw.checks),
    audience: normalizeAudience(raw.audience ?? raw.audiences),
    goal: raw.goal || raw.purpose ? truncateText(raw.goal ?? raw.purpose, 500) : null,
    requiredUserQuestions: normalizeContentUserQuestions(
      raw.requiredUserQuestions ?? raw.required_user_questions ?? raw.userQuestions ?? raw.questions ?? []
    ),
    sourceData,
    boundaries: {
      local_only: true,
      external_evidence_transfer: false,
      arbitrary_file_reads: false,
      gate_effect: 'none'
    }
  };
}

export function normalizeContentDataBindings(value = []) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  return entries
    .map((entry, index) => normalizeContentDataBinding(entry, index))
    .filter(Boolean);
}

export function normalizeContentUserQuestions(value = [], fallbackPageId = null) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  return entries
    .map((entry, index) => normalizeContentUserQuestion(entry, index, fallbackPageId))
    .filter(Boolean);
}

export function buildLocalContentUxAdvisory({ target, routeReviews = [] } = {}) {
  const config = target?.localContentUxAdvisory;
  if (!config?.enabled) {
    return null;
  }

  const signals = [];
  const counts = {
    manifest_pages: target?.pages?.length ?? 0,
    reviewed_page_viewports: routeReviews.length,
    source_data_declared: config.sourceData.length,
    source_data_available: config.sourceData.filter((source) => source.available).length,
    source_data_external_references_ignored: config.sourceData.filter((source) => source.externalReference).length,
    data_binding_checks: 0,
    data_binding_matches: 0,
    data_binding_mismatches: 0,
    data_binding_inconclusive: 0,
    selector_scoped_binding_checks: 0,
    attribute_binding_checks: 0,
    state_binding_checks: 0,
    risk_binding_checks: 0,
    required_user_questions: 0,
    user_questions_answered: 0,
    user_questions_unanswered: 0,
    user_questions_inconclusive: 0,
    pages_without_content_contract: 0
  };
  const sourceIndex = new Map(config.sourceData.map((source) => [source.id, source]));

  if (!config.goal) {
    addSignal(signals, {
      id: 'content_ux_goal_missing',
      severity: 'low',
      confidence: 'high',
      message: 'The manifest enables content UX advisory without declaring the product communication goal.',
      evidence: { configured: false },
      recommendation: 'Add localContentUxAdvisory.goal so advisory output can judge whether page evidence supports the intended user understanding.'
    });
  }
  if (config.audience.length === 0) {
    addSignal(signals, {
      id: 'content_ux_audience_missing',
      severity: 'low',
      confidence: 'high',
      message: 'The manifest enables content UX advisory without declaring the intended audience.',
      evidence: { configured: false },
      recommendation: 'Add localContentUxAdvisory.audience, for example non-engineers or early-career engineers, to make content review criteria explicit.'
    });
  }

  for (const source of config.sourceData) {
    if (source.externalReference) {
      addSignal(signals, {
        id: 'content_ux_external_source_ignored',
        severity: source.required ? 'medium' : 'info',
        confidence: 'high',
        message: `Source data "${source.id}" declares an external reference that was not read by the local advisory layer.`,
        evidence: { source_id: source.id, reference_type: source.referenceType, required: source.required },
        recommendation: 'Inline the bounded JSON data in the target manifest, or add a separately approved source-data loader later.'
      });
    } else if (!source.available && source.required) {
      addSignal(signals, {
        id: 'content_ux_required_source_missing',
        severity: 'medium',
        confidence: 'high',
        message: `Required source data "${source.id}" was not available to the local advisory layer.`,
        evidence: { source_id: source.id, required: true },
        recommendation: 'Provide a bounded inline JSON sourceData entry before relying on source-to-screen content advisory.'
      });
    }
  }

  for (const page of target?.pages ?? []) {
    const bindings = page.expectations?.dataBindings ?? [];
    if (bindings.length === 0) {
      counts.pages_without_content_contract += 1;
      addSignal(signals, {
        id: 'content_ux_page_contract_missing',
        severity: 'info',
        confidence: 'high',
        page: pageReference(page),
        message: `Manifest page "${page.name}" has no dataBindings content contract.`,
        evidence: { page_id: page.id, route: page.url },
        recommendation: 'Add expectations.dataBindings for source facts that must be visible or clearly represented on this page.'
      });
    }

    const reviews = matchingRouteReviews(routeReviews, page);
    if (reviews.length === 0) {
      addSignal(signals, {
        id: 'content_ux_page_not_reviewed',
        severity: 'medium',
        confidence: 'high',
        page: pageReference(page),
        message: `Manifest page "${page.name}" was not reviewed, so content UX bindings could not be checked.`,
        evidence: { page_id: page.id, route: page.url },
        recommendation: 'Raise the route budget, check manifest scope, or split the target manifest so the page is reviewed.'
      });
      evaluateUserQuestions({
        signals,
        counts,
        questions: page.expectations?.userQuestions ?? [],
        reviews,
        page,
        source: 'page_expectations'
      });
      continue;
    }

    for (const binding of bindings) {
      counts.data_binding_checks += 1;
      if (binding.selector) {
        counts.selector_scoped_binding_checks += 1;
      }
      if (binding.target === 'attribute') {
        counts.attribute_binding_checks += 1;
      } else if (binding.target === 'data-state') {
        counts.state_binding_checks += 1;
      } else if (binding.target === 'data-risk') {
        counts.risk_binding_checks += 1;
      }
      const source = sourceIndex.get(binding.sourceId);
      if (!source) {
        counts.data_binding_inconclusive += 1;
        addBindingSignal(signals, binding, page, {
          id: 'content_ux_binding_source_unknown',
          severity: binding.severity,
          confidence: 'high',
          message: `Content binding "${binding.id}" references unknown source data "${binding.sourceId}".`,
          evidence: { source_id: binding.sourceId, pointer: binding.pointer },
          recommendation: 'Declare the referenced sourceData entry in the target manifest.'
        });
        continue;
      }
      if (!source.available) {
        counts.data_binding_inconclusive += 1;
        addBindingSignal(signals, binding, page, {
          id: 'content_ux_binding_source_unavailable',
          severity: binding.severity,
          confidence: 'high',
          message: `Content binding "${binding.id}" could not read source data "${binding.sourceId}".`,
          evidence: { source_id: binding.sourceId, pointer: binding.pointer },
          recommendation: 'Provide bounded inline JSON source data for this binding.'
        });
        continue;
      }
      const pointed = readJsonPointer(source.data, binding.pointer);
      if (!pointed.found) {
        counts.data_binding_inconclusive += 1;
        addBindingSignal(signals, binding, page, {
          id: 'content_ux_binding_pointer_missing',
          severity: binding.severity,
          confidence: 'high',
          message: `Content binding "${binding.id}" points to missing source data.`,
          evidence: { source_id: binding.sourceId, pointer: binding.pointer },
          recommendation: 'Fix the JSON Pointer or sourceData shape before using this content advisory signal.'
        });
        continue;
      }

      const expectedText = primitiveText(pointed.value);
      if (!expectedText) {
        counts.data_binding_inconclusive += 1;
        addBindingSignal(signals, binding, page, {
          id: 'content_ux_binding_value_not_textual',
          severity: 'low',
          confidence: 'high',
          message: `Content binding "${binding.id}" resolves to non-textual source data.`,
          evidence: { source_id: binding.sourceId, pointer: binding.pointer },
          recommendation: 'Point the binding at a string, number, or boolean value that should be represented in the UI.'
        });
        continue;
      }

      const bindingResult = evaluateBindingTarget({ binding, reviews, expectedText });
      if (bindingResult.status === 'matched') {
        counts.data_binding_matches += 1;
      } else if (bindingResult.status === 'mismatched') {
        counts.data_binding_mismatches += 1;
        addBindingSignal(signals, binding, page, {
          id: bindingResult.signalId,
          severity: binding.severity,
          confidence: 'medium',
          message: bindingResult.message,
          evidence: bindingResult.evidence,
          recommendation: bindingResult.recommendation
        });
      } else {
        counts.data_binding_inconclusive += 1;
        addBindingSignal(signals, binding, page, {
          id: bindingResult.signalId,
          severity: binding.required ? binding.severity : 'info',
          confidence: 'high',
          message: bindingResult.message,
          evidence: bindingResult.evidence,
          recommendation: bindingResult.recommendation
        });
      }
    }

    evaluateUserQuestions({
      signals,
      counts,
      questions: page.expectations?.userQuestions ?? [],
      reviews,
      page,
      source: 'page_expectations'
    });
  }

  evaluateUserQuestions({
    signals,
    counts,
    questions: config.requiredUserQuestions,
    reviews: routeReviews,
    page: null,
    source: 'local_content_ux_advisory'
  });

  const status = statusForSignals(signals);
  const advisorySignals = signals.slice(0, SIGNAL_LIMIT);
  const findings = buildContentUxFindings(advisorySignals);
  const pageHandoff = buildContentUxPageHandoff({ findings, target });
  const manifestAuthoring = buildContentUxManifestAuthoring({ config, target, counts, findings });
  const actionPlan = buildContentUxActionPlan({ findings, counts, status, pageHandoff, manifestAuthoring });
  const readiness = buildContentUxReadiness({ findings, counts, status, pageHandoff });
  return redact({
    reviewer: 'local_content_ux_advisory',
    status,
    enabled: true,
    source: 'target_manifest_opt_in',
    gate_effect: 'none',
    external_evidence_transfer: false,
    checks: config.checks,
    audience: config.audience,
    goal: config.goal,
    counts,
    signals: advisorySignals,
    findings,
    action_plan: actionPlan,
    readiness,
    page_handoff: pageHandoff,
    manifest_authoring: manifestAuthoring,
    source_data: {
      declared: counts.source_data_declared,
      inline_available: counts.source_data_available,
      external_references_ignored: counts.source_data_external_references_ignored
    },
    quality_signal: {
      status,
      enabled: true,
      advisory_only: true,
      gate_effect: 'none',
      signal_count: signals.length,
      data_binding_checks: counts.data_binding_checks,
      data_binding_mismatches: counts.data_binding_mismatches,
      data_binding_inconclusive: counts.data_binding_inconclusive,
      required_user_questions: counts.required_user_questions,
      user_questions_unanswered: counts.user_questions_unanswered,
      user_questions_inconclusive: counts.user_questions_inconclusive,
      external_evidence_transfer: false
    },
    limitations: [
      'This advisory is manifest opt-in and does not change review findings, metrics, action plans, or release gates.',
      'The local advisory layer checks declared source-to-screen contracts, selector-scoped evidence, and required user-question coverage; it is not model output or final product approval.',
      'Inline source data is used only in-process and source values are not copied into advisory messages or Markdown reports.',
      'External source references are recorded but not read by this phase.'
    ]
  });
}

function normalizeChecks(value) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  const normalized = entries
    .map((entry) => String(entry).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_'))
    .filter(Boolean);
  return normalized.length > 0 ? [...new Set(normalized)] : ['content_contract', 'source_data_alignment'];
}

function normalizeAudience(value) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  return [...new Set(entries.map((entry) => truncateText(String(entry).trim(), 80)).filter(Boolean))];
}

function normalizeSourceData(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([id, data]) => ({ id, data }))
      : [];
  return entries
    .map((entry, index) => normalizeSourceDataEntry(entry, index))
    .filter(Boolean);
}

function normalizeSourceDataEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const id = safeId(entry.id ?? entry.name ?? entry.sourceId ?? `source-${index + 1}`, `source-${index + 1}`);
  const required = entry.required !== false;
  const maxSizeBytes = clampNumber(entry.maxSizeBytes ?? entry.max_size_bytes, 1, 1024 * 1024, DEFAULT_MAX_SOURCE_BYTES);
  const hasInlineData = Object.prototype.hasOwnProperty.call(entry, 'data');
  const externalReference = typeof entry.path === 'string' || typeof entry.url === 'string' || typeof entry.href === 'string';
  let data = null;
  let available = false;
  let sizeBytes = 0;
  if (hasInlineData) {
    const serialized = safeJson(entry.data);
    sizeBytes = Buffer.byteLength(serialized, 'utf8');
    if (sizeBytes <= maxSizeBytes) {
      data = entry.data;
      available = true;
    }
  }
  return {
    id,
    required,
    available,
    size_bytes: sizeBytes,
    max_size_bytes: maxSizeBytes,
    data,
    externalReference,
    referenceType: typeof entry.url === 'string' || typeof entry.href === 'string'
      ? 'url'
      : typeof entry.path === 'string'
        ? 'path'
        : null
  };
}

function normalizeContentDataBinding(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const sourceId = entry.sourceId ?? entry.source_id ?? entry.source;
  const pointer = entry.pointer ?? entry.path ?? entry.jsonPointer ?? entry.json_pointer;
  if (!sourceId || pointer === undefined || pointer === null) {
    return null;
  }
  const target = normalizeBindingTarget(entry.target ?? entry.targetKind ?? entry.kind);
  return {
    id: safeId(entry.id ?? entry.name ?? `binding-${index + 1}`, `binding-${index + 1}`),
    sourceId: String(sourceId),
    pointer: normalizeJsonPointer(pointer),
    selector: entry.selector ? truncateText(String(entry.selector), 240) : null,
    target,
    attribute: normalizeAttributeName(entry.attribute ?? entry.attr ?? entry.attributeName ?? entry.attribute_name),
    match: ['contains', 'exact'].includes(entry.match) ? entry.match : 'contains',
    severity: SEVERITIES.has(entry.severity) ? entry.severity : 'medium',
    required: entry.required !== false
  };
}

function normalizeBindingTarget(value) {
  const target = String(value ?? 'text').trim().toLowerCase();
  return KNOWN_BINDING_TARGETS.has(target) ? target : 'text';
}

function normalizeContentUserQuestion(entry, index, fallbackPageId) {
  const raw = typeof entry === 'string' ? { question: entry } : entry;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const question = raw.question ?? raw.prompt ?? raw.text ?? raw.value;
  if (!question) {
    return null;
  }
  const expectedEvidence = normalizeEvidencePhrases(
    raw.expectedEvidence
    ?? raw.expected_evidence
    ?? raw.evidence
    ?? raw.answers
    ?? raw.answer
    ?? raw.keywords
    ?? []
  );
  const pageId = raw.pageId ?? raw.page_id ?? raw.page ?? fallbackPageId;
  const matchMode = String(raw.matchMode ?? raw.match_mode ?? raw.mode ?? 'any').toLowerCase();
  return {
    id: safeId(raw.id ?? raw.name ?? `question-${index + 1}`, `question-${index + 1}`),
    question: truncateText(String(question).replace(/\s+/g, ' ').trim(), 240),
    pageId: pageId ? safeId(pageId, String(pageId)) : null,
    selector: raw.selector ? truncateText(String(raw.selector), 240) : null,
    expectedEvidence,
    matchMode: matchMode === 'all' ? 'all' : 'any',
    textMatch: ['contains', 'exact'].includes(raw.textMatch ?? raw.text_match) ? (raw.textMatch ?? raw.text_match) : 'contains',
    severity: SEVERITIES.has(raw.severity) ? raw.severity : 'medium',
    required: raw.required !== false
  };
}

function normalizeEvidencePhrases(value) {
  const entries = Array.isArray(value) ? value : [value].filter(Boolean);
  return [...new Set(entries
    .map((entry) => truncateText(String(entry).replace(/\s+/g, ' ').trim(), 240))
    .filter(Boolean))];
}

function normalizeAttributeName(value) {
  if (!value) {
    return null;
  }
  const name = String(value).trim();
  return SAFE_ATTRIBUTE_NAME.test(name) ? name.toLowerCase() : null;
}

function normalizeJsonPointer(value) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return '';
  }
  return text.startsWith('/') ? text : `/${text.replace(/^\/+/, '')}`;
}

function safeId(value, fallback) {
  return String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function matchingRouteReviews(routeReviews, page) {
  return routeReviews.filter((review) => normalizeUrlKey(review.route?.url ?? review.url) === normalizeUrlKey(page.url));
}

function normalizeUrlKey(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return String(value ?? '');
  }
}

function readJsonPointer(data, pointer) {
  if (pointer === '') {
    return { found: true, value: data };
  }
  if (!String(pointer).startsWith('/')) {
    return { found: false, value: undefined };
  }
  let current = data;
  for (const segment of String(pointer).slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: current };
}

function primitiveText(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text ? truncateText(text, 500) : null;
  }
  return null;
}

function textMatched(visibleText, expectedText, match) {
  const haystack = String(visibleText ?? '').replace(/\s+/g, ' ').trim();
  const needle = String(expectedText ?? '').replace(/\s+/g, ' ').trim();
  if (!needle) {
    return false;
  }
  if (match === 'exact') {
    return haystack === needle;
  }
  return haystack.includes(needle);
}

function evaluateBindingTarget({ binding, reviews, expectedText }) {
  if (!SUPPORTED_BINDING_TARGETS.has(binding.target)) {
    return inconclusiveBinding({
      binding,
      signalId: 'content_ux_binding_target_unsupported',
      message: `Content binding "${binding.id}" uses unsupported target "${binding.target}".`,
      evidence: { target: binding.target },
      recommendation: 'Use a supported target: text, attribute, data-state, or data-risk.'
    });
  }

  if (binding.target !== 'text' && !binding.selector) {
    return inconclusiveBinding({
      binding,
      signalId: 'content_ux_binding_selector_required',
      message: `Content binding "${binding.id}" requires a selector for target "${binding.target}".`,
      evidence: { target: binding.target },
      recommendation: 'Add a stable selector so the advisory can compare the source fact with a specific UI element.'
    });
  }
  if (binding.target === 'attribute' && !binding.attribute) {
    return inconclusiveBinding({
      binding,
      signalId: 'content_ux_binding_attribute_required',
      message: `Content binding "${binding.id}" requires an attribute name for target "attribute".`,
      evidence: { target: binding.target },
      recommendation: 'Add an attribute such as data-status, aria-current, or aria-expanded to the binding contract.'
    });
  }

  const reviewedViewports = reviews.map((review) => review.viewport?.name ?? 'unknown');
  if (binding.target === 'text' && !binding.selector) {
    const matched = reviews.some((review) => textMatched(review.evidenceSummary?.visible_text, expectedText, binding.match));
    if (matched) {
      return { status: 'matched' };
    }
    return {
      status: 'mismatched',
      signalId: 'content_ux_source_text_not_visible',
      message: `Content binding "${binding.id}" source text was not found in the reviewed page text.`,
      evidence: {
        source_id: binding.sourceId,
        pointer: binding.pointer,
        match: binding.match,
        target: binding.target,
        reviewed_viewports: reviewedViewports,
        reviewed_visible_text_lengths: reviews.map((review) => review.evidenceSummary?.visible_text_length ?? 0)
      },
      recommendation: 'Check whether the source fact is missing from the UI, hidden behind an unreviewed state, or represented with different wording that needs owner approval.'
    };
  }

  const elementMatches = reviews.flatMap((review) => matchingElements(review, binding.selector).map((element) => ({ review, element })));
  if (elementMatches.length === 0) {
    return {
      status: 'mismatched',
      signalId: 'content_ux_binding_selector_not_found',
      message: `Content binding "${binding.id}" selector was not found in reviewed element evidence.`,
      evidence: {
        source_id: binding.sourceId,
        pointer: binding.pointer,
        selector: binding.selector,
        target: binding.target,
        reviewed_viewports: reviewedViewports
      },
      recommendation: 'Check whether the selector is stale, hidden at the reviewed viewport, or should be added to page expectations.'
    };
  }

  const candidates = candidateValuesForBinding(binding, elementMatches);
  if (candidates.length === 0) {
    return {
      status: 'mismatched',
      signalId: 'content_ux_binding_candidate_missing',
      message: `Content binding "${binding.id}" found the selector but no comparable ${binding.target} evidence.`,
      evidence: {
        source_id: binding.sourceId,
        pointer: binding.pointer,
        selector: binding.selector,
        target: binding.target,
        attribute: binding.attribute,
        candidate_count: 0,
        reviewed_viewports: reviewedViewports
      },
      recommendation: 'Add stable visible text or state attributes to the UI element, or adjust the binding target after owner review.'
    };
  }

  if (candidates.some((candidate) => textMatched(candidate.value, expectedText, binding.match))) {
    return { status: 'matched' };
  }
  return {
    status: 'mismatched',
    signalId: signalIdForBindingTarget(binding.target),
    message: `Content binding "${binding.id}" source value did not match the reviewed ${binding.target} evidence.`,
    evidence: {
      source_id: binding.sourceId,
      pointer: binding.pointer,
      selector: binding.selector,
      target: binding.target,
      attribute: binding.attribute,
      match: binding.match,
      candidate_count: candidates.length,
      candidate_attributes: [...new Set(candidates.map((candidate) => candidate.attribute).filter(Boolean))],
      reviewed_viewports: reviewedViewports
    },
    recommendation: 'Check whether the UI state, attribute contract, or source mapping is stale before treating this as a product content issue.'
  };
}

function inconclusiveBinding({ signalId, message, evidence, recommendation }) {
  return {
    status: 'inconclusive',
    signalId,
    message,
    evidence,
    recommendation
  };
}

function matchingElements(review, selector) {
  if (!selector) {
    return [];
  }
  return (review.evidenceSummary?.elements ?? []).filter((element) => element.selector === selector);
}

function candidateValuesForBinding(binding, elementMatches) {
  const candidates = [];
  for (const { review, element } of elementMatches) {
    if (binding.target === 'text') {
      for (const value of [element.text, element.accessible_name]) {
        if (value) {
          candidates.push({ value, viewport: review.viewport?.name ?? 'unknown' });
        }
      }
      continue;
    }
    if (binding.target === 'attribute') {
      const value = element.attributes?.[binding.attribute];
      if (value !== undefined && value !== null && value !== '') {
        candidates.push({ value, attribute: binding.attribute, viewport: review.viewport?.name ?? 'unknown' });
      }
      continue;
    }
    const attributeNames = binding.target === 'data-state'
      ? (binding.attribute ? [binding.attribute] : DEFAULT_STATE_ATTRIBUTES)
      : (binding.attribute ? [binding.attribute] : DEFAULT_RISK_ATTRIBUTES);
    for (const attribute of attributeNames) {
      const value = element.attributes?.[attribute];
      if (value !== undefined && value !== null && value !== '') {
        candidates.push({ value, attribute, viewport: review.viewport?.name ?? 'unknown' });
      }
    }
  }
  return candidates;
}

function signalIdForBindingTarget(target) {
  if (target === 'attribute') {
    return 'content_ux_source_attribute_not_matched';
  }
  if (target === 'data-state') {
    return 'content_ux_source_state_not_matched';
  }
  if (target === 'data-risk') {
    return 'content_ux_source_risk_not_matched';
  }
  return 'content_ux_source_text_not_visible';
}

function evaluateUserQuestions({ signals, counts, questions, reviews, page, source }) {
  for (const question of questions ?? []) {
    if (page && question.pageId && !questionAppliesToPage(question, page)) {
      continue;
    }
    counts.required_user_questions += 1;
    if (question.expectedEvidence.length === 0) {
      counts.user_questions_inconclusive += 1;
      addQuestionSignal(signals, question, page, {
        id: 'content_ux_user_question_evidence_missing',
        severity: question.required ? question.severity : 'info',
        confidence: 'high',
        message: `User question "${question.id}" has no expected evidence contract.`,
        evidence: { source, selector: question.selector, required: question.required },
        recommendation: 'Add expectedEvidence keywords that should be visible when this question can be answered from the reviewed page.'
      });
      continue;
    }
    const questionReviews = page ? reviews : reviews.filter((review) => !question.pageId || reviewMatchesQuestionPage(review, question));
    if (questionReviews.length === 0) {
      counts.user_questions_inconclusive += 1;
      addQuestionSignal(signals, question, page, {
        id: 'content_ux_user_question_page_not_reviewed',
        severity: question.required ? question.severity : 'info',
        confidence: 'high',
        message: `User question "${question.id}" could not be checked because no matching page was reviewed.`,
        evidence: { source, page_id: question.pageId, required: question.required },
        recommendation: 'Raise the route budget, add the page to expectedRoutes or pages, or split the manifest so this question is reviewed.'
      });
      continue;
    }
    const matched = questionEvidenceMatched(question, questionReviews);
    if (matched) {
      counts.user_questions_answered += 1;
    } else {
      counts.user_questions_unanswered += 1;
      addQuestionSignal(signals, question, page, {
        id: 'content_ux_user_question_not_answered',
        severity: question.severity,
        confidence: 'medium',
        message: `Required user question "${question.id}" was not supported by reviewed page evidence.`,
        evidence: {
          source,
          selector: question.selector,
          page_id: question.pageId,
          expected_evidence_count: question.expectedEvidence.length,
          match_mode: question.matchMode,
          reviewed_viewports: questionReviews.map((review) => review.viewport?.name ?? 'unknown'),
          reviewed_visible_text_lengths: questionReviews.map((review) => review.evidenceSummary?.visible_text_length ?? 0)
        },
        recommendation: 'Improve headings, summary copy, state labels, navigation cues, or detail links so the target user can answer this question from the page.'
      });
    }
  }
}

function questionAppliesToPage(question, page) {
  return !question.pageId || question.pageId === page.id || question.pageId === safeId(page.name, page.id);
}

function reviewMatchesQuestionPage(review, question) {
  return !question.pageId || question.pageId === review.manifest_page_id;
}

function questionEvidenceMatched(question, reviews) {
  const matches = question.expectedEvidence.map((expected) => reviews.some((review) => {
    const candidates = question.selector
      ? matchingElements(review, question.selector).flatMap((element) => [element.text, element.accessible_name])
      : [review.evidenceSummary?.visible_text];
    return candidates.some((candidate) => textMatched(candidate, expected, question.textMatch));
  }));
  return question.matchMode === 'all' ? matches.every(Boolean) : matches.some(Boolean);
}

function addSignal(signals, signal) {
  signals.push({
    confidence: 'medium',
    owner_decision_required: true,
    ...signal
  });
}

function addBindingSignal(signals, binding, page, signal) {
  addSignal(signals, {
    binding: {
      id: binding.id,
      source_id: binding.sourceId,
      pointer: binding.pointer,
      selector: binding.selector,
      target: binding.target,
      match: binding.match
    },
    page: pageReference(page),
    ...signal
  });
}

function addQuestionSignal(signals, question, page, signal) {
  addSignal(signals, {
    question: {
      id: question.id,
      text: question.question,
      page_id: question.pageId,
      selector: question.selector,
      expected_evidence_count: question.expectedEvidence.length,
      match_mode: question.matchMode
    },
    ...(page ? { page: pageReference(page) } : {}),
    ...signal
  });
}

function pageReference(page) {
  return {
    id: page.id,
    name: page.name,
    url: page.url,
    priority: page.priority
  };
}

function statusForSignals(signals) {
  if (signals.some((signal) => ['medium', 'high', 'critical'].includes(signal.severity))) {
    return 'needs_owner_review';
  }
  if (signals.length > 0) {
    return 'advisory_notes';
  }
  return 'passed';
}

function buildContentUxFindings(signals) {
  return signals.slice(0, CONTENT_UX_FINDING_LIMIT).map((signal, index) => redact({
    id: `content-ux-${index + 1}`,
    category: contentUxFindingCategory(signal),
    severity: signal.severity,
    confidence: signal.confidence,
    source: 'local_content_ux_advisory',
    signal_id: signal.id,
    page: signal.page ?? (signal.question?.page_id ? { id: signal.question.page_id } : null),
    selector: signal.binding?.selector ?? signal.question?.selector ?? signal.evidence?.selector ?? null,
    target: signal.binding?.target ?? signal.evidence?.target ?? null,
    message: signal.message,
    evidence: contentUxFindingEvidence(signal),
    recommendation: signal.recommendation,
    owner_decision_required: signal.owner_decision_required !== false,
    gate_effect: 'none'
  }));
}

function contentUxFindingCategory(signal) {
  if (signal.question) {
    const questionText = String(signal.question.text ?? '').toLowerCase();
    if (/\b(next|action|step|fix|resolve|run|start|continue|proceed|decision)\b/.test(questionText)) {
      return 'next_action_clarity';
    }
    if (/\b(where|navigate|navigation|route|page|detail|link|drill|open|find)\b/.test(questionText)) {
      return 'navigation_clarity';
    }
    return 'information_architecture';
  }
  if (signal.binding) {
    if (['data-state', 'data-risk'].includes(signal.binding.target)) {
      return 'workflow_state_clarity';
    }
    return 'content_contract';
  }
  if (signal.id?.includes('source')) {
    return 'source_data_alignment';
  }
  if (signal.id?.includes('page')) {
    return 'coverage_contract';
  }
  return 'review_scope';
}

function contentUxFindingEvidence(signal) {
  return compactObject({
    source_signal: signal.id,
    page_id: signal.page?.id ?? signal.question?.page_id ?? signal.evidence?.page_id ?? null,
    selector: signal.binding?.selector ?? signal.question?.selector ?? signal.evidence?.selector ?? null,
    target: signal.binding?.target ?? signal.evidence?.target ?? null,
    source_id: signal.binding?.source_id ?? signal.evidence?.source_id ?? null,
    pointer: signal.binding?.pointer ?? signal.evidence?.pointer ?? null,
    match: signal.binding?.match ?? signal.evidence?.match ?? null,
    match_mode: signal.question?.match_mode ?? signal.evidence?.match_mode ?? null,
    expected_evidence_count: signal.question?.expected_evidence_count ?? signal.evidence?.expected_evidence_count ?? null,
    candidate_count: signal.evidence?.candidate_count ?? null,
    reviewed_viewports: signal.evidence?.reviewed_viewports ?? [],
    local_only: true,
    external_evidence_transfer: false
  });
}

function buildContentUxActionPlan({ findings, counts, status, pageHandoff, manifestAuthoring }) {
  const nextActions = findings
    .slice()
    .sort(compareContentUxFindingPriority)
    .slice(0, 12)
    .map((finding) => compactObject({
      finding_id: finding.id,
      category: finding.category,
      severity: finding.severity,
      page_id: finding.page?.id ?? null,
      selector: finding.selector,
      owner_decision_required: finding.owner_decision_required,
      recommendation: finding.recommendation
    }));

  return {
    reviewer: 'local_content_ux_advisory',
    status: contentUxDecisionStatus(findings, status),
    advisory_only: true,
    gate_effect: 'none',
    legacy_action_plan_unchanged: true,
    total_action_items: findings.length,
    total_actionable_items: findings.filter((finding) => finding.owner_decision_required).length,
    focus_areas: [...new Set(findings.map((finding) => finding.category))],
    page_focus: (pageHandoff?.pages ?? [])
      .filter((page) => page.finding_count > 0)
      .slice(0, 8)
      .map((page) => ({
        page_id: page.page_id,
        status: page.status,
        finding_count: page.finding_count,
        top_categories: page.top_categories
      })),
    manifest_authoring_suggestions: manifestAuthoring?.suggestions?.length ?? 0,
    counts: {
      data_binding_mismatches: counts.data_binding_mismatches,
      data_binding_inconclusive: counts.data_binding_inconclusive,
      user_questions_unanswered: counts.user_questions_unanswered,
      user_questions_inconclusive: counts.user_questions_inconclusive,
      pages_without_content_contract: counts.pages_without_content_contract
    },
    next_actions: nextActions
  };
}

function buildContentUxReadiness({ findings, counts, status, pageHandoff }) {
  return {
    reviewer: 'local_content_ux_advisory',
    status: contentUxDecisionStatus(findings, status),
    advisory_only: true,
    gate_effect: 'none',
    legacy_release_readiness_unchanged: true,
    content_owner_review_required: findings.some((finding) => severityRank(finding.severity) >= SEVERITY_RANK.medium),
    advisory_findings: findings.length,
    blocking_release_gate: false,
    external_evidence_transfer: false,
    source_data: {
      declared: counts.source_data_declared,
      inline_available: counts.source_data_available,
      external_references_ignored: counts.source_data_external_references_ignored
    },
    page_handoff: {
      pages: pageHandoff?.summary?.pages ?? 0,
      pages_with_findings: pageHandoff?.summary?.pages_with_findings ?? 0,
      pages_needing_owner_review: pageHandoff?.summary?.pages_needing_owner_review ?? 0
    },
    counts: {
      data_binding_checks: counts.data_binding_checks,
      data_binding_mismatches: counts.data_binding_mismatches,
      required_user_questions: counts.required_user_questions,
      user_questions_unanswered: counts.user_questions_unanswered
    }
  };
}

function buildContentUxPageHandoff({ findings, target }) {
  const pageIndex = new Map((target?.pages ?? []).map((page) => [page.id, {
    page_id: page.id,
    name: page.name,
    url: page.url,
    priority: page.priority
  }]));
  const grouped = new Map();
  for (const page of pageIndex.values()) {
    grouped.set(page.page_id, { ...page, findings: [] });
  }
  for (const finding of findings) {
    const pageId = finding.page?.id ?? 'target';
    if (!grouped.has(pageId)) {
      grouped.set(pageId, {
        page_id: pageId,
        name: pageId === 'target' ? 'Target-wide advisory' : pageId,
        priority: 'medium',
        findings: []
      });
    }
    grouped.get(pageId).findings.push(finding);
  }

  const pages = [...grouped.values()].map((page) => {
    const pageFindings = page.findings.slice().sort(compareContentUxFindingPriority);
    const ownerReviewRequired = pageFindings.some((finding) => severityRank(finding.severity) >= SEVERITY_RANK.medium);
    return compactObject({
      page_id: page.page_id,
      name: page.name,
      url: page.url,
      priority: page.priority,
      status: ownerReviewRequired ? 'needs_content_owner_review' : pageFindings.length > 0 ? 'advisory_notes' : 'passed',
      finding_count: pageFindings.length,
      owner_review_required: ownerReviewRequired,
      top_categories: [...new Set(pageFindings.map((finding) => finding.category))].slice(0, 5),
      top_findings: pageFindings.slice(0, 6).map((finding) => compactObject({
        finding_id: finding.id,
        category: finding.category,
        severity: finding.severity,
        selector: finding.selector,
        recommendation: finding.recommendation
      }))
    });
  });

  return {
    reviewer: 'local_content_ux_advisory',
    status: pages.some((page) => page.status === 'needs_content_owner_review')
      ? 'needs_content_owner_review'
      : pages.some((page) => page.status === 'advisory_notes')
        ? 'advisory_notes'
        : 'passed',
    advisory_only: true,
    gate_effect: 'none',
    summary: {
      pages: pages.length,
      pages_with_findings: pages.filter((page) => page.finding_count > 0).length,
      pages_needing_owner_review: pages.filter((page) => page.owner_review_required).length
    },
    pages
  };
}

function buildContentUxManifestAuthoring({ config, target, counts, findings }) {
  const suggestions = [];
  const addSuggestion = (suggestion) => {
    suggestions.push({
      severity: 'info',
      owner_decision_required: false,
      gate_effect: 'none',
      ...suggestion
    });
  };

  if (!config.goal) {
    addSuggestion({
      id: 'content-ux-authoring-goal',
      type: 'declare_goal',
      severity: 'low',
      recommendation: 'Add localContentUxAdvisory.goal so content UX findings can be interpreted against the intended user outcome.'
    });
  }
  if (config.audience.length === 0) {
    addSuggestion({
      id: 'content-ux-authoring-audience',
      type: 'declare_audience',
      severity: 'low',
      recommendation: 'Add localContentUxAdvisory.audience so advisory output can distinguish beginner, operator, and maintainer comprehension needs.'
    });
  }
  if (counts.source_data_declared === 0 && (target?.pages ?? []).some((page) => page.expectations?.dataBindings?.length > 0)) {
    addSuggestion({
      id: 'content-ux-authoring-source-data',
      type: 'add_source_data',
      severity: 'medium',
      recommendation: 'Add bounded inline sourceData entries for declared dataBindings before relying on source-to-screen advisory.'
    });
  }
  if (counts.source_data_external_references_ignored > 0) {
    addSuggestion({
      id: 'content-ux-authoring-inline-source-data',
      type: 'inline_source_data',
      severity: 'medium',
      recommendation: 'Replace path or URL source references with bounded inline sourceData, or approve a separate loader design with security tests.'
    });
  }
  if (counts.pages_without_content_contract > 0) {
    addSuggestion({
      id: 'content-ux-authoring-page-contracts',
      type: 'add_page_data_bindings',
      severity: 'low',
      recommendation: 'Add page expectations.dataBindings for important facts, state labels, or risk indicators that must be represented on each reviewed page.'
    });
  }
  if (counts.required_user_questions === 0) {
    addSuggestion({
      id: 'content-ux-authoring-user-questions',
      type: 'add_user_questions',
      severity: 'low',
      recommendation: 'Add requiredUserQuestions or page userQuestions for the user decisions the reviewed page must support.'
    });
  }
  if (counts.user_questions_inconclusive > 0) {
    addSuggestion({
      id: 'content-ux-authoring-question-evidence',
      type: 'add_question_expected_evidence',
      severity: 'medium',
      recommendation: 'Add expectedEvidence to userQuestions so the advisory can distinguish unsupported copy from unconfigured questions.'
    });
  }
  if (counts.data_binding_inconclusive > 0) {
    addSuggestion({
      id: 'content-ux-authoring-binding-pointers',
      type: 'fix_binding_sources',
      severity: 'medium',
      recommendation: 'Review sourceData IDs, JSON Pointers, selectors, and binding targets for inconclusive content contracts.'
    });
  }
  if (findings.some((finding) => finding.category === 'next_action_clarity')) {
    addSuggestion({
      id: 'content-ux-authoring-next-actions',
      type: 'strengthen_next_action_contracts',
      severity: 'medium',
      recommendation: 'Pin next-action questions or selector-scoped calls to action in page expectations so the review can track whether users know what to do next.'
    });
  }
  if (findings.some((finding) => finding.category === 'navigation_clarity')) {
    addSuggestion({
      id: 'content-ux-authoring-navigation',
      type: 'strengthen_navigation_contracts',
      severity: 'medium',
      recommendation: 'Pin route, detail-link, or drill-down questions in page expectations so the review can track whether users can move naturally through the workflow.'
    });
  }

  return {
    reviewer: 'local_content_ux_advisory',
    status: suggestions.some((suggestion) => severityRank(suggestion.severity) >= SEVERITY_RANK.medium)
      ? 'manifest_authoring_recommended'
      : suggestions.length > 0
        ? 'advisory_notes'
        : 'passed',
    advisory_only: true,
    gate_effect: 'none',
    external_evidence_transfer: false,
    suggestions,
    suggested_manifest_sections: [...new Set(suggestions.map((suggestion) => suggestion.type))]
  };
}

function contentUxDecisionStatus(findings, fallbackStatus) {
  if (findings.some((finding) => severityRank(finding.severity) >= SEVERITY_RANK.medium)) {
    return 'needs_content_owner_review';
  }
  if (findings.length > 0) {
    return 'advisory_notes';
  }
  return fallbackStatus === 'passed' ? 'passed' : 'advisory_notes';
}

function compareContentUxFindingPriority(left, right) {
  const severityDelta = severityRank(right.severity) - severityRank(left.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return left.id.localeCompare(right.id);
}

function severityRank(severity) {
  return SEVERITY_RANK[severity] ?? SEVERITY_RANK.info;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined && nested !== null));
}

function safeJson(value) {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}
