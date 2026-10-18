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
const profileDir = await mkdtemp(join(tmpdir(), 'tromu-welcome-mobile-smoke-'));
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

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `Welcome-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');

  const layout = await evaluate(client, `(() => {
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
    };
    return {
      innerWidth,
      innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      hero: rect(document.querySelector('.hero')),
      primary: rect(document.querySelector('.pixel-button.primary')),
      cards: [...document.querySelectorAll('.game-card')].map(rect),
      installCards: [...document.querySelectorAll('.install-card')].map(rect),
      footer: rect(document.querySelector('.world-footer')),
    };
  })()`);

  assert.equal(layout.innerWidth, 360);
  assert.equal(layout.innerHeight, 640);
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `Welcome-Page hat horizontalen Overflow: ${layout.scrollWidth}px bei ${layout.innerWidth}px Viewport.`);
  assert.ok(layout.scrollHeight > layout.innerHeight, 'Welcome-Page sollte die Spiele- und Installationsbereiche vertikal scrollbar zugänglich machen.');
  assert.equal(layout.cards.length, GAMES.length, `Welcome-Page zeigt mobil ${layout.cards.length} statt ${GAMES.length} registrierter Spielkarten.`);
  assert.equal(layout.installCards.length, 2, 'Welcome-Page zeigt mobil nicht beide Installationskarten.');
  assert.ok(layout.primary.height >= 44 && layout.primary.width >= 44, `Primäres Touchziel ist zu klein: ${JSON.stringify(layout.primary)}`);

  for (const [name, box] of [
    ['Hero', layout.hero],
    ...layout.cards.map((box, index) => [`Spielkarte ${index + 1}`, box]),
    ...layout.installCards.map((box, index) => [`Installationskarte ${index + 1}`, box]),
    ['Footer', layout.footer],
  ]) {
    assert.ok(box.left >= -1 && box.right <= layout.innerWidth + 1, `${name} liegt horizontal außerhalb des 360px-Viewports: ${JSON.stringify(box)}`);
  }

  const installReachable = await evaluate(client, `(() => {
    document.querySelector('.install-block').scrollIntoView({ block: 'start', behavior: 'instant' });
    const box = document.querySelector('.install-block').getBoundingClientRect();
    return box.top < innerHeight && box.bottom > 0;
  })()`);
  assert.equal(installReachable, true, 'Installationshinweise sind per mobilem Scroll nicht erreichbar.');

  const footerReachable = await evaluate(client, `(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    const footer = document.querySelector('.world-footer').getBoundingClientRect();
    return footer.top < innerHeight && footer.bottom <= innerHeight + 1;
  })()`);
  assert.equal(footerReachable, true, 'Footer/Seitenende ist im 360x640-Viewport nicht erreichbar.');

  console.log(`browser-smoke: tromu welcome ${GAMES.length} registry cards 360x640 layout + touch targets + scroll reachability passed`);
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
    console.warn(`browser-smoke: Welcome-Mobile-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
