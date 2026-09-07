import { useState, useRef } from "react";
import { Collection, Status } from "./types";
import { readReferenceImage } from "./imageUpload";

const STATUS_OPTS: { value: Status; label: string }[] = [
  { value: "want", label: "想試試" },
  { value: "tried", label: "已試過" },
  { value: "ref", label: "參考" },
];

// ── 圖片暫存：以固定 ID 對應非同步結果，移除或追加圖片不會錯位 ──
interface UploadItem {
  id: string;
  file?: File;
  progress: number;
  error?: string;
  dataUrl: string;
  name: string;
  status: "done" | "loading" | "error";
}

interface FormState {
  referenceImages: UploadItem[];
  originalPrompt: string;
  promptPending: boolean;
  tags: string;
  status: Status;
  isFavorite: boolean;
  collectionNotes: string;
  source: string;
}

function initForm(c?: Collection): FormState {
  if (c) {
    return {
      referenceImages: c.referenceImages.map((u) => ({ id: crypto.randomUUID(), progress: 100, dataUrl: u, name: "", status: "done" })),
      originalPrompt: c.originalPrompt,
      promptPending: c.promptPending,
      tags: c.tags.join(", "),
      status: c.status,
      isFavorite: c.isFavorite,
      collectionNotes: c.collectionNotes,
      source: c.source ?? "",
    };
  }
  return {
    referenceImages: [],
    originalPrompt: "",
    promptPending: false,
    tags: "",
    status: "want",
    isFavorite: false,
    collectionNotes: "",
    source: "",
  };
}

interface Props {
  existing?: Collection;
  onSave: (data: Omit<Collection, "id" | "addedAt" | "updatedAt" | "attempts">) => Promise<void>;
  onClose: () => void;
}

