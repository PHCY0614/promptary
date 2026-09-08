import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';

const code = ts.transpileModule(readFileSync('src/archiveStorage.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const image = 'data:image/png;base64,' + Buffer.alloc(1024 * 1024, 7).toString('base64');
const fixture = [{ id: 'kept', originalPrompt: 'original', collectionNotes: 'notes', tags: ['portrait'],
  status: 'want', isFavorite: true, promptPending: false, coverSource: { type: 'reference', index: 0 },
  addedAt: '2026-09-07', updatedAt: '2026-09-07', referenceImages: [image],
  attempts: [{ id: 'attempt', prompt: 'modified', notes: 'result', platform: 'PixAI', date: '2026-09-07', images: [image] }],
}];
class Reader {
  async readAsDataURL(blob) {
    try { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onload(); }
    catch (error) { this.error = error; this.onerror(); }
  }
}
function setup(raw = JSON.stringify(fixture)) {
  const exports = {};
  const indexedDB = new IDBFactory();
  let legacy = raw;
  vm.runInNewContext(code, { exports, indexedDB, Blob, atob, FileReader: Reader, Error,
    require: () => ({ SEED: [] }),
    localStorage: { getItem: () => legacy, removeItem: () => { legacy = null; } },
  });
  return { ...exports, indexedDB, legacy: () => legacy };
}
async function disk(api) {
  const db = await new Promise((resolve) => { const request = api.indexedDB.open('prompt-archive'); request.onsuccess = () => resolve(request.result); });
  try { return await new Promise((resolve) => { const transaction = db.transaction('archive'); const request = transaction.objectStore('archive').get('current'); transaction.oncomplete = () => resolve(request.result); }); }
  finally { db.close(); }
}
// 分類是獨立的可選欄位，原始／嘗試各有一份，舊資料無此欄位仍相容。
fixture[0].promptClassification = { sourcePrompt: 'original', overrides: { '0': 'appearance' } };
fixture[0].attempts[0].promptClassification = { sourcePrompt: 'modified', overrides: { '0': 'clothing' } };
const api = setup();
const loaded = await api.loadArchive();
assert.equal(JSON.stringify(loaded.collections), JSON.stringify(fixture));
assert.equal(api.legacy(), null);
const stored = await disk(api);
assert.ok(stored.collections[0].referenceImages[0] instanceof Blob);
assert.equal(stored.collections[0].referenceImages[0].size, 1024 * 1024);
assert.equal(stored.collections[0].attempts[0].images[0].size, 1024 * 1024);
assert.equal((await api.loadArchive()).collections[0].attempts[0].prompt, 'modified');
assert.equal((await api.loadArchive()).collections[0].promptClassification.overrides['0'], 'appearance');
assert.equal((await api.loadArchive()).collections[0].attempts[0].promptClassification.overrides['0'], 'clothing');
// 超過舊 localStorage 常見量級的多張原圖仍以 Blob 保存。
const larger = structuredClone(fixture);
larger[0].name = '藍色';
larger[0].attempts[0].name = '金髮女';
larger[0].referenceImages = Array(8).fill(image);
const revision = await api.saveArchive(larger, loaded.revision);
const reloadedLarger = await api.loadArchive();
assert.equal(reloadedLarger.collections[0].referenceImages.length, 8);
assert.equal(reloadedLarger.collections[0].name, '藍色');
assert.equal(reloadedLarger.collections[0].attempts[0].name, '金髮女');
await assert.rejects(api.saveArchive([], loaded.revision), /其他分頁/);
assert.equal((await api.loadArchive()).collections.length, 1);
await api.saveArchive([], revision);
assert.equal((await api.loadArchive()).collections.length, 0);
assert.equal((await disk(api)).collections.length, 0);

// 遷移寫入失敗必須保留舊資料；失敗更新不改变已保存的版本。
const failing = setup();
const oldPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); };
await assert.rejects(failing.loadArchive(), { name: 'QuotaExceededError' });
assert.notEqual(failing.legacy(), null);
assert.equal(await disk(failing), undefined);
IDBObjectStore.prototype.put = oldPut;
const recovered = await failing.loadArchive();
IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); };
await assert.rejects(failing.saveArchive([], recovered.revision), { name: 'QuotaExceededError' });
IDBObjectStore.prototype.put = oldPut;
assert.equal((await failing.loadArchive()).collections.length, 1);
assert.match(failing.storageErrorMessage(new DOMException('full', 'QuotaExceededError')), /空間不足/);
assert.match(failing.storageErrorMessage(new DOMException('denied', 'SecurityError')), /權限/);
for (const raw of ['invalid JSON', '{}']) {
  const corrupt = setup(raw);
  await assert.rejects(corrupt.loadArchive());
  assert.equal(corrupt.legacy(), raw);
  assert.equal(await disk(corrupt), undefined);
}
const parallel = setup();
const results = await Promise.all([parallel.loadArchive(), parallel.loadArchive()]);
assert.equal(results[0].revision, results[1].revision);
console.log('PASS: legacy migration, byte-exact Blob round trip, >8 MB archive, deletion/reload, quota rollback/retry, corrupt legacy preservation, concurrent initialization and stale-tab rejection');
