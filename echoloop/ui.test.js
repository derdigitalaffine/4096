import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ECHOLOOP-Seite besitzt Registry-Navigation, Grid, Loop-HUD und große Primäraktionen', () => {
  const html = readFileSync('echoloop/index.html', 'utf8');
  assert.match(html, /data-game-id="echoloop"/);
  assert.match(html, /data-game-nav/);
  assert.match(html, /id="echo-board"[^>]*role="grid"[^>]*tabindex="0"/);
  assert.match(html, /id="loop-number"/);
  assert.match(html, /id="tick-number"/);
  assert.match(html, /id="pause-game"/);
  assert.match(html, /id="restart-game"/);
  assert.match(html, /data-input="wait"/);
  assert.equal((html.match(/data-input="(?:up|down|left|right)"/g) ?? []).length, 4);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Browserlogik codiert aktuelle Figur und nummerierte Echos zusätzlich zur Farbe', () => {
  const app = readFileSync('echoloop/app.js', 'utf8');
  assert.match(app, /const echoGlyphs = \['①', '②', '③'/);
  assert.match(app, /tokens\.push\('●'\)/);
  assert.match(app, /Echos \$\{echoes\.map/);
  assert.match(app, /board\.dataset\.echoCount/);
  assert.match(app, /board\.dataset\.echoOneX/);
});

test('Keyboard, Blur und Visibility besitzen explizite Loop-Steuerung', () => {
  const app = readFileSync('echoloop/app.js', 'utf8');
  assert.match(app, /ArrowUp/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /event\.code === 'Space'/);
  assert.match(app, /window\.addEventListener\('blur'/);
  assert.match(app, /visibilitychange/);
});

test('mobile CSS hält Navigation und Controls auf mindestens 44px', () => {
  const css = readFileSync('echoloop/styles.css', 'utf8');
  assert.match(css, /grid-template-columns: repeat\(7, minmax\(44px, 1fr\)\)/);
  assert.match(css, /\.level-select button \{ min-height: 44px/);
  assert.match(css, /\.controls button \{ min-height: 44px; height: 44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
