import { redact, truncateText } from './redaction.js';

const DEFAULT_MAX_SOURCE_BYTES = 32768;
const SIGNAL_LIMIT = 80;
const SUPPORTED_BINDING_TARGETS = new Set(['text', 'attribute', 'data-state', 'data-risk']);
const KNOWN_BINDING_TARGETS = SUPPORTED_BINDING_TARGETS;
const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
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
    signals: signals.slice(0, SIGNAL_LIMIT),
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
      'This advisory is manifest opt-in and does not change findings, metrics, action plans, or release gates.',
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
