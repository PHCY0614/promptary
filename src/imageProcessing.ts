import type { ImageRef } from "./types";
import { ErrorCode } from "./i18n/errorCodes";

export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DECODED_IMAGE_PIXELS = 40_000_000;
export const CANONICAL_MAX_EDGE = 2048;
export const CANONICAL_WEBP_QUALITY = 0.85;
export const CANONICAL_JPEG_QUALITY = 0.88;
export const THUMBNAIL_MAX_EDGE = 800;
export const THUMBNAIL_WEBP_QUALITY = 0.82;
export const THUMBNAIL_JPEG_QUALITY = 0.85;
export const THUMBNAIL_VERSION = 1;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isAcceptedType(type: string): type is ImageRef["mimeType"] {
  return ACCEPTED_TYPES.has(type);
}

function decode(blob: Blob, timeoutMs?: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let settled = false;
    const finish = (outcome: "ok" | "err", value?: HTMLImageElement | Error) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (outcome === "ok") resolve(value as HTMLImageElement);
      else reject(value);
    };
    const timer = timeoutMs !== undefined && timeoutMs > 0
      ? setTimeout(() => finish("err", new Error(ErrorCode.imageParseFailed)), timeoutMs)
      : undefined;
    image.onload = () => finish("ok", image);
    image.onerror = () => finish("err", new Error(ErrorCode.imageParseFailed));
    image.src = url;
  });
}

function requestCanvasBlob(canvas: HTMLCanvasElement, type: ImageRef["mimeType"], quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (quality === undefined) canvas.toBlob(resolve, type);
    else canvas.toBlob(resolve, type, quality);
  });
}

async function canvasBlob(canvas: HTMLCanvasElement, sourceType: string, webpQuality: number, jpegQuality: number): Promise<Blob> {
  const preferred = await requestCanvasBlob(canvas, "image/webp", webpQuality);
  if (preferred && preferred.size > 0 && preferred.type === "image/webp") return preferred;

  const fallbackType: ImageRef["mimeType"] = sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
  if (preferred && preferred.size > 0 && preferred.type === fallbackType) return preferred;

  const fallback = await requestCanvasBlob(canvas, fallbackType, fallbackType === "image/jpeg" ? jpegQuality : undefined);
  if (!fallback || fallback.size === 0 || fallback.type !== fallbackType) {
    throw new Error(ErrorCode.imageEncodeFailed);
  }
  return fallback;
}

async function render(blob: Blob, maxEdge: number, webpQuality: number, jpegQuality: number, enforcePixelLimit: boolean) {
  const source = await decode(blob);
  const sourceWidth = source.naturalWidth;
  const sourceHeight = source.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error(ErrorCode.imageSizeUnknown);
  if (enforcePixelLimit && sourceWidth * sourceHeight > MAX_DECODED_IMAGE_PIXELS) {
    throw new Error(ErrorCode.imageTooManyPixels);
  }
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(ErrorCode.imageCanvasFailed);
  context.drawImage(source, 0, 0, width, height);
  const output = await canvasBlob(canvas, blob.type, webpQuality, jpegQuality);
  const verified = await decode(output);
  if (verified.naturalWidth !== width || verified.naturalHeight !== height) {
    throw new Error(ErrorCode.imageOptimizeFailed);
  }
  return { blob: output, width, height };
}

export async function createCanonicalImage(file: File, id: string = crypto.randomUUID()): Promise<{ ref: ImageRef; blob: Blob }> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error(ErrorCode.imageTypeUnsupported);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(ErrorCode.imageFileTooLarge);
  const result = await render(file, CANONICAL_MAX_EDGE, CANONICAL_WEBP_QUALITY, CANONICAL_JPEG_QUALITY, true);
  if (!isAcceptedType(result.blob.type)) throw new Error(ErrorCode.imageOutputTypeUnsupported);
  return {
    blob: result.blob,
    ref: {
      id,
      width: result.width,
      height: result.height,
      mimeType: result.blob.type,
      byteSize: result.blob.size,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function createThumbnail(blob: Blob) {
  return render(blob, THUMBNAIL_MAX_EDGE, THUMBNAIL_WEBP_QUALITY, THUMBNAIL_JPEG_QUALITY, false);
}

export async function validateCanonicalBlob(blob: Blob, expected?: ImageRef, decodeTimeoutMs?: number): Promise<{ width: number; height: number }> {
  if (!isAcceptedType(blob.type)) throw new Error(ErrorCode.backupImageTypeUnsupported);
  const image = await decode(blob, decodeTimeoutMs);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || width * height > MAX_DECODED_IMAGE_PIXELS || Math.max(width, height) > CANONICAL_MAX_EDGE) {
    throw new Error(ErrorCode.backupImageSizeMismatch);
  }
  if (expected && (expected.width !== width || expected.height !== height || expected.byteSize !== blob.size || expected.mimeType !== blob.type)) {
    throw new Error(ErrorCode.backupImageManifestMismatch);
  }
  return { width, height };
}
