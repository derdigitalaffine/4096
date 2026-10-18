import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve('.');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

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

const profileDir = await mkdtemp(join(tmpdir(), '4096-sml-touch-polish-'));
const { server, url } = await startStaticServer();
const browser = spawn(findBrowser(), [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-gpu',
  '--no-default-browser-check', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let browserStderr = '';
browser.stderr.on('data', (chunk) => {
  browserStderr += chunk.toString();
  if (browserStderr.length > 12_000) browserStderr = browserStderr.slice(-12_000);
});

let client;
try {
  const portMatch = await new Promise((resolvePort, reject) => {
    const deadline = setTimeout(() => reject(new Error('Chrome DevTools-Port wurde nicht gemeldet.')), 15_000);
    const inspect = (chunk) => {
      const match = chunk.toString().match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (!match) return;
      clearTimeout(deadline);
      browser.stderr.off('data', inspect);
      resolvePort(Number(match[1]));
    };
    browser.stderr.on('data', inspect);
  });
  await waitForJson(`http://127.0.0.1:${portMatch}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${portMatch}/json/new?about:blank`, { method: 'PUT' });
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

  const multiPointer = await evaluate(client, `(async () => {
    const button = document.querySelector('#move-right');
    const canvas = document.querySelector('#game-canvas');
    button.setPointerCapture = () => {};
    button.releasePointerCapture = () => {};
    button.hasPointerCapture = () => false;
    const fire = (type, pointerId) => button.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 101,
      button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    }));
    fire('pointerdown', 101);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const beforeForeignPointer = Number(canvas.dataset.cameraTarget);
    fire('pointerdown', 202);
    fire('pointerup', 202);
    await new Promise((resolve) => setTimeout(resolve, 260));
    const afterForeignPointer = Number(canvas.dataset.cameraTarget);
    const pressedAfterForeignPointer = button.dataset.pressed;
    fire('pointercancel', 101);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const afterCancel = Number(canvas.dataset.cameraTarget);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const settledAfterCancel = Number(canvas.dataset.cameraTarget);
    fire('pointerdown', 303);
    window.dispatchEvent(new Event('blur'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    const pressedAfterBlur = button.dataset.pressed;
    delete button.setPointerCapture;
    delete button.releasePointerCapture;
    delete button.hasPointerCapture;
    return { beforeForeignPointer, afterForeignPointer, pressedAfterForeignPointer, afterCancel, settledAfterCancel, pressedAfterBlur };
  })()`);
  assert.ok(multiPointer.beforeForeignPointer > 0, `Erster Hold bewegte die Kamera nicht: ${JSON.stringify(multiPointer)}`);
  assert.ok(multiPointer.afterForeignPointer > multiPointer.beforeForeignPointer, `Fremder Pointer beendet den aktiven Hold vorzeitig: ${JSON.stringify(multiPointer)}`);
  assert.equal(multiPointer.pressedAfterForeignPointer, 'true', `Pressed-Zustand ging durch fremden Pointer verloren: ${JSON.stringify(multiPointer)}`);
  assert.equal(multiPointer.afterCancel, multiPointer.settledAfterCancel, `Pointer-Cancel beendet die Richtung nicht sofort: ${JSON.stringify(multiPointer)}`);
  assert.equal(multiPointer.pressedAfterBlur, 'false', `Blur räumt den Pressed-Zustand nicht auf: ${JSON.stringify(multiPointer)}`);

  await evaluate(client, "document.querySelector('#new-game').click()");
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
  await sleep(1_000);
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

  console.log(`browser-smoke: SML touch polish passed; multi-pointer camera=${multiPointer.beforeForeignPointer}->${multiPointer.afterForeignPointer}, real-hold target=${targetDuringHold}`);
} catch (error) {
  const details = browserStderr ? `\nBrowser stderr:\n${browserStderr}` : '';
  throw new Error(`${error.message}${details}`, { cause: error });
} finally {
  client?.close();
  await stopBrowser(browser);
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true });
}
