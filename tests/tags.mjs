import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"

const exports = {}
vm.runInNewContext(
  ts.transpileModule(readFileSync("src/tags.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports, Intl, Date, Number, Map, Set },
)

const {
  cleanTag,
  normalizeTag,
  uniqueTags,
  summarizeTags,
  collectionHasAnyTag,
} = exports

assert.equal(cleanTag("  ##Portrait lighting  "), "Portrait lighting")
assert.equal(normalizeTag(" ＰＯＲＴＲＡＩＴ "), "ｐｏｒｔｒａｉｔ")
assert.equal(
  JSON.stringify(
    uniqueTags([
      " Portrait ",
      "portrait",
      "cinematic lighting",
      "#風景",
      "風景",
    ]),
  ),
  JSON.stringify(["Portrait", "cinematic lighting", "風景"]),
)

const collection = (id, updatedAt, tags) => ({
  id,
  updatedAt,
  createdAt: updatedAt,
  tags,
})
const summaries = summarizeTags(
  [
    collection("one", "2026-01-01T00:00:00.000Z", [
      "Portrait",
      "portrait",
      "cinematic lighting",
    ]),
    collection("two", "2026-01-02T00:00:00.000Z", ["PORTRAIT", "風景"]),
    collection("three", "2026-01-03T00:00:00.000Z", ["portrait", "風景"]),
  ],
  "zh-TW",
)

assert.equal(summaries[0].key, "portrait")
assert.equal(summaries[0].label, "portrait")
assert.equal(summaries[0].count, 3)
assert.equal(summaries[1].key, "風景")
assert.equal(summaries[1].count, 2)
assert.equal(summaries.find((tag) => tag.key === "cinematic lighting").count, 1)
assert.equal(collectionHasAnyTag([" PORTRAIT "], new Set(["portrait"])), true)
assert.equal(
  collectionHasAnyTag(["portrait lighting"], new Set(["portrait"])),
  false,
)

const picker = readFileSync("src/TagPicker.tsx", "utf8")
const modal = readFileSync("src/CollectionModal.tsx", "utf8")
const gallery = readFileSync("src/Gallery.tsx", "utf8")
assert.match(picker, /split\(\/\[,，\]\//)
assert.match(picker, /nativeEvent\.isComposing/)
assert.match(picker, /min-h-7/)
assert.doesNotMatch(picker, /min-h-11/)
assert.doesNotMatch(picker, /overflow-x-auto/)
assert.doesNotMatch(picker, /grid-cols-4/)
assert.doesNotMatch(picker, /sm:grid-cols-6/)
assert.match(picker, /flex flex-wrap gap-1\.5/)
assert.match(picker, /max-h-7[^"\n]*overflow-hidden/)
assert.match(picker, /new ResizeObserver\(updateVisibleCount\)/)
assert.match(picker, /index >= commonVisibleCount/)
assert.match(modal, /uniqueTags\(\[\.\.\.form\.tags, form\.tagInput\]\)/)
assert.match(gallery, /collectionHasAnyTag/)

console.log(
  "PASS: tag cleanup, logical dedupe, frequency/recency ranking, spaced labels, and shared filtering",
)
