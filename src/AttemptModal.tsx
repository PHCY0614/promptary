import { useState, useRef } from "react";
import { Attempt, PLATFORMS } from "./types";
import { fileToDataUrl } from "./store";

// 平台選單是獨立的本機偏好；移除選項不會改寫已保存的嘗試。
const PLATFORM_STORAGE_KEY = "promptary-custom-platforms";
function readCustomPlatforms(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PLATFORM_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((p): p is string =>
      typeof p === "string" && p.trim().length > 0 && !PLATFORMS.some((builtIn) => builtIn === p)))] : [];
  } catch { return []; }
}

interface UploadItem {
  dataUrl: string;
  name: string;
  status: "done" | "loading" | "error";
}

interface FormState {
  name: string;
  images: UploadItem[];
  platform: string;
  customPlatform: string;
  prompt: string;
  model: string;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  date: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function initForm(originalPrompt: string, existing?: Attempt): FormState {
  if (existing) {
    const isCustom = ![...PLATFORMS.slice(0, -1), ...readCustomPlatforms()].includes(existing.platform);
    return {
      name: existing.name ?? "",
      images: existing.images.map((u) => ({ dataUrl: u, name: "", status: "done" })),
      platform: isCustom ? "自訂" : existing.platform,
      customPlatform: isCustom ? existing.platform : "",
      prompt: existing.prompt,
      model: existing.model ?? "",
      notes: existing.notes,
      rating: existing.rating,
      date: existing.date,
    };
  }
  return {
    name: "",
    images: [],
    platform: "PixAI",
    customPlatform: "",
    prompt: originalPrompt,
    model: "",
    notes: "",
    rating: null,
    date: today(),
  };
}

interface Props {
  originalPrompt: string;
  existing?: Attempt;
  onSave: (data: Omit<Attempt, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
}

export default function AttemptModal({ originalPrompt, existing, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(originalPrompt, existing));
  const [customPlatforms, setCustomPlatforms] = useState(readCustomPlatforms);
  const [platformError, setPlatformError] = useState("");
  function savePlatformOptions(next: string[]): boolean {
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(next));
      setCustomPlatforms(next);
      setPlatformError("");
      return true;
    } catch {
      setPlatformError("無法儲存平台選單，請確認瀏覽器允許儲存後重試。已填內容仍保留。");
      return false;
    }
  }
  function addPlatform() {
    const name = form.customPlatform.trim();
    if (!name) { setPlatformError("請輸入平台名稱。"); return; }
    const known = [...PLATFORMS, ...customPlatforms].find((p) => p.toLowerCase() === name.toLowerCase());
    if (known || savePlatformOptions([...customPlatforms, name])) {
      setForm((f) => ({ ...f, platform: known ?? name, customPlatform: "" }));
      setPlatformError("");
    }
  }
  function deletePlatform(name: string) {
    if (savePlatformOptions(customPlatforms.filter((p) => p !== name))) {
      setForm((f) => f.platform === name ? { ...f, platform: "自訂", customPlatform: name } : f);
    }
  }
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const close = () => { if (!savingRef.current) onClose(); };
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const placeholders: UploadItem[] = arr.map((f) => ({
      dataUrl: "",
      name: f.name,
      status: "loading",
    }));
    setForm((f) => ({ ...f, images: [...f.images, ...placeholders] }));

