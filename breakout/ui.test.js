import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('Breakout page exposes shared navigation, canvas, live status and complete controls', () => {
  assert.match(html, /data-game-id="breakout"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /id="breakout-canvas"[^>]*width="320"[^>]*height="420"[^>]*role="img"[^>]*tabindex="0"/);
  for (const id of ['move-left', 'move-right', 'launch-ball', 'pause-game', 'restart-game', 'next-level']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
});

test('mobile Breakout keeps 44px touch controls, visible focus and reduced-motion opt-out', () => {
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(44px, 1fr\)\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('browser layer keeps input, local best and service-worker readiness outside pure physics', () => {
  assert.match(app, /keyDirection/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /setPaddleCenter\(game, pointerToWorldX\(event\)\)/);
  assert.match(app, /loadBest\(storage\)/);
  assert.match(app, /saveBest\(storage, bestScore\)/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
});
