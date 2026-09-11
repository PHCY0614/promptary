import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const image = (id, mimeType, contents) => {
  const blob = new Blob([contents], { type: mimeType });
  return { blob, ref: { id, width: 1200, height: 800, mimeType, byteSize: blob.size, createdAt: '2026-09-09T00:00:00.000Z' } };
};
const webp = image('image-webp', 'image/webp', 'canonical-webp');
const jpeg = image('image-jpeg', 'image/jpeg', 'canonical-jpeg');
const png = image('image-png', 'image/png', 'canonical-png');
const canonicals = new Map([webp, jpeg, png].map(({ ref, blob }) => [ref.id, blob]));
const ref = webp.ref;
const attempt = { id: 'attempt-1', images: [], platform: 'PixAI', promptMode: 'original', prompt: 'prompt', notes: '', rating: null, date: '2026-09-09', createdAt: '2026-09-09T00:00:00.000Z' };
const collection = { id: 'collection-1', name: '測試', referenceImages: [webp.ref, jpeg.ref, png.ref], coverSource: { type: 'reference', imageId: ref.id }, originalPrompt: 'prompt', promptPending: false, tags: [], isFavorite: false, status: 'want', collectionNotes: '', attempts: [attempt], createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z' };
class FileStub extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } }
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/backup.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports, Blob, Uint8Array, DataView, Set, Map, Date, JSON, Error,
  require(name) {
    if (name === 'fflate') return { strFromU8, strToU8, unzipSync, zipSync };
    if (name === './archiveStorage') return { getCanonicalBlob: async (id) => canonicals.get(id) };
    if (name === './imageProcessing') return { validateCanonicalBlob: async (blob, expected) => { if (expected && (blob.size !== expected.byteSize || blob.type !== expected.mimeType)) throw new Error('mismatch'); } };
    if (name === './platformStorage') return { normalizeCustomPlatforms: (value) => [...new Set(value)] };
    if (name === './i18n/errorCodes') {
      const errorExports = {};
      vm.runInNewContext(ts.transpileModule(readFileSync('src/i18n/errorCodes.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, { exports: errorExports, Error });
      return errorExports;
    }
    return {};
  },
});

const backup = await exports.createBackup([collection], ['Midjourney', 'ChatGPT']);
const files = unzipSync(new Uint8Array(await backup.arrayBuffer()));
assert.deepEqual(Object.keys(files).sort(), ['images/image-jpeg.jpg', 'images/image-png.png', 'images/image-webp.webp', 'manifest.json']);
assert.equal(Object.keys(files).some((name) => name.includes('thumbnail')), false);
const manifestText = strFromU8(files['manifest.json']);
assert.equal(manifestText.includes('data:image'), false);
assert.equal(JSON.parse(manifestText).collections[0].referenceImages[0].id, 'image-webp');
assert.deepEqual(JSON.parse(manifestText).settings.customPlatforms, ['Midjourney', 'ChatGPT']);

const parsed = await exports.parseBackup(new FileStub([backup], 'backup.zip', { type: 'application/zip' }));
assert.equal(parsed.collections[0].referenceImages[0].id, 'image-webp');
assert.equal(parsed.collections[0].attempts[0].promptMode, 'original');
assert.equal(await parsed.images.get('image-webp').text(), 'canonical-webp');
assert.equal(await parsed.images.get('image-jpeg').text(), 'canonical-jpeg');
assert.equal(await parsed.images.get('image-png').text(), 'canonical-png');
const previousManifest = JSON.parse(manifestText);
delete previousManifest.collections[0].attempts[0].promptMode;
delete previousManifest.settings;
previousManifest.collections[0].addedAt = previousManifest.collections[0].createdAt;
delete previousManifest.collections[0].createdAt;
delete previousManifest.collections[0].updatedAt;
const previousBackup = new Blob([zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(previousManifest)) })]);
const previousParsed = await exports.parseBackup(new FileStub([previousBackup], 'previous.zip', { type: 'application/zip' }));
assert.equal(previousParsed.collections[0].attempts[0].promptMode, 'original');
assert.equal(previousParsed.collections[0].createdAt, '2026-09-09T00:00:00.000Z');
assert.equal(previousParsed.collections[0].updatedAt, '2026-09-09T00:00:00.000Z');
assert.equal(previousParsed.customPlatforms, undefined);

