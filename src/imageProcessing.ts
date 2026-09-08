import type { ImageRef } from "./types";

export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DECODED_IMAGE_PIXELS = 40_000_000;
export const CANONICAL_MAX_EDGE = 2048;
export const CANONICAL_WEBP_QUALITY = 0.85;
export const THUMBNAIL_MAX_EDGE = 800;
export const THUMBNAIL_WEBP_QUALITY = 0.82;
export const THUMBNAIL_VERSION = 1;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("無法解析圖片，請確認檔案完整或更換圖片。")); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob || blob.type !== "image/webp") reject(new Error("瀏覽器無法產生 WebP 圖片，請更新瀏覽器後重試。"));
    else resolve(blob);
  }, "image/webp", quality));
}

async function render(blob: Blob, maxEdge: number, quality: number, enforcePixelLimit: boolean) {
  const source = await decode(blob);
  const sourceWidth = source.naturalWidth;
  const sourceHeight = source.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("圖片尺寸無法辨識，請更換圖片。");
  if (enforcePixelLimit && sourceWidth * sourceHeight > MAX_DECODED_IMAGE_PIXELS) {
    throw new Error("圖片解碼後超過 4,000 萬像素，請縮小尺寸後再匯入。");
  }
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法處理圖片，請重新整理後再試。");
  context.drawImage(source, 0, 0, width, height);
  const output = await canvasBlob(canvas, quality);
  const verified = await decode(output);
  if (verified.naturalWidth !== width || verified.naturalHeight !== height) {
    throw new Error("最佳化後的圖片驗證失敗，原有資料未變更。");
  }
  return { blob: output, width, height };
}

export async function createCanonicalImage(file: File, id: string = crypto.randomUUID()): Promise<{ ref: ImageRef; blob: Blob }> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("僅支援 JPG、PNG、WebP，請更換檔案。");
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("單張圖片不可超過 10 MB，請更換較小的檔案。");
  const result = await render(file, CANONICAL_MAX_EDGE, CANONICAL_WEBP_QUALITY, true);
  return {
    blob: result.blob,
    ref: {
      id,
      width: result.width,
      height: result.height,
      mimeType: "image/webp",
      byteSize: result.blob.size,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function createThumbnail(blob: Blob) {
  return render(blob, THUMBNAIL_MAX_EDGE, THUMBNAIL_WEBP_QUALITY, false);
}

export async function validateCanonicalBlob(blob: Blob, expected?: ImageRef): Promise<{ width: number; height: number }> {
  if (blob.type && blob.type !== "image/webp") throw new Error("備份內含非 WebP 圖片，原有收藏未變更。");
  const image = await decode(blob);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || width * height > MAX_DECODED_IMAGE_PIXELS || Math.max(width, height) > CANONICAL_MAX_EDGE) {
    throw new Error("備份圖片尺寸不符合 Promptary 規格，原有收藏未變更。");
  }
  if (expected && (expected.width !== width || expected.height !== height || expected.byteSize !== blob.size)) {
    throw new Error("備份圖片與 manifest 記錄不一致，原有收藏未變更。");
  }
  return { width, height };
}
