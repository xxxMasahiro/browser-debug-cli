import { SCHEMA_VERSION } from './constants.js';
import {
  TRACE_CUE_LOCALE_CODES,
  getTraceCueIntlLocale,
  getTraceCueLocaleDirection,
  normalizeTraceCueLocale
} from './locale-policy.js';
import { languageSettingsBoundary, resolveLanguageSettings } from './language-settings.js';

export const LOCALIZATION_RESOURCES_VERSION = '1.0.0';
export const REPORT_TEMPLATES_VERSION = '1.0.0';
export const TRANSLATION_READINESS_VERSION = '1.0.0';

const BASELINE_LOCALE = 'en';

const UI_RESOURCE_KEYS = Object.freeze([
  uiKey('dashboard.status.ready', 'Ready', 'status_label'),
  uiKey('dashboard.status.needs_attention', 'Needs attention', 'status_label'),
  uiKey('dashboard.action.open_report', 'Open report', 'command_label'),
  uiKey('dashboard.section.resources', 'Resources', 'section_label'),
  uiKey('dashboard.section.agent_activity', 'Agent activity', 'section_label'),
  uiKey('dashboard.section.capture', 'Capture readiness', 'section_label'),
  uiKey('dashboard.empty.no_items', 'No items', 'empty_state')
]);

