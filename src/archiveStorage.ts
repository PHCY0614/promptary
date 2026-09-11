import type { Attempt, Collection, CoverSource, ImageRef } from "./types";
import { STARTER_COLLECTIONS, starterImageUrl } from "./starterData";
import { STARTER_DECODE_TIMEOUT_MS, STARTER_FETCH_TIMEOUT_MS, STARTUP_IDB_OPEN_TIMEOUT_MS, STARTUP_IDB_READ_TIMEOUT_MS } from "./starterInitTimeouts";
import { createCanonicalImage, createThumbnail, THUMBNAIL_VERSION, validateCanonicalBlob } from "./imageProcessing";
import { ErrorCode, fail, isErrorCode } from "./i18n/errorCodes";
import { withTimeout } from "./withTimeout";

const LEGACY_KEY = "prompt-archive-v2";
const DATABASE = "prompt-archive";
const DATABASE_VERSION = 3;
const ARCHIVE_TABLE = "archive";
const IMAGE_TABLE = "images";
const THUMBNAIL_TABLE = "imageThumbnails";

interface Snapshot { revision: number; collections: Collection[] }
export interface ArchiveLoadResult { collections: Collection[]; revision: number; seedStarter?: boolean }
export interface CanonicalImageRecord extends ImageRef { blob: Blob }
export interface ThumbnailRecord { id: string; blob: Blob; width: number; height: number; thumbnailVersion: number; generatedAt: string }
type LegacyImage = string | Blob | { id: string; sourceUrl?: string; width?: number; height?: number };
type LegacyAttempt = Omit<Attempt, "images" | "promptMode"> & { images: LegacyImage[]; promptMode?: Attempt["promptMode"] };
type LegacyCollection = Omit<Collection, "referenceImages" | "attempts" | "coverSource" | "createdAt" | "updatedAt"> & {
  referenceImages: LegacyImage[];
  attempts: LegacyAttempt[];
  coverSource: { type: "reference"; index: number } | { type: "attempt"; attemptId: string; imageIndex: number } | CoverSource;
  createdAt?: string;
  addedAt?: string;
  updatedAt?: string;
};

const stagedCanonical = new Map<string, CanonicalImageRecord>();
const thumbnailJobs = new Map<string, Promise<Blob>>();
let cacheGeneration = 0;

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
    transaction.onabort = () => reject(transaction.error ?? new Error(ErrorCode.transactionAborted));
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
    request.onblocked = () => reject(new Error(ErrorCode.dbBlocked));
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
    for (const record of staged) {
      images.put(record, record.id);
      thumbnails.delete(record.id);
    }
    const currentRequest = archive.get("current");
    const imageKeysRequest = images.getAllKeys();
    const thumbnailKeysRequest = thumbnails.getAllKeys();
    const completion = done.catch((error) => {
      const current = currentRequest.result as Snapshot | undefined;
      if (current?.revision !== expected || (expected === undefined && current)) {
        fail(ErrorCode.revisionConflict);
      }
      const known = new Set((imageKeysRequest.result ?? []).map(String));
      const missing = refs.find((ref) => !known.has(ref.id) && !stagedCanonical.has(ref.id));
      if (missing) fail(ErrorCode.imageMissingRetry);
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

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCurrentCollections(value: unknown): value is Collection[] {
  return Array.isArray(value) && value.every((collection) => collection &&
    isIsoDate(collection.createdAt) && isIsoDate(collection.updatedAt) &&
    Array.isArray(collection.referenceImages) && collection.referenceImages.every(isImageRef) &&
    Array.isArray(collection.attempts) && collection.attempts.every((attempt: Collection["attempts"][number]) =>
      (attempt.promptMode === "original" || attempt.promptMode === "custom") &&
      Array.isArray(attempt.images) && attempt.images.every(isImageRef)));
}

function dataUrlToBlob(source: string): Blob {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]*)$/.exec(source);
  if (!match) fail(ErrorCode.legacyImageUnrecognized);
  const binary = atob(match[2]);
  return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: match[1] });
}

async function migrateCollections(value: unknown, experimental: Map<string, { display: Blob }>): Promise<Collection[]> {
  if (!Array.isArray(value)) fail(ErrorCode.archiveUnrecognized);
  const migrateImage = async (source: LegacyImage): Promise<ImageRef> => {
    if (isImageRef(source)) return source;
    let blob: Blob;
    let id: string = crypto.randomUUID();
    if (source instanceof Blob) blob = source;
    else if (typeof source === "string") {
      if (!source.startsWith("data:")) fail(ErrorCode.legacyRemoteImage);
      blob = dataUrlToBlob(source);
    } else {
      id = source.id;
      if (source.sourceUrl) fail(ErrorCode.legacyRemoteImage);
      const record = experimental.get(source.id);
      if (!record?.display) fail(ErrorCode.legacyImageMissing);
      blob = record.display;
    }
    const file = new File([blob], "legacy-image", { type: blob.type || "image/webp" });
    const canonical = await createCanonicalImage(file, id);
    stageCanonicalImage(canonical.ref, canonical.blob);
    return canonical.ref;
  };
  const migrated: Collection[] = [];
  for (const raw of value as LegacyCollection[]) {
    const createdAt = isIsoDate(raw.createdAt) ? raw.createdAt : isIsoDate(raw.addedAt) ? raw.addedAt : null;
    if (!createdAt) fail(ErrorCode.archiveUnrecognized);
    const updatedAt = isIsoDate(raw.updatedAt) ? raw.updatedAt : createdAt;
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
    const { addedAt: _legacyAddedAt, ...rest } = raw;
    migrated.push({ ...rest, createdAt, updatedAt, referenceImages, attempts, coverSource } as Collection);
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

async function readCurrentArchiveSnapshot(): Promise<Snapshot | undefined> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(ARCHIVE_TABLE, "readonly");
    const done = transactionDone(transaction);
    const current = await requestResult<Snapshot | undefined>(transaction.objectStore(ARCHIVE_TABLE).get("current"));
    await done;
    return current;
  } finally { db.close(); }
}

