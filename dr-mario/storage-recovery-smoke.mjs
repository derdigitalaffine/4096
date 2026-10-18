import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
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

function recoveryProbeHtml() {
  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>pending</title></head>
<body>
  <iframe id="game" title="Dr.-Mario-Recovery-Probe"></iframe>
  <script>
    const STORAGE_KEY = 'dr-mario-state-v1';
    const frame = document.querySelector('#game');
    const results = [];

    function snapshot(name) {
      let stored = null;
      let parseable = true;
      try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      } catch {
        parseable = false;
      }

      const gameDocument = frame.contentDocument;
      const boardVirusCount = Array.isArray(stored?.board)
        ? stored.board.filter((cell) => cell?.type === 'virus').length
        : -1;

      return {
        name,
        parseable,
        boardLength: stored?.board?.length ?? -1,
        boardVirusCount,
        active: Boolean(stored?.active),
        nextColorsLength: stored?.nextColors?.length ?? -1,
        score: stored?.score ?? -1,
        viruses: stored?.viruses ?? -1,
        status: stored?.status ?? null,
        cellCount: gameDocument?.querySelectorAll('.dm-cell').length ?? -1,
        scoreText: gameDocument?.querySelector('#score')?.textContent ?? null,
        virusText: gameDocument?.querySelector('#viruses')?.textContent ?? null,
        controlsEnabled: gameDocument?.querySelector('#move-left')?.disabled === false,
      };
    }

    async function runCase(name, rawValue) {
      localStorage.setItem(STORAGE_KEY, rawValue);
      await new Promise((resolveLoad, reject) => {
        const timeout = setTimeout(() => reject(new Error('iframe load timeout: ' + name)), 1500);
        frame.onload = () => {
          clearTimeout(timeout);
          resolveLoad();
        };
        frame.src = '/dr-mario/?storage-recovery=' + encodeURIComponent(name) + '-' + Date.now();
      });
      results.push(snapshot(name));
    }

    (async () => {
      await runCase('malformed-json', '{not-valid-json');
      await runCase('incompatible-state', JSON.stringify({
        board: Array(127).fill(null),
        active: null,
        nextColors: ['red', 'blue'],
        score: 900,
        viruses: 0,
        status: 'playing',
      }));

      document.title = btoa(JSON.stringify(results));
      document.documentElement.dataset.done = 'true';
    })().catch((error) => {
      document.title = 'ERROR-' + btoa(String(error?.stack || error));
      document.documentElement.dataset.done = 'error';
    });
  </script>
</body>
</html>`;
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      if (requestUrl.pathname === '/__dr-mario-storage-recovery-probe') {
        response.writeHead(200, {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/html; charset=utf-8',
        });
        response.end(recoveryProbeHtml());
        return;
      }

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
    url: `http://127.0.0.1:${server.address().port}/__dr-mario-storage-recovery-probe`,
  };
}

async function runBrowser(browserPath, profileDir, url) {
  const browser = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-gpu',
    '--no-default-browser-check',
    '--no-first-run',
    '--virtual-time-budget=3000',
    '--dump-dom',
    `--user-data-dir=${profileDir}`,
    url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  browser.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  browser.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  return new Promise((resolveRun, reject) => {
    const timeout = setTimeout(() => {
      browser.kill('SIGKILL');
      reject(new Error(`Chrome-Recovery-Smoke lief in ein Timeout.\n${stderr.slice(-4000)}`));
    }, 15_000);

    browser.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    browser.on('close', (code) => {
      clearTimeout(timeout);
      resolveRun({ code, stdout, stderr });
    });
  });
}

function assertRecovered(result) {
  assert.equal(result.parseable, true, `${result.name}: Storage wurde nicht durch valides JSON ersetzt.`);
  assert.equal(result.boardLength, 128, `${result.name}: frische Flasche hat nicht 128 Zellen.`);
  assert.equal(result.score, 0, `${result.name}: frische Runde startet nicht mit 0 Punkten.`);
  assert.equal(result.status, 'playing', `${result.name}: frische Runde ist nicht spielbar.`);
  assert.equal(result.active, true, `${result.name}: frische Runde besitzt keine aktive Kapsel.`);
  assert.equal(result.nextColorsLength, 2, `${result.name}: nächste Kapsel ist nicht vollständig.`);
  assert.ok(result.viruses > 0, `${result.name}: frische Runde enthält keine Viren.`);
  assert.equal(result.boardVirusCount, result.viruses, `${result.name}: gespeicherte Viruszahl passt nicht zur Flasche.`);
  assert.equal(result.cellCount, 128, `${result.name}: Browseroberfläche rendert nicht 128 Zellen.`);
  assert.equal(result.scoreText, '0', `${result.name}: Browseroberfläche zeigt keinen frischen Punktestand.`);
  assert.equal(Number(result.virusText), result.viruses, `${result.name}: Browseroberfläche zeigt eine falsche Viruszahl.`);
  assert.equal(result.controlsEnabled, true, `${result.name}: Steuerung ist nach Recovery nicht aktiv.`);
}

const profileDir = await mkdtemp(join(tmpdir(), '4096-dr-mario-storage-recovery-'));
const { server, url } = await startStaticServer();

try {
  const run = await runBrowser(findBrowser(), profileDir, url);
  assert.equal(run.code, 0, `Chrome-Recovery-Smoke schlug fehl.\n${run.stderr.slice(-4000)}`);

  const titleMatch = run.stdout.match(/<title>([^<]+)<\/title>/i);
  assert.ok(titleMatch, `Recovery-Probe lieferte kein auswertbares Ergebnis.\n${run.stdout.slice(-2000)}`);
  assert.equal(titleMatch[1].startsWith('ERROR-'), false, `Recovery-Probe meldete einen Browserfehler: ${titleMatch[1]}`);

  const results = JSON.parse(Buffer.from(titleMatch[1], 'base64').toString('utf8'));
  assert.deepEqual(results.map((result) => result.name), ['malformed-json', 'incompatible-state']);
  for (const result of results) assertRecovered(result);

  console.log('browser-smoke: dr-mario malformed localStorage recovery passed');
  console.log('browser-smoke: dr-mario incompatible localStorage recovery passed');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}
