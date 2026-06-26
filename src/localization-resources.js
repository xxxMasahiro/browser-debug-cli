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
  reportKey('report.label.release_readiness', 'Release readiness', 'label')
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
  return {
    locale: normalized,
    intl_locale: getTraceCueIntlLocale(normalized),
    text_direction: getTraceCueLocaleDirection(normalized),
    status: baseline ? 'baseline' : 'stub-falls-back-to-baseline',
    needs_human_review: !baseline,
    templates: REPORT_TEMPLATE_KEYS.map((item) => ({
      key: item.key,
      role: item.role,
      text: item.defaultText,
      baseline_text: item.defaultText,
      fallback_locale: baseline ? null : BASELINE_LOCALE,
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
    output_text: locale === BASELINE_LOCALE ? item.defaultText : `[${locale}] ${item.defaultText}`,
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
