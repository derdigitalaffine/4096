import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Super Tromu Land stays local and exposes an accessible 4x3-stage power-up canvas', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/', '../dr-tromu/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /<title>Super Tromu Land<\/title>/);
  assert.match(html, /id="game-canvas"[^>]*role="img"/);
  assert.match(html, /vier Welten und zwölf eigenen Stages/i);
  assert.match(html, /id="level">1-1 · 1\/12</);
  assert.match(html, /id="power">Klein</);
  assert.match(html, /2-3 und 4-3[^.]*automatisch vorwärts/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /Super Mario Land|https?:\/\//i);
});

test('Super Tromu Land supports touch, keyboard and flower attack controls', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  const styles = readFileSync('super-mario-land/styles.css', 'utf8');
  for (const id of ['move-left', 'move-right', 'jump', 'fire', 'new-game']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="fire"[^>]*disabled/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /event\.key === ' '/);
  assert.match(app, /key === 'x' \|\| key === 'k'/);
  assert.match(app, /queueFire/);
  assert.match(app, /game\.power !== 'flower'/);
  assert.match(app, /key === 'r'/);
  assert.match(app, /let activePointerId = null/);
  assert.match(app, /event\.pointerId !== activePointerId/);
  assert.match(app, /setDataIfChanged\(button, 'pressed', true\)/);
  assert.match(app, /window\.addEventListener\('blur', releaseDirectionalHolds\)/);
  assert.match(styles, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /touch-action:\s*manipulation/);
  assert.match(styles, /button\[data-pressed="true"\]/);
});

test('Super Tromu Land renders stage themes, question blocks, power-ups and projectiles locally', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /const LEVEL_THEMES = \{/);
  for (const environment of ['desert', 'coast', 'tide', 'ruins', 'cave', 'bamboo', 'mountain', 'sky']) assert.match(app, new RegExp(`${environment}:`));
  assert.match(app, /function drawQuestionBlock/);
  assert.match(app, /fillText\('\?'/);
  assert.match(app, /function drawPowerup/);
  assert.match(app, /item\.type === 'flower'/);
  assert.match(app, /function drawProjectile/);
  assert.match(app, /setDataIfChanged\(canvas, 'questionBlocks', game\.blocks\.length\)/);
  assert.match(app, /setDataIfChanged\(canvas, 'stage', level\.id\)/);
  assert.match(app, /setDataIfChanged\(canvas, 'autoScroll', level\.autoScroll\)/);
});

test('Super Tromu Land renders world-stage identity and twelve-stage progression', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /LEVEL_COUNT/);
  assert.match(app, /stageLabel\(game\)/);
  assert.match(app, /setTextIfChanged\(levelElement, `\$\{stageLabel\(game\)\} · \$\{game\.levelIndex \+ 1\}\/\$\{LEVEL_COUNT\}`\)/);
  assert.match(app, /setTextIfChanged\(powerElement, powerLabel\(game\.power\)\)/);
  assert.match(app, /game\.levelIndex !== previous\.levelIndex/);
  assert.match(app, /const playerTransition = game\.levelIndex !== previous\.levelIndex \|\| game\.lives < previous\.lives/);
  assert.match(app, /if \(playerTransition\) releaseDirectionalHolds\(\)/);
  assert.match(app, /renderGame\(delta, \{ snapCamera: playerTransition \}\)/);
  assert.match(app, /Punkte, Leben und Power-up bleiben erhalten/);
  assert.match(app, /Alle \$\{LEVEL_COUNT\} Stages in vier Welten geschafft/);
  assert.match(app, /level\.autoScroll/);
});

test('Super Tromu Land shares offline readiness and keeps best score locally', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  assert.match(app, /super-mario-land-best-v1/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /connectionStatus/);
});

test('Super Tromu Land has a compact mobile viewport and reduced-motion path', () => {
  const app = readFileSync('super-mario-land/app.js', 'utf8');
  const styles = readFileSync('super-mario-land/styles.css', 'utf8');
  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns:\s*44px 44px minmax\(72px, 1fr\) minmax\(60px, 1fr\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /button\[data-pressed="true"\][^}]*transform:\s*none/s);
  assert.match(app, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(app, /reducedMotionQuery\.matches/);
  assert.match(styles, /image-rendering:\s*pixelated/);
});