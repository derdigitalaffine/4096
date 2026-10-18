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
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

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

  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/dr-mario/`,
  };
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
    if (typeof WebSocket !== 'function') {
      throw new Error('Der Browser-Smoke benötigt Node.js 22+ mit globalem WebSocket.');
    }

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

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser-Auswertung fehlgeschlagen.');
  }
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

const browserPath = findBrowser();
const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), '4096-dr-mario-smoke-'));
const { server, url } = await startStaticServer();
const sudokuUrl = new URL('../sudoku/', url).href;
const drMarioNoSlashUrl = url.slice(0, -1);
const sudokuNoSlashUrl = sudokuUrl.slice(0, -1);
const browser = spawn(browserPath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-gpu',
  '--no-default-browser-check',
  '--no-first-run',
  `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profileDir}`,
  'about:blank',
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
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 640,
    deviceScaleFactor: 1,
    mobile: true,
  });

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `Dr.-Mario-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await navigated;

  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Dr. Mario wird nicht vom Service Worker kontrolliert.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.dm-cell').length"), 128, 'Dr.-Mario-Flasche hat nicht 128 Zellen.');
  assert.equal(await evaluate(client, "document.querySelector('#bottle')?.getAttribute('role')"), 'grid', 'Dr.-Mario-Flasche verlor ihre Grid-Semantik.');

  const mobileLayout = await evaluate(client, `(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    };
    return {
      innerWidth,
      innerHeight,
      scrollHeight: document.scrollingElement.scrollHeight,
      bottle: rect('#bottle'),
      newGame: rect('#new-game'),
      hardDrop: rect('#hard-drop'),
      status: rect('#game-status'),
    };
  })()`);
  assert.equal(mobileLayout.innerWidth, 360, 'Dr.-Mario-Mobile-Smoke läuft nicht mit 360 CSS-Pixeln Breite.');
  assert.equal(mobileLayout.innerHeight, 640, 'Dr.-Mario-Mobile-Smoke läuft nicht mit 640 CSS-Pixeln Höhe.');
  assert.ok(mobileLayout.scrollHeight <= mobileLayout.innerHeight + 1, `Dr. Mario erzwingt auf 360x640 vertikales Scrollen (${mobileLayout.scrollHeight}px > ${mobileLayout.innerHeight}px).`);
  for (const [name, box] of Object.entries({ bottle: mobileLayout.bottle, newGame: mobileLayout.newGame, hardDrop: mobileLayout.hardDrop, status: mobileLayout.status })) {
    assert.ok(box, `${name} fehlt im mobilen Dr.-Mario-Layout.`);
    assert.ok(box.top >= -1 && box.bottom <= mobileLayout.innerHeight + 1, `${name} liegt außerhalb des mobilen Viewports: ${JSON.stringify(box)}`);
    assert.ok(box.left >= -1 && box.right <= mobileLayout.innerWidth + 1, `${name} liegt horizontal außerhalb des mobilen Viewports: ${JSON.stringify(box)}`);
  }
  console.log('browser-smoke: dr-mario 360x640 fits without scrolling');
  console.log('browser-smoke: dr-mario online + service-worker ready + 128 cells');

  const savedProbe = await evaluate(client, `(() => {
    const savedState = {
      board: Array(128).fill(null),
      active: null,
      nextColors: ['red', 'blue'],
      score: 4242,
      viruses: 0,
      status: 'won',
    };
    localStorage.setItem('dr-mario-state-v1', JSON.stringify(savedState));
    const stored = JSON.parse(localStorage.getItem('dr-mario-state-v1'));
    return {
      score: stored?.score,
      viruses: stored?.viruses,
      status: stored?.status,
      boardLength: stored?.board?.length,
    };
  })()`);
  assert.deepEqual(savedProbe, { score: 4242, viruses: 0, status: 'won', boardLength: 128 }, 'Deterministischer Dr.-Mario-Spielstand wurde nicht lokal gespeichert.');

  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  const reloadedOffline = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await reloadedOffline;

  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Dr.-Mario-Offline-Reload verlor Service-Worker-Kontrolle.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.dm-cell').length"), 128, 'Offline-Dr.-Mario-Flasche hat nicht 128 Zellen.');
  assert.equal(await evaluate(client, "document.querySelector('#score')?.textContent"), '4242', 'Dr.-Mario-Score wurde beim Offline-Reload nicht wiederhergestellt.');
  assert.equal(await evaluate(client, "document.querySelector('#viruses')?.textContent"), '0', 'Dr.-Mario-Viruszahl wurde beim Offline-Reload nicht wiederhergestellt.');
  assert.equal(await evaluate(client, "document.querySelector('#game-status')?.textContent"), 'Alle Viren beseitigt. Runde geschafft!', 'Dr.-Mario-Terminalzustand wurde beim Offline-Reload nicht wiederhergestellt.');
  assert.equal(await evaluate(client, "document.querySelector('#move-left')?.disabled"), true, 'Dr.-Mario-Terminalzustand ließ nach Offline-Restore aktive Steuerung zu.');

  const restoredProbe = await evaluate(client, `(() => {
    const stored = JSON.parse(localStorage.getItem('dr-mario-state-v1'));
    return {
      score: stored?.score,
      viruses: stored?.viruses,
      status: stored?.status,
      boardLength: stored?.board?.length,
    };
  })()`);
  assert.deepEqual(restoredProbe, savedProbe, 'Dr.-Mario-Spielstand ging beim Offline-Reload im lokalen Storage verloren.');
  console.log('browser-smoke: dr-mario offline reload + save restore passed');

  const canonicalDrMario = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const drMarioNoSlashNavigation = await client.send('Page.navigate', { url: drMarioNoSlashUrl });
  assert.equal(drMarioNoSlashNavigation.errorText, undefined, `Offline-Dr.-Mario-No-Slash-Navigation fehlgeschlagen: ${drMarioNoSlashNavigation.errorText}`);
  await canonicalDrMario;

  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, 'location.href'), url, 'Dr.-Mario-No-Slash-Navigation wurde nicht auf die kanonische Slash-Route umgeleitet.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.dm-cell').length"), 128, 'Kanonisierte Dr.-Mario-Route verlor die Spieloberfläche.');
  assert.equal(await evaluate(client, "document.querySelector('#score')?.textContent"), '4242', 'Kanonisierte Dr.-Mario-Route verlor den lokalen Spielstand.');
  console.log('browser-smoke: dr-mario offline no-slash canonicalization passed');

  const canonicalSudoku = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === sudokuUrl);
  const sudokuNoSlashNavigation = await client.send('Page.navigate', { url: sudokuNoSlashUrl });
  assert.equal(sudokuNoSlashNavigation.errorText, undefined, `Offline-Sudoku-No-Slash-Navigation fehlgeschlagen: ${sudokuNoSlashNavigation.errorText}`);
  await canonicalSudoku;

  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, 'location.href'), sudokuUrl, 'Sudoku-No-Slash-Navigation wurde nicht auf die kanonische Slash-Route umgeleitet.');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true, 'Kanonisierte Sudoku-Route verlor Service-Worker-Kontrolle.');
  assert.equal(await evaluate(client, "document.querySelectorAll('.sudoku-cell').length"), 81, 'Kanonisierte Sudoku-Route erhielt nicht die Sudoku-Shell.');
  console.log('browser-smoke: sudoku offline no-slash canonicalization passed');
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
    console.warn(`browser-smoke: Dr.-Mario-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
