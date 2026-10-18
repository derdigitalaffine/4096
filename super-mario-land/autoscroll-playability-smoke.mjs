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
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
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
  await waitForValue(client, 'document.readyState', 'complete');
  assert.deepEqual(await evaluate(client, '({ width: innerWidth, height: innerHeight })'), { width: 360, height: 640 });

  const playability = await evaluate(client, `(async () => {
    const rules = await import('./game.js');
    const DT = 1 / 60;
    const MAX_FRAMES = 4_000;
    const BEAM_WIDTH = 256;
    const baseActions = [{ right: true }, {}];

    const isComplete = (state, startIndex) => startIndex === rules.LEVEL_COUNT - 1
      ? state.status === 'won'
      : state.status === 'playing' && state.levelIndex === startIndex + 1;

    const stateKey = (state) => {
      const player = state.player;
      const enemies = state.enemies.map((enemy) => enemy.alive ? '1' : '0').join('');
      const blocks = state.blocks.map((block) => block.used ? '1' : '0').join('');
      return [state.lives, state.power, Math.round(player.x / 4), Math.round(player.y / 4), Math.round(player.vy / 40), player.onGround ? 1 : 0, enemies, blocks].join('|');
    };

    const rank = (state) => {
      if (state.status === 'won') return Number.MAX_SAFE_INTEGER;
      if (state.status !== 'playing') return -1;
      return state.lives * 1e9 + state.player.x * 1e5 - Math.abs(state.player.vy) * 10 - state.player.y;
    };

    function runStage(startIndex) {
      const initial = rules.createGame(startIndex);
      const level = rules.getLevel(initial);
      let beam = [{ state: initial, jumps: 0, slowFrames: 0 }];
      let bestX = initial.player.x;
      let bestLives = initial.lives;

      for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
        const candidates = [];
        for (const candidate of beam) {
          const { state } = candidate;
          if (isComplete(state, startIndex)) {
            return { stage: level.id, autoScroll: level.autoScroll, completed: true, frames: frame, seconds: frame * DT, lives: state.lives, jumps: candidate.jumps, slowFrames: candidate.slowFrames, bestX, goalX: level.goalX };
          }
          if (state.status !== 'playing' || state.levelIndex !== startIndex) continue;
          const actions = state.player.onGround
            ? [...baseActions, { right: true, jump: true }, { jump: true }]
            : baseActions;
          for (const action of actions) {
            const next = rules.stepGame(state, action, DT);
            bestX = Math.max(bestX, next.player.x);
            bestLives = Math.max(bestLives, next.lives);
            candidates.push({
              state: next,
              jumps: candidate.jumps + (action.jump ? 1 : 0),
              slowFrames: candidate.slowFrames + (action.right ? 0 : 1),
            });
          }
        }

        const unique = new Map();
        for (const candidate of candidates) {
          if (isComplete(candidate.state, startIndex)) {
            return { stage: level.id, autoScroll: level.autoScroll, completed: true, frames: frame + 1, seconds: (frame + 1) * DT, lives: candidate.state.lives, jumps: candidate.jumps, slowFrames: candidate.slowFrames, bestX, goalX: level.goalX };
          }
          const key = stateKey(candidate.state);
          const previous = unique.get(key);
          if (!previous || rank(candidate.state) > rank(previous.state)) unique.set(key, candidate);
        }
        beam = [...unique.values()].sort((a, b) => rank(b.state) - rank(a.state)).slice(0, BEAM_WIDTH);
        if (beam.length === 0) break;
      }

      const best = beam.sort((a, b) => rank(b.state) - rank(a.state))[0];
      return {
        stage: level.id,
        autoScroll: level.autoScroll,
        completed: false,
        frames: MAX_FRAMES,
        seconds: MAX_FRAMES * DT,
        lives: best?.state.lives ?? 0,
        status: best?.state.status ?? 'none',
        x: best?.state.player.x ?? 0,
        jumps: best?.jumps ?? 0,
        slowFrames: best?.slowFrames ?? 0,
        bestX,
        bestLives,
        goalX: level.goalX,
      };
    }

    return [runStage(5), runStage(11)];
  })()`);

  console.log(`browser-smoke: SML auto-scroll probe ${JSON.stringify(playability)}`);
  assert.deepEqual(playability.map((result) => result.stage), ['2-3', '4-3']);
  for (const result of playability) {
    assert.equal(result.autoScroll, true, `${result.stage} ist nicht mehr als Auto-Scroll-Stage markiert.`);
    assert.equal(result.completed, true, `${result.stage} ist mit regulären Lauf-/Sprungeingaben nicht reproduzierbar durchspielbar: ${JSON.stringify(result)}`);
    assert.ok(result.lives > 0, `${result.stage} endete nur nach Game Over: ${JSON.stringify(result)}`);
    assert.ok(result.frames < 4_000, `${result.stage} überschritt das Frame-Budget: ${JSON.stringify(result)}`);
  }
  console.log('browser-smoke: SML auto-scroll playability passed');
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
