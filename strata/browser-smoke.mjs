import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve('.');
const MIME = {
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
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const found = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (found.status === 0) return found.stdout.trim();
  }
  throw new Error('Kein Chrome/Chromium gefunden. Setze CHROME_BIN.');
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const resource = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = resolve(ROOT, `.${resource}`);
      if (!file.startsWith(`${ROOT}${sep}`)) throw new Error('path');
      const content = await readFile(file);
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
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
  return { server, url: `http://127.0.0.1:${server.address().port}/strata/` };
}

async function waitForJson(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timeout bei ${url}`);
}

class DevTools {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.socket = new WebSocket(url);
    this.opened = new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('DevTools WebSocket failed')), { once: true });
    });
    this.socket.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)));
  }
  onMessage(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    const waiters = this.waiters.get(message.method) ?? [];
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message.params)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message.params);
      break;
    }
  }
  async send(method, params = {}) {
    await this.opened;
    const id = ++this.id;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method, predicate = () => true, timeout = 10_000) {
    return new Promise((resolveWait, reject) => {
      const list = this.waiters.get(method) ?? [];
      const waiter = {
        predicate,
        resolve: resolveWait,
        timer: setTimeout(() => {
          const index = list.indexOf(waiter);
          if (index >= 0) list.splice(index, 1);
          reject(new Error(`Timeout ${method}`));
        }, timeout),
      };
      list.push(waiter);
      this.waiters.set(method, list);
    });
  }
  close() { this.socket.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function waitValue(client, expression, expected, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await evaluate(client, expression);
    if (value === expected) return;
    await sleep(70);
  }
  throw new Error(`Timeout: ${expression} expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
}

async function point(client, selector) {
  return evaluate(client, `(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
}

async function touch(client, selector) {
  const p = await point(client, selector);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function key(client, keyName, code, keyCode, modifiers = 0) {
  const params = { key: keyName, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}

async function reload(client, url) {
  const navigated = client.wait('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await navigated;
  await waitValue(client, 'document.readyState', 'complete');
}

const browserPath = findBrowser();
const debugPort = await freePort();
const profile = await mkdtemp(join(tmpdir(), '4096-strata-smoke-'));
const { server, url } = await startServer();
const browser = spawn(browserPath, [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-gpu', '--no-default-browser-check', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let client;
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
  assert.equal(targetResponse.ok, true);
  const target = await targetResponse.json();
  client = new DevTools(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  const navigated = client.wait('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.navigate', { url });
  await navigated;
  await waitValue(client, 'document.readyState', 'complete');
  await waitValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true);

  const layout = await evaluate(client, `(() => {
    const board = document.querySelector('#strata-board').getBoundingClientRect();
    const controls = [...document.querySelectorAll('.control-panel button, .round-actions button, [data-game-nav] a')].map((e) => {
      const r = e.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, bottom: r.bottom };
    });
    return { innerWidth, innerHeight, scrollWidth: document.scrollingElement.scrollWidth, scrollHeight: document.scrollingElement.scrollHeight,
      cells: document.querySelectorAll('.strata-cell').length, levels: document.querySelectorAll('#level-select button').length,
      board: { width: board.width, height: board.height, left: board.left, right: board.right, bottom: board.bottom }, controls };
  })()`);
  assert.equal(layout.cells, 49);
  assert.equal(layout.levels, 10);
  assert.ok(layout.scrollWidth <= 361, `horizontal overflow ${layout.scrollWidth}`);
  assert.ok(layout.scrollHeight <= 641, `vertical overflow ${layout.scrollHeight}`);
  assert.ok(layout.board.width >= 180 && layout.board.right <= 361 && layout.board.bottom <= 641, JSON.stringify(layout.board));
  for (const control of layout.controls) assert.ok(control.width >= 44 && control.height >= 44 && control.left >= -1 && control.right <= 361 && control.bottom <= 641, `bad touch target ${JSON.stringify(control)}`);

  await touch(client, '[data-layer="1"]');
  await touch(client, '[data-shift="left"]');
  await waitValue(client, "document.querySelector('#strata-board').dataset.layerBX", '6');
  await touch(client, '[data-move="right"]');
  await waitValue(client, "document.querySelector('#strata-board').dataset.playerX", '2');
  await touch(client, '#undo-action');
  await waitValue(client, "document.querySelector('#strata-board').dataset.playerX", '1');
  await touch(client, '#redo-action');
  await waitValue(client, "document.querySelector('#strata-board').dataset.playerX", '2');
  await touch(client, '[data-move="right"]');
  await touch(client, '[data-move="right"]');
  await touch(client, '[data-move="right"]');
  await waitValue(client, "document.querySelector('#strata-board').dataset.status", 'won');
  assert.equal(await evaluate(client, "JSON.parse(localStorage.getItem('tromu-strata-progress-v1')).solved[0]"), true);

  await evaluate(client, "document.querySelector('#restart-game').click(); document.querySelector('#strata-board').focus()");
  await key(client, '2', 'Digit2', 50);
  await waitValue(client, "document.querySelector('#strata-board').dataset.selectedLayer", '1');
  await key(client, 'ArrowLeft', 'ArrowLeft', 37, 8);
  await waitValue(client, "document.querySelector('#strata-board').dataset.layerBX", '6');
  await key(client, 'ArrowRight', 'ArrowRight', 39);
  await waitValue(client, "document.querySelector('#strata-board').dataset.playerX", '2');

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload(client, url);
  await waitValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, "document.querySelectorAll('.strata-cell').length"), 49);
  assert.equal(await evaluate(client, "JSON.parse(localStorage.getItem('tromu-strata-progress-v1')).solved[0]"), true);

  await evaluate(client, "localStorage.setItem('tromu-strata-progress-v1', '{broken')");
  await reload(client, url);
  await waitValue(client, "document.querySelector('#strata-board').dataset.level", '1');
  assert.equal(await evaluate(client, "localStorage.getItem('tromu-strata-progress-v1')"), null);
} finally {
  client?.close();
  server.close();
  if (browser.exitCode === null) {
    browser.kill('SIGTERM');
    await Promise.race([once(browser, 'exit'), sleep(2_000)]);
    if (browser.exitCode === null) browser.kill('SIGKILL');
  }
  await rm(profile, { recursive: true, force: true });
}
