import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Dr. Mario page stays local and exposes game navigation', () => {
  const html = readFileSync('dr-mario/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.match(html, /id="bottle"[^>]*role="grid"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
});

test('Dr. Mario has touch controls and keyboard bindings without stealing native control activation', () => {
  const html = readFileSync('dr-mario/index.html', 'utf8');
  const app = readFileSync('dr-mario/app.js', 'utf8');
  const styles = readFileSync('dr-mario/styles.css', 'utf8');

  for (const id of ['move-left', 'rotate', 'move-right', 'move-down', 'hard-drop', 'new-game']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /Enter/);
  assert.match(app, /function isInteractiveTarget\(target\)/);
  assert.match(app, /isInteractiveTarget\(event\.target\)/);
  assert.match(styles, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media \(max-width: 680px\)/);
});

test('Dr. Mario keeps the playable mobile surface inside one dynamic viewport', () => {
  const styles = readFileSync('dr-mario/styles.css', 'utf8');
  const mobileBlock = styles.match(/@media \(max-width: 680px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(mobileBlock, /height:\s*100dvh/);
  assert.match(mobileBlock, /grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/);
  assert.match(mobileBlock, /grid-template-columns:\s*minmax\(0, 1fr\) 110px/);
  assert.match(mobileBlock, /grid-template-areas:\s*\n\s*"rotate down"\s*\n\s*"left right"\s*\n\s*"drop drop"/);
  assert.match(mobileBlock, /#move-left\s*\{\s*grid-area:\s*left/);
  assert.match(mobileBlock, /#move-right\s*\{\s*grid-area:\s*right/);
  assert.match(mobileBlock, /\.instructions\s*\{[^}]*display:\s*none/s);
  assert.match(mobileBlock, /footer\s*\{[^}]*display:\s*none/s);
});

test('Dr. Mario UI separates status, bottle and control deck visually', () => {
  const styles = readFileSync('dr-mario/styles.css', 'utf8');
  assert.match(styles, /--score-accent:\s*#77b8ff/);
  assert.match(styles, /--virus-accent:\s*#ef7077/);
  assert.match(styles, /\.stat-card::before\s*\{/);
  assert.match(styles, /\.side-panel\s*\{[^}]*border:\s*1px solid var\(--border\)[^}]*background:\s*linear-gradient/s);
  assert.match(styles, /#new-game\s*\{[^}]*background:\s*#202635[^}]*color:\s*#f6f7fb/s);
  assert.match(styles, /button:active\s*\{[^}]*transform:\s*translateY\(1px\)/s);
});

test('Dr. Mario renders 8x16 cells, persists locally and shares service-worker readiness', () => {
  const app = readFileSync('dr-mario/app.js', 'utf8');
  assert.match(app, /WIDTH \* HEIGHT/);
  assert.match(app, /dr-mario-state-v1/);
  assert.match(app, /isRestorableState/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\.\/sw\.js'\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /connectionStatus/);
});

test('Dr. Mario exposes a reduced-motion contract without animation dependencies', () => {
  const styles = readFileSync('dr-mario/styles.css', 'utf8');
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /button:active\s*\{\s*transform:\s*none/);
  assert.doesNotMatch(styles, /animation:\s*[^n]/i);
});
