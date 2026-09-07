import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/comparisonImages.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { comparisonImages, defaultComparisonIds, toggleComparisonSelection } = exports;
const original = { referenceImages: ['ref-1', 'ref-2'], attempts: [
  { id: 'old', platform: 'PixAI', date: '2026-09-01', prompt: 'old prompt', images: ['old-1', 'old-2'] },
  { id: 'new', platform: 'Gemini', date: '2026-09-07', prompt: 'new prompt', images: ['new-1'] },
] };
const options = comparisonImages(original);
assert.equal(options.length, 5);
assert.equal(new Set(options.map(x => x.id)).size, 5);
assert.equal(JSON.stringify(defaultComparisonIds(options)), JSON.stringify(['reference:0', 'attempt:new:0']));
assert.equal(JSON.stringify(defaultComparisonIds(options, 'old')), JSON.stringify(['reference:0', 'attempt:old:0']));
let selected = ['reference:0', 'attempt:old:0'];
// 第三張不會意外替換現有選取。
assert.equal(toggleComparisonSelection(selected, 'attempt:new:0')[0], 'reference:0');
selected = toggleComparisonSelection(selected, 'reference:0');
assert.equal(selected[0], undefined);
assert.equal(selected[1], 'attempt:old:0');
selected = toggleComparisonSelection(selected, 'attempt:new:0');
assert.equal(selected[0], 'attempt:new:0');
assert.equal(selected[1], 'attempt:old:0');
assert.equal(options.find(x => x.id === selected[0]).attempt.prompt, 'new prompt');
selected = toggleComparisonSelection(selected, 'attempt:new:0');
selected = toggleComparisonSelection(selected, 'attempt:old:1');
assert.equal(options.find(x => x.id === selected[0]).attempt.prompt, 'old prompt');
selected = toggleComparisonSelection(selected, 'attempt:old:0');
assert.equal(selected[1], undefined);
selected = toggleComparisonSelection(selected, 'attempt:old:1');
assert.equal(selected.filter(Boolean).length, 0);
assert.equal(defaultComparisonIds([]).length, 0);
assert.equal(defaultComparisonIds(options.slice(0, 1)).length, 1);
console.log('PASS: reference/attempt mapping, chosen attempt defaults, same-attempt pairs, different-attempt pairs, independent replacement/cancellation, duplicate prevention and empty states');
