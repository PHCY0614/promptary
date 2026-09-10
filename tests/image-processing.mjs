import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const dimensions = new WeakMap();
const urls = new Map();
let serial = 0;
let lastQuality = 0;
let webpResult = 'image/webp';
const encodeCalls = [];
const URLStub = {
  createObjectURL(blob) { const url = `blob:${++serial}`; urls.set(url, blob); return url; },
  revokeObjectURL(url) { urls.delete(url); },
};
class ImageStub {
  set src(url) {
    const blob = urls.get(url);
    const size = dimensions.get(blob);
    if (!blob || !size) return queueMicrotask(() => this.onerror());
    this.naturalWidth = size.width;
    this.naturalHeight = size.height;
    queueMicrotask(() => this.onload());
  }
}
const document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    return {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob(callback, type, quality) {
        lastQuality = quality;
        encodeCalls.push({ type, quality });
        if (type === 'image/webp' && webpResult === null) return callback(null);
        const output = new Blob(['image'], { type: type === 'image/webp' ? webpResult : type });
        dimensions.set(output, { width: this.width, height: this.height });
        callback(output);
      },
    };
  },
};
const errorCodes = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/i18n/errorCodes.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: errorCodes, Error });
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/imageProcessing.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports, Blob, URL: URLStub, Image: ImageStub, document, crypto: { randomUUID: () => 'generated-id' }, queueMicrotask, Error, Set, Date,
  require(name) {
    if (name === './i18n/errorCodes') return errorCodes;
    throw new Error(`unexpected ${name}`);
  },
});

const input = (type, bytes, width, height) => {
  const blob = new Blob([new Uint8Array(bytes)], { type });
  dimensions.set(blob, { width, height });
  return blob;
};
assert.equal(exports.MAX_SOURCE_IMAGE_BYTES, 10 * 1024 * 1024);
assert.equal(exports.MAX_DECODED_IMAGE_PIXELS, 40_000_000);
await assert.rejects(exports.createCanonicalImage(input('image/gif', 1, 100, 100)), /imageTypeUnsupported/);
await assert.rejects(exports.createCanonicalImage(input('image/png', exports.MAX_SOURCE_IMAGE_BYTES + 1, 100, 100)), /imageFileTooLarge/);
await assert.rejects(exports.createCanonicalImage(input('image/png', 1, 8000, 6000)), /imageTooManyPixels/);

const large = await exports.createCanonicalImage(input('image/jpeg', 10, 6000, 3000), 'stable-id');
assert.equal(large.ref.id, 'stable-id');
assert.equal(large.ref.width, 2048);
assert.equal(large.ref.height, 1024);
assert.equal(large.ref.mimeType, 'image/webp');
assert.equal(lastQuality, 0.85);

const small = await exports.createCanonicalImage(input('image/png', 10, 640, 480), 'small-id');
assert.equal(small.ref.width, 640);
assert.equal(small.ref.height, 480);
const thumbnail = await exports.createThumbnail(large.blob);
assert.equal(thumbnail.width, 800);
assert.equal(thumbnail.height, 400);
assert.equal(lastQuality, 0.82);

webpResult = 'image/png';
encodeCalls.length = 0;
const safariJpeg = await exports.createCanonicalImage(input('image/jpeg', 10, 1200, 800), 'safari-jpeg');
assert.equal(safariJpeg.ref.mimeType, 'image/jpeg');
assert.equal(safariJpeg.blob.type, 'image/jpeg');
assert.deepEqual(encodeCalls.map(({ type, quality }) => [type, quality]), [
  ['image/webp', 0.85],
  ['image/jpeg', 0.88],
]);

encodeCalls.length = 0;
const safariPng = await exports.createCanonicalImage(input('image/png', 10, 1200, 800), 'safari-png');
assert.equal(safariPng.ref.mimeType, 'image/png');
assert.equal(safariPng.blob.type, 'image/png');

webpResult = null;
encodeCalls.length = 0;
const nullFallback = await exports.createCanonicalImage(input('image/jpeg', 10, 1200, 800), 'null-fallback');
assert.equal(nullFallback.ref.mimeType, 'image/jpeg');
assert.equal(nullFallback.blob.type, 'image/jpeg');

encodeCalls.length = 0;
const jpegThumbnail = await exports.createThumbnail(nullFallback.blob);
assert.equal(jpegThumbnail.blob.type, 'image/jpeg');
assert.equal(lastQuality, 0.85);
console.log('PASS: image limits, stable IDs, resizing, WebP encoding, Safari JPEG/PNG fallback, null fallback, and thumbnail fallback');
