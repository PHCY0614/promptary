import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guard = readFileSync("src/ModalCloseGuard.tsx", "utf8");
const collection = readFileSync("src/CollectionModal.tsx", "utf8");
const attempt = readFileSync("src/AttemptModal.tsx", "utf8");
const messages = readFileSync("src/i18n/messages.ts", "utf8");

for (const source of [collection, attempt]) {
  assert.match(source, /useModalCloseGuard/);
  assert.doesNotMatch(source, /className="fixed inset-0 z-50[^"\n]*" onClick=/);
  assert.match(source, /open=\{closeGuard\.confirmationOpen\}/);
  assert.match(source, /onContinueEditing=\{closeGuard\.continueEditing\}/);
  assert.match(source, /onDiscard=\{closeGuard\.discardChanges\}/);
}

for (const field of ["name", "originalPrompt", "promptPending", "tags", "status", "isFavorite", "collectionNotes", "source"]) {
  assert.match(collection, new RegExp(`a\\.${field} === b\\.${field}`));
}
assert.match(collection, /a\.referenceImages\.map\(\(image\) => image\.id\)/);

for (const field of ["name", "platform", "customPlatform", "prompt", "unmodified", "model", "notes", "rating", "date"]) {
  assert.match(attempt, new RegExp(`a\\.${field} === b\\.${field}`));
}
assert.match(attempt, /a\.images\.map\(\(image\) => image\.id\)/);

assert.match(guard, /if \(!isDirty\) \{\s*onClose\(\);\s*return;/);
assert.match(guard, /if \(confirmationOpen\) \{\s*continueEditing\(\);\s*return;/);
assert.match(guard, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
assert.match(guard, /autoFocus/);
assert.match(guard, /max-w-xs/);
assert.match(guard, /onClick=\{onContinueEditing\}[\s\S]*?bg-\[#c9a96e\]/);
assert.match(guard, /onClick=\{onDiscard\}[\s\S]*?text-\[#b8b5af\]/);
assert.match(messages, /unsavedChangesTitle: "尚未儲存"/);
assert.match(messages, /discardChangesPrompt: "要捨棄目前的變更嗎？"/);
assert.match(messages, /continueEditing: "繼續編輯"/);
assert.match(messages, /discardChanges: "捨棄"/);
assert.match(messages, /nameOptional: "名稱"/);
assert.match(messages, /referenceImagesOptional: "參考圖片"/);
assert.match(messages, /originalPromptOptional: "原始咒語"/);

console.log("PASS: guarded form closing, comprehensive dirty snapshots, inert backdrops, and nested Escape priority");
