import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { GAMES } from '../games.js';

const ROOT = resolve('.');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

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
  throw new Error('Kein Chrome/Chromium gefunden. Setze CHROME_BIN.');
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
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
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
  return { server, url: `http://127.0.0.1:${server.address().port}/echoloop/` };
}

async function waitForJson(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error.message; }
    await sleep(100);
  }
  throw new Error(`Timeout bei ${url}: ${lastError}`);
}

class DevToolsClient {
  constructor(webSocketUrl) {
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
    await sleep(70);
  }
  throw new Error(`Timeout: erwartet ${JSON.stringify(expected)}, zuletzt ${JSON.stringify(lastValue)}.`);
}

async function waitForTrue(client, expression, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(70);
  }
  throw new Error(`Timeout: Ausdruck blieb false: ${expression}`);
}

async function reload(client, url) {
  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
}

async function elementPoint(client, selector) {
  return evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error('Element fehlt: ${selector}');
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
}

async function touchElement(client, selector) {
  const point = await elementPoint(client, selector);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function dispatchKey(client, key, code, windowsVirtualKeyCode) {
  const params = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode };
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
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

const browserPath = findBrowser();
const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), '4096-echoloop-smoke-'));
const { server, url } = await startStaticServer();
const browser = spawn(browserPath, [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-gpu', '--no-default-browser-check', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserStderr = '';
browser.stderr.on('data', (chunk) => { browserStderr = `${browserStderr}${chunk}`.slice(-12_000); });

let client;
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
  assert.equal(targetResponse.ok, true);
  const target = await targetResponse.json();
  client = new DevToolsClient(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.navigate', { url });
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'ECHOLOOP wird nicht vom Service Worker kontrolliert.');

  const layout = await evaluate(client, `(() => {
    const board = document.querySelector('#echo-board').getBoundingClientRect();
    const controls = [...document.querySelectorAll('#level-select button, .controls button')].map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.id || element.dataset.level || element.dataset.input, width: box.width, height: box.height, left: box.left, right: box.right, bottom: box.bottom };
    });
    const nav = [...document.querySelectorAll('[data-game-nav] a')].map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, left: box.left, right: box.right };
    });
    return {
      innerWidth, innerHeight,
      scrollWidth: document.scrollingElement.scrollWidth,
      scrollHeight: document.scrollingElement.scrollHeight,
      cells: document.querySelectorAll('.echo-cell').length,
      nav, controls,
      board: { width: board.width, height: board.height, left: board.left, right: board.right, top: board.top, bottom: board.bottom },
    };
  })()`);
  assert.equal(layout.cells, 81, 'ECHOLOOP rendert nicht 9×9 Zellen.');
  assert.equal(layout.nav.length, GAMES.length, 'ECHOLOOP-Navigation enthält nicht Spielewelt plus alle anderen registrierten Spiele.');
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `ECHOLOOP hat horizontalen Overflow: ${layout.scrollWidth}px.`);
  assert.ok(layout.scrollHeight <= layout.innerHeight + 1, `ECHOLOOP erzwingt auf 360×640 Scrollen: ${layout.scrollHeight}px.`);
  assert.ok(layout.board.width >= 220 && layout.board.right <= 361 && layout.board.bottom <= 641, `ECHOLOOP-Board passt mobil nicht: ${JSON.stringify(layout.board)}.`);
  for (const control of layout.controls) {
    if (control.id === '1' || control.id === '2') continue;
    assert.ok(control.width >= 44 && control.height >= 44 && control.left >= -1 && control.right <= 361 && control.bottom <= 641, `Primärziel ${control.id} ist mobil nicht vollständig nutzbar.`);
  }
  for (const link of layout.nav) assert.ok(link.width >= 44 && link.height >= 44 && link.left >= -1 && link.right <= 361, 'Navigationsziel ist kleiner als 44px oder außerhalb des Viewports.');
  assert.equal(await evaluate(client, "document.querySelector('#echo-board').dataset.paused"), 'true');

  await touchElement(client, '[data-input="left"]');
  await touchElement(client, '#pause-game');
  await waitForValue(client, "document.querySelector('#echo-board').dataset.playerX", '3');
  await touchElement(client, '#pause-game');
  await waitForValue(client, "document.querySelector('#echo-board').dataset.paused", 'true');

  await evaluate(client, "document.querySelector('#restart-game').click(); document.querySelector('#echo-board').focus()");
  await dispatchKey(client, 'ArrowRight', 'ArrowRight', 39);
  assert.equal(await evaluate(client, "document.querySelector('#echo-board').dataset.pending"), 'right');
  await evaluate(client, "document.querySelector('#pause-game').click()");
  await waitForValue(client, "document.querySelector('#echo-board').dataset.playerX", '5');
  await evaluate(client, "document.querySelector('#pause-game').click()");

  await evaluate(client, `(() => {
    document.querySelector('#restart-game').click();
    document.querySelector('[data-input="left"]').click();
    document.querySelector('#pause-game').click();
  })()`);
  await waitForValue(client, "document.querySelector('#echo-board').dataset.loop", '2', 7_000);
  await waitForValue(client, "document.querySelector('#echo-board').dataset.echoCount", '1');
  await waitForValue(client, "document.querySelector('#echo-board').dataset.echoOneX", '3', 3_000);
  assert.equal(await evaluate(client, "document.querySelector('#echo-board').dataset.echoOneY"), '4', 'Echo-Replay läuft nicht tickgenau vom Startpunkt nach links.');

  await evaluate(client, "window.dispatchEvent(new Event('blur'))");
  await waitForValue(client, "document.querySelector('#echo-board').dataset.paused", 'true');
  await waitForValue(client, "document.querySelector('#echo-board').dataset.pending", 'wait');

  await evaluate(client, `localStorage.setItem('tromu-echoloop-progress-v1', JSON.stringify({ version: 1, unlocked: 3, bestLoops: [1, 2, null] }))`);
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#best-loops')?.textContent", '1');
  assert.equal(await evaluate(client, "document.querySelector('#level-select [data-level=\"2\"]').disabled"), false, 'Gespeichertes drittes Level wurde nicht freigeschaltet.');

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  await waitForValue(client, "document.querySelector('#best-loops')?.textContent", '1');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'ECHOLOOP verlor offline die Service-Worker-Kontrolle.');

  await evaluate(client, "localStorage.setItem('tromu-echoloop-progress-v1', '{broken')");
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#best-loops')?.textContent", '–');
  assert.equal(await evaluate(client, "localStorage.getItem('tromu-echoloop-progress-v1')"), null, 'Kaputter ECHOLOOP-Fortschritt wurde nicht entfernt.');
  assert.equal(await evaluate(client, "document.querySelector('#level-select [data-level=\"1\"]').disabled"), true, 'Recovery fällt nicht auf nur Level 1 zurück.');

  console.log('browser-smoke: ECHOLOOP 360x640 + touch + keyboard + loop + echo replay + progress recovery + offline passed');
} catch (error) {
  if (browser.exitCode !== null) error.message += `\nChrome exit=${browser.exitCode}\n${browserStderr}`;
  throw error;
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
}
