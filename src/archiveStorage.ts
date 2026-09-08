import { Collection } from "./types";
import { SEED } from "./seed";

const LEGACY_KEY = "prompt-archive-v2";
const DATABASE = "prompt-archive";
const TABLE = "archive";
type StoredCollection = Omit<Collection, "referenceImages" | "attempts"> & {
  referenceImages: (string | Blob)[];
  attempts: (Omit<Collection["attempts"][number], "images"> & { images: (string | Blob)[] })[];
};
interface Snapshot { revision: number; collections: StoredCollection[] }

// ── 本機圖片保存：Data URL 還原成 Blob，保留原始位元組、不壓縮 ──
function encodeImage(source: string): string | Blob {
  if (!source.startsWith("data:")) return source;
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(source);
  if (!match) throw new Error("圖片資料格式不正確；原有資料未變更。");
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}
function decodeImage(source: string | Blob): Promise<string> {
  if (typeof source === "string") return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(source);
  });
}
function encode(collections: Collection[]): StoredCollection[] {
  return collections.map((c) => ({ ...c, referenceImages: c.referenceImages.map(encodeImage),
    attempts: c.attempts.map((a) => ({ ...a, images: a.images.map(encodeImage) })) }));
}
async function decode(collections: StoredCollection[]): Promise<Collection[]> {
  return Promise.all(collections.map(async (c) => ({ ...c,
    referenceImages: await Promise.all(c.referenceImages.map(decodeImage)),
    attempts: await Promise.all(c.attempts.map(async (a) => ({ ...a, images: await Promise.all(a.images.map(decodeImage)) }))),
  })));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("資料庫被其他分頁占用，請關閉其他圖庫分頁後重試。"));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
function readSnapshot(db: IDBDatabase): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TABLE, "readonly");
    const request = transaction.objectStore(TABLE).get("current");
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

// ── 原子交易及版本檢查：成功才回報，其他分頁的新版資料不被覆蓋 ──
async function writeSnapshot(db: IDBDatabase, next: Snapshot, expected: number | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TABLE, "readwrite");
    const table = transaction.objectStore(TABLE);
    let conflict = false;
    let writeError: unknown;
    const request = table.get("current");
    request.onsuccess = () => {
      // 另一分頁已完成首次遷移時沿用它，不重複寫入或把它當失敗。
      if (expected === undefined && request.result) return;
      if ((request.result as Snapshot | undefined)?.revision !== expected) {
        conflict = true;
        transaction.abort();
      } else {
        try { table.put(next, "current"); }
        catch (error) { writeError = error; transaction.abort(); }
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(conflict
      ? new Error("其他分頁已更新收藏。請先保留未儲存的文字，再重新整理此頁。")
      : writeError ?? transaction.error ?? new Error("儲存交易中止，請重試。"));
    transaction.onerror = () => { /* 由 onabort 統一處理，避免把部分寫入當成功。 */ };
  });
}

function validateLegacy(value: unknown): asserts value is Collection[] {
  if (!Array.isArray(value) || value.some((c) => !c || typeof c.id !== "string" ||
    typeof c.originalPrompt !== "string" || typeof c.collectionNotes !== "string" ||
    (c.name !== undefined && typeof c.name !== "string") ||
    !Array.isArray(c.tags) || !c.tags.every((t: unknown) => typeof t === "string") ||
    !c.coverSource || !Array.isArray(c.referenceImages) || !c.referenceImages.every((i: unknown) => typeof i === "string") ||
    !Array.isArray(c.attempts) || c.attempts.some((a: Collection["attempts"][number]) => !a ||
      typeof a.prompt !== "string" || typeof a.notes !== "string" ||
      (a.name !== undefined && typeof a.name !== "string") || !Array.isArray(a.images) || !a.images.every((i) => typeof i === "string")))) {
    throw new Error("舊收藏資料格式無法辨識，已保留原資料，未以範例覆蓋。");
  }
}

// ── 首次啟動遷移：舊資料寫入、讀回成功後才移除 localStorage 副本 ──
export async function loadArchive(): Promise<{ collections: Collection[]; revision: number }> {
  const db = await openDatabase();
  try {
    let snapshot = await readSnapshot(db);
    if (!snapshot) {
      const raw = localStorage.getItem(LEGACY_KEY);
      const collections: unknown = raw === null ? SEED : JSON.parse(raw);
      validateLegacy(collections);
      await writeSnapshot(db, { revision: 1, collections: encode(collections) }, undefined);
      snapshot = await readSnapshot(db);
    }
    if (!snapshot) throw new Error("無法讀回收藏，請重試。");
    const collections = await decode(snapshot.collections);
    // 清理失敗不影響已完成的遷移；下次仍優先使用 IndexedDB。
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* 瀏覽器可能禁止 localStorage。 */ }
    return { collections, revision: snapshot.revision };
  } finally { db.close(); }
}
export async function saveArchive(collections: Collection[], revision: number): Promise<number> {
  const encoded = encode(collections);
  const db = await openDatabase();
  try {
    await writeSnapshot(db, { collections: encoded, revision: revision + 1 }, revision);
    return revision + 1;
  } finally { db.close(); }
}
export function storageErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return "此瀏覽器可用儲存空間不足。請釋放裝置空間或刪除不需要的收藏後重試；表單仍保留。";
  if (name === "SecurityError" || name === "InvalidStateError") return "瀏覽器目前不允許使用本機資料庫，請檢查網站儲存權限後重試；表單仍保留。";
  return error instanceof Error ? error.message : "本機資料庫操作失敗，請重試；表單仍保留。";
}
