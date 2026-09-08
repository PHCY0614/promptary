import type { Attempt, Collection, CoverSource, ImageRef } from "./types";
import { SEED } from "./seed";
import { createCanonicalImage, createThumbnail, THUMBNAIL_VERSION } from "./imageProcessing";

const LEGACY_KEY = "prompt-archive-v2";
const DATABASE = "prompt-archive";
const DATABASE_VERSION = 3;
const ARCHIVE_TABLE = "archive";
const IMAGE_TABLE = "images";
const THUMBNAIL_TABLE = "imageThumbnails";

interface Snapshot { revision: number; collections: Collection[] }
export interface CanonicalImageRecord extends ImageRef { blob: Blob }
export interface ThumbnailRecord { id: string; blob: Blob; width: number; height: number; thumbnailVersion: number; generatedAt: string }
type LegacyImage = string | Blob | { id: string; sourceUrl?: string; width?: number; height?: number };
type LegacyAttempt = Omit<Attempt, "images" | "promptMode"> & { images: LegacyImage[]; promptMode?: Attempt["promptMode"] };
type LegacyCollection = Omit<Collection, "referenceImages" | "attempts" | "coverSource"> & {
  referenceImages: LegacyImage[];
  attempts: LegacyAttempt[];
  coverSource: { type: "reference"; index: number } | { type: "attempt"; attemptId: string; imageIndex: number } | CoverSource;
};

const stagedCanonical = new Map<string, CanonicalImageRecord>();
const thumbnailJobs = new Map<string, Promise<Blob>>();

export function stageCanonicalImage(ref: ImageRef, blob: Blob) {
  stagedCanonical.set(ref.id, { ...ref, blob });
}

export function discardStagedImage(id: string) {
  stagedCanonical.delete(id);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("儲存交易中止，請重試。"));
    transaction.onerror = () => { /* onabort 會提供一致的錯誤。 */ };
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARCHIVE_TABLE)) db.createObjectStore(ARCHIVE_TABLE);
      if (!db.objectStoreNames.contains(IMAGE_TABLE)) db.createObjectStore(IMAGE_TABLE);
      if (!db.objectStoreNames.contains(THUMBNAIL_TABLE)) db.createObjectStore(THUMBNAIL_TABLE);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("資料庫被其他分頁占用，請關閉其他圖庫分頁後重試。"));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function allImageRefs(collections: Collection[]): ImageRef[] {
  const refs = new Map<string, ImageRef>();
  for (const collection of collections) {
    for (const image of collection.referenceImages) refs.set(image.id, image);
    for (const attempt of collection.attempts) for (const image of attempt.images) refs.set(image.id, image);
  }
  return [...refs.values()];
}

async function commitSnapshot(collections: Collection[], expected: number | undefined): Promise<number> {
  const db = await openDatabase();
  const nextRevision = (expected ?? 0) + 1;
  const refs = allImageRefs(collections);
  const referenced = new Set(refs.map((image) => image.id));
  const staged = refs.map((ref) => stagedCanonical.get(ref.id)).filter((record): record is CanonicalImageRecord => Boolean(record));
  try {
    const transaction = db.transaction([ARCHIVE_TABLE, IMAGE_TABLE, THUMBNAIL_TABLE], "readwrite");
    const done = transactionDone(transaction);
    const archive = transaction.objectStore(ARCHIVE_TABLE);
    const images = transaction.objectStore(IMAGE_TABLE);
    const thumbnails = transaction.objectStore(THUMBNAIL_TABLE);
    for (const record of staged) images.put(record, record.id);
    const currentRequest = archive.get("current");
    const imageKeysRequest = images.getAllKeys();
    const thumbnailKeysRequest = thumbnails.getAllKeys();
    const completion = done.catch((error) => {
      const current = currentRequest.result as Snapshot | undefined;
      if (current?.revision !== expected || (expected === undefined && current)) {
        throw new Error("其他分頁已更新收藏。請先保留未儲存的文字，再重新整理此頁。");
      }
      const known = new Set((imageKeysRequest.result ?? []).map(String));
      const missing = refs.find((ref) => !known.has(ref.id) && !stagedCanonical.has(ref.id));
      if (missing) throw new Error("找不到圖片資料，表單仍保留，請重試或重新加入圖片。");
      throw error;
    });
    let currentReady = false;
    let imageKeysReady = false;
    let thumbnailKeysReady = false;
    let thumbnailKeys: IDBValidKey[] = [];
    let finished = false;
    const finish = () => {
      if (finished || !currentReady || !imageKeysReady || !thumbnailKeysReady) return;
      finished = true;
      const current = currentRequest.result as Snapshot | undefined;
      if (current?.revision !== expected || (expected === undefined && current)) {
        transaction.abort();
        return;
      }
      const storedIds = new Set(imageKeysRequest.result.map(String));
      const missing = refs.find((ref) => !storedIds.has(ref.id));
      if (missing) {
        transaction.abort();
        return;
      }
      archive.put({ revision: nextRevision, collections } satisfies Snapshot, "current");
      for (const key of imageKeysRequest.result) if (!referenced.has(String(key))) images.delete(key);
      for (const key of thumbnailKeys) if (!referenced.has(String(key))) thumbnails.delete(key);
    };
    currentRequest.onsuccess = () => { currentReady = true; finish(); };
    imageKeysRequest.onsuccess = () => { imageKeysReady = true; finish(); };
    thumbnailKeysRequest.onsuccess = () => { thumbnailKeys = thumbnailKeysRequest.result; thumbnailKeysReady = true; finish(); };
    await completion;
    for (const record of staged) if (stagedCanonical.get(record.id) === record) stagedCanonical.delete(record.id);
    return nextRevision;
  } finally { db.close(); }
}

