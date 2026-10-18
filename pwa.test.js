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

const sudokuFiles = [
  'sudoku/index.html',
  'sudoku/styles.css',
  'sudoku/app.js',
  'sudoku/game.js',
];

const drMarioFiles = [
  'dr-mario/index.html',
  'dr-mario/styles.css',
  'dr-mario/app.js',
  'dr-mario/game.js',
];

const superMarioLandFiles = [
  'super-mario-land/index.html',
  'super-mario-land/styles.css',
  'super-mario-land/app.js',
  'super-mario-land/game.js',
];

const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'connectivity.js',
  'dialog.js',
  'game.js',
  'pointer.js',
  'storage.js',
  'sw.js',
  'manifest.webmanifest',
  ...sudokuFiles,
  ...drMarioFiles,
  ...superMarioLandFiles,
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

test('root HTML references only local app-shell resources and all subgames', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const ref of ['./manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './styles.css', './app.js', './sudoku/', './dr-mario/', './super-mario-land/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\.\/apple-touch-icon\.png"[^>]*sizes="180x180"/);
  assert.match(html, /class="nav-link"[^>]*href="\.\/sudoku\/"[^>]*>Sudoku</);
  assert.match(html, /class="nav-link"[^>]*href="\.\/dr-mario\/"[^>]*>Dr\. Mario</);
  assert.match(html, /class="nav-link"[^>]*href="\.\/super-mario-land\/"[^>]*>Super Mario Land</);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Sudoku HTML is a local-only subpage sharing the root PWA shell', () => {
  const html = readFileSync('sudoku/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../dr-mario/', '../super-mario-land/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /id="sudoku-grid"[^>]*role="grid"/);
  assert.match(html, /id="sudoku-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="notes-mode"[^>]*aria-pressed="false"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Dr. Mario HTML is a local-only subpage sharing the root PWA shell', () => {
  const html = readFileSync('dr-mario/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/', '../super-mario-land/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /id="bottle"[^>]*role="grid"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="hard-drop"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Super Mario Land HTML is a local-only subpage sharing the root PWA shell', () => {
  const html = readFileSync('super-mario-land/index.html', 'utf8');
  for (const ref of ['../manifest.webmanifest', '../icon.svg', '../apple-touch-icon.png', './styles.css', './app.js', '../', '../sudoku/', '../dr-mario/']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /id="game-canvas"[^>]*role="img"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="jump"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('service worker precaches all four games, critical shell and install icons', () => {
  const worker = readFileSync('sw.js', 'utf8');
  const refs = [
    './index.html', './styles.css', './app.js', './connectivity.js', './dialog.js', './game.js', './pointer.js', './storage.js',
    './sudoku/', './sudoku/index.html', './sudoku/styles.css', './sudoku/app.js', './sudoku/game.js',
    './dr-mario/', './dr-mario/index.html', './dr-mario/styles.css', './dr-mario/app.js', './dr-mario/game.js',
    './super-mario-land/', './super-mario-land/index.html', './super-mario-land/styles.css', './super-mario-land/app.js', './super-mario-land/game.js',
    './manifest.webmanifest', ...iconFiles.map((file) => `./${file}`),
  ];
  for (const ref of refs) {
    assert.match(worker, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(worker, /4096-shell-v12/);
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

test('connection status waits for real service-worker readiness and exposes failure state', () => {
  const app = readFileSync('app.js', 'utf8');
  assert.match(app, /connectionStatus/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /controllerchange/);
  assert.match(app, /offlineError = true/);
  assert.match(app, /offlineReady = true/);
});

test('pointer integration guards gesture start and only cancels the active pointer', () => {
  const app = readFileSync('app.js', 'utf8');
  assert.match(app, /shouldStartPointerGesture\(event, pointerStart\)/);
  assert.match(app, /shouldCancelPointerGesture\(pointerStart, event\.pointerId\)/);
});
