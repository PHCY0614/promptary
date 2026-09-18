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
const attemptModal = readFileSync("src/AttemptModal.tsx", "utf8")
const messages = readFileSync("src/i18n/messages.ts", "utf8")
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
assert.doesNotMatch(picker, /t\.commonTags/)
assert.doesNotMatch(picker, /t\.matchingTags/)
assert.match(picker, /aria-label=\{showAll \? t\.fewerTags : t\.moreTags\}/)
assert.match(picker, /aria-controls=\{suggestionsId\}/)
assert.match(picker, /aria-expanded=\{showAll\}/)
assert.match(picker, /showAll \? "rotate-180" : ""/)
assert.match(picker, /commonVisibleCount > 0/)
assert.match(picker, /h-7 w-7/)
assert.match(picker, /text-base leading-none/)
assert.match(picker, /flex min-w-0 items-start gap-1\.5/)
assert.match(modal, /uniqueTags\(\[\.\.\.form\.tags, form\.tagInput\]\)/)
assert.match(modal, /existing \? t\.saveChanges : t\.addToLibrary/)
assert.match(attemptModal, /existing \? t\.saveChanges : t\.saveAttempt/)
assert.match(messages, /addToLibrary: "加入收藏"/)
assert.match(messages, /addToLibrary: "Add to library"/)
assert.match(messages, /saveAttempt: "儲存嘗試"/)
assert.match(messages, /saveAttempt: "Save attempt"/)
for (const source of [modal, attemptModal]) {
  assert.match(source, /h-\[55px\] px-5 flex items-center justify-between/)
  assert.match(source, /h-\[55px\] px-5 border-t[^"\n]*flex items-center/)
}
assert.match(modal, /Notes \+ Favorite/)
assert.match(modal, /flex flex-col gap-2/)
assert.match(modal, /relative h-4/)
assert.match(modal, /inline-flex min-h-6 -translate-y-1\/2 items-center/)
assert.match(modal, /<svg\s+width="14"\s+height="14"[\s\S]*?<span>\{t\.addFavorite\}<\/span>/)
for (const source of [modal, attemptModal]) {
  assert.match(
    source,
    /mt-1\.5 text-\[11px\] leading-relaxed text-\[#9d9a94\][^>]*>\{t\.localLibraryHint/s,
  )
}
assert.match(gallery, /collectionHasAnyTag/)

console.log(
  "PASS: tag cleanup, logical dedupe, frequency/recency ranking, spaced labels, and shared filtering",
)