function isImageRef(value: unknown): value is ImageRef {
  const image = value as Partial<ImageRef> | null;
  return Boolean(image && typeof image.id === "string" && Number.isInteger(image.width) && Number.isInteger(image.height) &&
    image.width! > 0 && image.height! > 0 && ["image/webp", "image/jpeg", "image/png"].includes(image.mimeType ?? "") && Number.isInteger(image.byteSize) &&
    image.byteSize! > 0 && typeof image.createdAt === "string");
}

function isCurrentCollections(value: unknown): value is Collection[] {
  return Array.isArray(value) && value.every((collection) => collection &&
    Array.isArray(collection.referenceImages) && collection.referenceImages.every(isImageRef) &&
    Array.isArray(collection.attempts) && collection.attempts.every((attempt: Collection["attempts"][number]) =>
      (attempt.promptMode === "original" || attempt.promptMode === "custom") &&
      Array.isArray(attempt.images) && attempt.images.every(isImageRef)));
}

function dataUrlToBlob(source: string): Blob {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]*)$/.exec(source);
  if (!match) throw new Error("舊圖片資料格式無法辨識，原有收藏未變更。");
  const binary = atob(match[2]);
  return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: match[1] });
}

async function migrateCollections(value: unknown, experimental: Map<string, { display: Blob }>): Promise<Collection[]> {
  if (!Array.isArray(value)) throw new Error("收藏資料格式無法辨識，原有收藏未變更。");
  const migrateImage = async (source: LegacyImage): Promise<ImageRef> => {
    if (isImageRef(source)) return source;
    let blob: Blob;
    let id: string = crypto.randomUUID();
    if (source instanceof Blob) blob = source;
    else if (typeof source === "string") {
      if (!source.startsWith("data:")) throw new Error("舊版遠端圖片無法轉成本機圖片，原有收藏未變更。");
      blob = dataUrlToBlob(source);
    } else {
      id = source.id;
      if (source.sourceUrl) throw new Error("舊版遠端圖片無法轉成本機圖片，原有收藏未變更。");
      const record = experimental.get(source.id);
      if (!record?.display) throw new Error("找不到舊版圖片資料，原有收藏未變更。");
      blob = record.display;
    }
    const file = new File([blob], "legacy-image", { type: blob.type || "image/webp" });
    const canonical = await createCanonicalImage(file, id);
    stageCanonicalImage(canonical.ref, canonical.blob);
    return canonical.ref;
  };
  const migrated: Collection[] = [];
  for (const raw of value as LegacyCollection[]) {
    const referenceImages = await Promise.all(raw.referenceImages.map(migrateImage));
    const attempts = await Promise.all(raw.attempts.map(async (attempt) => ({
      ...attempt,
      promptMode: attempt.promptMode ?? (attempt.prompt.trim() === raw.originalPrompt.trim() ? "original" : "custom"),
      images: await Promise.all(attempt.images.map(migrateImage)),
    })));
    let coverSource: CoverSource;
    if (raw.coverSource.type === "reference") {
      const previous = raw.coverSource as { type: "reference"; index?: number; imageId?: string };
      coverSource = { type: "reference", imageId: previous.imageId ?? referenceImages[previous.index ?? 0]?.id ?? "" };
    } else {
      const previous = raw.coverSource as { type: "attempt"; attemptId: string; imageIndex?: number; imageId?: string };
      const attempt = attempts.find((candidate) => candidate.id === previous.attemptId);
      coverSource = { type: "attempt", attemptId: previous.attemptId, imageId: previous.imageId ?? attempt?.images[previous.imageIndex ?? 0]?.id ?? "" };
    }
    migrated.push({ ...raw, referenceImages, attempts, coverSource } as Collection);
  }
  return migrated;
}

