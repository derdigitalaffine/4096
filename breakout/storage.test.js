import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, getSafeStorage, loadBest, saveBest } from './storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

test('missing or corrupt best score safely falls back to zero', () => {
  const storage = memoryStorage();
  assert.equal(loadBest(storage), 0);
  storage.setItem(STORAGE_KEY, '{bad');
  assert.equal(loadBest(storage), 0);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  storage.setItem(STORAGE_KEY, JSON.stringify(-4));
  assert.equal(loadBest(storage), 0);
});

test('valid best score round-trips as compact local JSON', () => {
  const storage = memoryStorage();
  assert.equal(saveBest(storage, 2300), true);
  assert.equal(loadBest(storage), 2300);
  assert.equal(storage.getItem(STORAGE_KEY), '2300');
});

test('blocked storage is tolerated by probe, load and save', () => {
  const scope = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(getSafeStorage(scope), null);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(loadBest(broken), 0);
  assert.equal(saveBest(broken, 100), false);
});
