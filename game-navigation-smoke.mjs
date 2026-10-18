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

const ROUTES = [
  {
    label: '4096',
    path: '4096/',
    navSelector: '.controls .nav-link',
    readyExpression: "document.querySelectorAll('.tile').length === 16",
    expectedPaths: ['/', '/sudoku/', '/dr-tromu/', '/super-tromu-land/'],
  },
  {
    label: 'Sudoku',
    path: 'sudoku/',
    navSelector: '.game-nav a',
    readyExpression: "document.querySelectorAll('.sudoku-cell').length === 81",
    expectedPaths: ['/', '/4096/', '/dr-tromu/', '/super-tromu-land/'],
  },
  {
    label: 'Dr. Tromu',
    path: 'dr-tromu/',
    navSelector: '.game-nav a',
    readyExpression: "document.querySelectorAll('.dm-cell').length === 128",
    expectedPaths: ['/', '/4096/', '/sudoku/', '/super-tromu-land/'],
  },
  {
    label: 'Super Tromu Land',
    path: 'super-tromu-land/',
    navSelector: '.game-nav a',
    readyExpression: "Boolean(document.querySelector('#game-canvas'))",
    expectedPaths: ['/', '/4096/', '/sudoku/', '/dr-tromu/'],
  },
];

const OFFLINE_ENTER_CYCLE = [
  {
    sourceLabel: '4096',
    navSelector: '.controls .nav-link',
    targetPath: '/sudoku/',
    targetReadyExpression: "document.querySelectorAll('.sudoku-cell').length === 81",
  },
  {
    sourceLabel: 'Sudoku',
    navSelector: '.game-nav a',
    targetPath: '/dr-tromu/',
    targetReadyExpression: "document.querySelectorAll('.dm-cell').length === 128",
  },
  {
    sourceLabel: 'Dr. Tromu',
    navSelector: '.game-nav a',
    targetPath: '/super-tromu-land/',
    targetReadyExpression: "Boolean(document.querySelector('#game-canvas'))",
  },
  {
    sourceLabel: 'Super Tromu Land',
    navSelector: '.game-nav a',
    targetPath: '/4096/',
    targetReadyExpression: "document.querySelectorAll('.tile').length === 16",
  },
];

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

async function pressTab(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await sleep(30);
}

async function pressEnter(client) {
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
}

