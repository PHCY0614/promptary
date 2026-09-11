import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { IDBFactory } from 'fake-indexeddb';

const image = (id) => ({ id, width: 1200, height: 800, mimeType: 'image/webp', byteSize: 9, createdAt: '2026-09-09T00:00:00.000Z' });
const collection = (ref) => ({
  id: 'collection', name: '藍色', originalPrompt: 'original', collectionNotes: '', tags: [], status: 'want',
  isFavorite: false, promptPending: false, coverSource: { type: 'reference', imageId: ref.id },
  createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z', referenceImages: [ref], attempts: [],
});
class FileStub extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } }

function setup() {
  const exports = {};
  const indexedDB = new IDBFactory();
  const code = ts.transpileModule(readFileSync('src/archiveStorage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replaceAll('import.meta.env.BASE_URL', '"/"');
  vm.runInNewContext(code, {
    exports, indexedDB, Blob, File: FileStub, atob, crypto: { randomUUID: () => 'migrated-id' }, Error, DOMException, Map, Set, Date,
    localStorage: { getItem: () => null, removeItem() {} },
    fetch: async () => { throw new Error('starter fetch should not run'); },
    require(name) {
      if (name === './starterData') return { STARTER_COLLECTIONS: [], starterImageUrl: () => '/starter/missing.webp' };
      if (name === './i18n/errorCodes') {
        const errorExports = {};
        vm.runInNewContext(ts.transpileModule(readFileSync('src/i18n/errorCodes.ts', 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText, { exports: errorExports, Error });
        return errorExports;
      }
      if (name === './imageProcessing') return {
        THUMBNAIL_VERSION: 1,
        createCanonicalImage: async (file, id) => ({ ref: { ...image(id), byteSize: file.size }, blob: new Blob([await file.arrayBuffer()], { type: 'image/webp' }) }),
        createThumbnail: async () => ({ blob: new Blob(['thumb'], { type: 'image/webp' }), width: 800, height: 533 }),
        validateCanonicalBlob: async () => ({ width: 1200, height: 800 }),
      };
      return {};
    },
  });
  return { ...exports, indexedDB };
}

async function readStore(indexedDB, name, key) {
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open('prompt-archive', 3); request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result); });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(name, 'readonly');
      const request = key === undefined ? transaction.objectStore(name).getAllKeys() : transaction.objectStore(name).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

const api = setup();
const initial = await api.loadArchive();
assert.equal(initial.revision, 1);
const ref = image('stable-image');
const canonical = new Blob(['canonical'], { type: 'image/webp' });
api.stageCanonicalImage(ref, canonical);
let revision = await api.saveArchive([collection(ref)], initial.revision);
const snapshot = await readStore(api.indexedDB, 'archive', 'current');
assert.equal(snapshot.collections[0].referenceImages[0].id, 'stable-image');
assert.equal('blob' in snapshot.collections[0].referenceImages[0], false);
assert.equal(JSON.stringify(snapshot).includes('data:image'), false);
const imageRecord = await readStore(api.indexedDB, 'images', 'stable-image');
assert.ok(imageRecord.blob instanceof Blob);
assert.equal(await imageRecord.blob.text(), 'canonical');
assert.equal(await (await api.getCanonicalBlob('stable-image')).text(), 'canonical');

assert.deepEqual(await readStore(api.indexedDB, 'imageThumbnails'), []);
assert.equal(await (await api.getThumbnailBlob(ref)).text(), 'thumb');
const thumbnailRecord = await readStore(api.indexedDB, 'imageThumbnails', 'stable-image');
assert.equal(thumbnailRecord.thumbnailVersion, 1);
assert.equal(await (await api.getThumbnailBlob(ref)).text(), 'thumb');

const replacement = new Blob(['replacement'], { type: 'image/webp' });
const replacementRef = { ...ref, byteSize: replacement.size };
api.stageCanonicalImage(replacementRef, replacement);
revision = await api.saveArchive([collection(replacementRef)], revision);
assert.equal(await (await api.getCanonicalBlob(ref.id)).text(), 'replacement');
assert.deepEqual(await readStore(api.indexedDB, 'imageThumbnails'), []);

await assert.rejects(api.saveArchive([], initial.revision), /revisionConflict/);
assert.equal((await api.loadArchive()).collections.length, 1);
await api.clearArchive(revision);
assert.deepEqual(await readStore(api.indexedDB, 'images'), []);
assert.deepEqual(await readStore(api.indexedDB, 'imageThumbnails'), []);
assert.match(api.storageErrorMessage(new DOMException('full', 'QuotaExceededError')), /quotaExceeded/);

// 尚未正式上線的 v2 display/thumbnail 實驗資料可升級；舊 thumbnail 不會成為正式資料。
const migrated = setup();
const v2 = await new Promise((resolve, reject) => {
  const request = migrated.indexedDB.open('prompt-archive', 2);
  request.onupgradeneeded = () => { request.result.createObjectStore('archive'); request.result.createObjectStore('images'); };
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});
await new Promise((resolve, reject) => {
  const transaction = v2.transaction(['archive', 'images'], 'readwrite');
  const legacyAttempts = [
    { id: 'same', images: [], platform: 'PixAI', prompt: 'original', notes: '', rating: null, date: '2026-09-09', createdAt: '2026-09-09T00:00:00.000Z' },
    { id: 'changed', images: [], platform: 'PixAI', prompt: 'changed', notes: '', rating: null, date: '2026-09-09', createdAt: '2026-09-09T00:00:00.000Z' },
  ];
  const currentShape = collection(image('legacy'));
  const { createdAt, updatedAt, ...legacyShape } = currentShape;
  transaction.objectStore('archive').put({ revision: 7, collections: [{ ...legacyShape, addedAt: createdAt, referenceImages: [{ id: 'legacy', width: 1200, height: 800 }], attempts: legacyAttempts, coverSource: { type: 'reference', index: 0 } }] }, 'current');
  transaction.objectStore('images').put({ display: new Blob(['legacy'], { type: 'image/webp' }), thumbnail: new Blob(['old-thumb'], { type: 'image/webp' }) }, 'legacy');
  transaction.oncomplete = resolve;
  transaction.onabort = () => reject(transaction.error);
});
v2.close();
const migratedLoad = await migrated.loadArchive();
assert.equal(migratedLoad.revision, 8);
assert.equal(migratedLoad.collections[0].referenceImages[0].id, 'legacy');
assert.equal(migratedLoad.collections[0].coverSource.imageId, 'legacy');
assert.equal(migratedLoad.collections[0].attempts[0].promptMode, 'original');
assert.equal(migratedLoad.collections[0].attempts[1].promptMode, 'custom');
assert.equal(migratedLoad.collections[0].createdAt, '2026-09-09T00:00:00.000Z');
assert.equal(migratedLoad.collections[0].updatedAt, '2026-09-09T00:00:00.000Z');
assert.equal(await (await migrated.getCanonicalBlob('legacy')).text(), 'legacy');
assert.deepEqual(await readStore(migrated.indexedDB, 'imageThumbnails'), []);
console.log('PASS: metadata-only snapshots, canonical Blob storage, lazy versioned thumbnails, reference cleanup, stale writes and v2 migration');
