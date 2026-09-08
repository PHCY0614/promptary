import { useMemo, useRef, useState } from "react";
import CopyPromptButton from "./CopyPromptButton";
import { classifyPrompt, classificationOverrides, PROMPT_CATEGORIES, PromptCategory, PromptClassification } from "./promptClassification";

// 分類閱讀依字詞排列；只改畫面順序，不改原文、複製內容或分類儲存位置。
const PROMPT_COLLATOR = new Intl.Collator(["zh-Hant-TW", "en"], { sensitivity: "base", numeric: true });
const promptSortKey = (value: string) => value.normalize("NFKC").replace(/^[^A-Za-z0-9\u3400-\u9FFF]+/u, "").trim();

interface Props {
  title: string;
  text: string;
  saved?: PromptClassification;
  fullHeight?: boolean;
  onSave: (classification: PromptClassification) => Promise<boolean>;
}

// ── 原文／分類閱讀切換：分類調整另存，複製永遠取完整原始文字 ──
export default function PromptReader(props: Props) {
  // 原文變更時重建分類草稿，避免舊詞句位置沿用到新版本。
  return <PromptReaderContent key={props.text} {...props} />;
}
function PromptReaderContent({ title, text, saved, onSave, fullHeight = false }: Props) {
  const [view, setView] = useState<"original" | "categories">("original");
  const [expanded, setExpanded] = useState(false);
  const [overrides, setOverrides] = useState(() => classificationOverrides(text, saved));
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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
        setDirty(false);
        setMessage("✓ 分類已儲存");
      } else setMessage("分類未儲存，調整仍保留，請重試。");
    } catch { setMessage("分類未儲存，調整仍保留，請重試。"); }
    finally { busy.current = false; setSaving(false); }
  }
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-bold text-xs text-[#c8c4bc] font-mono uppercase tracking-widest">{title}</h3>
      </div>
      {text.trim() ? <>
        <div className="mb-3 flex items-center gap-2" aria-label={`${title}閱讀方式`}>
          {(["original", "categories"] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`rounded-md border px-3 py-1.5 text-xs ${view === mode ? "border-[#c9a96e] bg-[#2a2010] text-[#e4c68f]" : "border-[#2e2e32] text-[#a09c95]"}`}>
              {mode === "original" ? "原文" : "分類閱讀"}
            </button>
          ))}
        </div>
        {view === "original" ? (
          <div className="relative rounded-lg border border-[#2e2e32] bg-[#111113] p-3 pt-11">
            <div className="absolute right-2 top-2"><CopyPromptButton text={text} /></div>
            <div tabIndex={0} aria-label={`${title}原文內容`} className={fullHeight || expanded ? "max-h-[min(55vh,480px)] overflow-y-auto overscroll-contain pr-2" : ""}>
              <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-xs leading-relaxed text-[#c8c4bc] ${fullHeight || expanded ? "" : "line-clamp-5"}`}>{text}</p>
            </div>
            {!fullHeight && <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-[#c9a96e]">{expanded ? "收起咒語" : "展開完整咒語"}</button>}
          </div>
        ) : (
          <div className="relative rounded-lg border border-[#2e2e32] bg-[#111113] p-3 pt-11">
            <div className="absolute right-2 top-2"><CopyPromptButton text={text} /></div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={saving} onClick={() => setEditing(!editing)} className="rounded border border-[#2e2e32] px-3 py-1.5 text-xs text-[#c9a96e]">{editing ? "完成調整" : "調整分類"}</button>
              {editing && <button type="button" disabled={saving} onClick={() => { setOverrides({}); setDirty(true); setMessage(""); }} className="text-xs text-[#a09c95] hover:text-[#c9a96e]">恢復自動分類</button>}
            </div>
            {/* 分類內容獨立捲動；底部操作列固定在區塊外，不必捲回上方。 */}
            <div tabIndex={0} aria-label={`${title}分類內容`} className="h-[min(55vh,480px)] overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] flex flex-col gap-4">
              {groups.filter((group) => group.parts.length).map((group) => (
                <section key={group.id} aria-label={group.label}>
                  <h4 className="mb-2 text-xs font-bold text-[#e4c68f]">{group.label} · {group.parts.length}</h4>
                  <ul className="flex flex-wrap gap-2">
                    {group.parts.map((part) => (
                      <li key={part.id} className={`min-w-0 max-w-full rounded border border-[#2e2e32] bg-[#161618] px-2.5 py-1.5 ${editing ? "basis-[200px] grow" : ""}`}>
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-xs leading-relaxed text-[#c8c4bc]">{part.text}</p>
                        {editing && <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select aria-label={`分類：${part.text}`} disabled={saving} value={overrides[part.id] ?? part.category} onChange={(event) => changeCategory(part.id, event.target.value as PromptCategory)} className="max-w-full rounded border border-[#2e2e32] bg-[#0d0d0e] px-2 py-1 text-xs text-[#a09c95]">
                            {PROMPT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                          </select>
                          <span className="text-[11px] text-[#a09c95]">{overrides[part.id] ? "手動分類" : part.ambiguous ? "涉及多類，請確認" : part.category === "other" ? "尚未辨識" : "自動建議"}</span>
                        </div>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!parts.length && <p className="text-xs text-[#a09c95]">沒有可分類的詞句。</p>}
            </div>
            {(editing || dirty || message) && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#2e2e32] pt-3">
              <span role="status" className="text-xs text-[#c8c4bc]">{message || (dirty ? "有未儲存的分類調整" : "")}</span>
              <button type="button" disabled={saving || !dirty} onClick={() => void save()} className="ml-auto rounded bg-[#c9a96e] px-3 py-2 text-xs text-[#0d0d0e] disabled:opacity-40">{saving ? "儲存中…" : "儲存分類"}</button>
            </div>}
          </div>
        )}
      </> : <p className="rounded-lg border border-[#2e2e32] p-3 text-xs text-[#c9a96e]">待補 Prompt</p>}
    </section>
  );
}
