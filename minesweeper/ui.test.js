import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('Minesweeper exposes shared navigation, three difficulties and explicit flag mode', () => {
  assert.match(html, /data-game-id="minesweeper"/);
  assert.match(html, /data-game-nav/);
  assert.equal((html.match(/<option value=/g) ?? []).length, 3);
  assert.match(html, /id="input-mode"[^>]*aria-pressed="false"[^>]*aria-keyshortcuts="F"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
});

test('cell states are conveyed with text symbols and labels, not color alone', () => {
  assert.match(app, /'⚑'/);
  assert.match(app, /'✹'/);
  assert.match(app, /setAttribute\('aria-label', cellLabel\(index\)\)/);
  assert.match(app, /setAttribute\('role', 'gridcell'\)/);
  assert.match(app, /tabIndex = index === focusedIndex \? 0 : -1/);
});

test('keyboard, touch-target controls and reduced-motion contracts are explicit', () => {
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.key === 'f' \|\| event\.key === 'F'/);
  assert.match(app, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:\s*hidden/);
});
