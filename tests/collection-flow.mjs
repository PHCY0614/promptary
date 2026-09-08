import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 將瀏覽器邊界替換成可控制的替身，重現檔案失敗與容量不足。
function loadModule(path, globals) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, ...globals });
  return exports;
}
let outcome = 'success';
class Reader {
  readAsDataURL() {
    if (outcome === 'read-error') return this.onerror();
    if (outcome === 'abort') return this.onabort();
    this.result = 'data:image/png;base64,original-bytes';
    this.onprogress({ lengthComputable: true, loaded: 10, total: 10 });
    this.onload();
  }
}
class ImageStub {
  set src(value) { outcome === 'decode-error' ? this.onerror() : this.onload(); }
}
const { readReferenceImage, MAX_REFERENCE_IMAGE_BYTES } = loadModule('src/imageUpload.ts', { FileReader: Reader, Image: ImageStub });
await assert.rejects(readReferenceImage({ type: 'image/gif', size: 1 }, () => {}), /僅支援/);
await assert.rejects(readReferenceImage({ type: 'image/png', size: MAX_REFERENCE_IMAGE_BYTES + 1 }, () => {}), /2 MB/);
for (const failure of ['read-error', 'abort', 'decode-error']) {
  outcome = failure;
  await assert.rejects(readReferenceImage({ type: 'image/png', size: 10 }, () => {}));
}
outcome = 'success';
let progress = 0;
assert.equal(await readReferenceImage({ type: 'image/png', size: 10 }, (p) => { progress = p; }), 'data:image/png;base64,original-bytes');
assert.equal(progress, 100);

let failWrite = true;
let persisted = [];
const states = [];
let id = 0;
const { useStore } = loadModule('src/store.ts', {
  require(name) {
    if (name === './backup') return loadModule('src/backup.ts', { URL });
    if (name === './archiveStorage') return {
      loadArchive: async () => ({ collections: persisted, revision: 1 }),
      saveArchive: async (next, revision) => { if (failWrite) throw new Error('QuotaExceededError'); persisted = next; return revision + 1; },
      storageErrorMessage: () => '無法儲存',
    };
    if (name === 'react') return {
      useState(initial) {
        const index = states.length;
        states.push(typeof initial === 'function' ? initial() : initial);
        return [states[index], (next) => { states[index] = next; }];
      },
      useRef: (current) => ({ current }),
      useEffect: () => {},
      useCallback: (fn) => fn,
    };
    throw new Error(name);
  },
  crypto: { randomUUID: () => `test-${++id}` },
});
const store = useStore();
await store.reload();
const draft = { name: '藍色', originalPrompt: 'keep my draft', referenceImages: [], tags: [], coverSource: { type: 'reference', index: 0 }, status: 'want', isFavorite: false, promptPending: false, collectionNotes: '' };
assert.equal(await store.addCollection(draft), undefined);
assert.equal(states[0].length, 0);
assert.equal(persisted.length, 0);
assert.match(states[1], /無法儲存/);
store.dismissStorageError();
assert.equal(states[1], null);
assert.equal(draft.originalPrompt, 'keep my draft');
failWrite = false;
await Promise.all([store.addCollection(draft), store.addCollection({ ...draft, originalPrompt: 'second' })]);
assert.equal(states[0].length, 2);
assert.equal(persisted.length, 2);
assert.equal(states[1], null);
console.log('PASS: image failures/retry, storage failure atomicity, dismiss error, retry and queued mutations preserve both additions');

const collectionId = persisted[0].id;
assert.equal(persisted[0].name, '藍色');
await store.editCollection(collectionId, { promptClassification: { sourcePrompt: 'second', overrides: { '0': 'other' } } });
assert.equal(persisted[0].originalPrompt, 'second');
const attemptId = await store.addAttempt(collectionId, { name: '金髮女', prompt: 'red hair', images: [], platform: 'PixAI', notes: '', rating: null, date: '2026-09-07' });
await store.editAttempt(collectionId, attemptId, { promptClassification: { sourcePrompt: 'red hair', overrides: { '0': 'appearance' } } });
assert.equal(persisted[0].promptClassification.overrides['0'], 'other');
assert.equal(persisted[0].attempts[0].prompt, 'red hair');
assert.equal(persisted[0].attempts[0].name, '金髮女');
assert.equal(persisted[0].attempts[0].promptClassification.overrides['0'], 'appearance');
console.log('PASS: classification saves independently for collection/attempt without rewriting either prompt');

// 備份往返保留圖片文字與分類；錯誤格式、重複匯入、容量不足皆不破壞舊資料。
const { parseBackup } = loadModule('src/backup.ts', { URL });
const backup = parseBackup(JSON.stringify(persisted));
assert.equal(JSON.stringify(backup), JSON.stringify(persisted));
assert.throws(() => parseBackup('{bad'));
assert.throws(() => parseBackup(JSON.stringify([{ ...backup[0], tags: 123 }])));
assert.throws(() => parseBackup(JSON.stringify([{ ...backup[0], name: 123 }])));
assert.throws(() => parseBackup(JSON.stringify([{ ...backup[0], attempts: [{ ...backup[0].attempts[0], name: 123 }] }])));
assert.throws(() => parseBackup(JSON.stringify([{ ...backup[0], referenceImages: ['javascript:alert(1)'] }])));
const incoming = { ...backup[0], id: 'imported', referenceImages: ['data:image/png;base64,YWJj'] };
const valid = parseBackup(JSON.stringify([incoming, incoming]));
const before = JSON.stringify(persisted);
failWrite = true;
assert.equal(await store.importData(valid), null);
assert.equal(JSON.stringify(persisted), before);
failWrite = false;
let result = await store.importData(valid);
assert.equal(result.added, 1);
assert.equal(result.skipped, 1);
assert.equal(persisted[0].referenceImages[0], incoming.referenceImages[0]);
result = await store.importData(valid);
assert.equal(result.added, 0);
assert.equal(result.skipped, 2);
console.log('PASS: backup validation/round trip, duplicate IDs, atomic import failure and retry');