async function recoverConcurrentInit(error: unknown): Promise<Snapshot> {
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

async function commitInitialSnapshot(collections: Collection[]): Promise<Snapshot> {
  try {
    const revision = await commitSnapshot(collections, undefined);
    return { collections, revision };
  } catch (error) {
    // 兩個分頁同時首次啟動時，採用已完成的那份原子寫入，不把正常競爭顯示成載入失敗。
    return recoverConcurrentInit(error);
  }
}

async function fetchStarterCanonical(ref: ImageRef): Promise<Blob> {
  const url = starterImageUrl(ref, import.meta.env.BASE_URL);
  const fetchTimeout = new Error(ErrorCode.storageFailed);
  let buffer: ArrayBuffer;
  try {
    const response = await withTimeout(fetch(url), STARTER_FETCH_TIMEOUT_MS, fetchTimeout);
    if (!response.ok) fail(ErrorCode.storageFailed);
    buffer = await withTimeout(response.arrayBuffer(), STARTER_FETCH_TIMEOUT_MS, fetchTimeout);
  } catch (error) {
    if (error instanceof Error && isErrorCode(error.message)) throw error;
    fail(ErrorCode.storageFailed);
  }
  const blob = new Blob([buffer], { type: ref.mimeType });
  await validateCanonicalBlob(blob, ref, STARTER_DECODE_TIMEOUT_MS);
  return blob;
}

async function installStarterCollections(): Promise<Snapshot> {
  const existing = await readCurrentArchiveSnapshot();
  if (existing && isCurrentCollections(existing.collections)) {
    console.info("[Promptary startup] starter-skipped-existing");
    return existing;
  }

  const collections = STARTER_COLLECTIONS;
  const refs = allImageRefs(collections);
  const stagedIds: string[] = [];
  try {
    for (const ref of refs) {
      const blob = await fetchStarterCanonical(ref);
      stageCanonicalImage(ref, blob);
      stagedIds.push(ref.id);
    }
    const beforeCommit = await readCurrentArchiveSnapshot();
    if (beforeCommit && isCurrentCollections(beforeCommit.collections)) {
      console.info("[Promptary startup] starter-skipped-existing");
      return beforeCommit;
    }
    return await commitInitialSnapshot(collections);
  } finally {
    for (const id of stagedIds) discardStagedImage(id);
  }
}

export async function seedStarterArchive(): Promise<{ revision: number } | null> {
  console.info("[Promptary startup] starter-seed");
  try {
    const snapshot = await installStarterCollections();
    console.info("[Promptary startup] starter-complete");
    return { revision: snapshot.revision };
  } catch (error) {
    console.warn("[Promptary startup] starter-failed", error);
    return null;
  }
}

export async function loadArchive(): Promise<ArchiveLoadResult> {
  const probeError = new Error(ErrorCode.storageFailed);
  console.info("[Promptary startup] open-db");
  const db = await withTimeout(openDatabase(), STARTUP_IDB_OPEN_TIMEOUT_MS, probeError);
  let snapshot: Snapshot | undefined;
  let experimental = new Map<string, { display: Blob }>();
  try {
    console.info("[Promptary startup] read-archive");
    await withTimeout((async () => {
      const transaction = db.transaction(ARCHIVE_TABLE, "readonly");
      const done = transactionDone(transaction);
      snapshot = await requestResult(transaction.objectStore(ARCHIVE_TABLE).get("current"));
      await done;
    })(), STARTUP_IDB_READ_TIMEOUT_MS, probeError);
    if (snapshot && !isCurrentCollections(snapshot.collections)) experimental = await readExperimentalImages(db);
  } finally { db.close(); }
  if (snapshot && isCurrentCollections(snapshot.collections)) return snapshot;
  if (snapshot) {
    const collections = await migrateCollections(snapshot.collections, experimental);
    const revision = await commitSnapshot(collections, snapshot.revision);
    return { collections, revision };
  }
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw !== null) {
    const collections = await migrateCollections(JSON.parse(raw), experimental);
    const result = await commitInitialSnapshot(collections);
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* IndexedDB 已成功，不讓清理副本阻斷載入。 */ }
    return result;
  }
  console.info("[Promptary startup] fresh-install");
  return { collections: STARTER_COLLECTIONS, revision: 0, seedStarter: true };
}

export function saveArchive(collections: Collection[], revision: number): Promise<number> {
  return commitSnapshot(collections, revision);
}

export function clearArchive(revision: number): Promise<number> {
  cacheGeneration++;
  stagedCanonical.clear();
  thumbnailJobs.clear();
  return commitSnapshot([], revision);
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
    if (!record?.blob) fail(ErrorCode.imageMissing);
    return record.blob;
  } finally { db.close(); }
}

export function getThumbnailBlob(image: ImageRef): Promise<Blob> {
  const existing = thumbnailJobs.get(image.id);
  if (existing) return existing;
  const generation = cacheGeneration;
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
    if (generation !== cacheGeneration) return thumbnail.blob;
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
  if (name === "QuotaExceededError") return ErrorCode.quotaExceeded;
  if (name === "SecurityError" || name === "InvalidStateError") return ErrorCode.storagePermission;
  const message = error instanceof Error ? error.message : "";
  return isErrorCode(message) ? message : ErrorCode.storageFailed;
}
