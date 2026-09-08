import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/comparisonImages.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { comparisonImages, defaultComparisonIds, toggleComparisonSelection } = exports;
const image = (id) => ({ id, width: 800, height: 600, mimeType: 'image/webp', byteSize: 100, createdAt: '2026-09-09T00:00:00.000Z' });
const original = { referenceImages: [image('ref-1'), image('ref-2')], attempts: [
  { id: 'old', platform: 'PixAI', date: '2026-09-01', prompt: 'old prompt', images: [image('old-1'), image('old-2')] },
  { id: 'new', platform: 'Gemini', date: '2026-09-07', prompt: 'new prompt', images: [image('new-1')] },
] };
const options = comparisonImages(original);
assert.equal(options.length, 5);
assert.equal(new Set(options.map((item) => item.id)).size, 5);
assert.equal(JSON.stringify(defaultComparisonIds(options)), JSON.stringify(['ref-1', 'new-1']));
assert.equal(JSON.stringify(defaultComparisonIds(options, 'old')), JSON.stringify(['ref-1', 'old-1']));
assert.equal(options[0].image.id, 'ref-1');
let selected = ['ref-1', 'old-1'];
assert.equal(toggleComparisonSelection(selected, 'new-1')[0], 'ref-1');
selected = toggleComparisonSelection(selected, 'ref-1');
assert.equal(selected[0], undefined);
selected = toggleComparisonSelection(selected, 'new-1');
assert.equal(options.find((item) => item.id === selected[0]).attempt.prompt, 'new prompt');
selected = toggleComparisonSelection(selected, 'new-1');
selected = toggleComparisonSelection(selected, 'old-2');
assert.equal(options.find((item) => item.id === selected[0]).attempt.prompt, 'old prompt');
assert.equal(defaultComparisonIds([]).length, 0);
assert.equal(defaultComparisonIds(options.slice(0, 1)).length, 1);
console.log('PASS: stable image IDs drive comparison selection without changing mobile two-slot behavior');
