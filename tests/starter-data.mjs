import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { IDBFactory } from 'fake-indexeddb';

class FileStub extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } }

function transpile(path) {
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/import\.meta\.env(?:\s*\?\.\s*BASE_URL|\.BASE_URL)/g, '"/"');
}

function loadStarterData() {
  const exports = {};
  vm.runInNewContext(transpile('src/starterData.ts'), { exports, Map, Error });
  return exports;
}

const starter = loadStarterData();
const refs = starter.starterImageRefs();
assert.equal(starter.STARTER_COLLECTIONS.length, 4);
assert.equal(refs.length, 11);
assert.equal(starter.starterImageUrl(refs[0], '/'), `/starter/${refs[0].id}.webp`);
assert.equal(starter.starterImageUrl(refs[0], '/app'), `/app/starter/${refs[0].id}.webp`);
for (const ref of refs) {
  const file = `public/${starter.starterImageAssetPath(ref)}`;
  assert.equal(existsSync(file), true, `missing ${file}`);
  assert.equal(readFileSync(file).length, ref.byteSize, `byteSize mismatch ${file}`);
}

function assetFetch(url) {
  const file = `public/starter/${basename(String(url))}`;
  if (!existsSync(file)) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  const copy = Uint8Array.from(readFileSync(file));
  return { ok: true, arrayBuffer: async () => copy.buffer };
}

function setup({ fetchImpl = assetFetch, localStorageValue = null, failValidate = false } = {}) {
  const exports = {};
  const indexedDB = new IDBFactory();
  const localStorage = {
    value: localStorageValue,
    getItem() { return this.value; },
    removeItem() { this.value = null; },
  };
  const fetchCalls = [];
  vm.runInNewContext(transpile('src/archiveStorage.ts'), {
    exports, indexedDB, Blob, File: FileStub, atob, crypto: { randomUUID: () => 'migrated-id' }, Error, DOMException, Map, Set, Date,
    localStorage,
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return fetchImpl(url);
    },
    require(name) {
      if (name === './starterData') return starter;
      if (name === './i18n/errorCodes') {
        const errorExports = {};
        vm.runInNewContext(transpile('src/i18n/errorCodes.ts'), { exports: errorExports, Error });
        return errorExports;
      }
      if (name === './imageProcessing') return {
        THUMBNAIL_VERSION: 1,
        createCanonicalImage: async (file, id) => ({
          ref: { id, width: 1200, height: 800, mimeType: 'image/webp', byteSize: file.size, createdAt: '2026-09-09T00:00:00.000Z' },
          blob: new Blob([await file.arrayBuffer()], { type: 'image/webp' }),
        }),
        createThumbnail: async () => ({ blob: new Blob(['thumb'], { type: 'image/webp' }), width: 800, height: 533 }),
        validateCanonicalBlob: async (blob, expected) => {
          if (failValidate) throw new Error('backupImageManifestMismatch');
          if (expected && (blob.size !== expected.byteSize || blob.type !== expected.mimeType)) {
            throw new Error('backupImageManifestMismatch');
          }
          return { width: expected?.width ?? 1, height: expected?.height ?? 1 };
        },
      };
      return {};
    },
  });
  return { ...exports, indexedDB, fetchCalls, localStorage };
}

