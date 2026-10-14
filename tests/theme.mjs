// 驗證主題偏好、啟動契約與亮色文字對比；不取代瀏覽器視覺驗收，搭配 theme.ts/index.css。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
let stored = null;
let blockedRead = false;
let blockedWrite = false;
let meta = { setAttribute: (name, value) => { meta[name] = value; } };
const document = {
  documentElement: { dataset: {} },
  querySelector: (selector) => {
    assert.equal(selector, 'meta[name="theme-color"]');
    return meta;
  },
};
vm.runInNewContext(
  ts.transpileModule(readFileSync("src/theme/theme.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    exports,
    document,
    localStorage: {
      getItem: (key) => {
        assert.equal(key, "promptary-theme");
        if (blockedRead) throw new Error("blocked storage");
        return stored;
      },
      setItem: (key, value) => {
        assert.equal(key, "promptary-theme");
        if (blockedWrite) throw new Error("blocked storage");
        stored = value;
      },
    },
  },
);

const { DEFAULT_THEME, THEMES, isTheme, readStoredTheme, writeStoredTheme, applyDocumentTheme } = exports;
assert.equal(DEFAULT_THEME, "dark");
assert.deepEqual(Array.from(THEMES), ["dark", "light"]);
for (const value of [null, "", "system", "Light", "{}", " light "]) {
  stored = value;
  assert.equal(readStoredTheme(), "dark");
}
for (const theme of THEMES) {
  assert.equal(isTheme(theme), true);
  writeStoredTheme(theme);
  assert.equal(readStoredTheme(), theme);
  applyDocumentTheme(theme);
  assert.equal(document.documentElement.dataset.theme, theme);
  assert.equal(meta.content, theme === "light" ? "#f7f5f0" : "#171719");
}
assert.equal(isTheme("system"), false);
blockedRead = true;
assert.equal(readStoredTheme(), "dark");
blockedWrite = true;
assert.doesNotThrow(() => writeStoredTheme("light"));
meta = null;
assert.doesNotThrow(() => applyDocumentTheme("dark"));
assert.equal(document.documentElement.dataset.theme, "dark");

const main = readFileSync("src/main.tsx", "utf8");
assert.ok(main.indexOf("applyDocumentTheme(readStoredTheme())") < main.indexOf("ReactDOM.createRoot"));
for (const file of ["src/Gallery.tsx", "src/DetailView.tsx"]) {
  assert.match(readFileSync(file, "utf8"), /<ThemeSwitcher\b/);
}

// 色票對比在實際使用的底色上檢查，避免只驗證白底卻漏掉較深的表面。
const css = readFileSync("src/index.css", "utf8");
const light = Object.fromEntries(
  [...css.slice(css.indexOf(':root[data-theme="light"]')).matchAll(/--c-([\w-]+): (#[\da-f]{6});/g)]
    .map(([, name, value]) => [name, value]),
);
function luminance(hex) {
  const values = hex.match(/[\da-f]{2}/g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const textRoles = ["text", "text-body", "text-muted", "text-dim", "placeholder", "text-subtitle", "text-secondary", "text-decoration", "text-handle", "accent-text", "favorite", "danger", "danger-muted"];
for (const foreground of textRoles) {
  for (const background of ["bg", "surface", "surface-2", "surface-3", "surface-hover", "overlay", "ref-dim"]) {
    assert.ok(contrast(light[foreground], light[background]) >= 4.5, `${foreground} on ${background} must meet AA`);
  }
}
for (const background of ["accent", "accent-hover", "danger", "danger-hover"]) {
  assert.ok(contrast(light["on-accent"], light[background]) >= 4.5, `white on ${background} must meet AA`);
}
for (const role of ["ref", "tried", "want"]) {
  assert.ok(contrast(light[`status-${role}`], light[`status-${role}-bg`]) >= 4.5, `${role} status must meet AA`);
}
for (const [name, value] of Object.entries(light)) {
  if (name.startsWith("platform-")) assert.ok(contrast(value, light.surface) >= 4.5, `${name} must meet AA`);
}
for (const foreground of ["accent-label", "accent-notice", "accent-tag", "accent-tag-hover"]) {
  for (const background of ["ref-dim", "warning-bg", "surface"]) {
    assert.ok(contrast(light[foreground], light[background]) >= 4.5, `${foreground} on ${background} must meet AA`);
  }
}
assert.ok(contrast(light["danger-text"], light["danger-bg"]) >= 4.5);
console.log("PASS: theme defaults, storage failures, document/meta sync, startup order, header controls, and light palette AA contrast");
