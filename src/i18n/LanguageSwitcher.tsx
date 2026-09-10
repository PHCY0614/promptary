import { useLocale } from "./LocaleContext";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const nextLocale = locale === "zh-TW" ? "en" : "zh-TW";
  const label = locale === "zh-TW" ? t.languageEn : t.languageZhTW;

  return (
    <button
      type="button"
      aria-label={t.switchLanguage}
      onClick={() => setLocale(nextLocale)}
      className="whitespace-nowrap px-2.5 py-1.5 text-xs font-ui font-normal text-[#b8b5af] hover:text-[#f0ede8] bg-transparent border border-transparent rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}
