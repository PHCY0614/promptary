import { useLocale } from "./LocaleContext";

type Props = {
  buttonClassName?: string;
};

export default function LanguageSwitcher({ buttonClassName = "px-2.5" }: Props) {
  const { locale, setLocale, t } = useLocale();
  const nextLocale = locale === "zh-TW" ? "en" : "zh-TW";
  const label = locale === "zh-TW" ? t.languageEn : t.languageZhTW;

  return (
    <button
      type="button"
      aria-label={t.switchLanguage}
      onClick={() => setLocale(nextLocale)}
      className={`whitespace-nowrap ${buttonClassName} py-1.5 text-xs font-ui font-normal text-text-muted hover:text-text bg-transparent border border-transparent rounded-lg transition-colors`}
    >
      {label}
    </button>
  );
}
