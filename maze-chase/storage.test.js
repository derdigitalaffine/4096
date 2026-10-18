import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, getSafeStorage, loadBest, recordBest, saveBest } from './storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('Bestwert round-tripped und steigt nur bei höherem Score', () => {
  const storage = memoryStorage();
  assert.equal(loadBest(storage), 0);
  assert.equal(recordBest(120, 90), 120);
  assert.equal(recordBest(120, 180), 180);
  assert.equal(saveBest(storage, 180), true);
  assert.equal(loadBest(storage), 180);
});

test('kaputter oder semantisch ungültiger Storage fällt sicher auf null zurück', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{oops');
  assert.equal(loadBest(storage), 0);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: -4 }));
  assert.equal(loadBest(storage), 0);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('gesperrter Storage blockiert weder Lesen noch Schreiben', () => {
  const root = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(getSafeStorage(root), null);
  assert.equal(loadBest(null), 0);
  assert.equal(saveBest(null, 100), false);
});