async function readExperimentalImages(db: IDBDatabase) {
  const records = new Map<string, { display: Blob }>();
  if (!db.objectStoreNames.contains(IMAGE_TABLE)) return records;
  const transaction = db.transaction(IMAGE_TABLE, "readonly");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(IMAGE_TABLE);
  const [keys, values] = await Promise.all([requestResult(store.getAllKeys()), requestResult(store.getAll())]);
  values.forEach((value, index) => { if (value?.display instanceof Blob) records.set(String(keys[index]), value); });
  await done;
  return records;
}

export async function loadArchive(): Promise<{ collections: Collection[]; revision: number }> {
  const db = await openDatabase();
  let snapshot: Snapshot | undefined;
  let experimental = new Map<string, { display: Blob }>();
  try {
    const transaction = db.transaction(ARCHIVE_TABLE, "readonly");
    const done = transactionDone(transaction);
    snapshot = await requestResult(transaction.objectStore(ARCHIVE_TABLE).get("current"));
    await done;
    if (snapshot && !isCurrentCollections(snapshot.collections)) experimental = await readExperimentalImages(db);
  } finally { db.close(); }
  if (snapshot && isCurrentCollections(snapshot.collections)) return snapshot;
  let value: unknown;
  let expected: number | undefined;
  if (snapshot) { value = snapshot.collections; expected = snapshot.revision; }
  else {
    const raw = localStorage.getItem(LEGACY_KEY);
    value = raw === null ? SEED : JSON.parse(raw);
    expected = undefined;
  }
  const collections = await migrateCollections(value, experimental);
  let revision: number;
  try {
    revision = await commitSnapshot(collections, expected);
  } catch (error) {
    // 兩個分頁同時首次啟動時，採用已完成的那份原子遷移，不把正常競爭顯示成載入失敗。
    if (expected !== undefined) throw error;
    const retryDb = await openDatabase();
    try {
      const transaction = retryDb.transaction(ARCHIVE_TABLE, "readonly");
      const done = transactionDone(transaction);
      const current = await requestResult<Snapshot | undefined>(transaction.objectStore(ARCHIVE_TABLE).get("current"));
      await done;
      if (!current || !isCurrentCollections(current.collections)) throw error;
      return current;
    } finally { retryDb.close(); }
  }
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* IndexedDB 已成功，不讓清理副本阻斷載入。 */ }
  return { collections, revision };
}

export function saveArchive(collections: Collection[], revision: number): Promise<number> {
  return commitSnapshot(collections, revision);
}

export async function getCanonicalBlob(id: string): Promise<Blob> {
  const staged = stagedCanonical.get(id);
  if (staged) return staged.blob;
  const db = await openDatabase();
  try {
    const transaction = db.transaction(IMAGE_TABLE, "readonly");
    const done = transactionDone(transaction);
    const record = await requestResult<CanonicalImageRecord | undefined>(transaction.objectStore(IMAGE_TABLE).get(id));
    await done;
    if (!record?.blob) throw new Error("找不到圖片資料。");
    return record.blob;
  } finally { db.close(); }
}

export function getThumbnailBlob(image: ImageRef): Promise<Blob> {
  const existing = thumbnailJobs.get(image.id);
  if (existing) return existing;
  const job = (async () => {
    const staged = stagedCanonical.get(image.id);
    if (staged) return (await createThumbnail(staged.blob)).blob;
    const db = await openDatabase();
    try {
      const read = db.transaction(THUMBNAIL_TABLE, "readonly");
      const done = transactionDone(read);
      const cached = await requestResult<ThumbnailRecord | undefined>(read.objectStore(THUMBNAIL_TABLE).get(image.id));
      await done;
      if (cached?.thumbnailVersion === THUMBNAIL_VERSION && cached.blob instanceof Blob) return cached.blob;
    } finally { db.close(); }
    const canonical = await getCanonicalBlob(image.id);
    const thumbnail = await createThumbnail(canonical);
    const writeDb = await openDatabase();
    try {
      const write = writeDb.transaction(THUMBNAIL_TABLE, "readwrite");
      const done = transactionDone(write);
      write.objectStore(THUMBNAIL_TABLE).put({
        id: image.id,
        blob: thumbnail.blob,
        width: thumbnail.width,
        height: thumbnail.height,
        thumbnailVersion: THUMBNAIL_VERSION,
        generatedAt: new Date().toISOString(),
      } satisfies ThumbnailRecord, image.id);
      await done;
    } finally { writeDb.close(); }
    return thumbnail.blob;
  })().finally(() => thumbnailJobs.delete(image.id));
  thumbnailJobs.set(image.id, job);
  return job;
}

export function storageErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return "此瀏覽器可用儲存空間不足。請釋放裝置空間或刪除不需要的收藏後重試；表單仍保留。";
  if (name === "SecurityError" || name === "InvalidStateError") return "瀏覽器目前不允許使用本機資料庫，請檢查網站儲存權限後重試；表單仍保留。";
  return error instanceof Error ? error.message : "本機資料庫操作失敗，請重試；表單仍保留。";
}
