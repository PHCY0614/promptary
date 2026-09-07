import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/promptClassification.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { classifyPrompt, classificationOverrides } = exports;
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
console.log('PASS: bilingual categories, word boundaries, ambiguous/unknown fallback, weights and LoRA preservation, repeated fragments, empty input and source-bound overrides');
