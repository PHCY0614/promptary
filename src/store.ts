import { useState, useCallback, useEffect, useRef } from "react";
import { Collection, Attempt, CoverSource, ImageRef } from "./types";
import { getCanonicalBlob, loadArchive, saveArchive, stageCanonicalImage, storageErrorMessage } from "./archiveStorage";
import { createBackup, mergeBackup, type BackupBundle } from "./backup";
import { ErrorCode } from "./i18n/errorCodes";

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
        (current) => current.map((c) => {
          if (c.id !== collectionId) return c;
          const attempts = c.attempts.map((a) => a.id === attemptId ? { ...a, ...data } : a);
          const coverSource = c.coverSource;
          const coveredAttempt = coverSource.type === "attempt" ? attempts.find((a) => a.id === coverSource.attemptId) : undefined;
          const coverStillExists = coverSource.type !== "attempt" || coveredAttempt?.images.some((image) => image.id === coverSource.imageId);
          return {
            ...c,
            updatedAt: new Date().toISOString(),
            attempts,
            coverSource: coverStillExists ? coverSource : firstAvailableCover(c.referenceImages, attempts),
          };
        })
      );
    },
    [update]
  );

  const deleteAttempt = useCallback(
    (collectionId: string, attemptId: string) => {
      return update(
        (current) => current.map((c) => {
          if (c.id !== collectionId) return c;
          const attempts = c.attempts.filter((a) => a.id !== attemptId);
          return {
            ...c,
            updatedAt: new Date().toISOString(),
            attempts,
            coverSource: c.coverSource.type === "attempt" && c.coverSource.attemptId === attemptId
              ? firstAvailableCover(c.referenceImages, attempts)
              : c.coverSource,
          };
        })
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
  const importData = useCallback(async (incoming: BackupBundle) => {
    let result = { added: 0, skipped: 0 };
    const merged = mergeBackup(latest.current, incoming.collections);
    try {
      const currentImageIds = new Set(latest.current.flatMap((collection) => [
        ...collection.referenceImages.map((image) => image.id),
        ...collection.attempts.flatMap((attempt) => attempt.images.map((image) => image.id)),
      ]));
      for (const id of merged.requiredImageIds) {
        const blob = incoming.images.get(id);
        if (!blob) throw new Error(ErrorCode.backupImagesIncomplete);
        if (currentImageIds.has(id)) {
          const [currentBytes, incomingBytes] = await Promise.all([getCanonicalBlob(id).then((value) => value.arrayBuffer()), blob.arrayBuffer()]);
          const currentView = new Uint8Array(currentBytes);
          const incomingView = new Uint8Array(incomingBytes);
          if (currentView.length !== incomingView.length || currentView.some((byte, index) => byte !== incomingView[index])) {
            throw new Error(ErrorCode.backupDuplicateImageId);
          }
        } else {
          const ref = [...merged.collections.flatMap((collection) => [...collection.referenceImages, ...collection.attempts.flatMap((attempt) => attempt.images)])].find((image) => image.id === id)!;
          stageCanonicalImage(ref, blob);
        }
      }
    } catch (error) {
      setStorageError(storageErrorMessage(error));
      return null;
    }
    const success = await update((current) => {
      const latestMerge = mergeBackup(current, incoming.collections);
      result = { added: latestMerge.added, skipped: latestMerge.skipped };
      return latestMerge.collections;
    });
    return success ? result : null;
  }, [update]);

  const exportData = useCallback(async () => {
    try {
      const blob = await createBackup(collections);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promptary-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStorageError(null);
      return true;
    } catch (error) {
      setStorageError(storageErrorMessage(error));
      return false;
    }
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

function firstAvailableCover(referenceImages: ImageRef[], attempts: Attempt[]): CoverSource {
  const reference = referenceImages[0];
  if (reference) return { type: "reference", imageId: reference.id };
  const attempt = attempts.find((candidate) => candidate.images.length > 0);
  return attempt ? { type: "attempt", attemptId: attempt.id, imageId: attempt.images[0].id } : { type: "reference", imageId: "" };
}

// Utility: get display cover image for a collection
export function getCoverImage(c: Collection): ImageRef | undefined {
  const { coverSource } = c;
  if (coverSource.type === "reference") {
    return c.referenceImages.find((image) => image.id === coverSource.imageId) ?? c.referenceImages[0];
  }
  const attempt = c.attempts.find((a) => a.id === coverSource.attemptId);
  return attempt?.images.find((image) => image.id === coverSource.imageId) ?? c.referenceImages[0];
}

