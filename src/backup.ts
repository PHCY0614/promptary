import type { Collection } from "./types";

// 匯入是不可信輸入：整份檢查成功後才允許寫入，避免半套卡片。
export function parseBackup(text: string): Collection[] {
  const value = JSON.parse(text.replace(/^\uFEFF/, ""));
  const fail = () => { throw new Error("備份格式不完整或不支援，請選擇 Promptary 匯出的 JSON。原有收藏未變更。"); };
  const str = (v: unknown) => typeof v === "string";
  const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v as string));
  const images = (v: unknown) => Array.isArray(v) && v.every((s) => {
    if (!str(s)) return false;
    if (/^https?:\/\//i.test(s)) { try { return Boolean(new URL(s).hostname); } catch { return false; } }
    return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(s) && s.split(",")[1].length % 4 === 0;
  });
  const classification = (v: any) => v === undefined || (v && str(v.sourcePrompt) && v.overrides &&
    typeof v.overrides === "object" && !Array.isArray(v.overrides) && Object.values(v.overrides).every((c) =>
      ["appearance", "clothing", "pose", "background", "composition", "lighting", "style", "other"].includes(c as string)));
  if (!Array.isArray(value)) fail();
  for (const c of value) {
    if (!c || !str(c.id) || !c.id || !str(c.originalPrompt) || !str(c.collectionNotes) ||
      typeof c.isFavorite !== "boolean" || typeof c.promptPending !== "boolean" ||
      !["tried", "want", "ref"].includes(c.status) || !date(c.addedAt) || !date(c.updatedAt) ||
      (c.source !== undefined && !str(c.source)) || !classification(c.promptClassification) ||
      !Array.isArray(c.tags) || !c.tags.every(str) || !images(c.referenceImages) || !Array.isArray(c.attempts)) fail();
    const ids = new Set();
    for (const a of c.attempts) {
      if (!a || !str(a.id) || !a.id || ids.has(a.id) || !str(a.platform) || !str(a.prompt) || !str(a.notes) ||
        !date(a.date) || !date(a.createdAt) || !images(a.images) || !classification(a.promptClassification) ||
        (a.model !== undefined && !str(a.model)) || !(a.rating === null || [1, 2, 3, 4, 5].includes(a.rating))) fail();
      ids.add(a.id);
    }
    const cover = c.coverSource;
    if (!cover || (cover.type !== "reference" && cover.type !== "attempt")) fail();
    if (cover.type === "reference") {
      if (!Number.isInteger(cover.index) || cover.index < 0 || cover.index >= Math.max(1, c.referenceImages.length)) fail();
    } else {
      const a = c.attempts.find((a: any) => a.id === cover.attemptId);
      if (!a || !Number.isInteger(cover.imageIndex) || cover.imageIndex < 0 || cover.imageIndex >= a.images.length) fail();
    }
  }
  return value;
}

// 以收藏 ID 去重（包含備份內的重複 ID）；既有版本不被覆蓋。
export function mergeBackup(current: Collection[], incoming: Collection[]) {
  const ids = new Set(current.map((c) => c.id));
  const added = incoming.filter((c) => { if (ids.has(c.id)) return false; ids.add(c.id); return true; });
  return { collections: [...added, ...current], added: added.length, skipped: incoming.length - added.length };
}
