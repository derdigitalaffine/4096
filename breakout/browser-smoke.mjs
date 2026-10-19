import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

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
  return { server, url: `http://127.0.0.1:${server.address().port}/breakout/` };
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
    await sleep(80);
  }
  throw new Error(`Timeout: erwartet ${JSON.stringify(expected)}, zuletzt ${JSON.stringify(lastValue)}.`);
}

async function reload(client, url) {
  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
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

const browserPath = findBrowser();
const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), '4096-breakout-smoke-'));
const { server, url } = await startStaticServer();
const browser = spawn(browserPath, [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-gpu', '--no-default-browser-check', '--no-first-run', `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileDir}`, 'about:blank',
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
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.navigate', { url });
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Breakout wird nicht vom Service Worker kontrolliert.');

  const layout = await evaluate(client, `(() => {
    const canvas = document.querySelector('#breakout-canvas').getBoundingClientRect();
    const controls = [...document.querySelectorAll('button:not([hidden])')].map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.id, width: box.width, height: box.height, left: box.left, right: box.right, bottom: box.bottom };
    });
    const nav = [...document.querySelectorAll('[data-game-nav] a')].map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    });
    return {
      innerWidth, innerHeight,
      scrollWidth: document.scrollingElement.scrollWidth,
      scrollHeight: document.scrollingElement.scrollHeight,
      canvas: { width: canvas.width, height: canvas.height, left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom },
      controls, nav,
      bricks: Number(document.querySelector('#breakout-canvas').dataset.brickCount),
    };
  })()`);
  assert.equal(layout.nav.length, 1, 'Breakout-Navigation enthält nicht genau eine Zurück-Schaltfläche zur Spielewelt.');
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `Breakout hat horizontalen Overflow: ${layout.scrollWidth}px.`);
  assert.ok(layout.scrollHeight <= layout.innerHeight + 1, `Breakout erzwingt auf 360×640 Scrollen: ${layout.scrollHeight}px.`);
  assert.ok(layout.canvas.width >= 210 && layout.canvas.left >= -1 && layout.canvas.right <= 361 && layout.canvas.bottom <= 641, `Breakout-Canvas passt mobil nicht: ${JSON.stringify(layout.canvas)}.`);
  assert.ok(layout.bricks >= 8, `Breakout startet mit zu wenigen Blöcken: ${layout.bricks}.`);
  for (const control of layout.controls) {
    assert.ok(control.width >= 44 && control.height >= 44 && control.left >= -1 && control.right <= 361 && control.bottom <= 641, `Touchziel ${control.id} ist nicht vollständig 44×44 sichtbar.`);
  }
  for (const link of layout.nav) {
    assert.ok(link.width >= 44 && link.height >= 44 && link.left >= -1 && link.right <= 361, 'Breakout-Navigationsziel liegt außerhalb des mobilen Viewports.');
  }

  await evaluate(client, "document.querySelector('#breakout-canvas').focus()");
  const paddleStart = Number(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.paddleX"));
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  await sleep(120);
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  const paddleRight = Number(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.paddleX"));
  assert.ok(paddleRight > paddleStart, `Tastatur bewegte das Paddle nicht nach rechts (${paddleStart} -> ${paddleRight}).`);

  const touchPoint = await evaluate(client, `(() => {
    const box = document.querySelector('#breakout-canvas').getBoundingClientRect();
    return { x: box.left + box.width * .15, y: box.top + box.height * .82 };
  })()`);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchPoint.x, y: touchPoint.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(80);
  const paddleTouch = Number(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.paddleX"));
  assert.ok(paddleTouch < paddleRight, `Touch/Drag bewegte das Paddle nicht nach links (${paddleRight} -> ${paddleTouch}).`);

  const readyBallY = Number(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.ballY"));
  await evaluate(client, "document.querySelector('#launch-ball').click()");
  await waitForValue(client, "document.querySelector('#breakout-canvas').dataset.status", 'running');
  await sleep(120);
  const movingBallY = Number(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.ballY"));
  assert.notEqual(movingBallY, readyBallY, 'Start setzt den Ball nicht in Bewegung.');
  await evaluate(client, "document.querySelector('#pause-game').click()");
  await waitForValue(client, "document.querySelector('#breakout-canvas').dataset.status", 'paused');
  const pausedY = await evaluate(client, "document.querySelector('#breakout-canvas').dataset.ballY");
  await sleep(120);
  assert.equal(await evaluate(client, "document.querySelector('#breakout-canvas').dataset.ballY"), pausedY, 'Pause friert den Ball nicht ein.');

  await evaluate(client, "localStorage.setItem('tromu-breakout-best-v1', '2400')");
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#best-score').textContent", '2400');

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  await waitForValue(client, "document.querySelector('#best-score').textContent", '2400');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Breakout verlor offline die Service-Worker-Kontrolle.');

  await evaluate(client, "localStorage.setItem('tromu-breakout-best-v1', '{broken')");
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#best-score').textContent", '0');
  assert.equal(await evaluate(client, "localStorage.getItem('tromu-breakout-best-v1')"), null, 'Kaputter Breakout-Bestwert wurde nicht verworfen.');

  console.log('browser-smoke: Tromu Breakout 360x640 + keyboard/touch + pause + best score + offline passed');
} catch (error) {
  if (browser.exitCode !== null) error.message += `\nChrome exit=${browser.exitCode}\n${browserStderr}`;
  throw error;
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
}
