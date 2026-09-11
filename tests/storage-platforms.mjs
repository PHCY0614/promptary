import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(path) {
  return ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const typeExports = {};
vm.runInNewContext(transpile('src/types.ts'), { exports: typeExports });
assert.equal(typeExports.PLATFORMS.includes('NovelAI'), true);

function loadStorage(navigator) {
  const exports = {};
  vm.runInNewContext(transpile('src/storagePersistence.ts'), { exports, navigator, Number, Intl });
  return exports;
}

const unsupported = loadStorage({});
assert.equal(await unsupported.requestPersistentStorageOnce(), null);
assert.equal(JSON.stringify(await unsupported.readLocalStorageStatus()), JSON.stringify({ usage: null, persisted: null }));

let persistCalls = 0;
const alreadyPersistent = loadStorage({ storage: {
  persisted: async () => true,
  persist: async () => { persistCalls++; return true; },
  estimate: async () => ({ usage: 386 * 1024 * 1024 }),
} });
assert.equal(await alreadyPersistent.requestPersistentStorageOnce(), true);
assert.equal(await alreadyPersistent.requestPersistentStorageOnce(), null);
assert.equal(persistCalls, 0);
assert.equal(alreadyPersistent.formatStorageUsage((await alreadyPersistent.readLocalStorageStatus()).usage, 'en'), '386 MB');

const granted = loadStorage({ storage: { persisted: async () => false, persist: async () => true } });
assert.equal(await granted.requestPersistentStorageOnce(), true);
const denied = loadStorage({ storage: { persisted: async () => false, persist: async () => false } });
assert.equal(await denied.requestPersistentStorageOnce(), false);
const throws = loadStorage({ storage: {
  persisted: async () => { throw new Error('blocked'); },
  persist: async () => { throw new Error('blocked'); },
  estimate: async () => { throw new Error('blocked'); },
} });
assert.equal(await throws.requestPersistentStorageOnce(), false);
assert.equal(JSON.stringify(await throws.readLocalStorageStatus()), JSON.stringify({ usage: null, persisted: null }));

const values = new Map([
  ['promptary-locale', 'en'],
  ['promptary-custom-platforms', JSON.stringify(['PixAI', 'NovelAI', 'Midjourney', 'midjourney', ' ChatGPT ', ''])],
]);
const platformExports = {};
vm.runInNewContext(transpile('src/platformStorage.ts'), {
  exports: platformExports,
  Set,
  JSON,
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  },
  require(name) {
    if (name === './types') return { PLATFORMS: ['PixAI', 'NovelAI', 'Gemini', 'ChatGPT', '自訂'] };
    return {};
  },
});
assert.equal(JSON.stringify(platformExports.readCustomPlatforms()), JSON.stringify(['Midjourney']));
assert.equal(platformExports.writeCustomPlatforms(['Midjourney', 'ChatGPT', 'Runway', 'runway']), true);
assert.equal(values.get('promptary-custom-platforms'), JSON.stringify(['Midjourney', 'Runway']));
assert.equal(platformExports.clearCustomPlatforms(), true);
assert.equal(values.has('promptary-custom-platforms'), false);
assert.equal(values.get('promptary-locale'), 'en');

console.log('PASS: Storage API fallbacks, one-shot persistence, usage formatting, platform union normalization and scoped clear');
