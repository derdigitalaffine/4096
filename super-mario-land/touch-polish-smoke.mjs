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
  return { server, url: `http://127.0.0.1:${server.address().port}/super-mario-land/` };
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
      const waiter = { predicate, resolve: resolveEvent, timeoutId: setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`Timeout beim Warten auf ${method}`));
      }, timeout) };
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
const profileDir = await mkdtemp(join(tmpdir(), '4096-sml-touch-polish-'));
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
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `SML-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await navigated;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');

  const firstPointer = await evaluate(client, `(() => {
    const button = document.querySelector('#move-right');
    button.setPointerCapture = () => {};
    button.releasePointerCapture = () => {};
    button.hasPointerCapture = () => false;
    window.__smlTouchFire = (type, pointerId) => button.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 101,
      button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    }));
    window.__smlTouchFire('pointerdown', 101);
    return { pressed: button.dataset.pressed ?? null, disabled: button.disabled };
  })()`);
  assert.equal(firstPointer.disabled, false);
  assert.equal(firstPointer.pressed, 'true', `Aktiver Pointer bekommt keinen sichtbaren Pressed-Zustand: ${JSON.stringify(firstPointer)}`);

  await sleep(1_200);
  const beforeForeignPointer = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  assert.ok(beforeForeignPointer > 0, `Erster Hold bewegt die Kamera nicht: ${beforeForeignPointer}`);
  const pressedAfterForeignPointer = await evaluate(client, `(() => {
    window.__smlTouchFire('pointerdown', 202);
    window.__smlTouchFire('pointerup', 202);
    return document.querySelector('#move-right').dataset.pressed ?? null;
  })()`);
  assert.equal(pressedAfterForeignPointer, 'true', 'Fremder Pointer beendet den sichtbaren Hold vorzeitig.');
  await sleep(260);
  const afterForeignPointer = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  assert.ok(afterForeignPointer > beforeForeignPointer, `Fremder Pointer beendet die aktive Richtung vorzeitig: ${beforeForeignPointer} -> ${afterForeignPointer}`);

  await evaluate(client, "window.__smlTouchFire('pointercancel', 101)");
  await waitForValue(client, "document.querySelector('#move-right')?.dataset.pressed", 'false');
  const targetAtSyntheticCancel = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  await sleep(260);
  const targetAfterSyntheticCancel = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  assert.equal(targetAfterSyntheticCancel, targetAtSyntheticCancel, `Pointer-Cancel beendet die Richtung nicht sofort: ${targetAtSyntheticCancel} -> ${targetAfterSyntheticCancel}`);

  await evaluate(client, `(() => {
    window.__smlTouchFire('pointerdown', 303);
    window.dispatchEvent(new Event('blur'));
  })()`);
  await waitForValue(client, "document.querySelector('#move-right')?.dataset.pressed", 'false');
  await evaluate(client, `(() => {
    const button = document.querySelector('#move-right');
    delete window.__smlTouchFire;
    delete button.setPointerCapture;
    delete button.releasePointerCapture;
    delete button.hasPointerCapture;
    document.querySelector('#new-game').click();
  })()`);
  await sleep(120);

  const center = await evaluate(client, `(() => {
    const rect = document.querySelector('#move-right').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  const beforeTransform = await evaluate(client, "getComputedStyle(document.querySelector('#move-right')).transform");
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: center.x, y: center.y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] });
  await waitForValue(client, "document.querySelector('#move-right')?.dataset.pressed", 'true');
  const duringTransform = await evaluate(client, "getComputedStyle(document.querySelector('#move-right')).transform");
  assert.notEqual(duringTransform, beforeTransform, `Realer Touch-Hold hat kein sichtbares Pressed-Feedback: ${beforeTransform}`);
  await sleep(1_200);
  const targetDuringHold = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  assert.ok(targetDuringHold > 0, `Realer Touch-Hold bewegt die Spielfigur nicht: ${targetDuringHold}`);

  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await waitForValue(client, "document.querySelector('#move-right')?.dataset.pressed", 'false');
  const targetAtCancel = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  await sleep(300);
  const targetAfterCancel = await evaluate(client, "Number(document.querySelector('#game-canvas').dataset.cameraTarget)");
  assert.equal(targetAfterCancel, targetAtCancel, `Realer Touch-Cancel lässt die Richtung weiterlaufen: ${targetAtCancel} -> ${targetAfterCancel}`);
  const afterTransform = await evaluate(client, "getComputedStyle(document.querySelector('#move-right')).transform");
  assert.equal(afterTransform, beforeTransform, `Pressed-Feedback bleibt nach Touch-Cancel hängen: ${afterTransform}`);

  console.log(`browser-smoke: SML touch polish passed; multi-pointer camera=${beforeForeignPointer}->${afterForeignPointer}, real-hold target=${targetDuringHold}`);
} catch (error) {
  const details = browserStderr ? `\nBrowser stderr:\n${browserStderr}` : '';
  throw new Error(`${error.message}${details}`, { cause: error });
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true });
}