async function readStore(indexedDB, name, key) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('prompt-archive', 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(name, 'readonly');
      const request = key === undefined ? transaction.objectStore(name).getAllKeys() : transaction.objectStore(name).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function putSnapshot(indexedDB, snapshot) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('prompt-archive', 3);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('archive');
      request.result.createObjectStore('images');
      request.result.createObjectStore('imageThumbnails');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('archive', 'readwrite');
    transaction.objectStore('archive').put(snapshot, 'current');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

const existingCollection = {
  id: 'already-there',
  originalPrompt: 'keep me',
  collectionNotes: '',
  tags: [],
  status: 'want',
  isFavorite: false,
  promptPending: false,
  coverSource: { type: 'reference', imageId: '' },
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
  referenceImages: [],
  attempts: [],
};

const fresh = setup();
const seeded = await fresh.loadArchive();
assert.equal(seeded.revision, 1);
assert.equal(seeded.collections.length, 4);
assert.deepEqual(seeded.collections.map((collection) => collection.id), starter.STARTER_COLLECTIONS.map((collection) => collection.id));
assert.equal(seeded.collections[0].name, 'Miniature Worlds');
assert.equal(seeded.collections[1].name, '天文館學者');
assert.equal(seeded.collections[1].promptClassification.overrides['519'], 'clothing');
assert.equal(seeded.collections[2].isFavorite, true);
assert.equal(seeded.collections[3].attempts[0].rating, 4);
assert.equal(fresh.fetchCalls.length, 11);
const storedIds = await readStore(fresh.indexedDB, 'images');
assert.equal(storedIds.length, 11);
for (const ref of refs) {
  const record = await readStore(fresh.indexedDB, 'images', ref.id);
  assert.ok(record?.blob instanceof Blob, `missing blob ${ref.id}`);
  assert.equal(record.blob.size, ref.byteSize);
  assert.equal(record.blob.type, ref.mimeType);
  const canonical = await fresh.getCanonicalBlob(ref.id);
  assert.equal(canonical.size, ref.byteSize);
  assert.equal(canonical.type, ref.mimeType);
}
const snapshot = await readStore(fresh.indexedDB, 'archive', 'current');
assert.equal(JSON.stringify(snapshot).includes('blob'), false);
const reloaded = await fresh.loadArchive();
assert.equal(reloaded.revision, 1);
assert.equal(fresh.fetchCalls.length, 11);

const preexisting = setup();
await putSnapshot(preexisting.indexedDB, { revision: 4, collections: [existingCollection] });
const kept = await preexisting.loadArchive();
assert.equal(kept.revision, 4);
assert.equal(kept.collections.length, 1);
assert.equal(kept.collections[0].id, 'already-there');
assert.equal(preexisting.fetchCalls.length, 0);
assert.deepEqual(await readStore(preexisting.indexedDB, 'images'), []);

const migrated = setup({
  localStorageValue: JSON.stringify([{
    ...existingCollection,
    addedAt: existingCollection.createdAt,
    createdAt: undefined,
    updatedAt: undefined,
    coverSource: { type: 'reference', index: 0 },
    attempts: [{ id: 'legacy-attempt', images: [], platform: 'PixAI', prompt: 'keep me', notes: '', rating: null, date: '2026-09-09', createdAt: '2026-09-09T00:00:00.000Z' }],
  }]),
});
const fromLegacy = await migrated.loadArchive();
assert.equal(fromLegacy.collections.length, 1);
assert.equal(fromLegacy.collections[0].id, 'already-there');
assert.equal(fromLegacy.collections[0].attempts[0].promptMode, 'original');
assert.equal(migrated.fetchCalls.length, 0);
assert.equal(migrated.localStorage.value, null);

const cleared = setup();
const beforeClear = await cleared.loadArchive();
assert.equal(beforeClear.collections.length, 4);
await cleared.clearArchive(beforeClear.revision);
const afterClear = await cleared.loadArchive();
assert.equal(afterClear.collections.length, 0);
assert.deepEqual(await readStore(cleared.indexedDB, 'images'), []);
assert.equal(afterClear.revision, beforeClear.revision + 1);

let fetchCount = 0;
let failAt = 3;
const failing = setup({
  fetchImpl: async (url) => {
    fetchCount += 1;
    if (fetchCount === failAt) return { ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) };
    return assetFetch(url);
  },
});
await assert.rejects(failing.loadArchive(), /storageFailed/);
assert.equal(await readStore(failing.indexedDB, 'archive', 'current'), undefined);
assert.deepEqual(await readStore(failing.indexedDB, 'images'), []);
await assert.rejects(failing.getCanonicalBlob(refs[0].id), /imageMissing/);

const invalid = setup({ failValidate: true });
await assert.rejects(invalid.loadArchive(), /backupImageManifestMismatch/);
assert.equal(await readStore(invalid.indexedDB, 'archive', 'current'), undefined);
assert.deepEqual(await readStore(invalid.indexedDB, 'images'), []);

failAt = -1;
const retry = await failing.loadArchive();
assert.equal(retry.collections.length, 4);
assert.equal((await readStore(failing.indexedDB, 'images')).length, 11);
for (const ref of refs) {
  const record = await readStore(failing.indexedDB, 'images', ref.id);
  assert.ok(record?.blob instanceof Blob);
  assert.equal(record.blob.size, ref.byteSize);
}

console.log('PASS: starter collections seed once, images land in IndexedDB, existing data is left alone, and failed init leaves no partial archive');
