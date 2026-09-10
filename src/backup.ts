import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Collection, ImageRef } from "./types";
import { getCanonicalBlob } from "./archiveStorage";
import { validateCanonicalBlob } from "./imageProcessing";
import { ErrorCode, fail as throwCoded } from "./i18n/errorCodes";

const FORMAT = "promptary-backup";
const FORMAT_VERSION = 1;
const MAX_ZIP_BYTES = 500 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 750 * 1024 * 1024;
const MAX_ENTRY_COUNT = 10_001;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_CANONICAL_BYTES = 20 * 1024 * 1024;

interface Manifest {
  format: typeof FORMAT;
  version: typeof FORMAT_VERSION;
  exportedAt: string;
  collections: Collection[];
}

export interface BackupBundle {
  collections: Collection[];
  images: Map<string, Blob>;
}

function allImageRefs(collections: Collection[]) {
  const refs = new Map<string, ImageRef>();
  for (const collection of collections) {
    for (const image of collection.referenceImages) refs.set(image.id, image);
    for (const attempt of collection.attempts) for (const image of attempt.images) refs.set(image.id, image);
  }
  return refs;
}

function fail(code: ErrorCode = ErrorCode.backupInvalid): never {
  throwCoded(code);
}

function imagePath(image: ImageRef): string {
  const extension = image.mimeType === "image/webp" ? "webp" : image.mimeType === "image/jpeg" ? "jpg" : "png";
  return `images/${image.id}.${extension}`;
}

function validImageRef(value: unknown): value is ImageRef {
  const image = value as Partial<ImageRef> | null;
  return Boolean(image && typeof image.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(image.id) &&
    Number.isInteger(image.width) && image.width! > 0 && Number.isInteger(image.height) && image.height! > 0 &&
    ["image/webp", "image/jpeg", "image/png"].includes(image.mimeType ?? "") && Number.isInteger(image.byteSize) && image.byteSize! > 0 &&
    typeof image.createdAt === "string" && Number.isFinite(Date.parse(image.createdAt)));
}

function validClassification(value: unknown) {
  if (value === undefined) return true;
  const classification = value as { sourcePrompt?: unknown; overrides?: unknown };
  return Boolean(classification && typeof classification.sourcePrompt === "string" && classification.overrides &&
    typeof classification.overrides === "object" && !Array.isArray(classification.overrides) &&
    Object.values(classification.overrides).every((category) => ["appearance", "clothing", "pose", "background", "composition", "lighting", "style", "other"].includes(category as string)));
}

function validateCollections(value: unknown): asserts value is Collection[] {
  if (!Array.isArray(value)) fail();
  const collectionIds = new Set<string>();
  const imageRefs = new Map<string, string>();
  for (const raw of value) {
    const collection = raw as Collection;
    if (!collection || typeof collection.id !== "string" || !collection.id || collectionIds.has(collection.id) ||
      typeof collection.originalPrompt !== "string" || typeof collection.collectionNotes !== "string" ||
      typeof collection.isFavorite !== "boolean" || typeof collection.promptPending !== "boolean" ||
      !["tried", "want", "ref"].includes(collection.status) || !Number.isFinite(Date.parse(collection.addedAt)) ||
      !Number.isFinite(Date.parse(collection.updatedAt)) || (collection.name !== undefined && typeof collection.name !== "string") ||
      (collection.source !== undefined && typeof collection.source !== "string") || !validClassification(collection.promptClassification) ||
      !Array.isArray(collection.tags) || !collection.tags.every((tag) => typeof tag === "string") ||
      !Array.isArray(collection.referenceImages) || !collection.referenceImages.every(validImageRef) || !Array.isArray(collection.attempts)) fail();
    collectionIds.add(collection.id);
    const attemptIds = new Set<string>();
    for (const attempt of collection.attempts) {
      if (!attempt || typeof attempt.id !== "string" || !attempt.id || attemptIds.has(attempt.id) ||
        typeof attempt.platform !== "string" || typeof attempt.prompt !== "string" || typeof attempt.notes !== "string" ||
        (attempt.promptMode !== undefined && attempt.promptMode !== "original" && attempt.promptMode !== "custom") ||
        !Number.isFinite(Date.parse(attempt.date)) || !Number.isFinite(Date.parse(attempt.createdAt)) ||
        !Array.isArray(attempt.images) || !attempt.images.every(validImageRef) || !validClassification(attempt.promptClassification) ||
        (attempt.name !== undefined && typeof attempt.name !== "string") || (attempt.model !== undefined && typeof attempt.model !== "string") ||
        !(attempt.rating === null || [1, 2, 3, 4, 5].includes(attempt.rating))) fail();
      attemptIds.add(attempt.id);
    }
    const cover = collection.coverSource;
    const collectionImages = [...collection.referenceImages, ...collection.attempts.flatMap((attempt) => attempt.images)];
    if (!cover || (collectionImages.length > 0 && !collectionImages.some((image) => image.id === cover.imageId)) ||
      (collectionImages.length === 0 && (cover.type !== "reference" || cover.imageId !== ""))) fail();
    if (cover.type === "attempt" && !collection.attempts.some((attempt) => attempt.id === cover.attemptId && attempt.images.some((image) => image.id === cover.imageId))) fail();
    if (cover.type !== "reference" && cover.type !== "attempt") fail();
    for (const image of collectionImages) {
      const signature = `${image.width}:${image.height}:${image.byteSize}:${image.mimeType}:${image.createdAt}`;
      const previous = imageRefs.get(image.id);
      if (previous !== undefined && previous !== signature) fail(ErrorCode.backupDuplicateMeta);
      imageRefs.set(image.id, signature);
    }
  }
}

