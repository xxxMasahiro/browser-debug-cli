import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from './constants.js';
import {
  TRACE_CUE_LOCALE_CODES,
  TRACE_CUE_LOCALE_POLICY,
  getTraceCueIntlLocale,
  getTraceCueLocaleDirection,
  normalizeTraceCueLocale
} from './locale-policy.js';
import { PRODUCT_IDENTITY } from './product-identity.js';
import { redact } from './redaction.js';

export const LANGUAGE_SETTINGS_SCHEMA_VERSION = '1.0.0';
export const DASHBOARD_SETTINGS_PATH = 'ops/DASHBOARD_SETTINGS.json';
export const DEFAULT_DASHBOARD_UI_LOCALE = 'en';
export const DEFAULT_SOURCE_LANGUAGE = 'auto';
export const DEFAULT_OUTPUT_LANGUAGE_MODE = 'source';
export const DEFAULT_TRANSLATION_MODE = 'none';
export const OUTPUT_LANGUAGE_MODES = Object.freeze(['source', 'ui', 'explicit']);
export const IMPLEMENTED_TRANSLATION_MODES = Object.freeze([DEFAULT_TRANSLATION_MODE]);
export const RESERVED_TRANSLATION_MODES = Object.freeze(['manual-reviewed', 'provider-derived']);

export function languageSettingsBoundary() {
  return {
    local_only: true,
    read_only: true,
    settings_write_enabled: false,
    dashboard_display_language_changed: false,
    artifact_content_language_changed: false,
    source_evidence_language_changed: false,
    translation_execution_enabled: false,
    provider_dispatch_enabled: false,
    external_sending_enabled: false,
    shell_execution_enabled: false,
    browser_execution_enabled: false,
    mcp_write_execute_exposed: false,
    mcp_permissions_changed: false,
    gate_effect: 'none'
  };
}

export function buildLanguageSettingsPolicyContract() {
  return {
    schema_version: LANGUAGE_SETTINGS_SCHEMA_VERSION,
    runtime_schema_version: SCHEMA_VERSION,
    kind: 'language-settings-policy',
    product_identity: {
      package_name: PRODUCT_IDENTITY.packageName,
      display_name: PRODUCT_IDENTITY.displayName
    },
    settings_path: DASHBOARD_SETTINGS_PATH,
    locale_authority: {
      supported_locale_count: TRACE_CUE_LOCALE_CODES.length,
      supported_locale_codes: [...TRACE_CUE_LOCALE_CODES],
      supported_locales: TRACE_CUE_LOCALE_POLICY.map((locale) => ({
        code: locale.code,
        aliases: [...locale.aliases],
        intl_locale: locale.intlLocale,
        direction: locale.direction,
        native_name: locale.nativeName,
        english_name: locale.englishName
      }))
    },
    roles: [
      {
        id: 'dashboard_ui_locale',
        applies_to: ['dashboard_chrome', 'local_status_surfaces'],
        must_not_drive: ['source_evidence_language', 'artifact_content_language', 'provider_dispatch']
      },
      {
        id: 'source_language',
        applies_to: ['observed_page_language', 'input_evidence_language', 'caller_declared_source_language'],
        must_not_drive: ['dashboard_chrome', 'provider_dispatch']
      },
      {
        id: 'artifact_language',
        applies_to: ['generated_report_metadata', 'generated_artifact_metadata', 'future_local_report_templates'],
        must_not_drive: ['dashboard_chrome', 'source_evidence_language', 'release_gates']
      },
      {
        id: 'translation_mode',
        applies_to: ['future_explicit_translation_boundary'],
        must_not_drive: ['provider_dispatch', 'external_send', 'raw_body_forwarding', 'mcp_execution']
      }
    ],
    defaults: {
      ui_locale: DEFAULT_DASHBOARD_UI_LOCALE,
      source_language: DEFAULT_SOURCE_LANGUAGE,
      output_language_mode: DEFAULT_OUTPUT_LANGUAGE_MODE,
      translation_mode: DEFAULT_TRANSLATION_MODE
    },
    output_language_modes: [...OUTPUT_LANGUAGE_MODES],
    implemented_translation_modes: [...IMPLEMENTED_TRANSLATION_MODES],
    reserved_translation_modes: [...RESERVED_TRANSLATION_MODES],
    boundary: languageSettingsBoundary(),
    body_included: false,
    summary_only: true
  };
}

export async function runLanguageSettingsPolicy() {
  const policy = buildLanguageSettingsPolicyContract();
  return {
    status: 'ok',
    data: {
      language_settings_policy: policy,
      boundary: policy.boundary
    },
    warnings: [],
    errors: [],
    artifacts: []
  };
}