    const results = await Promise.allSettled(arr.map((f) => fileToDataUrl(f)));
    setForm((f) => {
      const imgs = [...f.images];
      const start = imgs.length - arr.length;
      results.forEach((r, i) => {
        imgs[start + i] =
          r.status === "fulfilled"
            ? { dataUrl: r.value, name: arr[i].name, status: "done" }
            : { ...imgs[start + i], status: "error" };
      });
      return { ...f, images: imgs };
    });
  }

  function removeImage(i: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));
  }

  function retryImage(i: number, file: File) {
    fileToDataUrl(file).then((dataUrl) => {
      setForm((f) => {
        const imgs = [...f.images];
        imgs[i] = { dataUrl, name: file.name, status: "done" };
        return { ...f, images: imgs };
      });
    });
  }

  function setRating(r: 1 | 2 | 3 | 4 | 5) {
    set("rating", form.rating === r ? null : r);
  }

  async function handleSubmit() {
    if (savingRef.current) return;
    const effectivePlatform = form.platform === "自訂" ? form.customPlatform.trim() || "自訂" : form.platform;
    // 儲存自訂嘗試時也記住平台，之後可直接選取；選單寫入失敗則保留表單供重試。
    if (form.platform === "自訂" && effectivePlatform !== "自訂" &&
      ![...PLATFORMS, ...customPlatforms].some((p) => p.toLowerCase() === effectivePlatform.toLowerCase()) &&
      !savePlatformOptions([...customPlatforms, effectivePlatform])) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
    await onSave({
      name: form.name.trim() || undefined,
      images: form.images.filter((i) => i.status === "done").map((i) => i.dataUrl),
      platform: effectivePlatform,
      prompt: form.prompt.trim(),
      model: form.model.trim() || undefined,
      notes: form.notes.trim(),
      rating: form.rating,
      date: form.date,
    });
    } finally { savingRef.current = false; setIsSaving(false); }
  }

  const isLoading = form.images.some((i) => i.status === "loading");
  const promptDiffers = form.prompt.trim() !== originalPrompt.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-[#161618] border border-[#2e2e32] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#1e1e21]">
          <h2 className="text-sm font-bold text-[#f0ede8]" style={{ fontFamily: "'Fraunces', serif" }}>
            {existing ? "編輯嘗試紀錄" : "新增嘗試"}
          </h2>
          <button onClick={close} className="text-[#b8b5af] hover:text-[#f0ede8] transition-colors w-7 h-7 flex items-center justify-center">×</button>
        </div>

        <fieldset disabled={isSaving} className="px-5 py-4 flex flex-col gap-4">
          {/* 嘗試名稱：選填；與收藏名稱分開保存 */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
              名稱（選填）
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] transition-colors"
            />
          </div>

          {/* Images */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
              成果圖片（可多張）
            </label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <div className="flex gap-2 flex-wrap">
              {form.images.map((img, i) => (
                <div key={i} className="relative rounded overflow-hidden bg-[#1e1e21] flex-shrink-0" style={{ width: 64, height: 64 }}>
                  {img.status === "loading" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#c9a96e] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : img.status === "error" ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#2a1010] cursor-pointer" title="點擊重試">
                      <span className="text-[#e06e6e] text-xs font-mono">!</span>
                    </div>
                  ) : (
                    <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-[#e06e6e] transition-colors"
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded border border-dashed border-[#2e2e32] text-[#b8b5af] hover:border-[#c9a96e55] hover:text-[#b8b5af] flex items-center justify-center text-xl transition-colors flex-shrink-0"
              >+</button>
            </div>
          </div>

          {/* Platform + model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">平台</label>
              <select
                value={form.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] font-mono"
              >
                {[...PLATFORMS.slice(0, -1), ...customPlatforms, "自訂"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {form.platform === "自訂" && (
                <div>
                <input
                  type="text"
                  value={form.customPlatform}
                  onChange={(e) => set("customPlatform", e.target.value)}
                  placeholder="平台名稱"
                  className="mt-1.5 w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] font-mono"
                />
                <button type="button" onClick={addPlatform} className="mt-2 text-xs text-[#c9a96e]">加入平台選單</button>
                </div>
              )}
              {/* 自訂平台管理：只移除選單選項，歷史紀錄保留原名稱。 */}
              {customPlatforms.length > 0 && (
                <details className="mt-2 text-xs text-[#b8b5af]">
                  <summary className="cursor-pointer">管理自訂平台</summary>
                  <p className="mt-2">刪除選項不影響既有嘗試紀錄。</p>
                  <div className="max-h-32 overflow-y-auto">
                    {customPlatforms.map((name) => (
                      <div key={name} className="flex items-center justify-between gap-2 py-2">
                        <span className="break-all">{name}</span>
                        <button type="button" onClick={() => deletePlatform(name)} aria-label={`刪除平台選項 ${name}`} className="shrink-0 text-[#f19b9b]">刪除</button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {platformError && <p role="alert" className="mt-2 text-xs text-[#f19b9b]">{platformError}</p>}
            </div>
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">模型版本（選填）</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="v6.1, Flux Dev…"
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] font-mono"
              />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest">
                實際使用的 Prompt
              </label>
              {promptDiffers && (
                <span className="text-xs text-[#6e7abf] font-mono">已修改</span>
              )}
            </div>
            <textarea
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
              rows={5}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors resize-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            {promptDiffers && (
              <button
                onClick={() => set("prompt", originalPrompt)}
                className="text-xs text-[#b8b5af] hover:text-[#c9a96e] font-mono mt-1 transition-colors"
              >
                恢復原始 prompt
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">這次心得</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="哪裡成功、哪裡需要調整…"
              rows={2}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors resize-none"
            />
          </div>

          {/* Rating + date */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">評分</label>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}
                    className={`text-lg transition-colors ${(form.rating ?? 0) >= s ? "text-[#c9a96e]" : "text-[#b8b5af] hover:text-[#b8b5af]"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">生成日期</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] font-mono"
              />
            </div>
          </div>
        </fieldset>

        <div className="px-5 py-4 border-t border-[#1e1e21] flex items-center gap-3 justify-end">
          <button onClick={close} className="px-4 py-2 text-xs text-[#b8b5af] hover:text-[#f0ede8] font-mono transition-colors">取消</button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors disabled:opacity-40"
          >
            {isSaving ? "儲存中…" : isLoading ? "上傳中…" : existing ? "儲存變更" : "新增嘗試"}
          </button>
        </div>
      </div>
    </div>
  );
}
