import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const iconFiles = [
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'dialog.js',
  'game.js',
  'storage.js',
  'sw.js',
  'manifest.webmanifest',
  ...iconFiles,
];

function pngDimensions(path) {
  const png = readFileSync(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} must be a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('webroot contains the complete application shell', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `missing required webroot file: ${file}`);
  }
});

test('manifest describes a stable standalone local-scope PWA with install icons', () => {
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');

  const icon = (src) => manifest.icons?.find((entry) => entry.src === src);
  assert.deepEqual(icon('./icon-192.png'), { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' });
  assert.deepEqual(icon('./icon-512.png'), { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' });
  assert.deepEqual(icon('./icon-maskable-512.png'), { src: './icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  assert.deepEqual(icon('./icon.svg'), { src: './icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' });
});

test('raster install icons have the declared pixel dimensions', () => {
  assert.deepEqual(pngDimensions('icon-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions('icon-512.png'), { width: 512, height: 512 });
  assert.deepEqual(pngDimensions('icon-maskable-512.png'), { width: 512, height: 512 });
  assert.deepEqual(pngDimensions('apple-touch-icon.png'), { width: 180, height: 180 });
});

test('HTML references only local app-shell resources and an Apple touch icon', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const ref of ['./manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './styles.css', './app.js']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\.\/apple-touch-icon\.png"[^>]*sizes="180x180"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('service worker precaches the critical shell and install icons', () => {
  const worker = readFileSync('sw.js', 'utf8');
  for (const ref of ['./index.html', './styles.css', './app.js', './dialog.js', './game.js', './storage.js', './manifest.webmanifest', ...iconFiles.map((file) => `./${file}`)]) {
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
