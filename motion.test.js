import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('app.js', 'utf8');
const css = readFileSync('styles.css', 'utf8');

test('board renderer keeps stable cells and retriggers motion only on changed values', () => {
  assert.match(app, /function ensureBoardTiles\(\)/);
  assert.match(app, /existingRows\.length === 4 && existingTiles\.length === 16/);
  assert.match(app, /const tiles = boardElement\.querySelectorAll\('\.tile'\)/);
  assert.match(app, /const tile = tiles\[cellIndex\]/);
  assert.match(app, /const changed = hasRendered && tile\.dataset\.value !== nextValue/);
  assert.match(app, /if \(changed\) retriggerMotion\(tile\)/);
  assert.match(app, /element\.dataset\.motion = element\.dataset\.motion === 'a' \? 'b' : 'a'/);
});

test('tiles, scores, dialogs and buttons have lightweight motion feedback', () => {
  assert.match(css, /\.tile\[data-motion="a"\]/);
  assert.match(css, /\.score-card strong\[data-motion="a"\]/);
  assert.match(css, /\.overlay:not\(\[hidden\]\)/);
  assert.match(css, /@keyframes tile-change-a/);
  assert.match(css, /@keyframes dialog-enter/);
  assert.match(css, /button\s*\{[\s\S]*?transition:/);
});

test('reduced-motion preference remains a hard animation and transition opt-out', () => {
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/)?.[1] ?? '';
  assert.match(reduced, /transition:\s*none !important/);
  assert.match(reduced, /animation:\s*none !important/);
});
