import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, getSafeStorage, loadBest, recordBest, saveBest } from './storage.js';

function memoryStorage(initial = new Map()) {
  const data = new Map(initial);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    data,
  };
}

test('fehlender oder gesperrter Storage fällt auf 0 zurück', () => {
  assert.equal(loadBest(null), 0);
  const root = {};
  Object.defineProperty(root, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getSafeStorage(root), null);
});

test('gültiger Bestwert wird geladen, höherer Wert gewinnt', () => {
  const storage = memoryStorage([[STORAGE_KEY, '1200']]);
  assert.equal(loadBest(storage), 1200);
  assert.equal(recordBest(1200, 900), 1200);
  assert.equal(recordBest(1200, 1800), 1800);
  assert.equal(saveBest(storage, 1800), true);
  assert.equal(storage.getItem(STORAGE_KEY), '1800');
});

test('kaputter oder semantisch ungültiger Storage wird verworfen', () => {
  for (const raw of ['{broken', '-3', '1.5', '"900"']) {
    const storage = memoryStorage([[STORAGE_KEY, raw]]);
    assert.equal(loadBest(storage), 0);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});
