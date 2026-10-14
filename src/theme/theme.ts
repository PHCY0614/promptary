// 本機主題偏好與啟動套用；不跟隨系統，搭配 main.tsx 與 ThemeSwitcher。
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "promptary-theme";
export const THEME_HINT_SEEN_KEY = "promptary-theme-hint-seen";

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isTheme(stored)) return stored;
  } catch {
    /* private mode or blocked storage: keep default */
  }
  return DEFAULT_THEME;
}

export function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* preference is best-effort */
  }
}

export function applyDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "light" ? "#f7f5f0" : "#171719",
  );
}

// 一次性新功能提示：舊使用者早已看過首次介紹，只能靠切換鈕旁的氣泡得知。
export function hasSeenThemeHint(): boolean {
  try {
    return localStorage.getItem(THEME_HINT_SEEN_KEY) === "true";
  } catch {
    return true; // 儲存被封鎖時記不住，寧可不顯示也不要每次都跳出。
  }
}

export function markThemeHintSeen() {
  try {
    localStorage.setItem(THEME_HINT_SEEN_KEY, "true");
  } catch {
    /* hint is best-effort */
  }
}
