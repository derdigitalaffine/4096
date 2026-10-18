const CACHE_NAME = '4096-shell-v17';
const APP_SHELL = [
  './',
  './index.html',
  './home.css',
  './home.js',
  './games.js',
  './game-nav.js',
  './4096/',
  './4096/index.html',
  './styles.css',
  './app.js',
  './connectivity.js',
  './dialog.js',
  './game.js',
  './pointer.js',
  './storage.js',
  './sudoku/',
  './sudoku/index.html',
  './sudoku/styles.css',
  './sudoku/app.js',
  './sudoku/game.js',
  './dr-tromu/',
  './dr-tromu/index.html',
  './dr-tromu/styles.css',
  './dr-tromu/app.js',
  './dr-tromu/game.js',
  './super-tromu-land/',
  './super-tromu-land/index.html',
  './super-tromu-land/styles.css',
  './super-tromu-land/app.js',
  './super-tromu-land/game.js',
  './super-tromu-land/view.js',
  './dr-mario/',
  './dr-mario/index.html',
  './dr-mario/styles.css',
  './dr-mario/app.js',
  './dr-mario/game.js',
  './super-mario-land/',
  './super-mario-land/index.html',
  './super-mario-land/styles.css',
  './super-mario-land/app.js',
  './super-mario-land/game.js',
  './super-mario-land/view.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cachedNavigationResponse(request) {
  return (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
}

function canonicalDirectoryUrl(request) {
  const url = new URL(typeof request === 'string' ? request : request.url);
  if (url.pathname.endsWith('/')) return null;

  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  if (!lastSegment || lastSegment.includes('.')) return null;

  url.pathname = `${url.pathname}/`;
  return url;
}

async function cachedCanonicalRedirect(request) {
  const canonicalUrl = canonicalDirectoryUrl(request);
  if (!canonicalUrl) return null;

  const cached = await caches.match(canonicalUrl.href, { ignoreSearch: true });
  return cached ? Response.redirect(canonicalUrl.href, 302) : null;
}

async function navigationResponse(request) {
  const canonicalRedirect = await cachedCanonicalRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;

  const cachedRequest = await cachedNavigationResponse(request);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    return cachedRequest || (await caches.match('./index.html')) || (await caches.match('./')) || response;
  } catch {
    return cachedRequest || (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
  }
}

async function assetResponse(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    return (await caches.match(request)) || response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(assetResponse(request));
});