const REPORT_TEMPLATE_KEYS = Object.freeze([
  reportKey('report.title.review_summary', 'Review summary', 'heading'),
  reportKey('report.section.findings', 'Findings', 'heading'),
  reportKey('report.section.action_plan', 'Action plan', 'heading'),
  reportKey('report.section.quality_signals', 'Quality signals', 'heading'),
  reportKey('report.label.generated_at', 'Generated at', 'label'),
  reportKey('report.label.release_readiness', 'Release readiness', 'label'),
  reportKey('report.ahr.title', 'Agentic Human Review', 'heading'),
  reportKey('report.ahr.label.status', 'Status', 'label'),
  reportKey('report.ahr.label.plan', 'Plan', 'label'),
  reportKey('report.ahr.section.plain_language_review', 'Plain-Language Review', 'heading'),
  reportKey('report.ahr.section.likely_first_impression', 'Likely First Impression', 'heading'),
  reportKey('report.ahr.section.viewer_feeling_comprehension', 'Viewer Feeling And Comprehension', 'heading'),
  reportKey('report.ahr.section.content_trust', 'Content And Trust', 'heading'),
  reportKey('report.ahr.section.human_report', 'Human Report V3', 'heading'),
  reportKey('report.ahr.label.priority_fix', 'Priority fix', 'label'),
  reportKey('report.ahr.value.owner_review_required', 'owner review required', 'value'),
  reportKey('report.ahr.bullet.works', 'Works', 'label'),
  reportKey('report.ahr.bullet.lost_value', 'Lost value', 'label'),
  reportKey('report.ahr.section.editorial_synthesis', 'Editorial Synthesis', 'heading'),
  reportKey('report.ahr.section.language_settings', 'Language Settings', 'heading'),
  reportKey('report.ahr.label.editorial_synthesis_language', 'Editorial synthesis language', 'label'),
  reportKey('report.ahr.label.language_source', 'Language source', 'label'),
  reportKey('report.ahr.label.artifact_output_language', 'Artifact output language', 'label'),
  reportKey('report.ahr.label.artifact_language_mode', 'Artifact language mode', 'label'),
  reportKey('report.ahr.label.text_direction', 'Text direction', 'label'),
  reportKey('report.ahr.label.translation_mode', 'Translation mode', 'label'),
  reportKey('report.ahr.label.translation_execution', 'Translation execution', 'label'),
  reportKey('report.ahr.label.source_text_preserved', 'Source text preserved', 'label'),
  reportKey('report.ahr.label.evidence_scope', 'Evidence scope', 'label'),
  reportKey('report.ahr.section.key_tensions', 'Key Tensions', 'heading'),
  reportKey('report.ahr.section.recommended_direction', 'Recommended Direction', 'heading'),
  reportKey('report.ahr.section.source_findings', 'Source Findings', 'heading'),
  reportKey('report.ahr.section.mechanical_vs_human', 'Mechanical Review Compared With Human Review', 'heading'),
  reportKey('report.ahr.section.role_opinions', 'Role Opinions', 'heading'),
  reportKey('report.ahr.section.evidence_claims', 'Evidence Claims', 'heading'),
  reportKey('report.ahr.section.consensus', 'Consensus', 'heading'),
  reportKey('report.ahr.section.dissent_uncertainty', 'Dissent And Uncertainty', 'heading'),
  reportKey('report.ahr.section.suggested_fixes', 'Suggested Fixes', 'heading'),
  reportKey('report.ahr.section.owner_decisions', 'Owner Decisions', 'heading'),
  reportKey('report.ahr.section.report_quality', 'Report Quality', 'heading'),
  reportKey('report.ahr.label.completeness', 'Completeness', 'label'),
  reportKey('report.ahr.label.evidence_coverage', 'Evidence coverage', 'label'),
  reportKey('report.ahr.label.verification_coverage', 'Verification coverage', 'label'),
  reportKey('report.ahr.label.human_review_coverage', 'Human-review coverage', 'label'),
  reportKey('report.ahr.label.actionability', 'Actionability', 'label'),
  reportKey('report.ahr.label.evaluator', 'Evaluator', 'label'),
  reportKey('report.ahr.section.quality_evaluation', 'Quality Evaluation', 'heading'),
  reportKey('report.ahr.label.calibration_readiness', 'Calibration readiness', 'label'),
  reportKey('report.ahr.label.human_likeness', 'Human likeness', 'label'),
  reportKey('report.ahr.label.content_reading', 'Content reading', 'label'),
  reportKey('report.ahr.label.sensibility', 'Sensibility', 'label'),
  reportKey('report.ahr.label.role_coverage', 'Role coverage', 'label'),
  reportKey('report.ahr.label.weak_claims', 'Weak claims', 'label'),
  reportKey('report.ahr.section.calibration_privacy', 'Calibration And Privacy', 'heading'),
  reportKey('report.ahr.label.benchmark_case', 'Benchmark case', 'label'),
  reportKey('report.ahr.label.rubric_profile', 'Rubric profile', 'label'),
  reportKey('report.ahr.label.raw_provider_response_stored', 'Raw provider response stored', 'label'),
  reportKey('report.ahr.label.raw_pixel_json', 'Raw pixel bytes embedded in JSON', 'label'),
  reportKey('report.ahr.section.boundary', 'Boundary', 'heading'),
  reportKey('report.ahr.boundary.advisory_only', 'Advisory-only result.', 'sentence'),
  reportKey('report.ahr.boundary.deterministic_unchanged', 'Deterministic findings, metrics, release gates, and existing review artifacts are unchanged.', 'sentence'),
  reportKey('report.ahr.boundary.no_raw_provider_or_credentials', 'Raw provider responses and credential values are not stored.', 'sentence'),
  reportKey('report.ahr.editorial.scope.page_only', 'This synthesis is based on page evidence only; no separate video evidence summary was supplied.', 'sentence'),
  reportKey('report.ahr.editorial.scope.video_insufficient', 'A video evidence artifact was supplied, but it did not contain enough metadata summary to support video-content review.', 'sentence'),
  reportKey('report.ahr.editorial.scope.page_and_video', 'This synthesis can use both page evidence and supplied video-evidence summaries, but it does not embed or inspect raw video, audio, frames, or full transcripts.', 'sentence'),
  reportKey('report.ahr.editorial.fallback.recommended_direction', 'Review the advisory output with the owner before implementation.', 'sentence'),
  reportKey('report.ahr.editorial.fallback.no_owner_decision', 'No explicit owner decision was requested by the existing advisory output.', 'sentence'),
  reportKey('report.ahr.editorial.fallback.owner_review_needed', 'The existing advisory result needs owner review before product decisions are made.', 'sentence'),
  reportKey('report.ahr.editorial.limitation.sparse_input', 'The existing AHR result has too few evidence-backed findings or reported role opinions for a fuller editorial review.', 'sentence'),
  reportKey('report.ahr.editorial.limitation.unresolved_language', 'The artifact output language was unresolved, so the editorial synthesis used the local source-text language fallback.', 'sentence'),
  reportKey('report.ahr.editorial.limitation.source_preserved', 'The selected artifact output language was recorded from local language settings, but source advisory text was preserved because translation execution is disabled.', 'sentence')
]);

const RAW_EVIDENCE_FIELDS = Object.freeze([
  'url',
  'selector',
  'page_text',
  'accessible_name',
  'console_message',
  'network_url',
  'trace_path',
  'screenshot_path',
  'provider_output'
]);