function inspectZip(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_ZIP_BYTES) fail(ErrorCode.backupZipTooLarge);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) fail();
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entries > MAX_ENTRY_COUNT || centralOffset + centralSize > bytes.byteLength) fail(ErrorCode.backupZipTooMany);
  let cursor = centralOffset;
  let total = 0;
  const names = new Set<string>();
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) fail();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8)) fail(ErrorCode.backupZipUnsupported);
    const name = strFromU8(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..") || names.has(name)) fail(ErrorCode.backupZipUnsafePath);
    names.add(name);
    if ((name === "manifest.json" && size > MAX_MANIFEST_BYTES) || (name.startsWith("images/") && size > MAX_CANONICAL_BYTES)) {
      fail(ErrorCode.backupZipEntryTooLarge);
    }
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) fail(ErrorCode.backupZipUncompressed);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
}

export async function createBackup(collections: Collection[]): Promise<Blob> {
  const refs = allImageRefs(collections);
  const files: Record<string, Uint8Array> = {};
  const manifest: Manifest = { format: FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), collections };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  for (const [id, ref] of refs) {
    const blob = await getCanonicalBlob(id);
    await validateCanonicalBlob(blob, ref);
    files[imagePath(ref)] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
}

export async function parseBackup(file: File): Promise<BackupBundle> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  inspectZip(bytes);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { fail(); }
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes || manifestBytes.byteLength > MAX_MANIFEST_BYTES) fail();
  let manifest: unknown;
  try { manifest = JSON.parse(strFromU8(manifestBytes).replace(/^\uFEFF/, "")); } catch { fail(); }
  const candidate = manifest as Partial<Manifest>;
  if (candidate.format !== FORMAT || candidate.version !== FORMAT_VERSION || !Number.isFinite(Date.parse(candidate.exportedAt ?? ""))) fail();
  validateCollections(candidate.collections);
  const collections = candidate.collections.map((collection) => ({
    ...collection,
    attempts: collection.attempts.map((attempt) => ({
      ...attempt,
      promptMode: attempt.promptMode ?? (attempt.prompt.trim() === collection.originalPrompt.trim() ? "original" : "custom"),
    })),
  }));
  const refs = allImageRefs(collections);
  const expectedPaths = new Set(["manifest.json", ...[...refs.values()].map(imagePath)]);
  if (Object.keys(files).some((name) => !expectedPaths.has(name)) || Object.keys(files).length !== expectedPaths.size) fail();
  const images = new Map<string, Blob>();
  for (const [id, ref] of refs) {
    const imageBytes = files[imagePath(ref)];
    if (!imageBytes || imageBytes.byteLength > MAX_CANONICAL_BYTES) fail(ErrorCode.backupImageMissing);
    const blob = new Blob([imageBytes.slice().buffer], { type: ref.mimeType });
    await validateCanonicalBlob(blob, ref);
    images.set(id, blob);
  }
  return { collections, images };
}

export function mergeBackup(current: Collection[], incoming: Collection[]) {
  const ids = new Set(current.map((collection) => collection.id));
  const addedCollections = incoming.filter((collection) => { if (ids.has(collection.id)) return false; ids.add(collection.id); return true; });
  const requiredImageIds = new Set(allImageRefs(addedCollections).keys());
  return {
    collections: [...addedCollections, ...current],
    added: addedCollections.length,
    skipped: incoming.length - addedCollections.length,
    requiredImageIds,
  };
}
