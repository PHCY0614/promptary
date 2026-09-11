import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, globals) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, ...globals });
  return exports;
}

let failWrite = true;
let persisted = [];
const states = [];
let serial = 0;
const staged = new Map();
let customPlatforms = ['Local'];
let persistenceRequests = 0;
let persistenceAttempted = false;
const refsFrom = (collections) => new Map(collections.flatMap((collection) => [
  ...collection.referenceImages,
  ...collection.attempts.flatMap((attempt) => attempt.images),
]).map((image) => [image.id, image]));
const mergeBackup = (current, incoming) => {
  const currentById = new Map(current.map((collection) => [collection.id, collection]));
  const addedCollections = [];
  const updatedCollections = new Map();
  let kept = 0;
  for (const collection of incoming) {
    const local = currentById.get(collection.id);
    if (!local) addedCollections.push(collection);
    else if (Date.parse(collection.updatedAt ?? collection.createdAt) > Date.parse(local.updatedAt ?? local.createdAt)) updatedCollections.set(collection.id, collection);
    else kept++;
  }
  const selected = [...addedCollections, ...updatedCollections.values()];
  const requiredImageRefs = refsFrom(selected);
  return {
    collections: [...addedCollections, ...current.map((collection) => updatedCollections.get(collection.id) ?? collection)],
    added: addedCollections.length,
    updated: updatedCollections.size,
    kept,
    requiredImageIds: new Set(requiredImageRefs.keys()),
    requiredImageRefs,
    updatedCollectionIds: new Set(updatedCollections.keys()),
  };
};
const { useStore } = loadModule('src/store.ts', {
  Blob, URL, document: { createElement: () => ({ click() {} }) }, Uint8Array,
  require(name) {
    if (name === './backup') return { mergeBackup, createBackup: async () => new Blob(['zip']) };
    if (name === './archiveStorage') return {
      loadArchive: async () => ({ collections: persisted, revision: 1 }),
      saveArchive: async (next, revision) => { if (failWrite) throw new DOMException('full', 'QuotaExceededError'); persisted = next; return revision + 1; },
      clearArchive: async (revision) => { if (failWrite) throw new DOMException('full', 'QuotaExceededError'); persisted = []; staged.clear(); return revision + 1; },
      stageCanonicalImage: (ref, blob) => staged.set(ref.id, blob),
      getCanonicalBlob: async (id) => staged.get(id),
      storageErrorMessage: () => '無法儲存，表單仍保留。',
    };
    if (name === './platformStorage') return {
      readCustomPlatforms: () => customPlatforms,
      writeCustomPlatforms: (next) => { customPlatforms = next; return true; },
      clearCustomPlatforms: () => { customPlatforms = []; return true; },
      normalizeCustomPlatforms: (value) => {
        const seen = new Set();
        return value.filter((platform) => { const key = platform.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
      },
    };
    if (name === './storagePersistence') return { requestPersistentStorageOnce: async () => { if (!persistenceAttempted) { persistenceAttempted = true; persistenceRequests++; } } };
    if (name === 'react') return {
      useState(initial) {
        const index = states.length;
        states.push(typeof initial === 'function' ? initial() : initial);
        return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
      useRef: (current) => ({ current }),
      useEffect: () => {},
      useCallback: (fn) => fn,
    };
    if (name === './i18n/errorCodes') {
      const errorExports = {};
      vm.runInNewContext(ts.transpileModule(readFileSync('src/i18n/errorCodes.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, { exports: errorExports, Error });
      return errorExports;
    }
    throw new Error(name);
  },
  crypto: { randomUUID: () => `test-${++serial}` },
  DOMException, Error, Date, Set, Map,
});

const store = useStore();
await store.reload();
const draft = { name: '藍色', originalPrompt: 'keep my draft', referenceImages: [], tags: [], coverSource: { type: 'reference', imageId: '' }, status: 'want', isFavorite: false, promptPending: false, collectionNotes: '' };
assert.equal(await store.addCollection(draft), undefined);
assert.equal(states[0].length, 0);
assert.equal(persisted.length, 0);
assert.match(states[1], /表單仍保留/);
store.dismissStorageError();
assert.equal(states[1], null);

failWrite = false;
await Promise.all([store.addCollection(draft), store.addCollection({ ...draft, originalPrompt: 'second' })]);
assert.equal(states[0].length, 2);
assert.equal(persisted.length, 2);
assert.equal(persistenceRequests, 1);
const collectionId = persisted[0].id;
await store.editCollection(collectionId, { promptClassification: { sourcePrompt: 'second', overrides: { '0': 'other' } } });
const attemptId = await store.addAttempt(collectionId, { name: '金髮女', promptMode: 'custom', prompt: 'red hair', images: [], platform: 'PixAI', notes: '', rating: null, date: '2026-09-07' });
await store.editAttempt(collectionId, attemptId, { promptClassification: { sourcePrompt: 'red hair', overrides: { '0': 'appearance' } } });
assert.equal(persisted[0].promptClassification.overrides['0'], 'other');
await store.editCollection(collectionId, { promptClassification: { sourcePrompt: 'second', overrides: { '0': 'style' } } });
assert.equal(persisted[0].attempts[0].promptClassification.overrides['0'], 'appearance');
const originalModeId = await store.addAttempt(collectionId, { promptMode: 'original', prompt: 'second', images: [], platform: 'PixAI', notes: '', rating: null, date: '2026-09-07' });
assert.equal(persisted[0].attempts.find((attempt) => attempt.id === originalModeId).promptClassification, undefined);
assert.equal(persisted[0].originalPrompt, 'second');
assert.equal(persisted[0].attempts[0].prompt, 'red hair');
assert.equal(persisted[0].attempts[0].name, '金髮女');

const incoming = { ...draft, id: 'imported', createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z', attempts: [] };
const bundle = { collections: [incoming], images: new Map() };
const before = JSON.stringify(persisted);
failWrite = true;
assert.equal(await store.importData(bundle), null);
assert.equal(JSON.stringify(persisted), before);
failWrite = false;
const result = await store.importData(bundle);
assert.equal(JSON.stringify(result), JSON.stringify({ added: 1, updated: 0, kept: 0 }));
assert.equal(persisted[0].id, 'imported');

const oldImage = { id: 'shared-image', width: 100, height: 100, mimeType: 'image/webp', byteSize: 3, createdAt: '2026-09-10T00:00:00.000Z' };
await store.editCollection(collectionId, { referenceImages: [oldImage], coverSource: { type: 'reference', imageId: oldImage.id } });
staged.set(oldImage.id, new Blob(['old'], { type: 'image/webp' }));
const replacementBlob = new Blob(['new-image'], { type: 'image/webp' });
const replacementImage = { ...oldImage, byteSize: replacementBlob.size, createdAt: '2026-09-11T00:00:00.000Z' };
const newerCollection = {
  ...persisted.find((collection) => collection.id === collectionId),
  originalPrompt: 'backup newer',
  referenceImages: [replacementImage],
  coverSource: { type: 'reference', imageId: replacementImage.id },
  updatedAt: '2099-09-11T00:00:00.000Z',
};
const updated = await store.importData({ collections: [newerCollection], images: new Map([[replacementImage.id, replacementBlob]]), customPlatforms: ['Local', 'Backup', 'backup'] });
assert.equal(JSON.stringify(updated), JSON.stringify({ added: 0, updated: 1, kept: 0 }));
assert.equal(persisted.find((collection) => collection.id === collectionId).originalPrompt, 'backup newer');
assert.equal(await staged.get(replacementImage.id).text(), 'new-image');
assert.equal(JSON.stringify(customPlatforms), JSON.stringify(['Local', 'Backup']));

assert.equal(await store.clearData(), true);
assert.equal(persisted.length, 0);
assert.equal(JSON.stringify(customPlatforms), JSON.stringify([]));
console.log('PASS: save retry, serialized mutations, persistent-storage request, newer-wins import, image replacement, platform union and clear');