export async function runLanguageSettings(options = {}, context = {}) {
  const resolved = await resolveLanguageSettings(options, context);
  if (!resolved.ok) {
    return settingsError(resolved);
  }
  return {
    status: 'ok',
    data: {
      language_settings: resolved.settings,
      boundary: resolved.settings.boundary
    },
    warnings: resolved.warnings,
    errors: [],
    artifacts: []
  };
}

export async function runSettingsShow(options = {}, context = {}) {
  const resolved = await resolveLanguageSettings(options, context);
  if (!resolved.ok) {
    return settingsError(resolved);
  }
  return {
    status: 'ok',
    data: {
      dashboard_settings: {
        schema_version: LANGUAGE_SETTINGS_SCHEMA_VERSION,
        kind: 'dashboard-settings-summary',
        settings_path: resolved.settings.settings_path,
        storage_status: resolved.settings.storage.status,
        language_settings: resolved.settings,
        safety: resolved.settings.safety,
        boundary: resolved.settings.boundary
      },
      boundary: resolved.settings.boundary
    },
    warnings: resolved.warnings,
    errors: [],
    artifacts: []
  };
}

export async function resolveLanguageSettings(options = {}, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const requestedPath = options.settings || DASHBOARD_SETTINGS_PATH;
  const settingsInput = await readSettingsInput(cwd, requestedPath, requestedPath === DASHBOARD_SETTINGS_PATH);
  if (!settingsInput.ok) {
    return settingsInput;
  }
  const normalized = normalizeLanguageSettings(settingsInput.settings, {
    uiLocale: options['ui-locale'] ?? options.uiLocale,
    sourceLanguage: options['source-language'] ?? options.sourceLanguage,
    outputLanguageMode: options['output-language-mode'] ?? options.outputLanguageMode,
    outputLanguage: options['output-language'] ?? options.outputLanguage,
    translationMode: options['translation-mode'] ?? options.translationMode,
    settingsPath: requestedPath,
    storageStatus: settingsInput.storageStatus
  });
  return {
    ok: true,
    settings: normalized,
    warnings: normalized.diagnostics.map((diagnostic) => ({
      code: diagnostic.code.toUpperCase().replace(/-/gu, '_'),
      message: diagnostic.message,
      details: diagnostic
    }))
  };
}

export function normalizeLanguageSettings(settings = {}, options = {}) {
  const diagnostics = [];
  const profileLanguage = settings.profiles?.reports?.language
    ?? settings.profiles?.artifacts?.language
    ?? settings.language
    ?? {};
  const uiLocale = normalizeDashboardUiLocale(firstString(
    options.uiLocale,
    settings.ui_locale,
    settings.uiLocale,
    settings.display_locale,
    settings.displayLocale,
    settings.locale
  ), diagnostics);
  const sourceLanguage = normalizeSourceLanguage(firstString(
    options.sourceLanguage,
    profileLanguage.source_language,
    profileLanguage.sourceLanguage,
    settings.source_language,
    settings.sourceLanguage
  ), diagnostics);
  const outputSelection = normalizeOutputLanguageSelection(profileLanguage, options, diagnostics);
  const translationMode = normalizeTranslationMode(firstString(
    options.translationMode,
    profileLanguage.translation_mode,
    profileLanguage.translationMode,
    settings.translation_mode,
    settings.translationMode
  ), diagnostics);
  const resolvedOutput = resolveOutputLanguage({
    mode: outputSelection.mode,
    explicitOutputLanguage: outputSelection.explicitOutputLanguage,
    sourceLanguage,
    uiLocale
  });
  const boundary = languageSettingsBoundary();
  return redact({
    schema_version: LANGUAGE_SETTINGS_SCHEMA_VERSION,
    runtime_schema_version: SCHEMA_VERSION,
    kind: 'language-settings',
    settings_path: options.settingsPath ?? DASHBOARD_SETTINGS_PATH,
    storage: {
      status: options.storageStatus ?? 'defaults',
      repository_settings_path: DASHBOARD_SETTINGS_PATH,
      settings_write_enabled: false
    },
    dashboard_ui: {
      locale: uiLocale,
      intl_locale: getTraceCueIntlLocale(uiLocale),
      text_direction: getTraceCueLocaleDirection(uiLocale),
      source: 'settings',
      status: 'supported-locale'
    },
    source: {
      language: sourceLanguage,
      status: sourceLanguageStatus(sourceLanguage),
      raw_observed_page_language_preserved: true
    },
    artifact_output: {
      language_mode: outputSelection.mode,
      language: resolvedOutput.outputLanguage,
      status: resolvedOutput.status,
      explicit_language: outputSelection.explicitOutputLanguage,
      intl_locale: resolvedOutput.outputLanguage ? getTraceCueIntlLocale(resolvedOutput.outputLanguage) : null,
      text_direction: resolvedOutput.outputLanguage ? getTraceCueLocaleDirection(resolvedOutput.outputLanguage) : 'ltr',
      translation_mode: translationMode,
      translation_execution_enabled: false,
      provider_dispatch_enabled: false,
      external_sending_enabled: false,
      body_included: false
    },
    safety: {
      provider_dispatch_allowed_by_settings: false,
      external_send_allowed_by_settings: false,
      mcp_write_execute_allowed_by_settings: false,
      shell_execution_allowed_by_settings: false,
      browser_execution_allowed_by_settings: false,
      translation_execution_allowed_by_settings: false
    },
    diagnostics,
    boundary
  });
}

