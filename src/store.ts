import { useState, useCallback, useEffect, useRef } from "react";
import { Collection, Attempt, CoverSource } from "./types";
import { loadArchive, saveArchive, storageErrorMessage } from "./archiveStorage";
import { mergeBackup } from "./backup";

export function useStore() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const latest = useRef<Collection[]>([]);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve(true));
  const loading = useRef(false);

  // ── 非同步啟動：遷移失敗時提供重試，不以空資料覆蓋收藏 ──
  const reload = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setLoadState("loading");
    try {
      const result = await loadArchive();
      latest.current = result.collections;
      revision.current = result.revision;
      setCollections(result.collections);
      setStorageError(null);
      setLoadState("ready");
    } catch (error) {
      setStorageError(storageErrorMessage(error));
      setLoadState("error");
    } finally { loading.current = false; }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  // ── 序列化寫入：每次使用最新資料，避免快速操作互相覆蓋 ──
  const update = useCallback((change: (current: Collection[]) => Collection[]) => {
    const task = queue.current.then(async () => {
      try {
        const next = change(latest.current);
        revision.current = await saveArchive(next, revision.current);
        latest.current = next;
        setCollections(next);
        setStorageError(null);
        return true;
      } catch (error) {
        setStorageError(storageErrorMessage(error));
        return false;
      }
    });
    queue.current = task;
    return task;
  }, []);

  const addCollection = useCallback(
    async (data: Omit<Collection, "id" | "addedAt" | "updatedAt" | "attempts">) => {
      const now = new Date().toISOString();
      const c: Collection = {
        ...data,
        id: crypto.randomUUID(),
        attempts: [],
        addedAt: now,
        updatedAt: now,
      };
      if (!await update((current) => [c, ...current])) return;
      return c.id;
    },
    [update]
  );

  const editCollection = useCallback(
    (id: string, data: Partial<Omit<Collection, "id" | "addedAt" | "attempts">>) => {
      return update(
        (current) => current.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        )
      );
    },
    [update]
  );

  const deleteCollection = useCallback(
    (id: string) => {
      return update((current) => current.filter((c) => c.id !== id));
    },
    [update]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      return update(
        (current) => current.map((c) =>
          c.id === id
            ? { ...c, isFavorite: !c.isFavorite, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    [update]
  );

  const addAttempt = useCallback(
    async (collectionId: string, attempt: Omit<Attempt, "id" | "createdAt">) => {
      const now = new Date().toISOString();
      const a: Attempt = { ...attempt, id: crypto.randomUUID(), createdAt: now };
      const saved = await update(
        (current) => current.map((c) =>
          c.id === collectionId
            ? { ...c, attempts: [...c.attempts, a], updatedAt: now }
            : c
        )
      );
      return saved ? a.id : undefined;
    },
    [update]
  );

  const editAttempt = useCallback(
    (collectionId: string, attemptId: string, data: Partial<Omit<Attempt, "id" | "createdAt">>) => {
      return update(
        (current) => current.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                attempts: c.attempts.map((a) =>
                  a.id === attemptId ? { ...a, ...data } : a
                ),
              }
            : c
        )
      );
    },
    [update]
  );

  const deleteAttempt = useCallback(
    (collectionId: string, attemptId: string) => {
      return update(
        (current) => current.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                attempts: c.attempts.filter((a) => a.id !== attemptId),
              }
            : c
        )
      );
    },
    [update]
  );

  const setCover = useCallback(
    (collectionId: string, coverSource: CoverSource) => {
      return update(
        (current) => current.map((c) =>
          c.id === collectionId
            ? { ...c, coverSource, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    [update]
  );

  // 沿用序列化、原子寫入；成功才更新畫面並回報實際匯入數量。
  const importData = useCallback(async (incoming: Collection[]) => {
    let result = { added: 0, skipped: 0 };
    const success = await update((current) => {
      const merged = mergeBackup(current, incoming);
      result = { added: merged.added, skipped: merged.skipped };
      return merged.collections;
    });
    return success ? result : null;
  }, [update]);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(collections, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [collections]);

  return {
    storageError,
    dismissStorageError: () => setStorageError(null),
    loadState,
    reload,
    collections,
    addCollection,
    editCollection,
    deleteCollection,
    toggleFavorite,
    addAttempt,
    editAttempt,
    deleteAttempt,
    setCover,
    exportData,
    importData,
  };
}

export type Store = ReturnType<typeof useStore>;

// Utility: get display cover image for a collection
export function getCoverImage(c: Collection): string {
  const { coverSource } = c;
  if (coverSource.type === "reference") {
    return c.referenceImages[coverSource.index] ?? c.referenceImages[0] ?? "";
  }
  const attempt = c.attempts.find((a) => a.id === coverSource.attemptId);
  return attempt?.images[coverSource.imageIndex] ?? c.referenceImages[0] ?? "";
}

// Utility: convert File to base64
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

