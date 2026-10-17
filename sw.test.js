import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const workerSource = readFileSync('sw.js', 'utf8');
const origin = 'https://example.test';

function cacheKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function loadWorker({ fetchImpl, entries = [] }) {
  const store = new Map(entries);
  const cache = {
    addAll: async () => {},
    put: async (request, response) => {
      store.set(cacheKey(request), response.clone());
    },
  };
  const caches = {
    open: async () => cache,
    match: async (request) => store.get(cacheKey(request))?.clone(),
    keys: async () => ['4096-shell-v6'],
    delete: async () => true,
  };
  const self = {
    addEventListener: () => {},
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    location: { origin },
  };
  const context = vm.createContext({ self, caches, fetch: fetchImpl, URL, Response, Promise });
  vm.runInContext(workerSource, context);
  return { context, store };
}

test('assetResponse returns fresh online content and refreshes a stale cache entry', async () => {
  const asset = `${origin}/app.js`;
  const { context, store } = loadWorker({
    entries: [[asset, new Response('stale')]],
    fetchImpl: async () => new Response('fresh'),
  });

  const response = await context.assetResponse(asset);
  assert.equal(await response.text(), 'fresh');
  assert.equal(await store.get(asset).text(), 'fresh');
});

test('assetResponse falls back to cache when offline', async () => {
  const asset = `${origin}/styles.css`;
  const { context } = loadWorker({
    entries: [[asset, new Response('cached')]],
    fetchImpl: async () => {
      throw new TypeError('offline');
    },
  });

  const response = await context.assetResponse(asset);
  assert.equal(await response.text(), 'cached');
});

test('assetResponse prefers cached shell content over a failed HTTP response', async () => {
  const asset = `${origin}/game.js`;
  const { context } = loadWorker({
    entries: [[asset, new Response('cached')]],
    fetchImpl: async () => new Response('server error', { status: 503 }),
  });

  const response = await context.assetResponse(asset);
  assert.equal(await response.text(), 'cached');
});

test('navigationResponse falls back to cached index on a failed HTTP response', async () => {
  const { context } = loadWorker({
    entries: [['./index.html', new Response('cached index')]],
    fetchImpl: async () => new Response('server error', { status: 503 }),
  });

  const response = await context.navigationResponse(`${origin}/game`);
  assert.equal(await response.text(), 'cached index');
});
