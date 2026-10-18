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
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Kein Chrome/Chromium gefunden. Setze CHROME_BIN auf ein ausführbares Browser-Binary.');
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const resourcePath = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const filePath = resolve(ROOT, `.${resourcePath}`);
      if (!filePath.startsWith(`${ROOT}${sep}`)) throw new Error('Path traversal rejected');
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolveListen, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/dr-mario/` };
}

async function waitForJson(url, timeout = 15_000) {
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
    this.socket = new WebSocket(webSocketUrl);
    this.opened = new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('DevTools-WebSocket konnte nicht geöffnet werden.')), { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result);
    });
  }
  async send(method, params = {}) {
    await this.opened;
    const id = ++this.nextId;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser-Auswertung fehlgeschlagen.');
  return result.result.value;
}

async function waitForValue(client, expression, expected, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(client, expression);
    if (lastValue === expected) return lastValue;
    await sleep(80);
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
const profileDir = await mkdtemp(join(tmpdir(), '4096-dr-mario-ui-polish-'));
const { server, url } = await startStaticServer();
const browser = spawn(findBrowser(), [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-gpu',
  '--no-default-browser-check', '--no-first-run', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileDir}`, 'about:blank',
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
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `Dr.-Mario-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelectorAll('.dm-cell').length", 128);

  const layout = await evaluate(client, `(() => {
    const selectors = ['#new-game', '#rotate', '#move-down', '#move-left', '#move-right', '#hard-drop'];
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height, midY: box.top + box.height / 2 };
    };
    return {
      innerWidth,
      innerHeight,
      scrollHeight: document.scrollingElement.scrollHeight,
      bottle: rect('#bottle'),
      panel: rect('.side-panel'),
      controls: Object.fromEntries(selectors.map((selector) => [selector, rect(selector)])),
    };
  })()`);

  assert.equal(layout.innerWidth, 360);
  assert.equal(layout.innerHeight, 640);
  assert.ok(layout.scrollHeight <= 641, `Dr. Mario scrollt nach UI-Polish vertikal: ${layout.scrollHeight}px.`);
  assert.ok(layout.bottle.width >= 190 && layout.bottle.height >= 380, `Spielfläche ist nicht mehr dominant genug: ${JSON.stringify(layout.bottle)}.`);
  assert.ok(layout.bottle.right <= layout.panel.left + 1, `Control-Deck überlappt die Flasche: bottle=${JSON.stringify(layout.bottle)} panel=${JSON.stringify(layout.panel)}.`);

  for (const [selector, box] of Object.entries(layout.controls)) {
    assert.ok(box.width >= 44 && box.height >= 44, `${selector} unterschreitet 44×44px: ${JSON.stringify(box)}.`);
    assert.ok(box.left >= -1 && box.right <= 361 && box.top >= -1 && box.bottom <= 641, `${selector} liegt außerhalb des Viewports: ${JSON.stringify(box)}.`);
  }

  const controls = layout.controls;
  assert.ok(Math.abs(controls['#move-left'].midY - controls['#move-right'].midY) <= 1, `← und → liegen nicht auf einer Achse: ${JSON.stringify(controls)}.`);
  assert.ok(Math.abs(controls['#rotate'].midY - controls['#move-down'].midY) <= 1, `Drehen und ↓ liegen nicht auf einer Achse: ${JSON.stringify(controls)}.`);
  assert.ok(controls['#rotate'].bottom <= controls['#move-left'].top + 1, `Aktionszeile liegt nicht oberhalb der Bewegungszeile: ${JSON.stringify(controls)}.`);
  assert.ok(controls['#move-left'].bottom <= controls['#hard-drop'].top + 1, `Hard-Drop liegt nicht unter der Bewegungszeile: ${JSON.stringify(controls)}.`);

  console.log(`browser-smoke: Dr. Mario UI polish passed; bottle=${Math.round(layout.bottle.width)}x${Math.round(layout.bottle.height)}, panel=${Math.round(layout.panel.width)}px`);
} catch (error) {
  const details = browserStderr ? `\nBrowser stderr:\n${browserStderr}` : '';
  throw new Error(`${error.message}${details}`, { cause: error });
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  } catch (error) {
    console.warn(`browser-smoke: temporäres Dr.-Mario-UI-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
