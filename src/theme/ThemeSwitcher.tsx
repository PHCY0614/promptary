// 切換目前文件與本機主題偏好；不更動收藏資料，搭配 theme.ts 與 i18n。
import { useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { applyDocumentTheme, DEFAULT_THEME, isTheme, writeStoredTheme, type Theme } from "./theme";

type Props = {
  buttonClassName?: string;
  // 有值時在按鈕下方顯示一次性氣泡；由呼叫端決定何時顯示、關閉後如何記住。
  hint?: string;
  onHintDismiss?: () => void;
};

export default function ThemeSwitcher({ buttonClassName = "px-2.5", hint, onHintDismiss }: Props) {
  const { t } = useLocale();
  // 文件保留本次切換，即使儲存被封鎖、或從詳情返回首頁。
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.dataset.theme;
    return current && isTheme(current) ? current : DEFAULT_THEME;
  });
  // 首頁在詳情開啟時仍掛載，兩個切換器需共同反映文件上的主題。
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const current = document.documentElement.dataset.theme;
      if (current && isTheme(current)) setTheme(current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = nextTheme === "light" ? t.themeLight : t.themeDark;

  return (
    <div className="relative flex shrink-0">
    <button
      type="button"
      aria-label={`${t.switchTheme}: ${label}`}
      title={label}
      onClick={() => {
        onHintDismiss?.();
        applyDocumentTheme(nextTheme);
        writeStoredTheme(nextTheme);
        setTheme(nextTheme);
      }}
      className={`inline-flex shrink-0 items-center justify-center ${buttonClassName} py-1.5 text-xs font-ui font-normal text-text-muted hover:text-text bg-transparent border border-transparent rounded-lg transition-colors`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {nextTheme === "light" ? <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </> : <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />}
      </svg>
    </button>
    {hint && (
      <div role="status" className="absolute right-0 top-full z-40 mt-2 flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent py-1.5 pl-3 pr-1 text-xs font-medium text-on-accent shadow-xl">
        <span aria-hidden="true" className="absolute -top-1 right-4 h-2 w-2 rotate-45 bg-accent" />
        {hint}
        <button type="button" aria-label={t.close} onClick={onHintDismiss} className="px-1.5 leading-none opacity-70 hover:opacity-100">×</button>
      </div>
    )}
    </div>
  );
}
