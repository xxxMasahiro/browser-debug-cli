export const TRACE_CUE_LOCALE_POLICY = Object.freeze([
  Object.freeze({ code: 'ja', aliases: Object.freeze(['ja', 'ja-JP']), intlLocale: 'ja-JP', direction: 'ltr', nativeName: '日本語', englishName: 'Japanese' }),
  Object.freeze({ code: 'en', aliases: Object.freeze(['en', 'en-US', 'en-GB']), intlLocale: 'en-US', direction: 'ltr', nativeName: 'English', englishName: 'English' }),
  Object.freeze({ code: 'ko', aliases: Object.freeze(['ko', 'ko-KR']), intlLocale: 'ko-KR', direction: 'ltr', nativeName: '한국어', englishName: 'Korean' }),
  Object.freeze({ code: 'zh-CN', aliases: Object.freeze(['zh', 'zh-CN', 'zh-Hans', 'zh-cn', 'zh_CN']), intlLocale: 'zh-CN', direction: 'ltr', nativeName: '简体中文', englishName: 'Simplified Chinese' }),
  Object.freeze({ code: 'zh-TW', aliases: Object.freeze(['zh-TW', 'zh-Hant', 'zh-tw', 'zh_TW']), intlLocale: 'zh-TW', direction: 'ltr', nativeName: '繁體中文', englishName: 'Traditional Chinese' }),
  Object.freeze({ code: 'es', aliases: Object.freeze(['es', 'es-ES', 'es-MX']), intlLocale: 'es-ES', direction: 'ltr', nativeName: 'Español', englishName: 'Spanish' }),
  Object.freeze({ code: 'pt-BR', aliases: Object.freeze(['pt', 'pt-BR', 'pt-br', 'pt_BR']), intlLocale: 'pt-BR', direction: 'ltr', nativeName: 'Português do Brasil', englishName: 'Brazilian Portuguese' }),
  Object.freeze({ code: 'fr', aliases: Object.freeze(['fr', 'fr-FR']), intlLocale: 'fr-FR', direction: 'ltr', nativeName: 'Français', englishName: 'French' }),
  Object.freeze({ code: 'de', aliases: Object.freeze(['de', 'de-DE']), intlLocale: 'de-DE', direction: 'ltr', nativeName: 'Deutsch', englishName: 'German' }),
  Object.freeze({ code: 'id', aliases: Object.freeze(['id', 'id-ID']), intlLocale: 'id-ID', direction: 'ltr', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' }),
  Object.freeze({ code: 'vi', aliases: Object.freeze(['vi', 'vi-VN']), intlLocale: 'vi-VN', direction: 'ltr', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' }),
  Object.freeze({ code: 'th', aliases: Object.freeze(['th', 'th-TH']), intlLocale: 'th-TH', direction: 'ltr', nativeName: 'ไทย', englishName: 'Thai' }),
  Object.freeze({ code: 'hi', aliases: Object.freeze(['hi', 'hi-IN']), intlLocale: 'hi-IN', direction: 'ltr', nativeName: 'हिन्दी', englishName: 'Hindi' }),
  Object.freeze({ code: 'ar', aliases: Object.freeze(['ar', 'ar-SA', 'ar-EG']), intlLocale: 'ar-SA', direction: 'rtl', nativeName: 'العربية', englishName: 'Arabic' })
]);

export const TRACE_CUE_LOCALE_CODES = Object.freeze(TRACE_CUE_LOCALE_POLICY.map((locale) => locale.code));

const localePolicyByCode = new Map(TRACE_CUE_LOCALE_POLICY.map((locale) => [locale.code, locale]));
const localeAliasMap = new Map();

for (const locale of TRACE_CUE_LOCALE_POLICY) {
  localeAliasMap.set(locale.code.toLowerCase(), locale.code);
  for (const alias of locale.aliases) {
    localeAliasMap.set(String(alias).toLowerCase(), locale.code);
  }
}

export function normalizeTraceCueLocale(language, fallback = 'en') {
  const value = String(language || '').trim();
  if (!value) {
    return fallback;
  }
  const normalized = value.replace(/_/gu, '-').toLowerCase();
  if (localeAliasMap.has(normalized)) {
    return localeAliasMap.get(normalized);
  }
  if (normalized.startsWith('zh-hant') || normalized.startsWith('zh-tw')) {
    return 'zh-TW';
  }
  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }
  if (normalized.startsWith('pt')) {
    return 'pt-BR';
  }
  return localeAliasMap.get(normalized.split('-')[0]) || fallback;
}

export function resolveTraceCueLocale(languages = []) {
  const requested = Array.isArray(languages) && languages.length ? languages : ['en'];
  for (const language of requested) {
    const resolved = normalizeTraceCueLocale(language, '');
    if (resolved) {
      return resolved;
    }
  }
  return 'en';
}

export function getTraceCueLocalePolicy(locale) {
  return localePolicyByCode.get(normalizeTraceCueLocale(locale)) || localePolicyByCode.get('en');
}

export function getTraceCueLocaleDirection(locale) {
  return getTraceCueLocalePolicy(locale).direction;
}

export function getTraceCueIntlLocale(locale) {
  return getTraceCueLocalePolicy(locale).intlLocale;
}
