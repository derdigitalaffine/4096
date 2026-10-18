import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Super Mario Land stays local and exposes an accessible multilevel power-up canvas', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/', '../dr-mario/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /id="game-canvas"[^>]*role="img"/);
  assert.match(html, /\?-Blöcken, Pilz- und Blumen-Power-ups/);
  assert.match(html, /id="level">1\/3</);
  assert.match(html, /id="power">Klein</);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Super Mario Land supports touch, keyboard and flower attack controls', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  const styles = readFileSync('super-mario-land/styles.css', 'utf8');

  for (const id of ['move-left', 'move-right', 'jump', 'fire', 'new-game']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="fire"[^>]*disabled/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.key === ' '/);
  assert.match(app, /key === 'x' \|\| key === 'k'/);
  assert.match(app, /queueFire/);
  assert.match(app, /game\.power !== 'flower'/);
  assert.match(app, /key === 'r'/);
  assert.match(styles, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /touch-action:\s*manipulation/);
});

test('Super Mario Land renders question blocks, power-ups and projectiles with local canvas geometry', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /function drawQuestionBlock/);
  assert.match(app, /fillText\('\?'/);
  assert.match(app, /function drawPowerup/);
  assert.match(app, /item\.type === 'flower'/);
  assert.match(app, /function drawProjectile/);
  assert.match(app, /canvas\.dataset\.questionBlocks/);
  assert.match(app, /canvas\.dataset\.power/);
});

test('Super Mario Land renders current level and power data across transitions', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /LEVEL_COUNT/);
  assert.match(app, /getLevel\(game\)/);
  assert.match(app, /levelElement\.textContent = `\$\{game\.levelIndex \+ 1\}\/\$\{LEVEL_COUNT\}`/);
  assert.match(app, /powerElement\.textContent = powerLabel\(game\.power\)/);
  assert.match(app, /game\.levelIndex !== previous\.levelIndex/);
  assert.match(app, /Punkte, Leben und Power-up bleiben erhalten/);
  assert.match(app, /Alle \$\{LEVEL_COUNT\} Level geschafft/);
});

test('Super Mario Land shares offline readiness and keeps best score locally', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /super-mario-land-best-v1/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /connectionStatus/);
});

test('Super Mario Land has a compact mobile viewport and reduced-motion path', () => {
  const styles = readFileSync('super-mario-land/styles.css', 'utf8');
  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns:\s*44px 44px minmax\(72px, 1fr\) minmax\(60px, 1fr\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /image-rendering:\s*pixelated/);
});