async function focusNavPath(client, selector, targetPath, label) {
  await evaluate(client, 'document.activeElement?.blur()');
  for (let index = 0; index < 30; index += 1) {
    await pressTab(client);
    const focus = await evaluate(client, `(() => {
      const active = document.activeElement;
      if (!active?.matches?.(${JSON.stringify(selector)})) return null;
      return {
        pathname: new URL(active.href).pathname,
        focusVisible: active.matches(':focus-visible'),
      };
    })()`);
    if (focus?.pathname !== targetPath) continue;
    assert.equal(focus.focusVisible, true, `${label}: Offline-Ziel ${targetPath} hat vor Enter keinen sichtbaren Tastaturfokus.`);
    return;
  }
  throw new Error(`${label}: Offline-Ziel ${targetPath} wurde per Tab nicht erreicht.`);
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

  for (const route of ROUTES) {
    const pageUrl = new URL(route.path, url).href;
    const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === pageUrl, 15_000);
    const navigation = await client.send('Page.navigate', { url: pageUrl });
    assert.equal(navigation.errorText, undefined, `${route.label}: Navigation fehlgeschlagen: ${navigation.errorText}`);
    await navigated;
    await waitForTruthy(client, "document.readyState === 'complete'");
    await waitForTruthy(client, route.readyExpression);

    const layout = await evaluate(client, `(() => {
      const selector = ${JSON.stringify(route.navSelector)};
      const links = [...document.querySelectorAll(selector)];
      return {
        innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        links: links.map((link) => {
          const box = link.getBoundingClientRect();
          return {
            text: link.textContent.trim(),
            href: link.href,
            pathname: new URL(link.href).pathname,
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
          };
        }),
      };
    })()`);

    assert.equal(layout.innerWidth, 360, `${route.label}: Browser läuft nicht im erwarteten 360px-Viewport.`);
    assert.ok(layout.scrollWidth <= 361, `${route.label}: horizontale Seitenausdehnung ${layout.scrollWidth}px bei 360px Viewport.`);
    assert.equal(layout.links.length, 4, `${route.label}: erwartet vier lokale Navigationsziele.`);
    assert.deepEqual(layout.links.map(({ pathname }) => pathname), route.expectedPaths, `${route.label}: Navigationsziele oder Reihenfolge sind inkonsistent.`);

    for (const link of layout.links) {
      assert.equal(new URL(link.href).origin, new URL(url).origin, `${route.label}: ${link.text} verlässt den lokalen Ursprung.`);
      assert.ok(link.width >= 44, `${route.label}: Navigationsziel ${link.text} ist nur ${link.width.toFixed(1)}px breit.`);
      assert.ok(link.height >= 44, `${route.label}: Navigationsziel ${link.text} ist nur ${link.height.toFixed(1)}px hoch.`);
      assert.ok(link.left >= -1 && link.right <= 361, `${route.label}: Navigationsziel ${link.text} liegt horizontal außerhalb des Viewports.`);
    }

    await evaluate(client, 'document.activeElement?.blur()');
    const visited = [];
    for (let index = 0; index < 20 && visited.length < 4; index += 1) {
      await pressTab(client);
      const focus = await evaluate(client, `(() => {
        const active = document.activeElement;
        const nav = active?.matches?.(${JSON.stringify(route.navSelector)});
        return nav ? {
          pathname: new URL(active.href).pathname,
          focusVisible: active.matches(':focus-visible'),
        } : null;
      })()`);
      if (focus && !visited.some(({ pathname }) => pathname === focus.pathname)) visited.push(focus);
    }

    assert.deepEqual(visited.map(({ pathname }) => pathname), route.expectedPaths, `${route.label}: Tab-Fokus erreicht nicht alle vier Navigationsziele in DOM-Reihenfolge.`);
    assert.ok(visited.every(({ focusVisible }) => focusVisible), `${route.label}: mindestens ein per Tab erreichtes Navigationsziel hat keinen sichtbaren Tastaturfokus.`);

    console.log(`browser-smoke: ${route.label} four-game navigation 360x640 + keyboard focus passed`);
  }

  const startUrl = new URL('4096/', url).href;
  const startNavigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === startUrl, 15_000);
  const startNavigation = await client.send('Page.navigate', { url: startUrl });
  assert.equal(startNavigation.errorText, undefined, `Offline-Enter-Start fehlgeschlagen: ${startNavigation.errorText}`);
  await startNavigated;
  await waitForTruthy(client, "document.querySelectorAll('.tile').length === 16");
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

  for (const step of OFFLINE_ENTER_CYCLE) {
    await focusNavPath(client, step.navSelector, step.targetPath, step.sourceLabel);
    const targetUrl = new URL(step.targetPath.slice(1), url).href;
    const enterNavigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === targetUrl, 15_000);
    await pressEnter(client);
    await enterNavigated;
    await waitForTruthy(client, "document.readyState === 'complete'");
    await waitForTruthy(client, step.targetReadyExpression);
    assert.equal(await evaluate(client, 'location.pathname'), step.targetPath, `${step.sourceLabel}: Enter hat offline nicht zu ${step.targetPath} navigiert.`);
    assert.equal(await evaluate(client, 'navigator.onLine'), false, `${step.sourceLabel}: Offline-Zustand ging beim Enter-Wechsel verloren.`);
    console.log(`browser-smoke: ${step.sourceLabel} offline Enter -> ${step.targetPath} passed`);
  }
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
    console.warn(`browser-smoke: Navigations-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
