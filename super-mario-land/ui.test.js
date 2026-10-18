import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Super Mario Land stays local and exposes an accessible multilevel canvas', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/', '../dr-mario/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /id="game-canvas"[^>]*role="img"/);
  assert.match(html, /drei aufeinanderfolgenden Leveln/);
  assert.match(html, /id="level">1\/3</);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Super Mario Land supports touch and keyboard controls', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  const styles = readFileSync('super-mario-land/styles.css', 'utf8');

  for (const id of ['move-left', 'move-right', 'jump', 'new-game']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.key === ' '/);
  assert.match(app, /key === 'r'/);
  assert.match(styles, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /touch-action:\s*manipulation/);
});

test('Super Mario Land renders current level data and carries feedback across transitions', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /LEVEL_COUNT/);
  assert.match(app, /getLevel\(game\)/);
  assert.match(app, /levelElement\.textContent = `\$\{game\.levelIndex \+ 1\}\/\$\{LEVEL_COUNT\}`/);
  assert.match(app, /game\.levelIndex !== previous\.levelIndex/);
  assert.match(app, /Punkte und Leben bleiben erhalten/);
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
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /image-rendering:\s*pixelated/);
});
