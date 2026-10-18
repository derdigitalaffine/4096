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
const PREFIX = '/tromu/';
const MIME = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
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
  for (const candidate of [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Kein Chrome/Chromium gefunden.');
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (!pathname.startsWith(PREFIX)) throw new Error('outside mounted webroot');
      const localPath = pathname.slice(PREFIX.length);
      const resourcePath = localPath === '' ? 'index.html' : localPath.endsWith('/') ? `${localPath}index.html` : localPath;
      const filePath = resolve(ROOT, resourcePath);
      if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) throw new Error('path traversal');
      const content = await readFile(filePath);
      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': `${MIME[extname(filePath)] ?? 'application/octet-stream'}; charset=utf-8` });
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
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

class CDP {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolveReady, reject) => {
      this.socket.addEventListener('open', resolveReady, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
    });
    this.socket.addEventListener('message', (event) => this.handle(JSON.parse(event.data)));
  }
  handle(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    for (const waiter of [...(this.waiters.get(message.method) ?? [])]) {
      if (!waiter.predicate(message.params)) continue;
      clearTimeout(waiter.timeout);
      const list = this.waiters.get(message.method);
      list.splice(list.indexOf(waiter), 1);
      waiter.resolve(message.params);
      break;
    }
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  wait(method, predicate = () => true, timeout = 15000) {
    return new Promise((resolveWait, reject) => {
      const list = this.waiters.get(method) ?? [];
      const waiter = { predicate, resolve: resolveWait, timeout: setTimeout(() => reject(new Error(`Timeout ${method}`)), timeout) };
      list.push(waiter);
      this.waiters.set(method, list);
    });
  }
  close() { this.socket.close(); }
}

async function waitJson(url) {
  for (let i = 0; i < 150; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timeout ${url}`);
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Runtime error');
  return result.result.value;
}

async function waitFor(client, expression) {
  for (let i = 0; i < 150; i += 1) {
    if (await evaluate(client, expression)) return;
    await sleep(100);
  }
  throw new Error(`Timeout condition: ${expression}`);
}

async function navigate(client, url) {
  const event = client.wait('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const result = await client.send('Page.navigate', { url });
  assert.equal(result.errorText, undefined);
  await event;
  await waitFor(client, "document.readyState === 'complete'");
}

async function stopBrowser(browser) {
  if (browser.exitCode !== null) return;
  browser.kill('SIGTERM');
  await Promise.race([once(browser, 'exit'), sleep(2000)]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
}

const debugPort = await freePort();
const profileDir = await mkdtemp(join(tmpdir(), 'tromu-subpath-smoke-'));
const { server, origin } = await startServer();
const homeUrl = `${origin}${PREFIX}`;
const browser = spawn(findBrowser(), [
  '--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-gpu',
  '--no-default-browser-check', '--no-first-run', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profileDir}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let client;
try {
  await waitJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  client = new CDP(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  await navigate(client, homeUrl);
  await waitFor(client, `document.querySelectorAll('.game-card').length === ${GAMES.length}`);
  const homePaths = await evaluate(client, `[...document.querySelectorAll('.game-card')].map((link) => new URL(link.href).pathname)`);
  assert.deepEqual(homePaths, GAMES.map((game) => `${PREFIX}${game.route.slice(1)}`));

  for (const game of GAMES) {
    await navigate(client, homeUrl);
    await waitFor(client, `document.querySelector('[data-game-id="${game.id}"]')`);
    const targetUrl = `${origin}${PREFIX}${game.route.slice(1)}`;
    const moved = client.wait('Page.frameNavigated', ({ frame }) => frame?.url === targetUrl);
    await evaluate(client, `document.querySelector('.game-card[data-game-id="${game.id}"]').click()`);
    await moved;
    await waitFor(client, `document.body.dataset.gameId === '${game.id}'`);
    const navPaths = await evaluate(client, `[...document.querySelectorAll('.game-nav a')].map((link) => new URL(link.href).pathname)`);
    assert.ok(navPaths.every((path) => path.startsWith(PREFIX)), `${game.name}: Navigation verlässt Webroot-Prefix: ${navPaths.join(', ')}`);
  }

  await navigate(client, homeUrl);
  await waitFor(client, "navigator.serviceWorker?.ready.then(() => Boolean(navigator.serviceWorker.controller))");
  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
  const first = GAMES[0];
  const offlineUrl = `${origin}${PREFIX}${first.route.slice(1)}`;
  const offlineMoved = client.wait('Page.frameNavigated', ({ frame }) => frame?.url === offlineUrl);
  await evaluate(client, `document.querySelector('.game-card[data-game-id="${first.id}"]').click()`);
  await offlineMoved;
  await waitFor(client, `document.body.dataset.gameId === '${first.id}'`);

  console.log(`browser-smoke: registry links stay inside ${PREFIX} online + offline for ${GAMES.length} games`);
} finally {
  client?.close();
  server.close();
  await stopBrowser(browser);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
