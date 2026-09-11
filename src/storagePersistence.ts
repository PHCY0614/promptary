export interface LocalStorageStatus {
  usage: number | null;
  persisted: boolean | null;
}

let persistenceAttempted = false;

function storageManager(): StorageManager | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage;
}

export async function requestPersistentStorageOnce(): Promise<boolean | null> {
  if (persistenceAttempted) return null;
  persistenceAttempted = true;
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== "function") return null;
  try {
    if (await storage.persisted()) return true;
    if (typeof storage.persist !== "function") return false;
    return await storage.persist();
  } catch {
    return false;
  }
}

export async function readLocalStorageStatus(): Promise<LocalStorageStatus> {
  const storage = storageManager();
  let usage: number | null = null;
  let persisted: boolean | null = null;
  if (storage && typeof storage.estimate === "function") {
    try {
      const estimate = await storage.estimate();
      if (typeof estimate.usage === "number" && Number.isFinite(estimate.usage) && estimate.usage >= 0) usage = estimate.usage;
    } catch {
      // Storage API 是可靠度增強；查詢失敗不影響 App。
    }
  }
  if (storage && typeof storage.persisted === "function") {
    try {
      persisted = await storage.persisted();
    } catch {
      // 無法確認時交由 UI 顯示中性狀態。
    }
  }
  return { usage, persisted };
}

export function formatStorageUsage(bytes: number | null, locale: string): string | null {
  if (bytes === null) return null;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unit: (typeof units)[number] = "KB";
  if (value >= 1024) { value /= 1024; unit = "MB"; }
  if (value >= 1024) { value /= 1024; unit = "GB"; }
  const maximumFractionDigits = value > 0 && value < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)} ${unit}`;
}