const REPORT_TEMPLATE_TRANSLATIONS = Object.freeze({
  ja: Object.freeze({
    'report.ahr.title': 'エージェント人間レビュー',
    'report.ahr.label.status': 'ステータス',
    'report.ahr.label.plan': '計画',
    'report.ahr.section.plain_language_review': '平易なレビュー',
    'report.ahr.section.likely_first_impression': '想定される第一印象',
    'report.ahr.section.viewer_feeling_comprehension': '視聴者の感情と理解',
    'report.ahr.section.content_trust': '内容と信頼',
    'report.ahr.section.human_report': '人間向けレポート V3',
    'report.ahr.label.priority_fix': '優先修正',
    'report.ahr.value.owner_review_required': 'オーナーレビューが必要',
    'report.ahr.bullet.works': '機能している点',
    'report.ahr.bullet.lost_value': '伝わりにくい価値',
    'report.ahr.section.editorial_synthesis': '統括レビュー',
    'report.ahr.section.language_settings': '言語設定',
    'report.ahr.label.editorial_synthesis_language': '統括レビューの言語',
    'report.ahr.label.language_source': '言語の根拠',
    'report.ahr.label.artifact_output_language': '成果物出力言語',
    'report.ahr.label.artifact_language_mode': '成果物言語モード',
    'report.ahr.label.text_direction': '文字方向',
    'report.ahr.label.translation_mode': '翻訳モード',
    'report.ahr.label.translation_execution': '翻訳実行',
    'report.ahr.label.source_text_preserved': '原文保持',
    'report.ahr.label.evidence_scope': '証拠スコープ',
    'report.ahr.section.key_tensions': '主な揺れ',
    'report.ahr.section.recommended_direction': '推奨方針',
    'report.ahr.section.source_findings': '参照元所見',
    'report.ahr.section.mechanical_vs_human': '機械レビューと人間レビューの比較',
    'report.ahr.section.role_opinions': 'ロール別意見',
    'report.ahr.section.evidence_claims': '証拠付き主張',
    'report.ahr.section.consensus': '合意点',
    'report.ahr.section.dissent_uncertainty': '反対意見と不確実性',
    'report.ahr.section.suggested_fixes': '改善提案',
    'report.ahr.section.owner_decisions': 'オーナー判断',
    'report.ahr.section.report_quality': 'レポート品質',
    'report.ahr.label.completeness': '完全性',
    'report.ahr.label.evidence_coverage': '証拠カバレッジ',
    'report.ahr.label.verification_coverage': '検証カバレッジ',
    'report.ahr.label.human_review_coverage': '人間レビュー観点カバレッジ',
    'report.ahr.label.actionability': '実行可能性',
    'report.ahr.label.evaluator': '評価器',
    'report.ahr.section.quality_evaluation': '品質評価',
    'report.ahr.label.calibration_readiness': 'キャリブレーション準備度',
    'report.ahr.label.human_likeness': '人間らしさ',
    'report.ahr.label.content_reading': '内容読解',
    'report.ahr.label.sensibility': '感覚面の妥当性',
    'report.ahr.label.role_coverage': 'ロールカバレッジ',
    'report.ahr.label.weak_claims': '弱い主張',
    'report.ahr.section.calibration_privacy': 'キャリブレーションとプライバシー',
    'report.ahr.label.benchmark_case': 'ベンチマークケース',
    'report.ahr.label.rubric_profile': 'ルーブリックプロファイル',
    'report.ahr.label.raw_provider_response_stored': '生プロバイダ応答の保存',
    'report.ahr.label.raw_pixel_json': 'JSON 内の生ピクセルバイト',
    'report.ahr.section.boundary': '境界',
    'report.ahr.boundary.advisory_only': '助言専用の結果です。',
    'report.ahr.boundary.deterministic_unchanged': '決定論的所見、メトリクス、リリースゲート、既存レビュー成果物は変更されていません。',
    'report.ahr.boundary.no_raw_provider_or_credentials': '生プロバイダ応答と認証情報の値は保存されていません。',
    'report.ahr.editorial.scope.page_only': 'この統括レビューはページ証拠のみに基づきます。独立した動画証拠サマリーは提供されていません。',
    'report.ahr.editorial.scope.video_insufficient': '動画証拠成果物は提供されましたが、動画内容レビューを支える十分なメタデータ要約が含まれていません。',
    'report.ahr.editorial.scope.page_and_video': 'この統括レビューはページ証拠と提供された動画証拠サマリーの両方を使用できます。ただし、生動画、音声、フレーム、全文文字起こしは埋め込まず、検査もしません。',
    'report.ahr.editorial.fallback.recommended_direction': '実装前に、この助言出力をオーナーと確認してください。',
    'report.ahr.editorial.fallback.no_owner_decision': '既存の助言出力では、明示的なオーナー判断は要求されていません。',
    'report.ahr.editorial.fallback.owner_review_needed': '既存の助言結果は、製品判断の前にオーナーレビューが必要です。',
    'report.ahr.editorial.limitation.sparse_input': '既存の AHR 結果には、より深い統括レビューに必要な証拠付き所見またはロール別意見が不足しています。',
    'report.ahr.editorial.limitation.unresolved_language': '成果物出力言語が解決できなかったため、統括レビューはローカルの原文言語推定を使用しました。',
    'report.ahr.editorial.limitation.source_preserved': '選択された成果物出力言語はローカル言語設定から記録されていますが、翻訳実行が無効なため、元の助言本文は保持されています。'
  })
});

