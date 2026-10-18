import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
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

async function dumpRenderedDom(browserPath, url, profileDir) {
  const browser = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-gpu',
    '--no-default-browser-check',
    '--no-first-run',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
    '--dump-dom',
    `--user-data-dir=${profileDir}`,
    url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  browser.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  browser.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 12_000) stderr = stderr.slice(-12_000);
  });

  const [code, signal] = await once(browser, 'close');
  assert.equal(code, 0, `Chrome-DOM-Smoke fehlgeschlagen${signal ? ` (${signal})` : ''}:\n${stderr.trim()}`);
  return stdout;
}

const browserPath = findBrowser();
const profileDir = await mkdtemp(join(tmpdir(), '4096-dr-mario-smoke-'));
const { server, url } = await startStaticServer();

try {
  const dom = await dumpRenderedDom(browserPath, url, profileDir);
  const cells = dom.match(/class="dm-cell(?:\s|")/g) ?? [];

  assert.equal(cells.length, 128, `Dr.-Mario-Flasche hat ${cells.length} statt 128 gerenderte Zellen.`);
  assert.match(dom, /id="bottle"[^>]*role="grid"/);
  assert.match(dom, /id="connection-status"[^>]*data-offline-ready="true"/);
  assert.match(dom, /Online · offline bereit/);
  assert.match(dom, /id="viruses"[^>]*>\d+</);

  console.log('browser-smoke: dr-mario online + service-worker ready + 128 cells');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  } catch (error) {
    console.warn(`browser-smoke: Dr.-Mario-Profil konnte nicht vollständig entfernt werden (${error.code ?? 'unknown'}).`);
  }
}
