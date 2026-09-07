import type { Collection, Attempt } from "./types";

export interface ComparisonImage {
  id: string;
  src: string;
  label: string;
  attempt?: Attempt;
}
// ── 每張圖綁定其來源版本，選圖時一併切換正確 Prompt ──
export function comparisonImages(collection: Collection): ComparisonImage[] {
  return [
    ...collection.referenceImages.map((src, i) => ({ id: `reference:${i}`, src, label: `參考圖 ${i + 1}` })),
    ...collection.attempts.flatMap((attempt, attemptIndex) => attempt.images.map((src, imageIndex) => ({
      id: `attempt:${attempt.id}:${imageIndex}`, src, attempt,
      label: `嘗試 ${attemptIndex + 1} · ${attempt.platform} · ${attempt.date} · 圖 ${imageIndex + 1}`,
    }))),
  ];
}
export function defaultComparisonIds(images: ComparisonImage[], preferredAttemptId?: string): string[] {
  const reference = images.find((image) => !image.attempt);
  const attemptId = preferredAttemptId ?? images.filter((image) => image.attempt).at(-1)?.attempt?.id;
  const latestAttempt = images.find((image) => image.attempt?.id === attemptId && image.attempt);
  if (reference && latestAttempt) return [reference.id, latestAttempt.id];
  return images.slice(0, 2).map((image) => image.id);
}
// 共用選取列：再次點擊取消，新圖片填入空欄；最多兩張且不重複。
export function toggleComparisonSelection(selected: (string | undefined)[], id: string): (string | undefined)[] {
  const next = [selected[0], selected[1]];
  const existing = next.indexOf(id);
  if (existing !== -1) next[existing] = undefined;
  else {
    const empty = next.indexOf(undefined);
    if (empty !== -1) next[empty] = id;
  }
  return next;
}