export async function runLocalizationResources(options = {}, context = {}) {
  const report = buildLocalizationResources(options, context);
  return localizationResult('localization_resources', report);
}

export async function runReportTemplates(options = {}, context = {}) {
  const report = buildReportTemplates(options, context);
  return localizationResult('report_templates', report);
}

export async function runTranslationReadiness(options = {}, context = {}) {
  const report = await buildTranslationReadiness(options, context);
  return localizationResult('translation_readiness', report);
}

export async function runTranslationDryRun(options = {}, context = {}) {
  const report = await buildTranslationDryRun(options, context);
  return localizationResult('translation_dry_run', report);
}

export function buildLocalizationResources(options = {}, context = {}) {
  const now = materializeNow(context.now ?? options.now);
  const locale = normalizeTraceCueLocale(options.locale ?? options['ui-locale'] ?? BASELINE_LOCALE);
  const locales = TRACE_CUE_LOCALE_CODES.map((code) => localeResource(code));
  return {
    schema_version: SCHEMA_VERSION,
    resources_version: LOCALIZATION_RESOURCES_VERSION,
    generated_at: now.toISOString(),
    locale_selection: locale,
    baseline_locale: BASELINE_LOCALE,
    supported_locale_count: TRACE_CUE_LOCALE_CODES.length,
    key_inventory: UI_RESOURCE_KEYS.map(publicUiKey),
    selected_resource: localeResource(locale),
    locale_resources: locales,
    fallback: fallbackPolicy(locale),
    rtl_layout_guard: rtlLayoutGuard(locale),
    raw_evidence_policy: rawEvidencePolicy(),
    boundary: localizationBoundary(),
    next_steps: [
      'Use these resources for dashboard chrome only.',
      'Keep source evidence, canonical enums, selectors, URLs, logs, traces, screenshots, and provider output outside UI localization resources.'
    ]
  };
}

export function buildReportTemplates(options = {}, context = {}) {
  const now = materializeNow(context.now ?? options.now);
  const locale = normalizeTraceCueLocale(options.locale ?? options['artifact-locale'] ?? BASELINE_LOCALE);
  return {
    schema_version: SCHEMA_VERSION,
    templates_version: REPORT_TEMPLATES_VERSION,
    generated_at: now.toISOString(),
    locale_selection: locale,
    baseline_locale: BASELINE_LOCALE,
    supported_locale_count: TRACE_CUE_LOCALE_CODES.length,
    template_inventory: REPORT_TEMPLATE_KEYS.map(publicReportKey),
    selected_templates: reportTemplateResource(locale),
    locale_templates: TRACE_CUE_LOCALE_CODES.map((code) => reportTemplateResource(code)),
    fallback: fallbackPolicy(locale),
    raw_evidence_policy: rawEvidencePolicy(),
    rendering_contract: {
      generated_chrome_translatable: true,
      raw_evidence_interpolation_translatable: false,
      canonical_enum_translation_allowed: false,
      missing_locale_falls_back_to_baseline: true,
      rendered_report_writer_enabled: false
    },
    boundary: localizationBoundary(),
    next_steps: [
      'Render generated report chrome from templates only after the selected artifact language resolves.',
      'Interpolate raw evidence as escaped source text without translating or rewriting it.'
    ]
  };
}

export function resolveReportTemplateText(key, locale = BASELINE_LOCALE, fallbackText = '') {
  const normalized = normalizeTraceCueLocale(locale ?? BASELINE_LOCALE);
  const baseline = REPORT_TEMPLATE_KEYS.find((item) => item.key === key)?.defaultText ?? fallbackText ?? '';
  return REPORT_TEMPLATE_TRANSLATIONS[normalized]?.[key]
    ?? REPORT_TEMPLATE_TRANSLATIONS[BASELINE_LOCALE]?.[key]
    ?? baseline;
}

