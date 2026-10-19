import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { GAMES } from './games.js';

const iconFiles = [
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

const registryFiles = GAMES.flatMap((game) => game.shell)
  .filter((path) => !path.endsWith('/'))
  .map((path) => path.slice(1));

const requiredFiles = [...new Set([
  'index.html', 'home.css', 'home.js', 'games.js', 'game-nav.js',
  'sw.js', 'manifest.webmanifest',
  ...registryFiles, ...iconFiles,
])];

function pngDimensions(path) {
  const png = readFileSync(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} must be a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test('webroot contains the complete registry-backed Tromu application shell', () => {
  for (const file of requiredFiles) assert.equal(existsSync(file), true, `missing required webroot file: ${file}`);
});

test('manifest describes the Tromu Spielewelt as stable standalone local-scope PWA', () => {
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.name, 'Tromu Spielewelt');
  assert.match(manifest.description, /Lokale Browser-Spiele/);
  assert.doesNotMatch(manifest.description, /Vier lokale/);

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

test('root is a local-only Tromu welcome page whose game list is rendered from the registry', () => {
  const html = readFileSync('index.html', 'utf8');
  const home = readFileSync('home.js', 'utf8');
  for (const ref of ['./manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './home.css', './home.js']) {
    assert.match(html, new RegExp(ref.replaceAll('.', '\\.')));
  }
  assert.match(html, /Willkommen in der Tromu Spielewelt\./);
  assert.match(html, /id="game-grid"/);
  assert.match(home, /import \{ GAMES, routeHref \} from '\.\/games\.js'/);
  assert.equal((html.match(/class="game-card"/g) ?? []).length, 0);
  assert.match(html, /offlinefähige PWA/i);
  assert.match(html, /ANDROID/);
  assert.match(html, /iOS \/ iPadOS/);
  assert.match(html, /Zum Home-Bildschirm/);
  assert.match(html, /id="install-app"/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('every canonical game page declares its registry identity and shared navigation hook', () => {
  for (const game of GAMES) {
    const html = readFileSync(`${game.route.slice(1)}index.html`, 'utf8');
    assert.match(html, new RegExp(`<body[^>]*data-game-id="${game.id}"`), `${game.id}: data-game-id fehlt.`);
    assert.match(html, /data-game-nav/, `${game.id}: gemeinsamer Navigationshook fehlt.`);
    assert.match(html, /\.\.\/game-nav\.js/, `${game.id}: gemeinsames Navigationsmodul fehlt.`);
    assert.doesNotMatch(html, /https?:\/\//i, `${game.id}: externe Runtime-URL gefunden.`);
  }
});

test('4096 HTML keeps its grid, undo controls and polite live game status', () => {
  const html = readFileSync('4096/index.html', 'utf8');
  assert.match(html, /id="board"[\s\S]*?role="grid"/);
  assert.match(html, /data-link-class="nav-link"/);
  assert.match(html, /id="undo"/);
  assert.match(html, /id="overlay-undo"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /aria-keyshortcuts="Control\+Z Meta\+Z"/);
});

test('Sudoku HTML keeps its accessible grid and editing controls', () => {
  const html = readFileSync('sudoku/index.html', 'utf8');
  assert.match(html, /id="sudoku-grid"[^>]*role="grid"/);
  assert.match(html, /id="sudoku-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="notes-mode"[^>]*aria-pressed="false"/);
  assert.match(html, /data-link-class="back-link"/);
});

test('Dr. Tromu HTML keeps the bottle and local controls', () => {
  const html = readFileSync('dr-tromu/index.html', 'utf8');
  assert.match(html, /<title>Dr\. Tromu<\/title>/);
  assert.match(html, /id="bottle"[^>]*role="grid"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="hard-drop"/);
  assert.doesNotMatch(html, /Dr\. Mario|https?:\/\//i);
});

test('Super Tromu Land HTML exposes the current twelve-stage campaign', () => {
  const html = readFileSync('super-tromu-land/index.html', 'utf8');
  assert.match(html, /<title>Super Tromu Land<\/title>/);
  assert.match(html, /id="game-canvas"[^>]*role="img"/);
  assert.match(html, /vier Welten und zwölf eigenen Stages/i);
  assert.match(html, /id="level">1-1 · 1\/12</);
  assert.match(html, /2-3 und 4-3[^.]*automatisch vorwärts/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="jump"/);
  assert.doesNotMatch(html, /Super Mario Land|https?:\/\//i);
});

test('service worker precaches shared registry modules and every registered game shell', () => {
  const worker = readFileSync('sw.js', 'utf8');
  const refs = [
    './index.html', './home.css', './home.js', './games.js', './game-nav.js',
    ...GAMES.flatMap((game) => game.shell.map((path) => `.${path}`)),
    ...GAMES.flatMap((game) => game.legacyRoutes.map((path) => `.${path}`)),
    './manifest.webmanifest', ...iconFiles.map((file) => `./${file}`),
  ];
  for (const ref of refs) assert.match(worker, new RegExp(ref.replaceAll('.', '\\.')), `Service Worker precacht ${ref} nicht.`);
  assert.match(worker, /4096-shell-v27/);
});

test('4096 terminal dialog wires description, inert background and focus containment', () => {
  const html = readFileSync('4096/index.html', 'utf8');
  const app = readFileSync('app.js', 'utf8');
  assert.match(html, /id="overlay"[^>]*aria-describedby="overlay-message"/);
  assert.match(app, /appShell\.inert = true/);
  assert.match(app, /appShell\.inert = false/);
  assert.match(app, /wrappedDialogFocusTarget/);
});

test('welcome and 4096 both wait for real service-worker readiness', () => {
  const home = readFileSync('home.js', 'utf8');
  const app = readFileSync('app.js', 'utf8');
  assert.match(home, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(home, /navigator\.serviceWorker\.ready/);
  assert.match(home, /connectionStatus/);
  assert.match(app, /navigator\.serviceWorker\.register\(new URL\('\.\/sw\.js', import\.meta\.url\)\)/);
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /controllerchange/);
});

test('4096 pointer integration guards gesture start and only cancels the active pointer', () => {
  const app = readFileSync('app.js', 'utf8');
  assert.match(app, /shouldStartPointerGesture\(event, pointerStart\)/);
  assert.match(app, /shouldCancelPointerGesture\(pointerStart, event\.pointerId\)/);
});
