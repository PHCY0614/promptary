import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/imageBatch.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Promise });

assert.equal(exports.MAX_IMAGES_PER_BATCH, 10);
assert.equal(exports.MAX_CONCURRENT_IMAGE_PROCESSING, 2);

let active = 0;
let maxActive = 0;
const processed = [];
const accepted = await exports.processImageBatch(
  Array.from({ length: 10 }, (_, index) => index),
  async (item) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    processed.push(item);
    active--;
  },
  () => true,
);
assert.equal(accepted, true);
assert.deepEqual(processed, Array.from({ length: 10 }, (_, index) => index));
assert.equal(maxActive, 2);

active = 0;
maxActive = 0;
let queue = Promise.resolve();
for (const batch of [[1, 2], [3, 4], [5]]) {
  queue = exports.enqueueImageBatch(queue, batch, async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active--;
  }, () => true);
}
await queue;
assert.equal(maxActive, 2);

let rejectedCalls = 0;
const rejected = await exports.processImageBatch(
  Array.from({ length: 11 }, (_, index) => index),
  async () => { rejectedCalls++; },
  () => true,
);
assert.equal(rejected, false);
assert.equal(rejectedCalls, 0);

let mounted = true;
let cancelledCalls = 0;
await exports.processImageBatch([1, 2, 3], async () => {
  cancelledCalls++;
  mounted = false;
}, () => mounted);
assert.equal(cancelledCalls, 1);

for (const path of ["src/CollectionModal.tsx", "src/AttemptModal.tsx"]) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /multiple/);
  assert.match(source, /if \(files\.length > MAX_IMAGES_PER_BATCH\)[\s\S]*?return;[\s\S]*?Array\.from\(files\)/);
  assert.match(source, /setImageBatchError\(ErrorCode\.imageBatchTooLarge\)/);
  assert.match(source, /imageQueueRef = useRef<Promise<void>>\(Promise\.resolve\(\)\)/);
  assert.match(source, /useEffect\(\(\) => \{\s*mountedRef\.current = true;\s*return \(\) => \{/);
  assert.match(source, /imageQueueRef\.current = enqueueImageBatch\(imageQueueRef\.current, items, (?:readImage|processImage), \(\) => mountedRef\.current\)/);
  assert.match(source, /onClick=\{\(\) => enqueueImages\(\[img\]\)\}/);
  assert.doesNotMatch(source, /\.forEach\(\(item\) => \{ void (?:readImage|processImage)\(item\); \}\)/);
}

console.log("PASS: both image pickers accept 10, reject 11 before decoding, process at most two concurrently, survive StrictMode remount, and stop queued work after unmount");
