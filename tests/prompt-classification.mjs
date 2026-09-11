import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/promptClassification.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { classifyPrompt, classificationOverrides, inheritPromptClassification } = exports;
for (const [text, expected] of [
  ['black hair', 'appearance'], ['brown_eyes', 'appearance'], ['(long red hair:1.3)', 'appearance'],
  ['oversized sweater', 'clothing'], ['turtleneck dress', 'clothing'], ['微笑', 'pose'],
  ['sitting', 'pose'], ['classroom', 'background'], ['咖啡廳', 'background'],
  ['cowboy shot', 'composition'], ['柔光', 'lighting'], ['masterpiece', 'style'],
  ['mysterious unknown phrase', 'other'], ['address', 'other'], ['holding book', 'other'],
]) assert.equal(classifyPrompt(text)[0].category, expected, text);
assert.equal(classifyPrompt('holding book')[0].ambiguous, true);
const source = 'masterpiece, (red hair, brown eyes:1.2), <lora:some_model:0.7>\n白色毛衣；微笑。';
const fragments = classifyPrompt(source);
assert.equal(fragments.length, 5);
assert.equal(fragments[1].text, '(red hair, brown eyes:1.2)');
assert.equal(fragments[2].text, '<lora:some_model:0.7>');
assert.equal(fragments[3].category, 'clothing');
const repeated = classifyPrompt('red hair, red hair');
assert.notEqual(repeated[0].id, repeated[1].id);
assert.equal(classifyPrompt('').length, 0);
assert.equal(classifyPrompt(' ,\n, ').length, 0);
const saved = { sourcePrompt: source, overrides: { [fragments[0].id]: 'other' } };
assert.equal(classificationOverrides(source, saved)[fragments[0].id], 'other');
assert.equal(Object.keys(classificationOverrides('new source', saved)).length, 0);
assert.equal(Object.keys(classificationOverrides(source, { sourcePrompt: source, overrides: { invalid: 'pose', [fragments[0].id]: 'invalid-category' } })).length, 0);
assert.equal(source, 'masterpiece, (red hair, brown eyes:1.2), <lora:some_model:0.7>\n白色毛衣；微笑。');

const originalPrompt = '1girl, black hair, blue eyes, white dress';
const originalParts = classifyPrompt(originalPrompt);
const girl = originalParts.find((part) => part.text === '1girl');
const blackHair = originalParts.find((part) => part.text === 'black hair');
const blueEyes = originalParts.find((part) => part.text === 'blue eyes');
const whiteDress = originalParts.find((part) => part.text === 'white dress');
const originalSaved = {
  sourcePrompt: originalPrompt,
  overrides: { [girl.id]: 'other', [blackHair.id]: 'appearance', [blueEyes.id]: 'appearance', [whiteDress.id]: 'clothing' },
};
const reordered = inheritPromptClassification(originalPrompt, originalSaved, 'white dress, 1girl, silver hair, blue eyes');
const attemptParts = classifyPrompt('white dress, 1girl, silver hair, blue eyes');
const byText = Object.fromEntries(attemptParts.map((part) => [part.text, reordered.overrides[part.id]]));
assert.equal(reordered.sourcePrompt, 'white dress, 1girl, silver hair, blue eyes');
assert.equal(byText['white dress'], 'clothing');
assert.equal(byText['1girl'], 'other');
assert.equal(byText['blue eyes'], 'appearance');
assert.equal(byText['silver hair'], undefined);
assert.equal(classifyPrompt('silver hair')[0].category, 'appearance');
assert.equal(byText['black hair'], undefined);

const autoInherited = inheritPromptClassification(originalPrompt, undefined, 'blue eyes, white dress');
const autoParts = classifyPrompt('blue eyes, white dress');
assert.equal(autoInherited.overrides[autoParts.find((part) => part.text === 'blue eyes').id], 'appearance');
assert.equal(autoInherited.overrides[autoParts.find((part) => part.text === 'white dress').id], 'clothing');

