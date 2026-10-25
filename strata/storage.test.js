import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS } from './levels.js';
import { STORAGE_KEY, emptyProgress, getSafeStorage, isValidProgress, loadProgress, recordWin, saveProgress, selectLevel } from './storage.js';

function fakeStorage(initial = new Map()) {
  return {
    values: initial,
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
}

test('empty progress covers every STRATA puzzle', () => {
  const progress = emptyProgress();
  assert.equal(isValidProgress(progress), true);
  assert.equal(progress.solved.length, LEVELS.length);
  assert.equal(progress.bestActions.length, LEVELS.length);
  assert.equal(progress.bestShifts.length, LEVELS.length);
});

test('progress records solved state and independent best action/shift values', () => {
  let progress = emptyProgress();
  progress = recordWin(progress, 2, 8, 3);
  progress = recordWin(progress, 2, 6, 4);
  progress = recordWin(progress, 2, 9, 2);
  assert.equal(progress.solved[2], true);
  assert.equal(progress.bestActions[2], 6);
  assert.equal(progress.bestShifts[2], 2);
  assert.equal(progress.lastLevel, 2);
});

test('level selection is persisted without requiring unlock grind', () => {
  const progress = selectLevel(emptyProgress(), LEVELS.length - 1);
  assert.equal(progress.lastLevel, LEVELS.length - 1);
});

test('corrupt or blocked storage safely falls back and never prevents start', () => {
  const storage = fakeStorage(new Map([[STORAGE_KEY, '{broken']]));
  assert.deepEqual(loadProgress(storage), emptyProgress());
  assert.equal(storage.values.has(STORAGE_KEY), false);

  const blockedRoot = {};
  Object.defineProperty(blockedRoot, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getSafeStorage(blockedRoot), null);
  assert.deepEqual(loadProgress(null), emptyProgress());
  assert.equal(saveProgress(null, emptyProgress()), false);
});

test('valid progress round-trips through storage', () => {
  const storage = fakeStorage();
  const progress = recordWin(selectLevel(emptyProgress(), 4), 4, 7, 2);
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage), progress);
});