function normalizeDashboardUiLocale(value, diagnostics) {
  const raw = String(value || '').trim();
  const normalized = normalizeTraceCueLocale(raw, DEFAULT_DASHBOARD_UI_LOCALE);
  if (raw && !normalizeTraceCueLocale(raw, '')) {
    diagnostics.push({
      code: 'unsupported-ui-locale',
      role: 'dashboard_ui_locale',
      requested: raw,
      fallback: DEFAULT_DASHBOARD_UI_LOCALE,
      message: 'Unsupported dashboard UI locale fell back to the default locale.'
    });
  }
  return normalized;
}

export function normalizeSourceLanguage(value, diagnostics = []) {
  const raw = String(value || '').trim();
  if (!raw) {
    return DEFAULT_SOURCE_LANGUAGE;
  }
  const lower = raw.toLowerCase();
  if (lower === 'auto' || lower === 'unknown') {
    return lower;
  }
  const normalized = normalizeTraceCueLocale(raw, '');
  if (normalized) {
    return normalized;
  }
  diagnostics.push({
    code: 'unsupported-source-language',
    role: 'source_language',
    requested: raw,
    fallback: DEFAULT_SOURCE_LANGUAGE,
    message: 'Unsupported source language fell back to auto.'
  });
  return DEFAULT_SOURCE_LANGUAGE;
}

function normalizeOutputLanguageSelection(settings, options, diagnostics) {
  const rawMode = firstString(
    options.outputLanguageMode,
    settings.output_language_mode,
    settings.outputLanguageMode,
    settings.outputLanguageSelection,
    settings.output_language_selection
  );
  const rawOutputLanguage = firstString(
    options.outputLanguage,
    settings.output_language,
    settings.outputLanguage
  );
  const explicitOutputLanguage = normalizeExplicitOutputLanguage(rawOutputLanguage, diagnostics);
  const mode = normalizeOutputLanguageMode(rawMode || rawOutputLanguage, explicitOutputLanguage, diagnostics);
  return {
    mode,
    explicitOutputLanguage: mode === 'explicit' ? explicitOutputLanguage : null
  };
}

function normalizeOutputLanguageMode(value, explicitOutputLanguage, diagnostics) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return explicitOutputLanguage ? 'explicit' : DEFAULT_OUTPUT_LANGUAGE_MODE;
  }
  if (OUTPUT_LANGUAGE_MODES.includes(lower)) {
    return lower;
  }
  if (explicitOutputLanguage) {
    return 'explicit';
  }
  diagnostics.push({
    code: 'unsupported-output-language-mode',
    role: 'artifact_language',
    requested: raw,
    fallback: DEFAULT_OUTPUT_LANGUAGE_MODE,
    message: 'Unsupported output language mode fell back to source.'
  });
  return DEFAULT_OUTPUT_LANGUAGE_MODE;
}

function normalizeExplicitOutputLanguage(value, diagnostics) {
  const raw = String(value || '').trim();
  if (!raw || OUTPUT_LANGUAGE_MODES.includes(raw.toLowerCase())) {
    return null;
  }
  const normalized = normalizeTraceCueLocale(raw, '');
  if (normalized) {
    return normalized;
  }
  diagnostics.push({
    code: 'unsupported-output-language',
    role: 'artifact_language',
    requested: raw,
    fallback: null,
    message: 'Unsupported explicit output language was not resolved.'
  });
  return null;
}