export async function buildTranslationReadiness(options = {}, context = {}) {
  const now = materializeNow(context.now ?? options.now);
  const settings = await resolveLanguageSettings(options, context);
  const locale = normalizeTraceCueLocale(options.locale ?? settings.settings?.artifact_output?.language ?? BASELINE_LOCALE);
  return {
    schema_version: SCHEMA_VERSION,
    readiness_version: TRANSLATION_READINESS_VERSION,
    generated_at: now.toISOString(),
    locale_selection: locale,
    settings: settings.ok ? {
      dashboard_ui: settings.settings.dashboard_ui,
      artifact_output: settings.settings.artifact_output,
      boundary: settings.settings.boundary
    } : null,
    provider_policy: {
      dry_run_available: true,
      deterministic_fake_available: true,
      api_provider_available_without_injected_transport: false,
      live_provider_execution_available: false,
      mcp_admin_translation_execute_available: false,
      credentials_source: 'environment_names_only_for_future_api_provider',
      credential_values_read: false,
      external_sending_enabled: false
    },
    disclosure_plan: {
      allowed_text_classes: ['generated_ui_chrome', 'generated_report_template_chrome'],
      disallowed_text_classes: [...RAW_EVIDENCE_FIELDS],
      raw_evidence_translated: false,
      raw_evidence_sent_to_provider: false,
      canonical_enums_translated: false
    },
    dry_run_preview: dryRunItems(locale),
    boundary: translationBoundary({ dryRun: false }),
    next_steps: [
      'Use translation dry-run to inspect generated chrome only.',
      'Keep provider/API translation execution unavailable until a separate approval defines token, receipt, and disclosure gates.'
    ]
  };
}

export async function buildTranslationDryRun(options = {}, context = {}) {
  const now = materializeNow(context.now ?? options.now);
  const locale = normalizeTraceCueLocale(options.locale ?? options['artifact-locale'] ?? BASELINE_LOCALE);
  const provider = String(options.provider ?? 'fake').trim() || 'fake';
  if (provider !== 'fake') {
    return {
      schema_version: SCHEMA_VERSION,
      dry_run_version: TRANSLATION_READINESS_VERSION,
      generated_at: now.toISOString(),
      locale_selection: locale,
      provider,
      status: 'provider_not_available',
      items: [],
      raw_evidence_policy: rawEvidencePolicy(),
      boundary: translationBoundary({ dryRun: false }),
      error: {
        code: 'TRANSLATION_PROVIDER_NOT_AVAILABLE',
        message: 'Only deterministic fake translation dry-run is available without provider approval.'
      }
    };
  }
  return {
    schema_version: SCHEMA_VERSION,
    dry_run_version: TRANSLATION_READINESS_VERSION,
    generated_at: now.toISOString(),
    locale_selection: locale,
    provider,
    status: 'dry_run_only',
    items: dryRunItems(locale),
    raw_evidence_policy: rawEvidencePolicy(),
    boundary: translationBoundary({ dryRun: true }),
    note: 'Dry-run output is deterministic placeholder text for generated chrome only; it is not provider translation.'
  };
}

export function localizationBoundary() {
  return {
    ...languageSettingsBoundary(),
    read_only: true,
    resource_resolver_enabled: true,
    locale_resource_files_written: false,
    report_template_files_written: false,
    raw_evidence_translated: false,
    canonical_enums_translated: false,
    provider_call_performed: false,
    translation_execution_performed: false,
    external_upload: false,
    mcp_write_execute_exposed: false
  };
}

export function translationBoundary({ dryRun }) {
  return {
    ...languageSettingsBoundary(),
    read_only: true,
    dry_run_only: Boolean(dryRun),
    fake_translation_generated: Boolean(dryRun),
    translation_execution_performed: false,
    provider_call_performed: false,
    api_call_performed: false,
    credential_values_read: false,
    credential_values_recorded: false,
    raw_evidence_translated: false,
    raw_evidence_sent_to_provider: false,
    canonical_enums_translated: false,
    external_upload: false,
    artifacts_written: false,
    mcp_write_execute_exposed: false
  };
}

