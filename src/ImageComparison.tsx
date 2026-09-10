import { useState } from "react";
import type { Collection } from "./types";
import type { Store } from "./store";
import PromptReader from "./PromptReader";
import { comparisonImages, defaultComparisonIds, toggleComparisonSelection } from "./comparisonImages";
import StoredImage from "./StoredImage";
import type { ImageRef } from "./types";

// ── 桌機保留完整雙欄；手機固定雙圖並排，文字資訊改由 A／B 切換。 ──
export default function ImageComparison({ collection, store, onZoom, preferredAttemptId }: {
  collection: Collection;
  preferredAttemptId?: string;
  store: Store;
  onZoom: (image: ImageRef) => void;
}) {
  const images = comparisonImages(collection);
  const [selected, setSelected] = useState<(string | undefined)[]>(() => defaultComparisonIds(images, preferredAttemptId));
  const [activeMobileSlot, setActiveMobileSlot] = useState<0 | 1>(0);
  // 圖片被刪除後不沿用已失效的索引；空出欄位讓使用者重新選擇。
  const valid = selected.map((id) => images.some((image) => image.id === id) ? id : undefined);
  const slotImages = ([0, 1] as const).map((slot) => images.find((item) => item.id === valid[slot]));
  function renderTextInfo(slot: 0 | 1) {
    const image = slotImages[slot];
    const attempt = image?.attempt;
    if (!image) return <p className="text-sm text-[#b8b5af]">請從上方選擇圖片</p>;
    const attemptIndex = attempt ? collection.attempts.findIndex((candidate) => candidate.id === attempt.id) : -1;
    const model = attempt?.model?.trim();
    const usesOriginalPrompt = attempt?.promptMode === "original";
    const promptTitle = attempt
      ? `嘗試 ${attemptIndex + 1} · ${attempt.platform}${model ? ` · ${model}` : ""}${usesOriginalPrompt ? " · 無修改" : " 的咒語"}`
      : "原始咒語";
    return <>
      <PromptReader
        key={image.id}
        fullHeight
        editable={false}
        title={promptTitle}
        text={!attempt || usesOriginalPrompt ? collection.originalPrompt : attempt.prompt}
        saved={!attempt || usesOriginalPrompt ? collection.promptClassification : attempt.promptClassification}
        onSave={(promptClassification) => !attempt || usesOriginalPrompt
          ? store.editCollection(collection.id, { promptClassification })
          : store.editAttempt(collection.id, attempt.id, { promptClassification })}
      />
      {(attempt?.notes || (!attempt && collection.collectionNotes)) && <div>
        <p className="mb-1.5 text-xs font-bold text-[#c8c4bc] font-ui normal-case tracking-normal">{attempt ? "筆記" : "收藏筆記"}</p>
        <p className="whitespace-pre-wrap break-words rounded-lg border-2 border-dashed border-[#2e2e32] bg-[#111113] p-3 text-xs leading-relaxed text-[#c8c4bc]">{attempt ? attempt.notes : collection.collectionNotes}</p>
      </div>}
    </>;
  }
  return (
    <section aria-label="圖片與咒語並排比較" className="min-w-0">
      {/* 共用縮圖 filmstrip：44 × 58px；超出寬度時可橫向捲動。 */}
      <div aria-label="比較選圖" className="mb-4 overflow-x-auto py-1">
        <div className="mx-auto flex w-max items-center gap-2 whitespace-nowrap">
        {images.map((option) => (
          <button key={option.id} type="button" aria-label={option.label} aria-pressed={valid.includes(option.id)}
            title={valid.filter(Boolean).length === 2 && !valid.includes(option.id) ? "請先取消一張已選圖片" : option.label}
            disabled={valid.filter(Boolean).length === 2 && !valid.includes(option.id)}
            onClick={() => setSelected(toggleComparisonSelection(valid, option.id))}
            className={`h-[58px] w-[44px] shrink-0 overflow-hidden rounded-md border p-0.5 focus-visible:outline-2 focus-visible:outline-[#c9a96e] focus-visible:outline-offset-2 disabled:opacity-50 ${valid.includes(option.id) ? "border-[#c9a96e] bg-[#2a2010] text-[#e4c68f]" : "border-[#55545a] text-[#b8b5af] hover:text-[#f0ede8]"}`}>
            <StoredImage image={option.image} variant="thumbnail" alt="" loading="lazy" className="h-full w-full rounded-sm object-cover" />
          </button>
        ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {([0, 1] as const).map((slot) => {
          const image = slotImages[slot];
          return <div key={slot} aria-label={slot === 0 ? "A 圖片" : "B 圖片"} className="min-w-0">
            <p className="mb-2 h-5 truncate text-xs leading-5 text-[#b8b5af]" title={image?.label}>{image?.label ?? `請選擇${slot === 0 ? " A" : " B"} 圖片`}</p>
            {image ? <button type="button" onClick={() => onZoom(image.image)} aria-label={`放大${slot === 0 ? " A" : " B"} 圖片`} className="h-[42vh] min-h-[260px] max-h-[460px] w-full cursor-zoom-in overflow-hidden rounded-lg bg-[#161618]">
              <StoredImage image={image.image} variant="canonical" alt={image.label} className="h-full w-full object-contain" />
            </button> : <div className="flex h-[42vh] min-h-[260px] max-h-[460px] items-center justify-center rounded-lg border border-dashed border-[#55545a] px-2 text-center text-xs text-[#b8b5af]">{images.length ? "請從上方選擇圖片" : "尚無可比較的圖片"}</div>}
          </div>;
        })}
      </div>
      <div className="mt-4 md:hidden">
        <div aria-label="比較圖片資訊" className="mx-auto flex w-fit items-center gap-1 rounded-md border border-[#2e2e32] bg-[#111113] p-0.5">
          {([0, 1] as const).map((slot) => <button
            key={slot}
            type="button"
            aria-label={slot === 0 ? "顯示左圖資訊" : "顯示右圖資訊"}
            title={slot === 0 ? "顯示左圖資訊" : "顯示右圖資訊"}
            aria-pressed={activeMobileSlot === slot}
            onClick={() => setActiveMobileSlot(slot)}
            className={`inline-flex h-7 w-8 cursor-pointer items-center justify-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-[#c9a96e] focus-visible:outline-offset-2 ${activeMobileSlot === slot ? "border-[#c9a96e] bg-[#2a2010] text-[#e4c68f]" : "border-transparent text-[#77747c] hover:bg-[#1b1b1e] hover:text-[#f0ede8]"}`}
          >
            {slot === 0
              ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>}
          </button>)}
        </div>
        <div className="mt-4">
          {([0, 1] as const).map((slot) => <div
            key={slot}
            aria-label={slot === 0 ? "左圖資訊" : "右圖資訊"}
            className={`${activeMobileSlot === slot ? "flex" : "hidden"} min-w-0 flex-col gap-4`}
          >
            {renderTextInfo(slot)}
          </div>)}
        </div>
      </div>
      <div className="hidden items-start gap-6 md:grid md:grid-cols-2">
        {([0, 1] as const).map((slot) => {
          const image = slotImages[slot];
          return <div key={slot} aria-label={slot === 0 ? "左側比較欄" : "右側比較欄"} className="min-w-0 flex flex-col gap-4">
            <p className="h-5 truncate text-xs leading-5 text-[#b8b5af]" title={image?.label}>{image?.label ?? "請從上方選擇圖片"}</p>
            {image ? <button type="button" onClick={() => onZoom(image.image)} aria-label={`放大${slot === 0 ? "左" : "右"}欄圖片`} className="h-[min(60vh,640px)] w-full overflow-hidden rounded-lg bg-[#161618] cursor-zoom-in">
              <StoredImage image={image.image} variant="canonical" alt={image.label} className="h-full w-full object-contain" />
            </button> : <div className="h-[min(60vh,640px)] rounded-lg border border-dashed border-[#55545a] flex items-center justify-center text-sm text-[#b8b5af]">{images.length ? "請從上方選擇圖片" : "尚無可比較的圖片"}</div>}
            {image && renderTextInfo(slot)}
          </div>;
        })}
      </div>
    </section>
  );
}