assert.equal(exports.MAX_ZIP_BYTES, 100 * 1024 * 1024);
assert.equal(exports.MAX_UNCOMPRESSED_BYTES, 200 * 1024 * 1024);
await assert.rejects(
  exports.parseBackup({ arrayBuffer: async () => new ArrayBuffer(exports.MAX_ZIP_BYTES + 1) }),
  /backupZipTooLarge/,
);

const declaredLarge = zipSync(Object.fromEntries(
  Array.from({ length: 21 }, (_, index) => [`padding/${index}.bin`, new Uint8Array()]),
));
const declaredLargeView = new DataView(declaredLarge.buffer, declaredLarge.byteOffset, declaredLarge.byteLength);
let declaredLargeEocd = declaredLarge.byteLength - 22;
while (declaredLargeView.getUint32(declaredLargeEocd, true) !== 0x06054b50) declaredLargeEocd--;
let declaredLargeCursor = declaredLargeView.getUint32(declaredLargeEocd + 16, true);
for (let index = 0; index < 21; index++) {
  declaredLargeView.setUint32(declaredLargeCursor + 24, 10 * 1024 * 1024, true);
  const nameLength = declaredLargeView.getUint16(declaredLargeCursor + 28, true);
  const extraLength = declaredLargeView.getUint16(declaredLargeCursor + 30, true);
  const commentLength = declaredLargeView.getUint16(declaredLargeCursor + 32, true);
  declaredLargeCursor += 46 + nameLength + extraLength + commentLength;
}
await assert.rejects(
  exports.parseBackup(new FileStub([declaredLarge], 'declared-large.zip', { type: 'application/zip' })),
  /backupZipUncompressed/,
);

const local = { ...collection, originalPrompt: 'local', updatedAt: '2026-09-10T00:00:00.000Z' };
const backupNewer = { ...collection, originalPrompt: 'backup', updatedAt: '2026-09-11T00:00:00.000Z' };
const newerResult = exports.mergeBackup([local], [backupNewer]);
assert.equal(newerResult.updated, 1);
assert.equal(newerResult.collections[0].originalPrompt, 'backup');
assert.equal(newerResult.requiredImageIds.has('image-webp'), true);
const localNewerResult = exports.mergeBackup([{ ...local, updatedAt: '2026-09-12T00:00:00.000Z' }], [backupNewer]);
assert.equal(localNewerResult.kept, 1);
assert.equal(localNewerResult.collections[0].originalPrompt, 'local');
const equalResult = exports.mergeBackup([backupNewer], [{ ...backupNewer, originalPrompt: 'same-time backup' }]);
assert.equal(equalResult.kept, 1);
assert.equal(equalResult.collections[0].originalPrompt, 'backup');
const legacyTime = { ...backupNewer, updatedAt: undefined, createdAt: '2026-09-12T00:00:00.000Z' };
assert.equal(exports.mergeBackup([backupNewer], [legacyTime]).updated, 1);
await assert.rejects(exports.parseBackup(new FileStub(['{"old":true}'], 'old.json')), /backupInvalid/);
const traversal = new Blob([zipSync({ 'manifest.json': strToU8('{}'), '../escape': strToU8('x') })]);
await assert.rejects(exports.parseBackup(new FileStub([traversal], 'bad.zip')), /backupZipUnsafePath/);
const missingImageManifest = { format: 'promptary-backup', version: 1, exportedAt: '2026-09-09T00:00:00.000Z', collections: [collection] };
const missing = new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify(missingImageManifest)) })]);
await assert.rejects(exports.parseBackup(new FileStub([missing], 'missing.zip')), /backupInvalid/);
console.log('PASS: ZIP round trip and existing validation remain intact; 100 MiB archive and 200 MiB declared-size limits are enforced');