function localeResource(locale) {
  const normalized = normalizeTraceCueLocale(locale);
  const baseline = normalized === BASELINE_LOCALE;
  return {
    locale: normalized,
    intl_locale: getTraceCueIntlLocale(normalized),
    text_direction: getTraceCueLocaleDirection(normalized),
    status: baseline ? 'baseline' : 'stub-falls-back-to-baseline',
    needs_human_review: !baseline,
    entries: UI_RESOURCE_KEYS.map((item) => ({
      key: item.key,
      role: item.role,
      text: item.defaultText,
      baseline_text: item.defaultText,
      fallback_locale: baseline ? null : BASELINE_LOCALE,
      raw_evidence: false
    }))
  };
}

function reportTemplateResource(locale) {
  const normalized = normalizeTraceCueLocale(locale);
  const baseline = normalized === BASELINE_LOCALE;
  const translations = REPORT_TEMPLATE_TRANSLATIONS[normalized] ?? {};
  const translatedCount = REPORT_TEMPLATE_KEYS.filter((item) => translations[item.key]).length;
  return {
    locale: normalized,
    intl_locale: getTraceCueIntlLocale(normalized),
    text_direction: getTraceCueLocaleDirection(normalized),
    status: baseline ? 'baseline' : translatedCount > 0 ? 'localized-partial-with-baseline-fallback' : 'stub-falls-back-to-baseline',
    needs_human_review: !baseline && translatedCount < REPORT_TEMPLATE_KEYS.length,
    templates: REPORT_TEMPLATE_KEYS.map((item) => ({
      key: item.key,
      role: item.role,
      text: resolveReportTemplateText(item.key, normalized, item.defaultText),
      baseline_text: item.defaultText,
      fallback_locale: baseline || translations[item.key] ? null : BASELINE_LOCALE,
      translatable_generated_chrome: true,
      raw_evidence: false
    }))
  };
}

function dryRunItems(locale) {
  const normalized = normalizeTraceCueLocale(locale);
  return [
    ...UI_RESOURCE_KEYS.map((item) => dryRunItem('ui', item, normalized)),
    ...REPORT_TEMPLATE_KEYS.map((item) => dryRunItem('report', item, normalized))
  ];
}

function dryRunItem(kind, item, locale) {
  return {
    kind,
    key: item.key,
    source_locale: BASELINE_LOCALE,
    target_locale: locale,
    source_text: item.defaultText,
    output_text: kind === 'report'
      ? resolveReportTemplateText(item.key, locale, item.defaultText)
      : (locale === BASELINE_LOCALE ? item.defaultText : `[${locale}] ${item.defaultText}`),
    raw_evidence: false,
    provider_call_performed: false
  };
}

function fallbackPolicy(locale) {
  const normalized = normalizeTraceCueLocale(locale);
  return {
    selected_locale: normalized,
    baseline_locale: BASELINE_LOCALE,
    fallback_chain: normalized === BASELINE_LOCALE ? [BASELINE_LOCALE] : [normalized, BASELINE_LOCALE],
    missing_key_behavior: 'fallback-to-baseline-key',
    missing_locale_behavior: 'fallback-to-baseline-locale'
  };
}

function rtlLayoutGuard(locale) {
  const normalized = normalizeTraceCueLocale(locale);
  return {
    locale: normalized,
    text_direction: getTraceCueLocaleDirection(normalized),
    direction_attribute_required: true,
    logical_css_required: getTraceCueLocaleDirection(normalized) === 'rtl',
    fixed_viewport_font_scaling_allowed: false
  };
}

function rawEvidencePolicy() {
  return {
    translated: false,
    sent_to_provider: false,
    fields: [...RAW_EVIDENCE_FIELDS],
    treatment: 'preserve-as-source-evidence'
  };
}

function publicUiKey(item) {
  return {
    key: item.key,
    role: item.role,
    baseline_locale: BASELINE_LOCALE,
    baseline_text: item.defaultText,
    raw_evidence: false
  };
}

function publicReportKey(item) {
  return {
    key: item.key,
    role: item.role,
    baseline_locale: BASELINE_LOCALE,
    baseline_text: item.defaultText,
    raw_evidence: false
  };
}

function uiKey(key, defaultText, role) {
  return Object.freeze({ key, defaultText, role });
}

function reportKey(key, defaultText, role) {
  return Object.freeze({ key, defaultText, role });
}

function localizationResult(key, report) {
  if (report?.error) {
    return {
      status: 'error',
      data: {
        [key]: report,
        boundary: report.boundary
      },
      warnings: [],
      errors: [report.error],
      artifacts: []
    };
  }
  return {
    status: 'ok',
    data: {
      [key]: report,
      boundary: report.boundary
    },
    warnings: [],
    errors: [],
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
