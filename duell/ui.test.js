import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Duell-Seite besitzt gemeinsame Navigation, zwei Modi und zugängliche Statusflächen', () => {
  const html = readFileSync('duell/index.html', 'utf8');
  assert.match(html, /data-game-id="duell"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /data-mode="connect-four"/);
  assert.match(html, /data-mode="reversi"/);
  assert.match(html, /id="duell-board"[^>]*role="grid"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /A ●/);
  assert.match(html, /B ○/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Browserlogik bewahrt native Controls und stellt Reversi-Roving-Fokus bereit', () => {
  const app = readFileSync('duell/app.js', 'utf8');
  assert.match(app, /event\.target instanceof Element && event\.target\.closest\('a, button, input, select, textarea'\)/);
  assert.match(app, /button\.tabIndex = index === reversiFocus \? 0 : -1/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /ArrowDown/);
});

test('mobile CSS hält Primärsteuerung auf 44px und codiert Spieler zusätzlich per Symbol', () => {
  const css = readFileSync('duell/styles.css', 'utf8');
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(44px, 1fr\)\)/);
  assert.match(css, /\.column-controls button \{ min-height: 44px; height: 44px/);
  assert.match(css, /\.duell-cell\[data-player="1"\]/);
  assert.match(css, /\.duell-cell\[data-player="2"\]/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