const padded = inheritPromptClassification(originalPrompt, originalSaved, '  blue eyes  , white dress');
const paddedParts = classifyPrompt('  blue eyes  , white dress');
assert.equal(paddedParts.find((part) => part.text === 'blue eyes').text, 'blue eyes');
assert.equal(padded.overrides[paddedParts.find((part) => part.text === 'blue eyes').id], 'appearance');

assert.equal(inheritPromptClassification(originalPrompt, originalSaved, 'silver hair').overrides[classifyPrompt('silver hair')[0].id], undefined);
assert.equal(inheritPromptClassification(originalPrompt, originalSaved, 'Blue eyes').overrides[classifyPrompt('Blue eyes')[0].id], undefined);
assert.equal(inheritPromptClassification(originalPrompt, originalSaved, 'blue  eyes').overrides[classifyPrompt('blue  eyes')[0].id], undefined);

const conflictSource = 'red hair, portrait, red hair';
const conflictParts = classifyPrompt(conflictSource);
const conflictSaved = { sourcePrompt: conflictSource, overrides: { [conflictParts[0].id]: 'other', [conflictParts[2].id]: 'clothing' } };
const conflictInherited = inheritPromptClassification(conflictSource, conflictSaved, 'red hair');
assert.equal(conflictInherited.overrides[classifyPrompt('red hair')[0].id], 'other');

const snapshotOriginalSaved = {
  sourcePrompt: originalPrompt,
  overrides: { ...originalSaved.overrides },
};
const snapshot = inheritPromptClassification(originalPrompt, snapshotOriginalSaved, 'blue eyes');
snapshotOriginalSaved.overrides[blueEyes.id] = 'style';
assert.equal(snapshot.overrides[classifyPrompt('blue eyes')[0].id], 'appearance');
assert.equal(inheritPromptClassification(originalPrompt, snapshotOriginalSaved, 'blue eyes').overrides[classifyPrompt('blue eyes')[0].id], 'style');

const mergeOriginalPrompt = '1girl, blue eyes';
const mergeOriginalParts = classifyPrompt(mergeOriginalPrompt);
const mergeOriginalSaved = {
  sourcePrompt: mergeOriginalPrompt,
  overrides: {
    [mergeOriginalParts.find((part) => part.text === '1girl').id]: 'other',
    [mergeOriginalParts.find((part) => part.text === 'blue eyes').id]: 'appearance',
  },
};
const existingAttemptPrompt = '1girl, blue eyes, silver hair';
const existingAttemptParts = classifyPrompt(existingAttemptPrompt);
const existingAttemptSaved = {
  sourcePrompt: existingAttemptPrompt,
  overrides: {
    [existingAttemptParts.find((part) => part.text === '1girl').id]: 'style',
    [existingAttemptParts.find((part) => part.text === 'silver hair').id]: 'clothing',
  },
};
const mergedPrompt = '1girl, blue eyes, silver hair, portrait';
const merged = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  mergedPrompt,
  existingAttemptPrompt,
  existingAttemptSaved,
);
const mergedParts = classifyPrompt(mergedPrompt);
const mergedByText = Object.fromEntries(mergedParts.map((part) => [part.text, merged.overrides[part.id]]));
assert.equal(mergedByText['1girl'], 'style');
assert.equal(mergedByText['blue eyes'], 'appearance');
assert.equal(mergedByText['silver hair'], 'clothing');
assert.equal(mergedByText['portrait'], undefined);
assert.equal(classifyPrompt('portrait')[0].category, 'composition');

const addOnly = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  '1girl, blue eyes, silver hair, portrait',
  existingAttemptPrompt,
  existingAttemptSaved,
);
assert.equal(addOnly.overrides[mergedParts.find((part) => part.text === '1girl').id], 'style');
assert.equal(addOnly.overrides[mergedParts.find((part) => part.text === 'silver hair').id], 'clothing');

