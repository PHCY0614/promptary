import { useEffect, useState, useRef } from "react";
import { Collection, ImageRef, Status } from "./types";
import { createCanonicalImage } from "./imageUpload";
import { discardStagedImage, stageCanonicalImage } from "./archiveStorage";
import StoredImage from "./StoredImage";
import ResizableTextarea from "./ResizableTextarea";
import { ErrorCode, translateError, useLocale } from "./i18n";
import { UnsavedChangesDialog, useModalCloseGuard } from "./ModalCloseGuard";

// ── 圖片暫存：以固定 ID 對應非同步結果，移除或追加圖片不會錯位 ──
interface UploadItem {
  id: string;
  file?: File;
  progress: number;
  error?: string;
  image?: ImageRef;
  name: string;
  isNew?: boolean;
  status: "done" | "loading" | "error";
}

interface FormState {
  name: string;
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
      name: c.name ?? "",
      referenceImages: c.referenceImages.map((image) => ({ id: image.id, progress: 100, image, name: "", status: "done" })),
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
    name: "",
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

function sameForm(a: FormState, b: FormState) {
  return a.name === b.name &&
    a.referenceImages.map((image) => image.id).join("\u0000") === b.referenceImages.map((image) => image.id).join("\u0000") &&
    a.originalPrompt === b.originalPrompt &&
    a.promptPending === b.promptPending &&
    a.tags === b.tags &&
    a.status === b.status &&
    a.isFavorite === b.isFavorite &&
    a.collectionNotes === b.collectionNotes &&
    a.source === b.source;
}

interface Props {
  existing?: Collection;
  onSave: (data: Omit<Collection, "id" | "createdAt" | "updatedAt" | "attempts">) => Promise<void>;
  onClose: () => void;
}

export default function CollectionModal({ existing, onSave, onClose }: Props) {
  const { t } = useLocale();
  const statusOpts: { value: Status }[] = [{ value: "want" }, { value: "tried" }, { value: "ref" }];
  const [form, setForm] = useState<FormState>(() => initForm(existing));
  const initialFormRef = useRef(form);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const closeGuard = useModalCloseGuard({ isDirty: !sameForm(initialFormRef.current, form), isBusy: isSaving, onClose });
  const close = closeGuard.requestClose;
  const fileRef = useRef<HTMLInputElement>(null);
  const newImageIds = useRef(new Set<string>());
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    for (const id of newImageIds.current) discardStagedImage(id);
  }, []);

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
      patch({ progress: 20 });
      const result = await createCanonicalImage(item.file, item.id);
      if (!mountedRef.current) return;
      stageCanonicalImage(result.ref, result.blob);
      newImageIds.current.add(item.id);
      patch({ image: result.ref, status: "done", progress: 100, isNew: true });
    } catch (error) {
      if (!mountedRef.current) return;
      patch({ status: "error", error: error instanceof Error ? error.message : ErrorCode.imageReadFailed });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const items: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(), file, name: file.name, status: "loading", progress: 0,
    }));
    setForm((f) => ({ ...f, referenceImages: [...f.referenceImages, ...items] }));
    items.forEach((item) => { void readImage(item); });
    // 允許移除或讀取失敗後再次選取同一個檔案。
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(i: number) {
    const removed = form.referenceImages[i];
    if (removed?.isNew) { discardStagedImage(removed.id); newImageIds.current.delete(removed.id); }
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
      name: form.name.trim() || undefined,
      referenceImages: form.referenceImages.filter((i): i is UploadItem & { image: ImageRef } => i.status === "done" && Boolean(i.image)).map((i) => i.image),
      coverSource: existing && (existing.coverSource.type === "attempt" || form.referenceImages.some((item) => item.image?.id === existing.coverSource.imageId))
        ? existing.coverSource
        : { type: "reference", imageId: form.referenceImages.find((item) => item.status === "done")?.image?.id ?? "" },
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-[#161618] border border-[#2e2e32] shadow-2xl"
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#1e1e21]">
          <h2 className="text-sm font-bold text-[#f0ede8]" style={{ fontFamily: "'Fraunces', serif" }}>
            {existing ? t.editCollection : t.newCollection}
          </h2>
          <button onClick={close} className="text-[#b8b5af] hover:text-[#f0ede8] transition-colors w-7 h-7 flex items-center justify-center">
            ×
          </button>
        </div>

        <fieldset disabled={isSaving} className="ios-form-zoom-fix px-5 py-4 flex flex-col gap-4">
          {/* 收藏名稱：選填；空白時不建立名稱欄位 */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
              {t.nameOptional}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] focus:outline-none focus:border-[#c9a96e55] transition-colors"
            />
          </div>

          {/* Reference images */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
              {t.referenceImagesOptional}
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
                    <button type="button" onClick={() => void readImage(img)} title={img.error ? translateError(img.error, t) : undefined} aria-label={t.retryNamed(img.name)} className="w-full h-full bg-[#2a1010] text-[#e06e6e] text-xs">{t.retry}</button>
                  ) : (
                    img.image && <StoredImage image={img.image} variant="thumbnail" alt="" className="w-full h-full object-cover" />
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

          <p className="text-xs leading-relaxed text-[#b8b5af]">{t.localLibraryHint.split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</p>
          {hasImageError && <div role="alert" className="text-xs text-[#e06e6e]">
            {form.referenceImages.filter((image) => image.status === "error").map((image) => <p key={image.id}>{image.name}：{image.error ? translateError(image.error, t) : ""}</p>)}
            {t.imageSaveBlocked}
          </div>}

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal">
                {t.originalPromptOptional}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-xs text-[#b8b5af] font-ui">{t.skipForNow}</span>
                <div
                  onClick={() => set("promptPending", !form.promptPending)}
                  className={`w-7 h-4 rounded-full transition-colors cursor-pointer ${form.promptPending ? "bg-[#c9a96e]" : "bg-[#2e2e32]"}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${form.promptPending ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </div>
            <ResizableTextarea
              value={form.originalPrompt}
              onChange={(e) => set("originalPrompt", e.target.value)}
              placeholder={t.promptPlaceholder}
              rows={3}
              disabled={form.promptPending}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors disabled:opacity-40 font-technical"
              style={{ height: 56 }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
              {t.tagsComma}
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder={t.tagsPlaceholder}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-technical"
            />
          </div>

          {/* Status + source in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
                {t.status}
              </label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {statusOpts.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => set("status", o.value)}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${form.status === o.value ? "border-[#c9a96e] bg-[#c9a96e]" : "border-[#2e2e32]"}`}
                    />
                    <span className="text-xs text-[#b8b5af]">{t.statusLabel[o.value]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
                {t.sourceUrl}
              </label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder={t.urlPlaceholder}
                className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-technical"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5">
              {t.collectionNotes}
            </label>
            <ResizableTextarea
              value={form.collectionNotes}
              onChange={(e) => set("collectionNotes", e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={2}
              className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2.5 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors"
            />
          </div>

          {/* Favorite */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => set("isFavorite", !form.isFavorite)}
              aria-label={form.isFavorite ? t.removeFavorite : t.addFavorite}
              aria-pressed={form.isFavorite}
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${form.isFavorite ? "text-[#DB8587]" : "text-[#b8b5af] hover:text-[#DB8587]"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={form.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
            </button>
            <span className="text-xs text-[#b8b5af]">{t.addFavorite}</span>
          </div>
        </fieldset>

        <div className="px-5 py-4 border-t border-[#1e1e21] flex items-center gap-3 justify-end">
          <button onClick={close} className="px-4 py-2 text-xs text-[#b8b5af] hover:text-[#f0ede8] font-ui transition-colors">
            {t.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isLoading || hasImageError}
            className="px-4 py-2 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors disabled:opacity-40"
          >
            {isSaving ? t.saving : isLoading ? t.reading : existing ? t.saveChanges : t.newCollection}
          </button>
        </div>
      </div>
      <UnsavedChangesDialog
        open={closeGuard.confirmationOpen}
        onContinueEditing={closeGuard.continueEditing}
        onDiscard={closeGuard.discardChanges}
      />
    </div>
  );
}
