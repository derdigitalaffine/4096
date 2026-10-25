import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAMES } from './games.js';

const theme = readFileSync('mantine-theme.css', 'utf8');
const home = readFileSync('index.html', 'utf8');
const nav = readFileSync('game-nav.js', 'utf8');
const worker = readFileSync('sw.js', 'utf8');

test('shared UI theme exposes Mantine-compatible tokens and accessible focus styles', () => {
  assert.match(theme, /--mantine-color-blue-6:/);
  assert.match(theme, /--mantine-radius-md:/);
  assert.match(theme, /--mantine-shadow-md:/);
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /prefers-reduced-motion/);
});

test('home and every canonical game route receive the shared theme without external runtime assets', () => {
  assert.match(home, /\.\/mantine-theme\.css/);
  assert.match(nav, /routeHref\('\/mantine-theme\.css'\)/);
  assert.match(worker, /\.\/mantine-theme\.css/);

  for (const game of GAMES) {
    const html = readFileSync(`${game.route.slice(1)}index.html`, 'utf8');
    assert.match(html, /\.\.\/game-nav\.js/, `${game.id}: shared navigation/theme loader missing`);
    assert.doesNotMatch(html, /https?:\/\//i, `${game.id}: external runtime URL found`);
  }
});
