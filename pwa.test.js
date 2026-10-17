import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'dialog.js',
  'game.js',
  'storage.js',
  'sw.js',
  'manifest.webmanifest',
  'icon.svg',
];

test('webroot contains the complete application shell', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `missing required webroot file: ${file}`);
  }
});

test('manifest describes a standalone local-scope PWA', () => {
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons?.some((icon) => icon.src === './icon.svg'));
});

test('HTML references only local app-shell resources', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const ref of ['./manifest.webmanifest', './icon.svg', './styles.css', './app.js']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('service worker precaches the critical shell', () => {
  const worker = readFileSync('sw.js', 'utf8');
  for (const ref of ['./index.html', './styles.css', './app.js', './dialog.js', './game.js', './storage.js', './manifest.webmanifest', './icon.svg']) {
    assert.match(worker, new RegExp(ref.replaceAll('.', '\\.')));
  }
});

test('HTML exposes undo controls and a polite live game status', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="undo"/);
  assert.match(html, /id="overlay-undo"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /aria-keyshortcuts="Control\+Z Meta\+Z"/);
});

test('terminal dialog wires description, inert background and focus containment', () => {
  const html = readFileSync('index.html', 'utf8');
  const app = readFileSync('app.js', 'utf8');
  assert.match(html, /id="overlay"[^>]*aria-describedby="overlay-message"/);
  assert.match(app, /appShell\.inert = true/);
  assert.match(app, /appShell\.inert = false/);
  assert.match(app, /wrappedDialogFocusTarget/);
});