function normalizeTranslationMode(value, diagnostics) {
  const raw = String(value || '').trim();
  if (!raw) {
    return DEFAULT_TRANSLATION_MODE;
  }
  const lower = raw.toLowerCase();
  if (IMPLEMENTED_TRANSLATION_MODES.includes(lower)) {
    return lower;
  }
  diagnostics.push({
    code: 'translation-mode-not-implemented',
    role: 'translation_mode',
    requested: lower,
    fallback: DEFAULT_TRANSLATION_MODE,
    message: 'Only translation mode none is implemented; translation execution remains disabled.'
  });
  return DEFAULT_TRANSLATION_MODE;
}

function resolveOutputLanguage({ mode, explicitOutputLanguage, sourceLanguage, uiLocale }) {
  if (mode === 'ui') {
    return { outputLanguage: uiLocale, status: 'resolved-from-dashboard-ui-locale' };
  }
  if (mode === 'explicit') {
    return explicitOutputLanguage
      ? { outputLanguage: explicitOutputLanguage, status: 'resolved-explicit-locale' }
      : { outputLanguage: null, status: 'explicit-locale-unresolved' };
  }
  if (TRACE_CUE_LOCALE_CODES.includes(sourceLanguage)) {
    return { outputLanguage: sourceLanguage, status: 'resolved-from-source-language' };
  }
  return { outputLanguage: null, status: 'source-language-unresolved' };
}

function sourceLanguageStatus(sourceLanguage) {
  if (sourceLanguage === 'auto') {
    return 'auto';
  }
  if (sourceLanguage === 'unknown') {
    return 'unknown';
  }
  return TRACE_CUE_LOCALE_CODES.includes(sourceLanguage) ? 'supported-locale' : 'unsupported-observed';
}

async function readSettingsInput(cwd, requestedPath, allowMissingDefault) {
  const resolved = resolveWorkspaceSettingsPath(cwd, requestedPath);
  if (!resolved.ok) {
    return resolved;
  }
  try {
    const parsed = JSON.parse(await readFile(resolved.path, 'utf8'));
    return {
      ok: true,
      settings: parsed,
      storageStatus: 'repository-settings'
    };
  } catch (error) {
    if (error.code === 'ENOENT' && allowMissingDefault) {
      return {
        ok: true,
        settings: defaultDashboardSettings(),
        storageStatus: 'defaults'
      };
    }
    return {
      ok: false,
      code: error.code === 'ENOENT' ? 'LANGUAGE_SETTINGS_NOT_FOUND' : 'LANGUAGE_SETTINGS_READ_FAILED',
      message: error.code === 'ENOENT'
        ? 'Language settings file was not found.'
        : 'Language settings file could not be read as JSON.',
      details: { settings: requestedPath, reason: error.message }
    };
  }
}

function defaultDashboardSettings() {
  return {
    schema_version: LANGUAGE_SETTINGS_SCHEMA_VERSION,
    kind: 'dashboard-settings',
    ui_locale: DEFAULT_DASHBOARD_UI_LOCALE,
    profiles: {
      reports: {
        language: {
          source_language: DEFAULT_SOURCE_LANGUAGE,
          output_language_mode: DEFAULT_OUTPUT_LANGUAGE_MODE,
          output_language: null,
          translation_mode: DEFAULT_TRANSLATION_MODE
        }
      }
    }
  };
}

function resolveWorkspaceSettingsPath(cwd, requestedPath) {
  const value = String(requestedPath || '').trim();
  if (!value || value === '-') {
    return {
      ok: false,
      code: 'INVALID_LANGUAGE_SETTINGS_PATH',
      message: 'Language settings path must be a workspace-relative JSON file path.',
      details: { settings: requestedPath }
    };
  }
  if (value.startsWith('@') || path.isAbsolute(value) || value.includes('\0') || value.split(/[\\/]+/u).includes('..')) {
    return {
      ok: false,
      code: 'INVALID_LANGUAGE_SETTINGS_PATH',
      message: 'Language settings path must stay inside the current workspace and must not use indirection.',
      details: { settings: requestedPath }
    };
  }
  const resolvedCwd = path.resolve(cwd);
  const resolved = path.resolve(resolvedCwd, value);
  if (resolved !== resolvedCwd && !resolved.startsWith(`${resolvedCwd}${path.sep}`)) {
    return {
      ok: false,
      code: 'INVALID_LANGUAGE_SETTINGS_PATH',
      message: 'Language settings path must stay inside the current workspace.',
      details: { settings: requestedPath }
    };
  }
  return { ok: true, path: resolved };
}

function settingsError(error) {
  return {
    status: 'error',
    data: {
      language_settings: null,
      boundary: languageSettingsBoundary()
    },
    warnings: [],
    errors: [{
      code: error.code,
      message: error.message,
      details: error.details ?? {}
    }],
    artifacts: []
  };
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}
