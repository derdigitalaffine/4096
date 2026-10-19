import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { GAMES } from './games.js';

const ROOT = resolve('.');
const NAV_SELECTOR = '.game-nav a';
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

async function waitForJson(url, timeout = 15_000) {
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

async function waitForTruthy(client, expression, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await sleep(100);
  }
  throw new Error(`Timeout bei Browser-Bedingung: ${expression}`);
}

async function navigate(client, targetUrl, label) {
  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === targetUrl, 15_000);
  const result = await client.send('Page.navigate', { url: targetUrl });
  assert.equal(result.errorText, undefined, `${label}: Navigation fehlgeschlagen: ${result.errorText}`);
  await navigated;
  await waitForTruthy(client, "document.readyState === 'complete'");
}

async function pressTab(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await sleep(30);
}

async function pressEnter(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
}

async function focusBackLink(client, label) {
  await evaluate(client, 'document.activeElement?.blur()');
  for (let index = 0; index < 40; index += 1) {
    await pressTab(client);
    const focus = await evaluate(client, `(() => {
      const active = document.activeElement;
      if (!active?.matches?.(${JSON.stringify(NAV_SELECTOR)})) return null;
      return {
        pathname: new URL(active.href).pathname,
        focusVisible: active.matches(':focus-visible'),
      };
    })()`);
    if (!focus) continue;
    assert.equal(focus.pathname, '/', `${label}: Spielnavigation zeigt nicht zurück zur Spielewelt.`);
    assert.equal(focus.focusVisible, true, `${label}: Zurück-Schaltfläche hat keinen sichtbaren Tastaturfokus.`);
    return;
  }
  throw new Error(`${label}: Zurück-Schaltfläche wurde per Tab nicht erreicht.`);
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

const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), 'tromu-game-navigation-smoke-'));
const { server, url } = await startStaticServer();
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
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  for (const game of GAMES) {
    const pageUrl = new URL(game.route.slice(1), url).href;
    await navigate(client, pageUrl, game.name);
    await waitForTruthy(client, `document.body.dataset.gameId === ${JSON.stringify(game.id)}`);
    await waitForTruthy(client, `document.querySelectorAll(${JSON.stringify(NAV_SELECTOR)}).length === 1`);

    const layout = await evaluate(client, `(() => {
      const link = document.querySelector(${JSON.stringify(NAV_SELECTOR)});
      const box = link.getBoundingClientRect();
      return {
        innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        text: link.textContent.trim(),
        href: link.href,
        pathname: new URL(link.href).pathname,
        width: box.width,
        height: box.height,
        left: box.left,
        right: box.right,
      };
    })()`);

    assert.equal(layout.innerWidth, 360, `${game.name}: Browser läuft nicht im erwarteten 360px-Viewport.`);
    assert.ok(layout.scrollWidth <= 361, `${game.name}: horizontale Seitenausdehnung ${layout.scrollWidth}px bei 360px Viewport.`);
    assert.equal(layout.pathname, '/', `${game.name}: Spielnavigation führt nicht zur Spielewelt.`);
    assert.match(layout.text, /Zurück zur Spielewelt/, `${game.name}: Zurück-Link ist nicht eindeutig beschriftet.`);
    assert.equal(new URL(layout.href).origin, new URL(url).origin, `${game.name}: Zurück-Link verlässt den lokalen Ursprung.`);
    assert.ok(layout.width >= 44, `${game.name}: Zurück-Schaltfläche ist nur ${layout.width.toFixed(1)}px breit.`);
    assert.ok(layout.height >= 44, `${game.name}: Zurück-Schaltfläche ist nur ${layout.height.toFixed(1)}px hoch.`);
    assert.ok(layout.left >= -1 && layout.right <= 361, `${game.name}: Zurück-Schaltfläche liegt horizontal außerhalb des Viewports.`);
    await focusBackLink(client, game.name);
    console.log(`browser-smoke: ${game.name} single back navigation 360x640 + keyboard focus passed`);
  }

  const lastGame = GAMES.at(-1);
  await navigate(client, new URL(lastGame.route.slice(1), url).href, 'Offline-Back-Start');
  await waitForTruthy(client, `document.body.dataset.gameId === ${JSON.stringify(lastGame.id)}`);
  await waitForTruthy(client, "Boolean(navigator.serviceWorker?.controller)");
  await waitForTruthy(client, "navigator.serviceWorker?.ready.then((registration) => Boolean(registration.active))");

  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none',
  });
  await waitForTruthy(client, 'navigator.onLine === false');

  await focusBackLink(client, lastGame.name);
  const homeNavigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url, 15_000);
  await pressEnter(client);
  await homeNavigated;
  await waitForTruthy(client, "document.readyState === 'complete'");
  await waitForTruthy(client, `document.querySelectorAll('.game-card').length === ${GAMES.length}`);

  const catalogPaths = await evaluate(client, `[...document.querySelectorAll('.game-card')].map((link) => new URL(link.href).pathname)`);
  assert.deepEqual(catalogPaths, GAMES.map((game) => game.route), 'Spielewelt zeigt offline nicht den vollständigen Registry-Katalog.');
  assert.equal(await evaluate(client, 'navigator.onLine'), false, 'Offline-Zustand ging beim Zurück-Wechsel verloren.');

  const afterSokoban = GAMES.slice(GAMES.findIndex((game) => game.id === 'sokoban') + 1);
  assert.ok(afterSokoban.length > 0, 'Test erwartet Spiele nach Sokoban.');
  for (const game of afterSokoban) {
    assert.equal(catalogPaths.includes(game.route), true, `${game.name} fehlt im Spielewelt-Katalog nach Sokoban.`);
  }
  console.log(`browser-smoke: single back navigation + complete ${GAMES.length}-game catalog after Sokoban passed`);
} catch (error) {
  const browserDetails = browserStderr.trim() ? `\nBrowser stderr:\n${browserStderr.trim()}` : '';
  throw new Error(`${error.message}${browserDetails}`, { cause: error });
} finally {
  client?.close();
  server.close();
  await stopBrowser(browser);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