export default function CollectionModal({ existing, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(existing));
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const close = () => { if (!savingRef.current) onClose(); };
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // ── 本機圖片讀取與重試（第二階段才接 Storage 上傳） ──
  async function readImage(item: UploadItem) {
    if (!item.file) return;
    const patch = (data: Partial<UploadItem>) => setForm((f) => ({
      ...f,
      referenceImages: f.referenceImages.map((image) => image.id === item.id ? { ...image, ...data } : image),
    }));
    patch({ status: "loading", progress: 0, error: undefined });
    try {
      const dataUrl = await readReferenceImage(item.file, (progress) => patch({ progress }));
      patch({ dataUrl, status: "done", progress: 100 });
    } catch (error) {
      patch({ status: "error", error: error instanceof Error ? error.message : "圖片讀取失敗，請重試。" });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const items: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(), file, dataUrl: "", name: file.name, status: "loading", progress: 0,
    }));
    setForm((f) => ({ ...f, referenceImages: [...f.referenceImages, ...items] }));
    items.forEach((item) => { void readImage(item); });
    // 允許移除或讀取失敗後再次選取同一個檔案。
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(i: number) {
    setForm((f) => ({
      ...f,
      referenceImages: f.referenceImages.filter((_, j) => j !== i),
    }));
  }

  // ── 表單提交：所有圖片成功或已移除，才允許儲存 ──
  async function handleSubmit() {
    if (savingRef.current) return;
    if (form.referenceImages.some((image) => image.status !== "done")) return;
    const tags = form.tags
      .split(/[,，\s]+/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    savingRef.current = true;
    setIsSaving(true);
    try {
    await onSave({
      referenceImages: form.referenceImages.filter((i) => i.status === "done").map((i) => i.dataUrl),
      coverSource: { type: "reference", index: 0 },
      originalPrompt: form.originalPrompt.trim(),
      promptPending: !form.originalPrompt.trim(),
      tags,
      status: form.status,
      isFavorite: form.isFavorite,
      collectionNotes: form.collectionNotes.trim(),
      source: form.source.trim() || undefined,
    });
    } finally { savingRef.current = false; setIsSaving(false); }
  }

  const hasImageError = form.referenceImages.some((i) => i.status === "error");
  const isLoading = form.referenceImages.some((i) => i.status === "loading");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-[#161618] border border-[#2e2e32] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#1e1e21]">
          <h2 className="text-sm font-bold text-[#f0ede8]" style={{ fontFamily: "'Fraunces', serif" }}>
            {existing ? "編輯收藏" : "新增收藏"}
          </h2>
          <button onClick={close} className="text-[#b8b5af] hover:text-[#f0ede8] transition-colors w-7 h-7 flex items-center justify-center">
            ×
          </button>
        </div>

        <fieldset disabled={isSaving} className="px-5 py-4 flex flex-col gap-4">
          {/* Reference images */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
              參考圖片（可不填）
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="flex gap-2 flex-wrap">
              {form.referenceImages.map((img, i) => (
                <div
                  key={img.id}
                  className="relative rounded overflow-hidden bg-[#1e1e21] flex-shrink-0"
                  style={{ width: 64, height: 64 }}
                >
                  {img.status === "loading" ? (
                    <div role="status" className="w-full h-full flex items-center justify-center text-xs text-[#c8c4bc]">{img.progress}%</div>
                  ) : img.status === "error" ? (
                    <button type="button" onClick={() => void readImage(img)} title={img.error} aria-label={`重試 ${img.name}`} className="w-full h-full bg-[#2a1010] text-[#e06e6e] text-xs">重試</button>
                  ) : (
                    <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-xs flex items-center justify-center leading-none hover:bg-[#e06e6e] transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded border border-dashed border-[#2e2e32] text-[#b8b5af] hover:border-[#c9a96e55] hover:text-[#b8b5af] flex items-center justify-center text-xl transition-colors flex-shrink-0"
              >
                +
              </button>
            </div>
          </div>

          <p className="text-xs text-[#b8b5af]">本機圖庫：支援 JPG、PNG、WebP，每張最多 2 MB。原圖不壓縮，以 IndexedDB 保存；尚未同步雲端。</p>
          {hasImageError && <div role="alert" className="text-xs text-[#e06e6e]">
            {form.referenceImages.filter((image) => image.status === "error").map((image) => <p key={image.id}>{image.name}：{image.error}</p>)}
            請重試或移除失敗圖片後再儲存，已填內容會保留。
          </div>}

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest">
                原始 Prompt（可之後補）
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-xs text-[#b8b5af] font-mono">待補</span>
                <div
                  onClick={() => set("promptPending", !form.promptPending)}
                  className={`w-7 h-4 rounded-full transition-colors cursor-pointer ${form.promptPending ? "bg-[#c9a96e]" : "bg-[#2e2e32]"}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${form.promptPending ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </div>
            <textarea
              value={form.originalPrompt}
              onChange={(e) => set("originalPrompt", e.target.value)}
              placeholder="貼上或輸入原始 prompt…"
              rows={3}
              disabled={form.promptPending}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors resize-none disabled:opacity-40"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
              標籤（逗號分隔）
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="portrait, cosmic, cinematic"
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-mono"
            />
          </div>

          {/* Status + source in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
                狀態
              </label>
              <div className="flex flex-col gap-1">
                {STATUS_OPTS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => set("status", o.value)}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${form.status === o.value ? "border-[#c9a96e] bg-[#c9a96e]" : "border-[#2e2e32]"}`}
                    />
                    <span className="text-xs text-[#b8b5af]">{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
                來源連結
              </label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder="填入網址"
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#b8b5af] font-mono uppercase tracking-widest block mb-1.5">
              收藏筆記
            </label>
            <textarea
              value={form.collectionNotes}
              onChange={(e) => set("collectionNotes", e.target.value)}
              placeholder="喜歡這個光線，想拿來做角色頭像…"
              rows={2}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors resize-none"
            />
          </div>

          {/* Favorite */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              onClick={() => set("isFavorite", !form.isFavorite)}
              className={`text-xl transition-colors ${form.isFavorite ? "text-[#e06e6e]" : "text-[#b8b5af] hover:text-[#b8b5af]"}`}
            >
              ♥
            </button>
            <span className="text-xs text-[#b8b5af]">加入最愛</span>
          </label>
        </fieldset>

        <div className="px-5 py-4 border-t border-[#1e1e21] flex items-center gap-3 justify-end">
          <button onClick={close} className="px-4 py-2 text-xs text-[#b8b5af] hover:text-[#f0ede8] font-mono transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isLoading || hasImageError}
            className="px-4 py-2 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors disabled:opacity-40"
          >
            {isSaving ? "儲存中…" : isLoading ? "讀取中…" : existing ? "儲存變更" : "新增收藏"}
          </button>
        </div>
      </div>
    </div>
  );
}
