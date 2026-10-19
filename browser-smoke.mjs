import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { GAMES } from './games.js';

const ROOT = resolve('.');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function findBrowser() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Kein Chrome/Chromium gefunden. Setze CHROME_BIN auf ein ausführbares Browser-Binary.');
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(requestUrl.pathname);
      const resourcePath = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const filePath = resolve(ROOT, `.${resourcePath}`);
      if (!filePath.startsWith(`${ROOT}${sep}`)) throw new Error('Path traversal rejected');
      const content = await readFile(filePath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(content);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  await new Promise((resolveListen, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function waitForJson(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(100);
  }
  throw new Error(`Timeout bei ${url}: ${lastError}`);
}

class DevToolsClient {
  constructor(webSocketUrl) {
    if (typeof WebSocket !== 'function') throw new Error('Der Browser-Smoke benötigt Node.js 22+ mit globalem WebSocket.');
    this.nextId = 0;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.opened = new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('DevTools-WebSocket konnte nicht geöffnet werden.')), { once: true });
    });
    this.socket.addEventListener('message', (event) => this.handleMessage(JSON.parse(event.data)));
  }

  handleMessage(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result);
      return;
    }
    const waiters = this.eventWaiters.get(message.method) ?? [];
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message.params)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      clearTimeout(waiter.timeoutId);
      waiter.resolve(message.params);
      break;
    }
  }

  async send(method, params = {}) {
    await this.opened;
    const id = ++this.nextId;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, predicate = () => true, timeout = 10_000) {
    return new Promise((resolveEvent, reject) => {
      const waiters = this.eventWaiters.get(method) ?? [];
      const waiter = {
        predicate,
        resolve: resolveEvent,
        timeoutId: setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timeout beim Warten auf ${method}`));
        }, timeout),
      };
      waiters.push(waiter);
      this.eventWaiters.set(method, waiters);
    });
  }

  close() { this.socket.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser-Auswertung fehlgeschlagen.');
  return result.result.value;
}

async function waitForValue(client, expression, expected, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(client, expression);
    if (lastValue === expected) return lastValue;
    await sleep(100);
  }
  throw new Error(`Timeout: erwartet ${JSON.stringify(expected)}, zuletzt ${JSON.stringify(lastValue)}.`);
}

async function navigate(client, targetUrl, label) {
  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === targetUrl);
  const result = await client.send('Page.navigate', { url: targetUrl });
  assert.equal(result.errorText, undefined, `${label} fehlgeschlagen: ${result.errorText}`);
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
}

async function stopBrowser(browser) {
  if (browser.exitCode !== null) return;
  browser.kill('SIGTERM');
  await Promise.race([once(browser, 'exit'), sleep(2_000)]);
  if (browser.exitCode === null) {
    browser.kill('SIGKILL');
    await Promise.race([once(browser, 'exit'), sleep(1_000)]);
  }
}

const { server, url } = await startStaticServer();
const game4096Url = new URL('4096/', url).href;
const sudokuUrl = new URL('sudoku/', url).href;
const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), '4096-browser-smoke-'));
const browser = spawn(findBrowser(), [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update',
  '--disable-default-apps', '--disable-gpu', '--no-default-browser-check', '--no-first-run',
  `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let browserStderr = '';
browser.stderr.on('data', (chunk) => {
  browserStderr += chunk.toString();
  if (browserStderr.length > 12_000) browserStderr = browserStderr.slice(-12_000);
});

let client;
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
  assert.equal(targetResponse.ok, true, `DevTools target failed: HTTP ${targetResponse.status}`);
  const target = await targetResponse.json();

  client = new DevToolsClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  await navigate(client, url, 'Welcome-Navigation');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Welcome-Page wird nicht vom Service Worker kontrolliert.');
  assert.equal(await evaluate(client, "document.querySelector('h1')?.textContent"), 'Willkommen in der Tromu Spielewelt.', 'Welcome-Text fehlt.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.game-card').length"), GAMES.length, 'Welcome-Page bildet die registrierten Spiele nicht vollständig ab.');
  assert.equal(await evaluate(client, "document.body.textContent.includes('Zum Home-Bildschirm')"), true, 'iOS-Installationshinweis fehlt.');
  assert.equal(await evaluate(client, "document.body.textContent.includes('App installieren')"), true, 'Android-Installationshinweis fehlt.');

  const manifest = await client.send('Page.getAppManifest');
  assert.equal(manifest.errors.length, 0, `Manifestfehler: ${JSON.stringify(manifest.errors)}`);
  assert.match(manifest.url, /manifest\.webmanifest$/);
  const manifestName = await evaluate(client, "fetch('./manifest.webmanifest').then((response) => response.json()).then((data) => data.name)");
  assert.equal(manifestName, 'Tromu Spielewelt');
  console.log('browser-smoke: tromu welcome + service-worker + registry cards + install guidance passed');

  await navigate(client, game4096Url, '4096-Navigation');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, '4096 wird online nicht vom Service Worker kontrolliert.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.tile').length"), 16, 'Online-4096-Spielfeld hat nicht 16 Zellen.');
  assert.equal(await evaluate(client, "document.querySelector('.game-nav a[data-game-id=\"home\"]')?.textContent"), '← Zurück zur Spielewelt', '4096 hat keine eindeutige Zurück-Schaltfläche zur Spielewelt.');
  console.log('browser-smoke: 4096 subroute online passed');

  await navigate(client, sudokuUrl, 'Sudoku-Navigation');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Sudoku wird online nicht vom Service Worker kontrolliert.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.sudoku-cell').length"), 81, 'Online-Sudoku hat nicht 81 Zellen.');

  const sudokuPersistenceProbe = await evaluate(client, `(() => {
    const cell = [...document.querySelectorAll('.sudoku-cell')].find((candidate) => candidate.dataset.given === 'false');
    const numberButton = document.querySelector('[data-number="1"]');
    if (!cell || !numberButton) return null;
    const index = Number(cell.dataset.index);
    cell.click();
    numberButton.click();
    const stored = JSON.parse(localStorage.getItem('sudoku-state-v1'));
    return { index, storedValue: stored?.values?.[index], renderedValue: document.querySelector('[data-index="' + index + '"]')?.textContent };
  })()`);
  assert.ok(sudokuPersistenceProbe, 'Sudoku-Persistenzprobe konnte kein editierbares Feld bedienen.');
  assert.equal(sudokuPersistenceProbe.storedValue, 1, 'Sudoku-Eingabe wurde online nicht gespeichert.');
  assert.equal(sudokuPersistenceProbe.renderedValue, '1', 'Sudoku-Eingabe wurde online nicht gerendert.');
  console.log('browser-smoke: sudoku online input + persistence passed');

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const reloadedSudoku = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === sudokuUrl);
  await client.send('Page.reload', { ignoreCache: false });
  await reloadedSudoku;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, "document.querySelectorAll('.sudoku-cell').length"), 81, 'Offline-Sudoku hat nicht 81 Zellen.');
  assert.equal(await evaluate(client, `document.querySelector('[data-index="${sudokuPersistenceProbe.index}"]')?.textContent`), '1', 'Sudoku-Spielstand wurde offline nicht wiederhergestellt.');
  console.log('browser-smoke: sudoku offline reload + persistence passed');

  const sudokuQueryUrl = new URL('sudoku/?source=offline-smoke', url).href;
  await navigate(client, sudokuQueryUrl, 'Offline-Sudoku-Navigation mit Query');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, "document.querySelectorAll('.sudoku-cell').length"), 81, 'Offline-Sudoku mit Query erhielt nicht die Sudoku-Shell.');
  console.log('browser-smoke: sudoku offline query navigation passed');

  await navigate(client, url, 'Offline-Navigation zur Spielewelt');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, "document.querySelector('h1')?.textContent"), 'Willkommen in der Tromu Spielewelt.', 'Offline-Root erhielt nicht die Welcome-Page.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.game-card').length"), GAMES.length, 'Offline-Root verlor registrierte Spiele aus der Auswahl.');
  console.log('browser-smoke: tromu welcome offline navigation passed');

  await navigate(client, game4096Url, 'Offline-Navigation zu 4096');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, "document.querySelectorAll('.tile').length"), 16, 'Offline-4096-Spielfeld hat nicht 16 Zellen.');
  console.log('browser-smoke: 4096 subroute offline navigation passed');
} catch (error) {
  const browserDetails = browserStderr.trim() ? `\nBrowser stderr:\n${browserStderr.trim()}` : '';
  throw new Error(`${error.message}${browserDetails}`, { cause: error });
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  } catch (error) {
    console.warn(`browser-smoke: temporäres Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
