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
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
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
  return { server, url: `http://127.0.0.1:${server.address().port}/snake/` };
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

async function waitForTrue(client, expression, timeout = 3_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(35);
  }
  throw new Error(`Timeout: Ausdruck blieb false: ${expression}`);
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
const profileDir = await mkdtemp(join(tmpdir(), '4096-snake-smoke-'));
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
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Snake wird nicht vom Service Worker kontrolliert.');

  const layout = await evaluate(client, `(() => {
    const board = document.querySelector('#snake-board').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const box = button.getBoundingClientRect();
      return { id: button.id || button.dataset.mode || button.dataset.direction, width: box.width, height: box.height };
    });
    return {
      innerWidth, innerHeight,
      scrollWidth: document.scrollingElement.scrollWidth,
      scrollHeight: document.scrollingElement.scrollHeight,
      cells: document.querySelectorAll('.snake-cell').length,
      navLinks: document.querySelectorAll('[data-game-nav] a').length,
      board: { width: board.width, height: board.height, top: board.top, bottom: board.bottom, left: board.left, right: board.right },
      buttons,
      tick: Number(document.querySelector('#snake-board').dataset.tickMs),
    };
  })()`);
  assert.equal(layout.cells, 324, 'Snake rendert nicht 18×18 Zellen.');
  assert.equal(layout.navLinks, 5, 'Snake-Navigation enthält nicht Spielewelt plus vier andere registrierte Spiele.');
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `Snake hat horizontalen Overflow: ${layout.scrollWidth}px.`);
  assert.ok(layout.scrollHeight <= layout.innerHeight + 1, `Snake erzwingt auf 360×640 Scrollen: ${layout.scrollHeight}px.`);
  assert.ok(layout.board.width >= 200 && layout.board.height >= 200, `Snake-Board ist mobil zu klein: ${JSON.stringify(layout.board)}.`);
  assert.ok(layout.board.left >= -1 && layout.board.right <= 361 && layout.board.top >= -1 && layout.board.bottom <= 641, 'Snake-Board liegt außerhalb des mobilen Viewports.');
  for (const button of layout.buttons) {
    assert.ok(button.width >= 44 && button.height >= 44, `Touchziel ${button.id} ist kleiner als 44×44: ${button.width}×${button.height}.`);
  }
  const classicTick = layout.tick;

  const speed = await evaluate(client, `(() => {
    document.querySelector('[data-mode="speed"]').click();
    document.querySelector('#pause-game').click();
    const board = document.querySelector('#snake-board');
    return { mode: board.dataset.mode, paused: board.dataset.paused, tick: Number(board.dataset.tickMs) };
  })()`);
  assert.equal(speed.mode, 'speed');
  assert.equal(speed.paused, 'true');
  assert.ok(speed.tick < classicTick, `Speed ist nicht schneller als Classic (${speed.tick} >= ${classicTick}).`);

  const maze = await evaluate(client, `(() => {
    document.querySelector('[data-mode="maze"]').click();
    document.querySelector('#pause-game').click();
    const board = document.querySelector('#snake-board');
    return { mode: board.dataset.mode, paused: board.dataset.paused, walls: Number(board.dataset.wallCount) };
  })()`);
  assert.equal(maze.mode, 'maze');
  assert.equal(maze.paused, 'true');
  assert.ok(maze.walls > 20, `Maze enthält zu wenige Hindernisse: ${maze.walls}.`);

  await evaluate(client, "document.querySelector('[data-mode=\"classic\"]').click()");
  const touchPoint = await evaluate(client, `(() => {
    const box = document.querySelector('#move-up').getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchPoint.x, y: touchPoint.y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForTrue(client, "Number(document.querySelector('#snake-board').dataset.headY) < 9");
  const touchHead = await evaluate(client, "Number(document.querySelector('#snake-board').dataset.headY)");
  await evaluate(client, "document.querySelector('#pause-game').click()");
  assert.ok(touchHead < 9, `Touch-D-Pad bewegte Snake nicht nach oben: y=${touchHead}.`);

  await evaluate(client, "document.querySelector('#new-game').click()");
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
  await waitForTrue(client, "Number(document.querySelector('#snake-board').dataset.headY) > 9");
  const keyboardHead = await evaluate(client, "Number(document.querySelector('#snake-board').dataset.headY)");
  await evaluate(client, "document.querySelector('#pause-game').click()");
  assert.ok(keyboardHead > 9, `Tastatur bewegte Snake nicht nach unten: y=${keyboardHead}.`);

  await evaluate(client, `localStorage.setItem('tromu-snake-highscores-v1', JSON.stringify({ classic: 120, speed: 80, maze: 60 }))`);
  const onlineReload = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await onlineReload;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#best-score')?.textContent", '120');
  await evaluate(client, "document.querySelector('#pause-game').click()");

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const offlineReload = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await offlineReload;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  await waitForValue(client, "document.querySelector('#best-score')?.textContent", '120');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Snake verlor offline die Service-Worker-Kontrolle.');

  await evaluate(client, "localStorage.setItem('tromu-snake-highscores-v1', '{oops')");
  const recoveryReload = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await recoveryReload;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#best-score')?.textContent", '0');
  assert.equal(await evaluate(client, "localStorage.getItem('tromu-snake-highscores-v1')"), null, 'Kaputter Snake-Storage wurde nicht verworfen.');

  console.log(`browser-smoke: Tromu Snake 360x640 + Classic/Speed/Maze + touch/keyboard + offline passed; touchY=${touchHead}, keyY=${keyboardHead}`);
} catch (error) {
  if (browser.exitCode !== null) error.message += `\nChrome exit=${browser.exitCode}\n${browserStderr}`;
  throw error;
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
}