const modifyOther = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  '1girl, blue eyes, silver hair, masterpiece',
  existingAttemptPrompt,
  existingAttemptSaved,
);
const modifyOtherParts = classifyPrompt('1girl, blue eyes, silver hair, masterpiece');
assert.equal(modifyOther.overrides[modifyOtherParts.find((part) => part.text === '1girl').id], 'style');
assert.equal(modifyOther.overrides[modifyOtherParts.find((part) => part.text === 'silver hair').id], 'clothing');

const removedSegment = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  '1girl, portrait',
  existingAttemptPrompt,
  existingAttemptSaved,
);
const removedParts = classifyPrompt('1girl, portrait');
assert.equal(removedSegment.overrides[removedParts.find((part) => part.text === '1girl').id], 'style');
assert.equal(removedSegment.overrides[removedParts.find((part) => part.text === 'silver hair')?.id], undefined);
assert.equal(removedSegment.overrides[removedParts.find((part) => part.text === 'blue eyes')?.id], undefined);

const hairAttemptPrompt = '1girl, black hair';
const hairAttemptParts = classifyPrompt(hairAttemptPrompt);
const hairAttemptSaved = {
  sourcePrompt: hairAttemptPrompt,
  overrides: { [hairAttemptParts.find((part) => part.text === 'black hair').id]: 'clothing' },
};
const changedText = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  '1girl, silver hair',
  hairAttemptPrompt,
  hairAttemptSaved,
);
const changedTextParts = classifyPrompt('1girl, silver hair');
assert.equal(changedText.overrides[changedTextParts.find((part) => part.text === 'silver hair').id], undefined);
assert.equal(classifyPrompt('silver hair')[0].category, 'appearance');

const newFromOriginal = inheritPromptClassification(
  originalPrompt,
  originalSaved,
  '1girl, blue eyes, white dress',
  existingAttemptPrompt,
  existingAttemptSaved,
);
const newFromOriginalParts = classifyPrompt('1girl, blue eyes, white dress');
assert.equal(newFromOriginal.overrides[newFromOriginalParts.find((part) => part.text === '1girl').id], 'style');
assert.equal(newFromOriginal.overrides[newFromOriginalParts.find((part) => part.text === 'blue eyes').id], 'appearance');
assert.equal(newFromOriginal.overrides[newFromOriginalParts.find((part) => part.text === 'white dress').id], 'clothing');

const reorderedMerge = inheritPromptClassification(
  mergeOriginalPrompt,
  mergeOriginalSaved,
  'silver hair, blue eyes, 1girl',
  existingAttemptPrompt,
  existingAttemptSaved,
);
const reorderedParts = classifyPrompt('silver hair, blue eyes, 1girl');
assert.equal(reorderedMerge.overrides[reorderedParts.find((part) => part.text === '1girl').id], 'style');
assert.equal(reorderedMerge.overrides[reorderedParts.find((part) => part.text === 'silver hair').id], 'clothing');
assert.equal(reorderedMerge.overrides[reorderedParts.find((part) => part.text === 'blue eyes').id], 'appearance');

const promptReaderSource = readFileSync('src/PromptReader.tsx', 'utf8');
assert.equal(promptReaderSource.includes('<details'), false);
assert.equal(promptReaderSource.includes('<summary'), false);
assert.match(promptReaderSource, /const \[menuOpen, setMenuOpen\] = useState\(false\)/);
assert.match(promptReaderSource, /aria-haspopup="true"/);
assert.match(promptReaderSource, /aria-expanded=\{menuOpen\}/);
assert.match(promptReaderSource, /document\.addEventListener\("pointerdown", closeMenu\)/);
const attemptModalSource = readFileSync('src/AttemptModal.tsx', 'utf8');
assert.match(attemptModalSource, /inheritPromptClassification/);
assert.match(attemptModalSource, /form\.unmodified \? undefined : customAttemptClassification/);
assert.match(attemptModalSource, /existing\?\.promptMode === "custom" && existing\.prompt === prompt && existing\.promptClassification/);
console.log('PASS: bilingual categories, word boundaries, ambiguous/unknown fallback, weights and LoRA preservation, repeated fragments, empty input, source-bound overrides, original-to-attempt inheritance with attempt manual merge and React-controlled category dropdown');
