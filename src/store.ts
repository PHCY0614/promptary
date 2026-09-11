import { useState, useCallback, useEffect, useRef } from "react";
import { Collection, Attempt, CoverSource, ImageRef } from "./types";
import { clearArchive, getCanonicalBlob, loadArchive, saveArchive, seedStarterArchive, stageCanonicalImage, storageErrorMessage } from "./archiveStorage";
import { createBackup, mergeBackup, type BackupBundle } from "./backup";
import { ErrorCode } from "./i18n/errorCodes";
import { clearCustomPlatforms, normalizeCustomPlatforms, readCustomPlatforms, writeCustomPlatforms } from "./platformStorage";
import { requestPersistentStorageOnce } from "./storagePersistence";

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
      console.info("[Promptary startup] ready");
      // starter seed 與使用者寫入共用 staging，必須排進同一條寫入佇列；
      // 成功或失敗都要讓佇列繼續，否則後續操作會永久卡住。
      if (result.seedStarter) {
        queue.current = queue.current.then(async () => {
          const seeded = await seedStarterArchive();
          if (seeded && revision.current === 0) revision.current = seeded.revision;
          return true;
        }).catch(() => true);
      }
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
    async (data: Omit<Collection, "id" | "createdAt" | "updatedAt" | "attempts">) => {
      const now = new Date().toISOString();
      const c: Collection = {
        ...data,
        id: crypto.randomUUID(),
        attempts: [],
        createdAt: now,
        updatedAt: now,
      };
      if (!await update((current) => [c, ...current])) return;
      void requestPersistentStorageOnce();
      return c.id;
    },
    [update]
  );

  const editCollection = useCallback(
    (id: string, data: Partial<Omit<Collection, "id" | "createdAt" | "updatedAt" | "attempts">>) => {
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
    let result = { added: 0, updated: 0, kept: 0 };
    const merged = mergeBackup(latest.current, incoming.collections);
    try {
      const protectedCollections = latest.current.filter((collection) => !merged.updatedCollectionIds.has(collection.id));
      const protectedRefs = protectedCollections.flatMap((collection) => [
        ...collection.referenceImages,
        ...collection.attempts.flatMap((attempt) => attempt.images),
      ]);
      const protectedImageRefs = new Map(protectedRefs.map((image) => [image.id, image]));
      for (const id of merged.requiredImageIds) {
        const blob = incoming.images.get(id);
        const incomingRef = merged.requiredImageRefs.get(id)!;
        if (!blob) throw new Error(ErrorCode.backupImagesIncomplete);
        const protectedRef = protectedImageRefs.get(id);
        if (protectedRef) {
          if (protectedRef.width !== incomingRef.width || protectedRef.height !== incomingRef.height ||
            protectedRef.byteSize !== incomingRef.byteSize || protectedRef.mimeType !== incomingRef.mimeType ||
            protectedRef.createdAt !== incomingRef.createdAt) throw new Error(ErrorCode.backupDuplicateMeta);
          const [currentBytes, incomingBytes] = await Promise.all([getCanonicalBlob(id).then((value) => value.arrayBuffer()), blob.arrayBuffer()]);
          const currentView = new Uint8Array(currentBytes);
          const incomingView = new Uint8Array(incomingBytes);
          if (currentView.length !== incomingView.length || currentView.some((byte, index) => byte !== incomingView[index])) {
            throw new Error(ErrorCode.backupDuplicateImageId);
          }
        } else {
          stageCanonicalImage(incomingRef, blob);
        }
      }
    } catch (error) {
      setStorageError(storageErrorMessage(error));
      return null;
    }
    const success = await update((current) => {
      const latestMerge = mergeBackup(current, incoming.collections);
      result = { added: latestMerge.added, updated: latestMerge.updated, kept: latestMerge.kept };
      return latestMerge.collections;
    });
    if (!success) return null;
    if (incoming.customPlatforms !== undefined) {
      const platforms = normalizeCustomPlatforms([...readCustomPlatforms(), ...incoming.customPlatforms]);
      if (!writeCustomPlatforms(platforms)) setStorageError(ErrorCode.platformSaveFailed);
    }
    return result;
  }, [update]);

  const exportData = useCallback(async () => {
    try {
      const blob = await createBackup(collections, readCustomPlatforms());
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

  const clearData = useCallback(() => {
    const task = queue.current.then(async () => {
      try {
        revision.current = await clearArchive(revision.current);
        latest.current = [];
        setCollections([]);
        if (!clearCustomPlatforms()) {
          setStorageError(ErrorCode.platformSaveFailed);
          return false;
        }
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
    clearData,
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

