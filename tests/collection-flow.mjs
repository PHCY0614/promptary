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
const mergeBackup = (current, incoming) => {
  const ids = new Set(current.map((collection) => collection.id));
  const addedCollections = incoming.filter((collection) => { if (ids.has(collection.id)) return false; ids.add(collection.id); return true; });
  return { collections: [...addedCollections, ...current], added: addedCollections.length, skipped: incoming.length - addedCollections.length, requiredImageIds: new Set() };
};
const { useStore } = loadModule('src/store.ts', {
  Blob, URL, document: { createElement: () => ({ click() {} }) }, Uint8Array,
  require(name) {
    if (name === './backup') return { mergeBackup, createBackup: async () => new Blob(['zip']) };
    if (name === './archiveStorage') return {
      loadArchive: async () => ({ collections: persisted, revision: 1 }),
      saveArchive: async (next, revision) => { if (failWrite) throw new DOMException('full', 'QuotaExceededError'); persisted = next; return revision + 1; },
      stageCanonicalImage: (ref, blob) => staged.set(ref.id, blob),
      getCanonicalBlob: async (id) => staged.get(id),
      storageErrorMessage: () => '無法儲存，表單仍保留。',
    };
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
const collectionId = persisted[0].id;
await store.editCollection(collectionId, { promptClassification: { sourcePrompt: 'second', overrides: { '0': 'other' } } });
const attemptId = await store.addAttempt(collectionId, { name: '金髮女', promptMode: 'custom', prompt: 'red hair', images: [], platform: 'PixAI', notes: '', rating: null, date: '2026-09-07' });
await store.editAttempt(collectionId, attemptId, { promptClassification: { sourcePrompt: 'red hair', overrides: { '0': 'appearance' } } });
assert.equal(persisted[0].originalPrompt, 'second');
assert.equal(persisted[0].attempts[0].prompt, 'red hair');
assert.equal(persisted[0].attempts[0].name, '金髮女');

const incoming = { ...draft, id: 'imported', addedAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z', attempts: [] };
const bundle = { collections: [incoming, incoming], images: new Map() };
const before = JSON.stringify(persisted);
failWrite = true;
assert.equal(await store.importData(bundle), null);
assert.equal(JSON.stringify(persisted), before);
failWrite = false;
const result = await store.importData(bundle);
assert.equal(JSON.stringify(result), JSON.stringify({ added: 1, skipped: 1 }));
assert.equal(persisted[0].id, 'imported');
console.log('PASS: unified save error, form-safe retry, queued mutations, classification fields and atomic import merge');
