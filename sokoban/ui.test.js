import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('Sokoban page exposes shared navigation, grid and complete local controls', () => {
  assert.match(html, /data-game-id="sokoban"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /id="sokoban-board"[^>]*role="grid"[^>]*tabindex="0"/);
  assert.match(html, /id="undo-move"[^>]*aria-keyshortcuts="Control\+Z Meta\+Z"/);
  assert.match(html, /id="restart-level"/);
  assert.match(html, /id="level-select"/);
  assert.equal((html.match(/data-direction=/g) ?? []).length, 4);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
});

test('Sokoban mobile controls keep the established 44px touch contract and visible focus', () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /width:\s*44px;\s*height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('Sokoban keyboard and persistence hooks are wired in the browser layer', () => {
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(app, /withResume\(progress, game\)/);
  assert.match(app, /recordCompletion\(progress, game\)/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
});
