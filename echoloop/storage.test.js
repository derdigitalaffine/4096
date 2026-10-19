import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyProgress, getSafeStorage, loadProgress, recordWin, saveProgress } from './storage.js';

function memoryStorage(initial = new Map()) {
  const data = new Map(initial);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    data,
  };
}

test('fehlender oder gesperrter Storage fällt auf Level 1 zurück', () => {
  assert.deepEqual(loadProgress(null), emptyProgress());
  const root = {};
  Object.defineProperty(root, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getSafeStorage(root), null);
});

test('Sieg speichert besten Loop-Wert und schaltet genau das nächste Level frei', () => {
  let progress = emptyProgress();
  progress = recordWin(progress, 0, 3);
  assert.deepEqual(progress, { version: 1, unlocked: 2, bestLoops: [3, null, null] });
  progress = recordWin(progress, 0, 2);
  assert.deepEqual(progress, { version: 1, unlocked: 2, bestLoops: [2, null, null] });
  progress = recordWin(progress, 1, 4);
  assert.deepEqual(progress, { version: 1, unlocked: 3, bestLoops: [2, 4, null] });
});

test('gültiger Fortschritt wird gespeichert und geladen', () => {
  const storage = memoryStorage();
  const progress = { version: 1, unlocked: 3, bestLoops: [1, 2, 3] };
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage), progress);
});

test('kaputter oder semantisch ungültiger Fortschritt wird entfernt', () => {
  const invalid = [
    '{broken',
    JSON.stringify({ version: 1, unlocked: 4, bestLoops: [1, 2, 3] }),
    JSON.stringify({ version: 1, unlocked: 2, bestLoops: [0, null, null] }),
    JSON.stringify({ version: 2, unlocked: 1, bestLoops: [null, null, null] }),
  ];
  for (const raw of invalid) {
    const storage = memoryStorage([[STORAGE_KEY, raw]]);
    assert.deepEqual(loadProgress(storage), emptyProgress());
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});
