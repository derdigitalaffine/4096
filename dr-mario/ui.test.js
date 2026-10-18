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

test('Dr. Mario has touch controls and keyboard bindings', () => {
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
  assert.match(styles, /button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media \(max-width: 680px\)/);
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
  assert.doesNotMatch(styles, /animation:\s*[^n]/i);
});
