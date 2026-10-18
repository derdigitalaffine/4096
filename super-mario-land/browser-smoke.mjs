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
const profileDir = await mkdtemp(join(tmpdir(), '4096-super-mario-land-smoke-'));
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
  await client.send('Network.enable');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });

  const navigatedOnline = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `Super-Mario-Land-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await navigatedOnline;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Online · offline bereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true);
  assert.equal(await evaluate(client, "document.querySelector('#level')?.textContent"), '1-1 · 1/12');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas')?.dataset.stage"), '1-1');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas')?.dataset.questionBlocks"), '2');
  assert.equal(await evaluate(client, "document.querySelectorAll('.touch-controls button').length"), 4);

  const layout = await evaluate(client, `(() => ({
    innerWidth, innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    boxes: ['#game-canvas','#level','#power','#jump','#fire','#game-status'].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { selector, top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null;
    }),
  }))()`);
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `horizontaler Scroll auf 360px: ${JSON.stringify(layout)}`);
  assert.ok(layout.scrollHeight <= layout.innerHeight + 1, `vertikaler Scroll auf 640px: ${JSON.stringify(layout)}`);
  for (const box of layout.boxes) {
    assert.ok(box, 'mobiles Spielelement fehlt');
    assert.ok(box.top >= -1 && box.bottom <= layout.innerHeight + 1, `${box.selector} liegt vertikal außerhalb: ${JSON.stringify(box)}`);
    assert.ok(box.left >= -1 && box.right <= layout.innerWidth + 1, `${box.selector} liegt horizontal außerhalb: ${JSON.stringify(box)}`);
  }

  const rulesProbe = await evaluate(client, `(async () => {
    const rules = await import('./game.js');
    const hitBlock = (state, blockIndex) => {
      const block = state.blocks[blockIndex];
      state.player = { ...state.player, x: block.x + 4, y: block.y + block.height + 1, vy: -400, onGround: false };
      return rules.stepGame(state, {}, 0.05);
    };
    let mushroom = hitBlock(rules.createGame(), 0);
    mushroom.player = { ...mushroom.player, x: mushroom.powerups[0].x, y: mushroom.powerups[0].y, vy: 0, onGround: false };
    mushroom = rules.stepGame(mushroom, {}, 0);
    const enemy = mushroom.enemies[0];
    mushroom.player = { ...mushroom.player, x: enemy.x, y: enemy.y, vy: 0, onGround: false };
    mushroom = rules.stepGame(mushroom, {}, 0);

    let flower = hitBlock(rules.createGame(), 1);
    flower.player = { ...flower.player, x: flower.powerups[0].x, y: flower.powerups[0].y, vy: 0, onGround: false };
    flower = rules.stepGame(flower, {}, 0);
    flower.player = { ...flower.player, x: 64, y: rules.GROUND_Y - rules.PLAYER_HEIGHT, vy: 0, onGround: true, facing: 1 };
    flower.enemies[0] = { ...flower.enemies[0], x: flower.player.x + rules.PLAYER_WIDTH + 1, y: rules.GROUND_Y - 24 };
    flower = rules.stepGame(flower, { fire: true }, 0);

    let campaign = rules.createGame();
    campaign.lives = 2;
    campaign.power = 'flower';
    const checkpoints = [];
    for (let index = 0; index < rules.LEVEL_COUNT - 1; index += 1) {
      campaign.player = { ...campaign.player, x: rules.getLevel(campaign).goalX - rules.PLAYER_WIDTH };
      campaign = rules.stepGame(campaign, {}, 0);
      if ([3, 6, 9, 11].includes(campaign.levelIndex)) checkpoints.push({ index: campaign.levelIndex, stage: rules.stageLabel(campaign), lives: campaign.lives, power: campaign.power, status: campaign.status });
    }
    campaign.player = { ...campaign.player, x: rules.getLevel(campaign).goalX - rules.PLAYER_WIDTH };
    campaign = rules.stepGame(campaign, {}, 0);

    const autoStart = rules.createGame(5);
    const autoMoved = rules.stepGame(autoStart, {}, 0.05);
    return {
      levelCount: rules.LEVEL_COUNT,
      worldCount: rules.WORLD_COUNT,
      ids: rules.LEVELS.map((level) => level.id),
      blocksPerLevel: rules.LEVELS.map((level) => level.blocks.length),
      autoStages: rules.LEVELS.filter((level) => level.autoScroll).map((level) => level.id),
      protectedHit: { power: mushroom.power, lives: mushroom.lives },
      flowerPower: flower.power,
      flowerEnemyAlive: flower.enemies[0].alive,
      checkpoints,
      finalStage: rules.stageLabel(campaign),
      finalStatus: campaign.status,
      autoMoved: autoMoved.player.x > autoStart.player.x,
    };
  })()`);
  assert.equal(rulesProbe.levelCount, 12);
  assert.equal(rulesProbe.worldCount, 4);
  assert.deepEqual(rulesProbe.ids, ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3','4-1','4-2','4-3']);
  assert.deepEqual(rulesProbe.blocksPerLevel, Array(12).fill(2));
  assert.deepEqual(rulesProbe.autoStages, ['2-3', '4-3']);
  assert.deepEqual(rulesProbe.protectedHit, { power: 'small', lives: 3 });
  assert.equal(rulesProbe.flowerPower, 'flower');
  assert.equal(rulesProbe.flowerEnemyAlive, false);
  assert.deepEqual(rulesProbe.checkpoints.map((item) => item.stage), ['2-1', '3-1', '4-1', '4-3']);
  assert.ok(rulesProbe.checkpoints.every((item) => item.lives === 2 && item.power === 'flower' && item.status === 'playing'));
  assert.equal(rulesProbe.finalStage, '4-3');
  assert.equal(rulesProbe.finalStatus, 'won');
  assert.equal(rulesProbe.autoMoved, true);
  console.log('browser-smoke: super-mario-land 4x3 campaign + power-ups + special stages passed');

  const startProgress = Number((await evaluate(client, "document.querySelector('#progress')?.textContent"))?.replace('%', ''));
  await evaluate(client, `(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return new Promise((resolve) => setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
      resolve(true);
    }, 700));
  })()`);
  const movedProgress = Number((await evaluate(client, "document.querySelector('#progress')?.textContent"))?.replace('%', ''));
  assert.ok(movedProgress > startProgress, `Tastatureingabe bewegte die Figur nicht (${startProgress}% -> ${movedProgress}%).`);

  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const reloadedOffline = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  await client.send('Page.reload', { ignoreCache: false });
  await reloadedOffline;
  await waitForValue(client, 'document.readyState', 'complete');
  await waitForValue(client, "document.querySelector('#connection-status')?.textContent", 'Offline · spielbereit');
  assert.equal(await evaluate(client, 'Boolean(navigator.serviceWorker.controller)'), true);
  assert.equal(await evaluate(client, "document.querySelector('#level')?.textContent"), '1-1 · 1/12');
  assert.equal(await evaluate(client, "document.querySelector('#game-canvas')?.dataset.stage"), '1-1');
  assert.equal(await evaluate(client, "document.querySelector('#jump')?.disabled"), false);
  console.log('browser-smoke: super-mario-land 12-stage campaign offline reload passed');
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
    console.warn(`browser-smoke: Super-Mario-Land-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
