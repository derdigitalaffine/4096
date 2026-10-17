import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('sudoku/index.html', 'utf8');
const app = readFileSync('sudoku/app.js', 'utf8');
const css = readFileSync('sudoku/styles.css', 'utf8');
const rootHtml = readFileSync('index.html', 'utf8');

test('root exposes Sudoku as a touch-sized local navigation target', () => {
  assert.match(rootHtml, /class="nav-link"[^>]*href="\.\/sudoku\/"[^>]*>Sudoku</);
  const rootCss = readFileSync('styles.css', 'utf8');
  assert.match(rootCss, /button, \.nav-link\s*\{[\s\S]*?min-height:\s*44px/);
});

test('Sudoku exposes mobile controls, live status and keyboard shortcuts', () => {
  assert.match(html, /id="difficulty"/);
  assert.equal((html.match(/data-number="[1-9]"/g) ?? []).length, 9);
  assert.match(html, /id="notes-mode"[^>]*aria-pressed="false"[^>]*aria-keyshortcuts="N"/);
  assert.match(html, /id="erase"[^>]*aria-keyshortcuts="Delete Backspace"/);
  assert.match(html, /id="undo"[^>]*aria-keyshortcuts="Control\+Z Meta\+Z"/);
  assert.match(html, /id="sudoku-status"[^>]*aria-live="polite"/);
});

test('renderer creates a semantic nine-row grid with 81 roving-focus cells', () => {
  assert.match(app, /for \(let rowIndex = 0; rowIndex < 9; rowIndex \+= 1\)/);
  assert.match(app, /for \(let columnIndex = 0; columnIndex < 9; columnIndex \+= 1\)/);
  assert.match(app, /row\.setAttribute\('role', 'row'\)/);
  assert.match(app, /cell\.setAttribute\('role', 'gridcell'\)/);
  assert.match(app, /existingRows\.length === 9 && existingCells\.length === 81/);
  assert.match(app, /cell\.tabIndex = index === state\.selected \? 0 : -1/);
});

test('Sudoku persists locally, supports notes and undo, and validates completion', () => {
  assert.match(app, /const STORAGE_KEY = 'sudoku-state-v1'/);
  assert.match(app, /function restoreState\(\)/);
  assert.match(app, /function persistState\(\)/);
  assert.match(app, /state\.notesMode/);
  assert.match(app, /function undo\(\)/);
  assert.match(app, /state\.completed = isSolved\(state\.values, puzzle\)/);
  assert.match(app, /state\.mistakes \+= 1/);
});

test('Sudoku integrates the shared service worker and reports offline readiness', () => {
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /controllerchange/);
  assert.match(app, /connectionStatus/);
});

test('mobile-first layout keeps strong boxes, touch targets and reduced-motion opt-out', () => {
  assert.match(css, /\.sudoku-grid\s*\{[\s\S]*?grid-template-rows:\s*repeat\(9/);
  assert.match(css, /\.sudoku-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(9/);
  assert.match(css, /\.keypad button\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(css, /nth-child\(3n\)/);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/)?.[1] ?? '';
  assert.match(reduced, /transition:\s*none !important/);
  assert.match(reduced, /animation:\s*none !important/);
});
