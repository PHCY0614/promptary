// ── 第一階段圖片政策：保留原始位元組，不做壓縮或雲端上傳 ──
export const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function readReferenceImage(file: File, onProgress: (value: number) => void): Promise<string> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return Promise.reject(new Error("僅支援 JPG、PNG、WebP，請更換檔案。"));
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return Promise.reject(new Error("單張圖片不可超過 2 MB，請更換較小的檔案。"));
  }

  // ── 讀取及解碼驗證：副檔名正確的損壞圖片也必須回報失敗 ──
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    reader.onerror = () => reject(new Error("無法讀取檔案，請重試。"));
    reader.onabort = () => reject(new Error("讀取已中止，請重試。"));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const image = new Image();
      image.onload = () => resolve(dataUrl);
      image.onerror = () => reject(new Error("無法解析圖片，請確認檔案完整或更換圖片。"));
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
