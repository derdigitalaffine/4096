import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('4096/index.html', 'utf8');
const app = readFileSync('app.js', 'utf8');
const css = readFileSync('styles.css', 'utf8');

test('board exposes a valid four-row ARIA grid hierarchy', () => {
  assert.match(html, /id="board"[\s\S]*?role="grid"/);
  assert.match(app, /row\.className = 'board-row'/);
  assert.match(app, /row\.setAttribute\('role', 'row'\)/);
  assert.match(app, /row\.setAttribute\('aria-rowindex'/);
  assert.match(app, /tile\.setAttribute\('role', 'gridcell'\)/);
  assert.match(app, /tile\.setAttribute\('aria-colindex'/);
  assert.match(app, /existingRows\.length === 4 && existingTiles\.length === 16/);
});

test('nested semantic rows preserve the visual four-by-four board', () => {
  assert.match(css, /\.board\s*\{[\s\S]*?grid-template-rows:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.board-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});
