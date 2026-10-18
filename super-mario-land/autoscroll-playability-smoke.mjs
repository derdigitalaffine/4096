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
const profileDir = await mkdtemp(join(tmpdir(), '4096-sml-autoscroll-smoke-'));
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

  const navigated = client.waitForEvent('Page.frameNavigated', ({ frame }) => frame?.url === url);
  const navigation = await client.send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, `Super-Mario-Land-Navigation fehlgeschlagen: ${navigation.errorText}`);
  await navigated;
  assert.equal(await evaluate(client, 'document.readyState'), 'complete');
  assert.deepEqual(await evaluate(client, '({ width: innerWidth, height: innerHeight })'), { width: 360, height: 640 });

  const playability = await evaluate(client, `(async () => {
    const rules = await import('./game.js');
    const DT = 1 / 60;
    const MAX_FRAMES = 12_000;

    function hasFloorAt(level, x, y) {
      return level.solids.some((solid) => x >= solid.x && x <= solid.x + solid.width && y >= solid.y - 6 && y <= solid.y + solid.height + 6);
    }

    function shouldJump(state, level, frame) {
      if (!state.player.onGround) return false;
      const player = state.player;
      const footY = player.y + player.height + 4;
      const floorAhead = hasFloorAt(level, player.x + player.width + 72, footY);
      const enemyAhead = state.enemies.some((enemy) => enemy.alive && enemy.x >= player.x - 4 && enemy.x <= player.x + 132 && Math.abs(enemy.y - player.y) < 90);
      const wallAhead = level.solids.some((solid) => solid.x >= player.x + player.width && solid.x <= player.x + player.width + 58 && solid.y < player.y + player.height - 6 && solid.y + solid.height > player.y + 8);
      return !floorAhead || enemyAhead || wallAhead || frame % 96 === 0;
    }

    function runStage(startLevelIndex) {
      let state = rules.createGame(startLevelIndex);
      const level = rules.getLevel(state);
      const startStage = rules.stageLabel(state);
      const startLives = state.lives;
      let frames = 0;
      let maxX = state.player.x;
      let minLives = state.lives;

      for (; frames < MAX_FRAMES; frames += 1) {
        if (state.status !== 'playing' || state.levelIndex !== startLevelIndex) break;
        const currentLevel = rules.getLevel(state);
        state = rules.stepGame(state, { right: true, jump: shouldJump(state, currentLevel, frames) }, DT);
        maxX = Math.max(maxX, state.player.x);
        minLives = Math.min(minLives, state.lives);
      }

      const completed = startLevelIndex === rules.LEVEL_COUNT - 1
        ? state.status === 'won'
        : state.status === 'playing' && state.levelIndex === startLevelIndex + 1;
      return {
        startStage,
        autoScroll: level.autoScroll,
        completed,
        frames,
        seconds: frames * DT,
        startLives,
        minLives,
        endLives: state.lives,
        endStatus: state.status,
        endLevelIndex: state.levelIndex,
        maxX,
        goalX: level.goalX,
      };
    }

    return [runStage(5), runStage(11)];
  })()`);

  assert.deepEqual(playability.map((result) => result.startStage), ['2-3', '4-3']);
  for (const result of playability) {
    assert.equal(result.autoScroll, true, `${result.startStage} ist nicht mehr als Auto-Scroll-Stage markiert.`);
    assert.equal(result.completed, true, `${result.startStage} wurde mit regulären Lauf-/Sprungeingaben nicht beendet: ${JSON.stringify(result)}`);
    assert.ok(result.minLives > 0, `${result.startStage} endete im Game Over: ${JSON.stringify(result)}`);
    assert.ok(result.maxX + 24 >= result.goalX, `${result.startStage} erreichte die Ziellinie nicht: ${JSON.stringify(result)}`);
    assert.ok(result.frames < 12_000, `${result.startStage} überschritt das Frame-Budget: ${JSON.stringify(result)}`);
  }
  console.log(`browser-smoke: SML auto-scroll playability passed ${JSON.stringify(playability)}`);
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
    console.warn(`browser-smoke: Auto-Scroll-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
