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
  return { server, url: `http://127.0.0.1:${server.address().port}/super-tromu-land-2/` };
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
    this.waiters = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.opened = new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('DevTools-WebSocket konnte nicht geöffnet werden.')), { once: true });
    });
    this.socket.addEventListener('message', (event) => this.handle(JSON.parse(event.data)));
  }
  handle(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result);
      return;
    }
    const waiters = this.waiters.get(message.method) ?? [];
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
      const waiters = this.waiters.get(method) ?? [];
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
      this.waiters.set(method, waiters);
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
const profileDir = await mkdtemp(join(tmpdir(), '4096-super-tromu-land-2-smoke-'));
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
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'STL2 wird nicht vom Service Worker kontrolliert.');

  const layout = await evaluate(client, `(() => {
    const canvas = document.querySelector('#game-canvas').getBoundingClientRect();
    const controls = [...document.querySelectorAll('.input-panel button')].map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.id || element.dataset.move, width: box.width, height: box.height, left: box.left, right: box.right, bottom: box.bottom };
    });
    const nav = document.querySelector('[data-game-nav] a').getBoundingClientRect();
    return {
      innerWidth, innerHeight,
      scrollWidth: document.scrollingElement.scrollWidth,
      scrollHeight: document.scrollingElement.scrollHeight,
      canvas: { width: canvas.width, height: canvas.height, left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom },
      controls,
      nav: { width: nav.width, height: nav.height, left: nav.left, right: nav.right },
    };
  })()`);
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `STL2 hat horizontalen Overflow: ${layout.scrollWidth}px.`);
  assert.ok(layout.scrollHeight <= layout.innerHeight + 1, `STL2 erzwingt auf 360×640 Scrollen: ${layout.scrollHeight}px.`);
  assert.ok(layout.canvas.width >= 250 && layout.canvas.right <= 361 && layout.canvas.bottom <= 641, `STL2-Canvas passt mobil nicht: ${JSON.stringify(layout.canvas)}.`);
  for (const control of layout.controls) assert.ok(control.width >= 44 && control.height >= 44 && control.left >= -1 && control.right <= 361 && control.bottom <= 641, `Touchziel ${control.id} ist nicht vollständig nutzbar.`);
  assert.ok(layout.nav.width >= 44 && layout.nav.height >= 44 && layout.nav.left >= -1 && layout.nav.right <= 361, 'Navigation ist mobil zu klein.');

  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.quest"), '0');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.blade"), 'false');

  await touchElement(client, '[data-move="up"]');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.playerY"), '6', 'Touch-D-Pad bewegt Tromu nicht.');
  await evaluate(client, "document.querySelector('#new-game').click(); document.querySelector('#game-canvas').focus()");

  for (let i = 0; i < 4; i += 1) await dispatchKey(client, 'ArrowUp', 'ArrowUp', 38);
  await dispatchKey(client, 'ArrowRight', 'ArrowRight', 39);
  await dispatchKey(client, 'e', 'KeyE', 69);
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.quest"), '1', 'Mira startet die Quest nicht per Tastatur.');

  await dispatchKey(client, 'ArrowDown', 'ArrowDown', 40);
  for (let i = 0; i < 8; i += 1) await dispatchKey(client, 'ArrowRight', 'ArrowRight', 39);
  await dispatchKey(client, 'ArrowUp', 'ArrowUp', 38);
  await dispatchKey(client, 'e', 'KeyE', 69);
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.quest"), '2');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.blade"), 'true', 'Werkstatttruhe gibt keine Klinge.');
  assert.equal(await evaluate(client, "document.querySelector('#attack-button').disabled"), false, 'Klingenbutton bleibt nach Ausrüstung deaktiviert.');

  await reload(client, url);
  await waitForValue(client, "document.querySelector('#game-canvas').dataset.quest", '2');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.blade"), 'true', 'Questfortschritt überlebt Reload nicht.');

  const questProbe = await evaluate(client, `(async () => {
    const rules = await import('./game.js');
    const place = (state, zoneId, x, y, facing) => ({ ...structuredClone(state), zoneId, player: { ...state.player, x, y, facing } });
    const interactAt = (state, zoneId, x, y, facing) => rules.interact(place(state, zoneId, x, y, facing));
    const attackEnemy = (state, enemyId, times = 1) => {
      let next = state;
      for (let i = 0; i < times; i += 1) {
        const enemy = next.enemies.find((item) => item.id === enemyId);
        next = rules.attack(place(next, enemy.zoneId, enemy.x - 1, enemy.y, 'right'));
      }
      return next;
    };
    let state = rules.createGame();
    state = interactAt(state, 'village', 5, 4, 'up');
    state = interactAt(state, 'village', 12, 4, 'up');
    for (const id of ['leaf-a', 'leaf-b', 'leaf-c']) state = attackEnemy(state, id);
    const afterCombat = { quest: state.quest, kills: state.defeated.filter((id) => id.startsWith('leaf-')).length };
    state = interactAt(state, 'meadow', 13, 4, 'up');
    state = interactAt(state, 'meadow', 14, 6, 'right');
    state = interactAt(state, 'shrine', 3, 4, 'up');
    state = interactAt(state, 'shrine', 12, 4, 'up');
    state = interactAt(state, 'shrine', 8, 10, 'up');
    const afterRunes = { quest: state.quest, runes: state.activatedRunes.length };
    state = attackEnemy(state, 'guardian', 3);
    const afterGuardian = { quest: state.quest, guardian: state.guardianDefeated };
    state = interactAt(state, 'shrine', 8, 2, 'up');
    state = interactAt(state, 'village', 5, 4, 'up');
    return { afterCombat, afterRunes, afterGuardian, complete: rules.isQuestComplete(state), status: state.status, core: state.inventory.core };
  })()`);
  assert.deepEqual(questProbe.afterCombat, { quest: 3, kills: 3 });
  assert.deepEqual(questProbe.afterRunes, { quest: 6, runes: 3 });
  assert.deepEqual(questProbe.afterGuardian, { quest: 7, guardian: true });
  assert.deepEqual({ complete: questProbe.complete, status: questProbe.status, core: questProbe.core }, { complete: true, status: 'completed', core: true });

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  await waitForValue(client, "document.querySelector('#game-canvas').dataset.quest", '2');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.blade"), 'true');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true);

  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate(client, "localStorage.setItem('tromu-super-tromu-land-2-v1', '{broken')");
  await reload(client, url);
  await waitForValue(client, "document.querySelector('#game-canvas').dataset.quest", '0');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas').dataset.blade"), 'false', 'Kaputter Storage fällt nicht auf neues Abenteuer zurück.');

  console.log('browser-smoke: super-tromu-land-2 intro quest + mobile + persistence + offline passed');
} catch (error) {
  console.error(error);
  if (browserStderr) console.error(browserStderr);
  process.exitCode = 1;
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true });
}
