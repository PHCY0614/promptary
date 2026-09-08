import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const dimensions = new WeakMap();
const urls = new Map();
let serial = 0;
let lastQuality = 0;
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
        const output = new Blob(['webp'], { type });
        dimensions.set(output, { width: this.width, height: this.height });
        callback(output);
      },
    };
  },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/imageProcessing.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Blob, URL: URLStub, Image: ImageStub, document, crypto: { randomUUID: () => 'generated-id' }, queueMicrotask, Error, Set, Date });

const input = (type, bytes, width, height) => {
  const blob = new Blob([new Uint8Array(bytes)], { type });
  dimensions.set(blob, { width, height });
  return blob;
};
assert.equal(exports.MAX_SOURCE_IMAGE_BYTES, 10 * 1024 * 1024);
assert.equal(exports.MAX_DECODED_IMAGE_PIXELS, 40_000_000);
await assert.rejects(exports.createCanonicalImage(input('image/gif', 1, 100, 100)), /僅支援/);
await assert.rejects(exports.createCanonicalImage(input('image/png', exports.MAX_SOURCE_IMAGE_BYTES + 1, 100, 100)), /10 MB/);
await assert.rejects(exports.createCanonicalImage(input('image/png', 1, 8000, 6000)), /4,000 萬/);

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
console.log('PASS: 10 MB and 40 MP guards, stable IDs, 2048 canonical, 800 thumbnail, WebP quality and no upscaling');
