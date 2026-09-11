import { STATUS_STYLE } from "./statusStyles";
import { useLayoutEffect, useRef, useState } from "react";
import { Collection, Attempt, CoverSource, ImageRef } from "./types";
import { Store, getCoverImage } from "./store";
import ImageViewer from "./ImageViewer";
import ImageComparison from "./ImageComparison";
import PromptReader from "./PromptReader";
import type { PromptClassification } from "./promptClassification";
import StoredImage from "./StoredImage";
import { LanguageSwitcher, sectionLabelClass, useLocale } from "./i18n";

// 來源只允許一般網頁協定成為連結，避免危險協定被直接執行。
function safeSourceHref(source: string): string | null {
  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
const PLATFORM_COLORS: Record<string, string> = {
  PixAI: "text-[#a78bfa]",
  Midjourney: "text-[#6abf96]",
  Flux: "text-[#60a5fa]",
  Gemini: "text-[#fbbf24]",
  ChatGPT: "text-[#34d399]",
  "GPT-4o": "text-[#34d399]",
  SDXL: "text-[#f472b6]",
  ComfyUI: "text-[#fb923c]",
  Leonardo: "text-[#e879f9]",
};

type CompareMode = "mine" | "side";

interface Props {
  collection: Collection;
  store: Store;
  onBack: () => void;
  onAddAttempt: () => void;
  onEditAttempt: (a: Attempt) => void;
  onEditCollection: () => void;
}

export default function DetailView({
  collection: c,
  store,
  onBack,
  onAddAttempt,
  onEditAttempt,
  onEditCollection,
}: Props) {
  const { locale, t } = useLocale();
  const { toggleFavorite, deleteCollection, deleteAttempt, setCover } = store;
  const [compareMode, setCompareMode] = useState<CompareMode>("mine");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(
    c.attempts.at(-1)?.id ?? ""
  );
  const [viewer, setViewer] = useState<{ images: ImageRef[]; index: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // 切換比較版面後回到圖片區，避免瀏覽器捲動錨點留在移到下方的原始資訊。
  useLayoutEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [compareMode]);

  const selectedAttempt = c.attempts.find((a) => a.id === selectedAttemptId) ?? c.attempts.at(-1);

  async function handleDelete() {
    if (await deleteCollection(c.id)) onBack();
  }

  const allImages: { image: ImageRef; label: string; coverSrc: CoverSource }[] = [
    ...c.referenceImages.map((image, i) => ({
      image,
      label: t.referenceImageN(i + 1),
      coverSrc: { type: "reference" as const, imageId: image.id },
    })),
    ...c.attempts.flatMap((a) =>
      a.images.map((image, i) => ({
        image,
        label: t.attemptCoverLabel(a.platform, a.date.slice(5), i + 1),
        coverSrc: {
          type: "attempt" as const,
          attemptId: a.id,
          imageId: image.id,
        },
      }))
    ),
  ];

  const currentCover = getCoverImage(c);
  const sourceHref = c.source ? safeSourceHref(c.source) : null;

  return (
    <div ref={detailRef} className="h-full overflow-y-auto bg-[#0d0d0e]">
      {/* Nav bar */}
      <div className="sticky top-0 z-30 bg-[#0d0d0e]/95 backdrop-blur-md border-b border-[#1e1e21] px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-[#b8b5af] hover:text-[#f0ede8] transition-colors text-sm font-ui flex items-center gap-1.5"
        >
          {t.back}
        </button>
        {c.name && (
          <p
            className="min-w-0 truncate text-sm font-normal not-italic text-[#f0ede8]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {c.name}
          </p>
        )}
        <div className="flex-1" />
        <div className="hidden md:block">
          <LanguageSwitcher />
        </div>
        <button
          onClick={() => toggleFavorite(c.id)}
          aria-label={c.isFavorite ? t.removeFavorite : t.addFavorite} aria-pressed={c.isFavorite} className={`text-xs w-9 h-9 flex items-center justify-center transition-colors ${c.isFavorite ? "text-[#DB8587]" : "text-[#b8b5af] hover:text-[#DB8587]"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={c.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
        </button>
        <button
          onClick={onEditCollection}
          className="px-2.5 py-1 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors"
        >
          {t.edit}
        </button>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-2.5 py-1 text-xs text-[#b8b5af] hover:text-[#e06e6e] hover:border-[#e06e6e] border border-[#2e2e32] rounded-lg transition-colors font-ui"
          >
            {t.delete}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#e06e6e] font-ui">{t.confirmDelete}</span>
            <button onClick={handleDelete} className="px-2 py-1 text-xs bg-[#e06e6e] text-white rounded font-ui">{t.confirm}</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-1 text-xs text-[#b8b5af] border border-[#2e2e32] rounded font-ui">{t.cancel}</button>
          </div>
        )}
      </div>

      {/* 模式入口位置固定；主頁左窄右寬，並排模式左右等寬。 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-3 grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-3 md:gap-6 items-start">
          {/* Status + tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[c.status]}`}>
              <span className="w-1 h-1 rounded-full bg-current" />
              {t.statusLabel[c.status]}
            </span>
            {c.tags.map((t) => (
              <span key={t} className="text-xs font-technical text-[#c9a96e] bg-[#2a2010] px-2 py-0.5 rounded-full">
                #{t}
              </span>
            ))}
          </div>


            <div className="flex items-center gap-2">
              {(["mine", "side"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCompareMode(m)}
                  className={`px-2.5 py-1 text-xs font-ui rounded-md transition-colors ${
                    compareMode === m
                      ? "bg-[#c9a96e] text-[#0d0d0e]"
                      : "text-[#b8b5af] hover:text-[#f0ede8] border border-[#2e2e32]"
                  }`}
                >
                  {m === "mine" ? t.myResults : t.compare}
                </button>
              ))}
            </div>

      </div>
      {compareMode === "side" && <div className="max-w-6xl mx-auto px-4 xs:px-6 pb-8">
        <ImageComparison collection={c} preferredAttemptId={selectedAttempt?.id} store={store} onZoom={(src) => setViewer({ images: [src], index: 0 })} />
      </div>}
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 pb-6 gap-6 grid-cols-1 md:grid-cols-[1fr_1.4fr] ${compareMode === "side" ? "hidden" : "grid"}`}>
        {/* Left: reference info */}
        <div className="min-w-0 flex flex-col gap-5">
          {/* 主頁直接從參考原圖標題開始，與右側嘗試紀錄並排。選圖只在比較模式顯示。 */}
          <ImagePane
            images={c.referenceImages}
            label={t.referenceOriginal}
            collectedDate={c.createdAt.slice(0, 10)}
            onZoom={(i) => setViewer({ images: c.referenceImages, index: i })}
            emptyText={t.noReferenceImage}
          />

          {/* Cover picker */}
          {allImages.length > 0 && (
            <div>
              <button
                onClick={() => setShowCoverPicker(!showCoverPicker)}
                className="text-xs text-[#b8b5af] hover:text-[#c9a96e] font-ui transition-colors"
              >
                {showCoverPicker ? t.collapse : t.changeCover}
              </button>
              {showCoverPicker && (
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {allImages.map((img, i) => (
                    <div
                      key={i}
                      className={`relative rounded overflow-hidden bg-[#161618] cursor-pointer group`}
                      style={{ aspectRatio: "1" }}
                      onClick={async () => { if (await setCover(c.id, img.coverSrc)) setShowCoverPicker(false); }}
                      title={img.label}
                    >
                      <StoredImage image={img.image} variant="thumbnail" alt="" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
                      {currentCover?.id === img.image.id && (
                        <div className="absolute inset-0 border-2 border-[#c9a96e] rounded pointer-events-none" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 原始 Prompt：完整原文與獨立的分類閱讀視圖。 */}
          <PromptReader
            title={t.originalPrompt}
            text={c.originalPrompt}
            saved={c.promptClassification}
            onSave={(promptClassification) => store.editCollection(c.id, { promptClassification })}
          />

          {/* Collection notes */}
          {c.collectionNotes && (
            <div>
              <p className={`text-xs font-bold text-[#c8c4bc] mb-1.5 ${sectionLabelClass(locale)}`}>{t.collectionNotes}</p>
              <p className="whitespace-pre-wrap break-words rounded-lg border-2 border-dashed border-[#2e2e32] bg-[#111113] p-3 text-xs leading-relaxed text-[#c8c4bc]">
                {c.collectionNotes}
              </p>
            </div>
          )}

          {c.source && (
            <p className="text-xs text-[#b8b5af] font-ui break-all">
              {t.source}{sourceHref ? (
                <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="font-technical underline underline-offset-2 hover:text-[#c9a96e]">
                  {c.source}
                </a>
              ) : c.source}
            </p>
          )}

        </div>

        {/* Right: compare + attempts */}
        <div className="min-w-0 flex flex-col gap-5">
          {/* Attempts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-bold text-[#b8b5af] ${sectionLabelClass(locale)}`}>
                {t.attemptLog(c.attempts.length)}
              </p>
              <button
                onClick={onAddAttempt}
                className="px-2.5 py-1 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors"
              >
                {t.addAttempt}
              </button>
            </div>

            {c.attempts.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#2e2e32] rounded-lg">
                <p className="text-xs text-[#b8b5af] font-ui mb-2">{t.noAttempts}</p>
                <button onClick={onAddAttempt} className="text-xs text-[#c9a96e] hover:underline font-ui">
                  {t.addFirstAttempt}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[...c.attempts].reverse().map((a) => (
                  <AttemptCard
                    key={a.id}
                    attempt={a}
                    isSelected={a.id === selectedAttempt?.id}
                    onEdit={() => onEditAttempt(a)}
                    onDelete={() => deleteAttempt(c.id, a.id)}
                    onZoom={(i) => setViewer({ images: a.images, index: i })}
                    onSaveClassification={(promptClassification) => store.editAttempt(c.id, a.id, { promptClassification })}
                  />
                ))}
              </div>
            )}
          </div>


        </div>
      </div>

      {viewer && (
        <ImageViewer
          images={viewer.images}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onChange={(i) => setViewer({ ...viewer, index: i })}
        />
      )}
    </div>
  );
}

function ImagePane({
  images,
  label,
  onZoom,
  emptyText,
  collectedDate,
}: {
  images: ImageRef[];
  label: string;
  onZoom: (i: number) => void;
  emptyText: string;
  collectedDate?: string;
}) {
  const { locale, t } = useLocale();
  const [idx, setIdx] = useState(0);
  const i = Math.min(idx, images.length - 1);
  // 圖片標題與收藏日期同排；手機可換行。
  const heading = <div className="flex flex-wrap items-baseline justify-between gap-2"><p className={`text-xs font-bold text-[#c8c4bc] ${sectionLabelClass(locale)}`}>{label}</p>{collectedDate && <p className="text-xs text-[#b8b5af]">{t.collectedOn(collectedDate)}</p>}</div>;

  if (images.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">{heading}<div className="h-[min(65vh,640px)] bg-[#161618] rounded-lg flex items-center justify-center border border-[#2e2e32]"><p className="text-xs text-[#b8b5af] font-ui">{emptyText}</p></div></div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {heading}
      <button
        className="relative w-full h-[min(65vh,640px)] rounded-lg overflow-hidden bg-[#161618] cursor-zoom-in"
        aria-label={t.zoom(label)}
        type="button"
        onClick={() => onZoom(i)}
      >
        <StoredImage image={images[i]} variant="canonical" alt={label} className="w-full h-full object-contain" />
      </button>
      {images.length > 1 && (
        <div className="flex gap-1 overflow-x-auto">
          {images.map((image, j) => (
            <div
              key={image.id}
              className={`w-12 shrink-0 rounded overflow-hidden cursor-pointer bg-[#161618] ${j === i ? "ring-1 ring-[#c9a96e]" : "opacity-50 hover:opacity-80"}`}
              style={{ aspectRatio: "1" }}
              onClick={() => setIdx(j)}
            >
              <StoredImage image={image} variant="thumbnail" alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttemptCard({
  attempt: a,
  isSelected,
  onEdit,
  onDelete,
  onZoom,
  onSaveClassification,
}: {
  attempt: Attempt;
  isSelected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onZoom: (i: number) => void;
  onSaveClassification: (classification: PromptClassification) => Promise<boolean>;
}) {
  const { locale, t } = useLocale();
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const platformColor = PLATFORM_COLORS[a.platform] ?? "text-[#b8b5af]";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected ? "border-[#c9a96e44] bg-[#161618]" : "border-[#1e1e21] bg-[#0d0d0e] hover:border-[#2e2e32]"
      }`}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            {a.name && (
              <p
                className="mb-1 text-sm font-normal text-[#f0ede8]"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {a.name}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-technical font-bold ${platformColor}`}>{a.platform}</span>
              {a.model && <span className="text-xs text-[#b8b5af] font-technical">{a.model}</span>}
              <span className="text-xs text-[#b8b5af] font-technical">{a.date}</span>
            </div>
          </div>
          {a.rating && (
            <div className="flex gap-0.5 flex-shrink-0">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className={s <= a.rating! ? "text-[#c9a96e]" : "text-[#b8b5af]"} style={{ fontSize: 12 }}>★</span>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {a.images.length > 0 && (
          <div className="flex gap-1 mb-2.5 overflow-x-auto">
            {a.images.map((image, i) => (
              <div
                key={image.id}
                className="relative rounded overflow-hidden bg-[#1e1e21] cursor-pointer group flex-shrink-0"
                style={{ width: 112, height: 112 }}
                onClick={() => onZoom(i)}
              >
                <StoredImage image={image} variant="thumbnail" alt="" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {a.notes && (
          <div className="mb-3">
            <p className={`mb-1.5 text-xs font-bold text-[#c8c4bc] ${sectionLabelClass(locale)}`}>{t.notes}</p>
            <p className="whitespace-pre-wrap break-words rounded-lg border-2 border-dashed border-[#2e2e32] bg-[#111113] p-3 text-xs leading-relaxed text-[#c8c4bc]">{a.notes}</p>
          </div>
        )}

        {a.promptMode === "original" ? (
          <p className={`text-xs font-bold text-[#c8c4bc] ${sectionLabelClass(locale)}`}>{t.unchanged}</p>
        ) : (
          <PromptReader
            title={t.attemptPrompt}
            text={a.prompt}
            saved={a.promptClassification}
            onSave={onSaveClassification}
          />
        )}
      </div>

      {/* Action row */}
      <div className="px-3 pb-2 flex flex-wrap items-center gap-2 border-t border-[#1e1e21] pt-2">
        <div className="flex-1" />
        <button onClick={onEdit} className="px-2.5 py-1 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors">{t.edit}</button>
        {!showDelConfirm ? (
          <button onClick={() => setShowDelConfirm(true)} className="text-xs text-[#b8b5af] hover:text-[#e06e6e] font-ui transition-colors">{t.delete}</button>
        ) : (
          <>
            <button onClick={onDelete} className="text-xs text-[#e06e6e] font-ui">{t.confirm}</button>
            <button onClick={() => setShowDelConfirm(false)} className="text-xs text-[#b8b5af] font-ui">{t.cancel}</button>
          </>
        )}
      </div>

    </div>
  );
}
