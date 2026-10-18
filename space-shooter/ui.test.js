import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Space Shooter page exposes local canvas, shared navigation and accessible live status', () => {
  const html = readFileSync('space-shooter/index.html', 'utf8');
  assert.match(html, /data-game-id="space-shooter"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /\.\.\/game-nav\.js/);
  assert.match(html, /id="shooter-canvas"[^>]*role="img"[^>]*tabindex="0"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="fire"/);
  assert.equal((html.match(/data-direction=/g) ?? []).length, 4);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('browser runtime cleans held input on blur, visibility, terminal state and restart', () => {
  const app = readFileSync('space-shooter/app.js', 'utf8');
  assert.match(app, /held\.clear\(\)/);
  assert.match(app, /window\.addEventListener\('blur', clearInputsAndPause\)/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /game\.status === 'gameover' \|\| game\.status === 'won'/);
  assert.match(app, /function restart\(\)[\s\S]*?held\.clear\(\)/);
});

test('mobile CSS keeps navigation and primary controls on explicit touch targets', () => {
  const css = readFileSync('space-shooter/styles.css', 'utf8');
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.game-nav a[\s\S]*?min-height: 44px/);
  assert.match(css, /\.round-actions button, \.touch-controls button \{ min-height: 44px; height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
