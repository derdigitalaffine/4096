import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('home.css', 'utf8');
const app = readFileSync('home.js', 'utf8');

test('Tromu welcome page presents all four games and explicit install guidance', () => {
  assert.match(html, /Willkommen in der Tromu Spielewelt\./);
  assert.equal((html.match(/class="game-card"/g) ?? []).length, 4);
  for (const route of ['./4096/', './sudoku/', './dr-mario/', './super-mario-land/']) {
    assert.match(html, new RegExp(`href="${route.replaceAll('.', '\\.')}"`));
  }
  assert.match(html, /offlinefähige PWA/i);
  assert.match(html, /Chrome/);
  assert.match(html, /Safari/);
  assert.match(html, /App installieren/);
  assert.match(html, /Zum Home-Bildschirm/);
});

test('welcome page uses a responsive pixel-game visual contract with touch targets', () => {
  assert.match(css, /font-family:\s*ui-monospace/);
  assert.match(css, /\.hero,[\s\S]*?border:\s*4px solid/);
  assert.match(css, /box-shadow:\s*8px 8px 0 #000/);
  assert.match(css, /\.pixel-button\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(css, /\.game-card\s*\{[\s\S]*?box-shadow:\s*4px 4px 0 #000/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('welcome page exposes install prompt and real shared service-worker readiness', () => {
  assert.match(html, /id="install-app"/);
  assert.match(html, /id="connection-status"[^>]*aria-live="polite"/);
  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /appinstalled/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /connectionStatus/);
});
