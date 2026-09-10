import { useEffect, useState, useRef } from "react";
import { Attempt, ImageRef, PLATFORMS } from "./types";
import { createCanonicalImage } from "./imageUpload";
import { discardStagedImage, stageCanonicalImage } from "./archiveStorage";
import StoredImage from "./StoredImage";
import ResizableTextarea from "./ResizableTextarea";

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
  id: string;
  file?: File;
  image?: ImageRef;
  name: string;
  error?: string;
  isNew?: boolean;
  status: "done" | "loading" | "error";
}

interface FormState {
  name: string;
  images: UploadItem[];
  platform: string;
  customPlatform: string;
  prompt: string;
  unmodified: boolean;
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
      images: existing.images.map((image) => ({ id: image.id, image, name: "", status: "done" })),
      platform: isCustom ? "自訂" : existing.platform,
      customPlatform: isCustom ? existing.platform : "",
      prompt: existing.promptMode === "original" ? originalPrompt : existing.prompt,
      unmodified: existing.promptMode === "original",
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
    prompt: "",
    unmodified: false,
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
  const newImageIds = useRef(new Set<string>());
  useEffect(() => () => { for (const id of newImageIds.current) discardStagedImage(id); }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function processImage(item: UploadItem) {
    if (!item.file) return;
    const patchItem = (patch: Partial<UploadItem>) => setForm((form) => ({
      ...form,
      images: form.images.map((image) => image.id === item.id ? { ...image, ...patch } : image),
    }));
    patchItem({ status: "loading", error: undefined });
    try {
      const result = await createCanonicalImage(item.file, item.id);
      stageCanonicalImage(result.ref, result.blob);
      newImageIds.current.add(item.id);
      patchItem({ image: result.ref, status: "done", isNew: true });
    } catch (error) {
      patchItem({ status: "error", error: error instanceof Error ? error.message : "圖片處理失敗，請重試。" });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const placeholders: UploadItem[] = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, name: file.name, status: "loading" }));
    setForm((form) => ({ ...form, images: [...form.images, ...placeholders] }));
    placeholders.forEach((item) => { void processImage(item); });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(i: number) {
    const removed = form.images[i];
    if (removed?.isNew) { discardStagedImage(removed.id); newImageIds.current.delete(removed.id); }
    setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));
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
      images: form.images.filter((item): item is UploadItem & { image: ImageRef } => item.status === "done" && Boolean(item.image)).map((item) => item.image),
      platform: effectivePlatform,
      promptMode: form.unmodified ? "original" : "custom",
      prompt: form.unmodified ? originalPrompt.trim() : form.prompt.trim(),
      promptClassification: form.unmodified ? undefined : existing?.promptClassification,
      model: form.model.trim() || undefined,
      notes: form.notes.trim(),
      rating: form.rating,
      date: form.date,
    });
    } finally { savingRef.current = false; setIsSaving(false); }
  }

  const isLoading = form.images.some((i) => i.status === "loading");
  const hasImageError = form.images.some((i) => i.status === "error");
  const promptDiffers = !form.unmodified && form.prompt.trim() !== originalPrompt.trim();
  function toggleUnmodified() {
    setForm((current) => ({
      ...current,
      unmodified: !current.unmodified,
    }));
  }

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

        <fieldset disabled={isSaving} className="ios-form-zoom-fix px-5 py-4 flex flex-col gap-4">
          {/* 嘗試名稱：選填；與收藏名稱分開保存 */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
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
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
              成果圖片（可多張）
            </label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <div className="flex gap-2 flex-wrap">
              {form.images.map((img, i) => (
                <div key={img.id} className="relative rounded overflow-hidden bg-[#1e1e21] flex-shrink-0" style={{ width: 64, height: 64 }}>
                  {img.status === "loading" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#c9a96e] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : img.status === "error" ? (
                    <button type="button" onClick={() => void processImage(img)} className="w-full h-full flex items-center justify-center bg-[#2a1010] text-[#e06e6e] text-xs" title={img.error}>重試</button>
                  ) : (
                    img.image && <StoredImage image={img.image} variant="thumbnail" alt="" className="w-full h-full object-cover" />
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

          <p className="text-xs leading-relaxed text-[#b8b5af]">本機圖庫：支援 JPG、PNG、WebP，每張圖片最多 10 MB。<br />匯入後會自動最佳化，並僅儲存在此裝置。</p>
          {hasImageError && <div role="alert" className="text-xs text-[#e06e6e]">
            {form.images.filter((image) => image.status === "error").map((image) => <p key={image.id}>{image.name}：{image.error}</p>)}
            請重試或移除失敗圖片後再儲存，已填內容會保留。
          </div>}

          {/* Platform + model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">平台</label>
              <select
                value={form.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] font-technical"
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
                  className="mt-1.5 w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] font-technical"
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
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">模型版本（選填）</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] font-technical"
              />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal">
                實際使用的咒語
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#b8b5af] font-ui">無修改</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.unmodified}
                  aria-label="使用原始咒語，無修改"
                  onClick={toggleUnmodified}
                  className={`h-4 w-7 rounded-full transition-colors ${form.unmodified ? "bg-[#c9a96e]" : "bg-[#2e2e32]"}`}
                >
                  <span className={`mt-0.5 block h-3 w-3 rounded-full bg-white transition-transform ${form.unmodified ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            {!form.unmodified && <ResizableTextarea
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
              placeholder="貼上或輸入咒語"
              rows={3}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-technical"
              style={{ height: 56 }}
            />}
            {promptDiffers && (
              <button
                onClick={() => set("prompt", originalPrompt)}
                className="text-xs text-[#b8b5af] hover:text-[#c9a96e] font-ui mt-1 transition-colors"
              >
                恢復原始咒語
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">筆記</label>
            <ResizableTextarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="記錄心得與想法"
              rows={2}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors"
            />
          </div>

          {/* Rating + date */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">評分</label>
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
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">生成日期</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] font-technical"
              />
            </div>
          </div>
        </fieldset>

        <div className="px-5 py-4 border-t border-[#1e1e21] flex items-center gap-3 justify-end">
          <button onClick={close} className="px-4 py-2 text-xs text-[#b8b5af] hover:text-[#f0ede8] font-ui transition-colors">取消</button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isLoading || hasImageError}
            className="px-4 py-2 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors disabled:opacity-40"
          >
            {isSaving ? "儲存中……" : isLoading ? "上傳中……" : existing ? "儲存變更" : "新增嘗試"}
          </button>
        </div>
      </div>
    </div>
  );
}
