export const LOCALES = ["zh-TW", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";
export const LOCALE_STORAGE_KEY = "promptary-locale";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    /* private mode or blocked storage: keep default */
  }
  return DEFAULT_LOCALE;
}

export function writeStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* preference is best-effort */
  }
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale === "en" ? "en-AU" : locale;
}

/** Section headings / small metadata labels — casing is English-only. */
export function sectionLabelClass(locale: Locale) {
  return locale === "en"
    ? "font-technical uppercase tracking-wide"
    : "font-ui normal-case tracking-normal";
}

/** Brand subtitle: Noto Serif TC for zh-TW, existing Fraunces for English. */
export function brandSubtitleClass(locale: Locale) {
  return locale === "zh-TW" ? "font-brand-subtitle" : "font-display";
}
