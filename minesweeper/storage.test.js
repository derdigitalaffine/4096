import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyBestTimes, loadBestTimes, recordBestTime, saveBestTimes } from './storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('missing and malformed best-time storage recovers to empty values', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadBestTimes(storage), emptyBestTimes());
  storage.setItem(STORAGE_KEY, '{bad');
  assert.deepEqual(loadBestTimes(storage), emptyBestTimes());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('valid best times round-trip and only improve monotonically', () => {
  const storage = memoryStorage();
  let best = recordBestTime(emptyBestTimes(), 'beginner', 12_340);
  best = recordBestTime(best, 'beginner', 15_000);
  assert.equal(best.beginner, 12_340);
  best = recordBestTime(best, 'beginner', 11_000);
  assert.equal(best.beginner, 11_000);
  assert.equal(saveBestTimes(storage, best), true);
  assert.deepEqual(loadBestTimes(storage), best);
});

test('structurally invalid and impossible best times are discarded', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, best: { beginner: -4 } }) });
  assert.deepEqual(loadBestTimes(storage), emptyBestTimes());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('blocked storage never prevents game startup or score updates', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadBestTimes(broken), emptyBestTimes());
  assert.equal(saveBestTimes(broken, emptyBestTimes()), false);
});
