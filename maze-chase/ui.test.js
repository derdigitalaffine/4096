import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('Maze-Chase-Seite nutzt gemeinsame Navigation, Live-Status und lokale Steuerung', () => {
  assert.match(html, /data-game-id="maze-chase"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /\.\.\/game-nav\.js/);
  assert.match(html, /id="maze-board"[^>]*tabindex="0"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /data-direction="up"/);
  assert.match(html, /data-direction="left"/);
  assert.match(html, /data-direction="down"/);
  assert.match(html, /data-direction="right"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Mobile-CSS hält 15x15-Board und Touchziele kompakt', () => {
  assert.match(css, /grid-template-columns:\s*repeat\(15, 1fr\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(44px, 1fr\)\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('Browserzustand registriert Offline-Shell und schützt native Controls vor Gameplay-Shortcuts', () => {
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
  assert.match(app, /closest\('button, a, input, select, textarea'\)/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /pointerdown/);
});
