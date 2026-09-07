import { useState } from "react";
import type { Collection } from "./types";
import type { Store } from "./store";
import PromptReader from "./PromptReader";
import { comparisonImages, defaultComparisonIds, toggleComparisonSelection } from "./comparisonImages";

// ── 兩個等寬比較欄：圖片、來源與對應 Prompt 永遠放在同一欄 ──
export default function ImageComparison({ collection, store, onZoom, preferredAttemptId }: {
  collection: Collection;
  preferredAttemptId?: string;
  store: Store;
  onZoom: (src: string) => void;
}) {
  const images = comparisonImages(collection);
  const [selected, setSelected] = useState<(string | undefined)[]>(() => defaultComparisonIds(images, preferredAttemptId));
  // 圖片被刪除後不沿用已失效的索引；空出欄位讓使用者重新選擇。
  const valid = selected.map((id) => images.some((image) => image.id === id) ? id : undefined);
  return (
    <section aria-label="圖片與 Prompt 並排比較" className="min-w-0">
      {/* 共用縮圖 filmstrip：44 × 58px；超出寬度時可橫向捲動。 */}
      <div aria-label="比較選圖" className="mb-4 overflow-x-auto py-1">
        <div className="mx-auto flex w-max items-center gap-2 whitespace-nowrap">
        {images.map((option) => (
          <button key={option.id} type="button" aria-label={option.label} aria-pressed={valid.includes(option.id)}
            title={valid.filter(Boolean).length === 2 && !valid.includes(option.id) ? "請先取消一張已選圖片" : option.label}
            disabled={valid.filter(Boolean).length === 2 && !valid.includes(option.id)}
            onClick={() => setSelected(toggleComparisonSelection(valid, option.id))}
            className={`h-[58px] w-[44px] shrink-0 overflow-hidden rounded-md border p-0.5 focus-visible:outline-2 focus-visible:outline-[#c9a96e] focus-visible:outline-offset-2 disabled:opacity-50 ${valid.includes(option.id) ? "border-[#c9a96e] bg-[#2a2010] text-[#e4c68f]" : "border-[#55545a] text-[#b8b5af] hover:text-[#f0ede8]"}`}>
            <img src={option.src} alt="" loading="lazy" className="h-full w-full rounded-sm object-cover" />
          </button>
        ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {([0, 1] as const).map((slot) => {
          const image = images.find((item) => item.id === valid[slot]);
          const attempt = image?.attempt;
          return <div key={slot} aria-label={slot === 0 ? "左側比較欄" : "右側比較欄"} className="min-w-0 flex flex-col gap-4">
            <p className="h-5 truncate text-xs leading-5 text-[#b8b5af]" title={image?.label}>{image?.label ?? "請從上方選擇圖片"}</p>
            {image ? <button type="button" onClick={() => onZoom(image.src)} aria-label={`放大${slot === 0 ? "左" : "右"}欄圖片`} className="h-[min(60vh,640px)] w-full overflow-hidden rounded-lg bg-[#161618] cursor-zoom-in">
              <img src={image.src} alt={image.label} className="h-full w-full object-contain" />
            </button> : <div className="h-[min(60vh,640px)] rounded-lg border border-dashed border-[#55545a] flex items-center justify-center text-sm text-[#b8b5af]">{images.length ? "請從上方選擇圖片" : "尚無可比較的圖片"}</div>}
            {image && <PromptReader
              key={image.id}
              fullHeight
              title={attempt ? "這次嘗試的 Prompt" : "原始 Prompt"}
              text={attempt?.prompt ?? collection.originalPrompt}
              saved={attempt?.promptClassification ?? (!attempt ? collection.promptClassification : undefined)}
              onSave={(promptClassification) => attempt
                ? store.editAttempt(collection.id, attempt.id, { promptClassification })
                : store.editCollection(collection.id, { promptClassification })}
            />}
            {image && (attempt?.notes || (!attempt && collection.collectionNotes)) && <div className="rounded-lg border border-[#2e2e32] p-3">
              <p className="mb-2 text-xs font-bold text-[#c9a96e]">{attempt ? "這次心得" : "收藏筆記"}</p>
              <p className="whitespace-pre-wrap break-words text-xs text-[#c8c4bc]">{attempt ? attempt.notes : collection.collectionNotes}</p>
            </div>}
          </div>;
        })}
      </div>
    </section>
  );
}

