import { useEffect, useMemo, useRef, useState } from "react";
import CopyPromptButton from "./CopyPromptButton";
import { classifyPrompt, classificationOverrides, PROMPT_CATEGORIES, PromptCategory, PromptClassification } from "./promptClassification";
import { sectionLabelClass, useLocale } from "./i18n";

// 分類閱讀依字詞排列；只改畫面順序，不改原文、複製內容或分類儲存位置。
const PROMPT_COLLATOR = new Intl.Collator(["zh-Hant-TW", "en"], { sensitivity: "base", numeric: true });
const promptSortKey = (value: string) => value.normalize("NFKC").replace(/^[^A-Za-z0-9\u3400-\u9FFF]+/u, "").trim();

interface Props {
  title: string;
  text: string;
  saved?: PromptClassification;
  fullHeight?: boolean;
  editable?: boolean;
  onSave: (classification: PromptClassification) => Promise<boolean>;
}

function CategorySelect({ label, value, disabled, onChange }: {
  label: string;
  value: PromptCategory;
  disabled: boolean;
  onChange: (category: PromptCategory) => void;
}) {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = PROMPT_CATEGORIES.find((category) => category.id === value)!;

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  return (
    <div
      ref={menuRef}
      className="relative max-w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setMenuOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        disabled={disabled}
        onClick={() => setMenuOpen((current) => !current)}
        className={`flex w-full items-center gap-2 rounded border border-border bg-bg py-1 pl-2 pr-2 text-xs text-text-dim ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      >
        <span className="min-w-0 flex-1 truncate">{t.promptCategory[selected.id]}</span>
        <span aria-hidden="true" className={`inline-block shrink-0 text-[14px] transition-transform duration-150 motion-reduce:transition-none ${menuOpen ? "rotate-180" : ""}`}>▾</span>
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-[calc(100%-1px)] z-20 min-w-full overflow-hidden rounded border border-border bg-bg shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          {PROMPT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={category.id === value}
              onClick={() => { onChange(category.id); setMenuOpen(false); }}
              className={`block w-full whitespace-nowrap px-2 py-1.5 text-left text-xs transition-colors ${category.id === value ? "bg-ref-dim text-accent-label" : "text-text-dim hover:bg-surface-2 hover:text-text"}`}
            >
              {t.promptCategory[category.id]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 原文／分類閱讀切換：分類調整另存，複製永遠取完整原始文字 ──
export default function PromptReader(props: Props) {
  // 原文變更時重建分類草稿，避免舊詞句位置沿用到新版本。
  return <PromptReaderContent key={props.text} {...props} />;
}
function PromptReaderContent({ title, text, saved, onSave, fullHeight = false, editable = true }: Props) {
  const { locale, t } = useLocale();
  const [view, setView] = useState<"original" | "categories">("original");
  const [expanded, setExpanded] = useState(false);
  // 已儲存分類是取消草稿時的回復基準；儲存成功後才更新。
  const savedOverrides = useRef(classificationOverrides(text, saved));
  const [overrides, setOverrides] = useState(() => savedOverrides.current);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const busy = useRef(false);
  const parts = useMemo(() => classifyPrompt(text), [text]);
  const groups = PROMPT_CATEGORIES.map((category) => ({ ...category,
    parts: parts
      .filter((part) => (overrides[part.id] ?? part.category) === category.id)
      .sort((a, b) => PROMPT_COLLATOR.compare(promptSortKey(a.text), promptSortKey(b.text))),
  }));
  function changeCategory(id: string, category: PromptCategory) {
    setOverrides((previous) => ({ ...previous, [id]: category }));
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      if (await onSave({ sourcePrompt: text, overrides })) {
        savedOverrides.current = { ...overrides };
        setDirty(false);
        setMessage(t.categoriesSaved);
      } else setMessage(t.categoriesSaveFailed);
    } catch { setMessage(t.categoriesSaveFailed); }
    finally { busy.current = false; setSaving(false); }
  }
  function cancelChanges() {
    setOverrides({ ...savedOverrides.current });
    setDirty(false);
    setMessage("");
    setShowResetConfirm(false);
  }
  function restoreDefaults() {
    setOverrides({});
    setDirty(true);
    setMessage("");
    setShowResetConfirm(false);
  }
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`min-w-0 flex-1 font-bold text-xs text-text-body ${sectionLabelClass(locale)}`}>{title}</h3>
        {text.trim() && <div className="flex shrink-0 items-center gap-2" aria-label={t.readerMode(title)}>
          {(["original", "categories"] as const).map((mode) => {
            const blockedByDraft = mode === "original" && view === "categories" && (dirty || showResetConfirm);
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                disabled={blockedByDraft}
                title={blockedByDraft ? t.saveOrCancelCategories : undefined}
                onClick={() => { setView(mode); setShowResetConfirm(false); }}
                className={`rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${view === mode ? "border-accent bg-ref-dim text-accent-label" : "border-border text-text-dim"}`}
              >
                {mode === "original" ? t.original : t.categoryView}
              </button>
            );
          })}
        </div>}
      </div>
      {text.trim() ? <>
        {view === "original" ? (
          <div className="relative rounded-lg border border-border bg-overlay p-3 pt-11">
            <div className="absolute right-2 top-2"><CopyPromptButton text={text} /></div>
            <div tabIndex={0} aria-label={t.originalContent(title)} className={fullHeight || expanded ? "max-h-[min(55vh,480px)] overflow-y-auto overscroll-contain pr-2" : ""}>
              <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-technical text-xs leading-relaxed text-text-body ${fullHeight || expanded ? "" : "line-clamp-5"}`}>{text}</p>
            </div>
            {!fullHeight && <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-accent-text">{expanded ? t.collapsePrompt : t.expandPrompt}</button>}
          </div>
        ) : (
          <div className="relative rounded-lg border border-border bg-overlay p-3">
            {editable && <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving || showResetConfirm || (editing && dirty)}
                title={editing && dirty ? t.saveOrCancelCategories : undefined}
                onClick={() => { setEditing(!editing); setShowResetConfirm(false); }}
                className="rounded border border-border px-3 py-1.5 text-xs text-accent-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editing ? t.doneAdjusting : t.adjustCategories}
              </button>
              {editing && (
                <button
                  type="button"
                  disabled={saving || showResetConfirm}
                  onClick={() => setShowResetConfirm(true)}
                  className="text-xs text-text-dim hover:text-accent-text disabled:opacity-40"
                >
                  {t.restoreDefaultCategories}
                </button>
              )}
            </div>}
            {editing && showResetConfirm && (
              <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent-dim bg-ref-dim px-3 py-2 text-xs text-accent-label">
                <p className="min-w-0 flex-1">{t.confirmRestoreCategories}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" disabled={saving} onClick={restoreDefaults} className="rounded border border-accent-dim px-2 py-1 text-text-body">✓ {t.confirm}</button>
                  <button type="button" disabled={saving} onClick={() => setShowResetConfirm(false)} className="rounded bg-accent px-2 py-1 text-on-accent">× {t.cancel}</button>
                </div>
              </div>
            )}
            {/* 分類內容獨立捲動；底部操作列固定在區塊外，不必捲回上方。 */}
            <div tabIndex={0} aria-label={t.categoryContent(title)} className="h-[min(55vh,480px)] overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] flex flex-col gap-4">
              {groups.filter((group) => group.parts.length).map((group) => (
                <section key={group.id} aria-label={t.promptCategory[group.id]}>
                  <h4 className={`mb-2 text-xs font-bold text-accent-label ${sectionLabelClass(locale)}`}>{t.promptCategory[group.id]} · {group.parts.length}</h4>
                  <ul className="flex flex-wrap gap-2">
                    {group.parts.map((part) => (
                      <li key={part.id} className={`min-w-0 max-w-full rounded border border-border bg-surface px-2.5 py-1.5 ${editing ? "basis-[200px] grow" : ""}`}>
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] font-technical text-xs leading-relaxed text-text-body">{part.text}</p>
                        {editing && <div className="mt-2 flex flex-wrap items-center gap-2">
                          <CategorySelect
                            label={t.categorize(part.text)}
                            value={overrides[part.id] ?? part.category}
                            disabled={saving || showResetConfirm}
                            onChange={(category) => changeCategory(part.id, category)}
                          />
                          <span className="text-[11px] text-text-dim">{overrides[part.id] ? t.categoryManual : part.ambiguous ? t.categoryAmbiguous : part.category === "other" ? t.categoryUnrecognized : t.categorySuggested}</span>
                        </div>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!parts.length && <p className="text-xs text-text-dim">{t.noFragments}</p>}
            </div>
            {(editing || dirty || message) && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <span role="status" className="text-xs text-text-body">{message || (dirty ? t.unsavedCategoryChanges : "")}</span>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" disabled={saving || showResetConfirm || !dirty} onClick={cancelChanges} className="rounded border border-border px-3 py-2 text-xs text-text-dim disabled:opacity-40">{t.cancel}</button>
                <button type="button" disabled={saving || showResetConfirm || !dirty} onClick={() => void save()} className="rounded bg-accent px-3 py-2 text-xs text-on-accent disabled:opacity-40">{saving ? t.savingCategories : t.saveCategories}</button>
              </div>
            </div>}
          </div>
        )}
      </> : <p className="rounded-lg border border-border p-3 text-xs text-accent-text">{t.promptPending}</p>}
    </section>
  );
}
