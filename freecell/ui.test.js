import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('FreeCell HTML exposes shared navigation, local deal controls and polite status', () => {
  assert.match(html, /data-game-id="freecell"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /\.\.\/game-nav\.js/);
  assert.match(html, /id="deal-seed"/);
  assert.match(html, /id="undo-move"[^>]*aria-keyshortcuts="Control\+Z Meta\+Z"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('FreeCell UI keeps eight responsive cascades and non-color suit symbols', () => {
  assert.match(css, /grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(app, /const SYMBOLS = Object\.freeze\(\{ C: '♣', D: '♦', H: '♥', S: '♠' \}\)/);
  assert.match(app, /aria-label/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
});
