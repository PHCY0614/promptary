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

function setup(options = {}) {
  const exports = {};
  const indexedDB = options.indexedDB ?? new IDBFactory();
  const code = ts.transpileModule(readFileSync('src/archiveStorage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replaceAll('import.meta.env.BASE_URL', '"/"');
  vm.runInNewContext(code, {
    exports, indexedDB, Blob, File: FileStub, atob, crypto: { randomUUID: () => 'migrated-id' }, Error, DOMException, Map, Set, Date,
    setTimeout, clearTimeout, Promise,
    console,
    localStorage: { getItem: () => null, removeItem() {} },
    fetch: options.fetch ?? (async () => { throw new Error('starter fetch should not run'); }),
    require(name) {
      if (name === './starterData') {
        return options.starterData ?? { STARTER_COLLECTIONS: [], starterImageUrl: () => '/starter/missing.webp' };
      }
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
      if (name === './starterInitTimeouts') return {
        STARTER_FETCH_TIMEOUT_MS: 20_000,
        STARTER_DECODE_TIMEOUT_MS: 15_000,
        STARTUP_IDB_OPEN_TIMEOUT_MS: 15_000,
        STARTUP_IDB_READ_TIMEOUT_MS: 10_000,
      };
      if (name === './withTimeout') {
        const timeoutExports = {};
        vm.runInNewContext(ts.transpileModule(readFileSync('src/withTimeout.ts', 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText, { exports: timeoutExports, setTimeout, clearTimeout, Promise });
        return timeoutExports;
      }
      return {};
    },
  });
  return { ...exports, indexedDB };
}

// 極小 IndexedDB 替身：只支援 archiveStorage 用到的操作，用來重現 WebKit
// 「put 失敗只送出 transaction error、不再送出 abort」的行為。
function createStubIndexedDB(shouldFailPut = () => false) {
  class StubRequest {
    constructor() {
      this.readyState = 'pending';
      this.result = undefined;
      this.error = null;
      this.onsuccess = null;
      this.onerror = null;
      this.listeners = { success: [], error: [] };
    }
    addEventListener(type, handler) { this.listeners[type].push(handler); }
    settle(type) {
      this.readyState = 'done';
      const direct = type === 'success' ? this.onsuccess : this.onerror;
      direct?.call(this);
      for (const handler of [...this.listeners[type]]) handler.call(this);
    }
  }

  class StubStore {
    constructor(transaction, name) { this.transaction = transaction; this.map = transaction.db.data[name]; }
    get(key) { return this.transaction.enqueue(() => this.map.get(String(key))); }
    getAllKeys() { return this.transaction.enqueue(() => [...this.map.keys()]); }
    delete(key) { return this.transaction.enqueue(() => { this.map.delete(String(key)); }); }
    put(value, key) {
      return this.transaction.enqueue(() => {
        if (this.transaction.db.shouldFailPut(String(key))) {
          throw new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
        }
        this.transaction.db.puts.push(String(key));
        this.map.set(String(key), value);
      });
    }
  }

  class StubTransaction {
    constructor(db) {
      this.db = db;
      this.error = null;
      this.state = 'active';
      this.pending = 0;
      this.listeners = { complete: [], error: [], abort: [] };
    }
    addEventListener(type, handler) { this.listeners[type].push(handler); }
    emit(type) { for (const handler of [...this.listeners[type]]) handler(); }
    objectStore(name) { return new StubStore(this, name); }
    abort() {
      if (this.state !== 'active') return;
      this.state = 'aborted';
      this.error ??= new DOMException('aborted', 'AbortError');
      this.emit('abort');
    }
    enqueue(work) {
      const request = new StubRequest();
      this.pending++;
      void Promise.resolve().then(() => {
        this.pending--;
        if (this.state !== 'active') return;
        try {
          request.result = work();
          request.settle('success');
        } catch (error) {
          this.error = error;
          this.state = 'failed';
          request.error = error;
          request.settle('error');
          this.emit('error'); // 只有 error，沒有後續 abort。
          return;
        }
        if (this.pending === 0) {
          this.state = 'finished';
          this.emit('complete');
        }
      });
      return request;
    }
  }

  const db = {
    data: { archive: new Map(), images: new Map(), imageThumbnails: new Map() },
    puts: [],
    shouldFailPut,
    objectStoreNames: { contains: (name) => Boolean(db.data[name]) },
    transaction: () => new StubTransaction(db),
    close() {},
  };
  return {
    db,
    open() {
      const request = { result: db, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
      void Promise.resolve().then(() => request.onsuccess?.());
      return request;
    },
  };
}

function withDeadline(promise, label) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`never settled: ${label}`)), 2000); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
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
assert.equal(initial.revision, 0);
assert.equal(initial.seedStarter, true);
await api.seedStarterArchive();
const seeded = await api.loadArchive();
assert.equal(seeded.revision, 1);
const ref = image('stable-image');
const canonical = new Blob(['canonical'], { type: 'image/webp' });
api.stageCanonicalImage(ref, canonical);
let revision = await api.saveArchive([collection(ref)], seeded.revision);
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
api.stageCanonicalImage(replacementRef, replacement, { overwrite: true });
revision = await api.saveArchive([collection(replacementRef)], revision);
assert.equal(await (await api.getCanonicalBlob(ref.id)).text(), 'replacement');
assert.deepEqual(await readStore(api.indexedDB, 'imageThumbnails'), []);

const staleBlob = new Blob([new Uint8Array(replacementRef.byteSize)], { type: 'image/webp' });
api.stageCanonicalImage(replacementRef, staleBlob);
revision = await api.saveArchive([{ ...collection(replacementRef), name: 'renamed-only' }], revision);
assert.equal(await (await api.getCanonicalBlob(ref.id)).text(), 'replacement');
assert.equal((await readStore(api.indexedDB, 'archive', 'current')).collections[0].name, 'renamed-only');

await assert.rejects(api.saveArchive([], seeded.revision), /revisionConflict/);
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
// transaction 只送出 error（Safari 無痕模式的 Blob 寫入失敗）時仍必須 settle，不得永久 pending。
const failingStub = createStubIndexedDB((key) => key === 'blob-image');
failingStub.db.data.archive.set('current', { revision: 0, collections: [] });
const failing = setup({ indexedDB: failingStub });
const blobRef = image('blob-image');
failing.stageCanonicalImage(blobRef, new Blob(['canonical'], { type: 'image/webp' }));
await assert.rejects(
  withDeadline(failing.saveArchive([collection(blobRef)], 0), 'saveArchive on transaction error'),
  /UnknownError|Error preparing Blob/,
);

// starter seed 的 Blob 寫入失敗時：Promise settle 成 null，且 starter staged IDs 必須清除，
// 後續普通 save 不會再把這批 starter image 當成 staged candidates。
const starterRef = image('starter-image');
const starterStub = createStubIndexedDB((key) => key === 'starter-image');
const starter = setup({
  indexedDB: starterStub,
  starterData: { STARTER_COLLECTIONS: [collection(starterRef)], starterImageUrl: () => '/starter/starter-image.webp' },
  fetch: async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
});
assert.equal(await withDeadline(starter.seedStarterArchive(), 'seedStarterArchive'), null);
assert.deepEqual(starterStub.db.puts, []);
starterStub.db.shouldFailPut = () => false;
starterStub.db.data.archive.set('current', { revision: 0, collections: [] });
await assert.rejects(
  withDeadline(starter.saveArchive([collection(starterRef)], 0), 'saveArchive after failed starter seed'),
  /imageMissingRetry/,
);
assert.deepEqual(starterStub.db.puts, []);

console.log('PASS: metadata-only snapshots, canonical Blob storage, lazy versioned thumbnails, reference cleanup, stale writes, v2 migration, transaction-error settle and starter seed cleanup');
