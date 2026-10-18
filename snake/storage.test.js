import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyHighscores, getSafeStorage, isValidHighscores, loadHighscores, recordHighscore, saveHighscores } from './storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    read: (key) => data.get(key),
  };
}

test('empty highscores contain every Snake mode', () => {
  assert.deepEqual(emptyHighscores(), { classic: 0, speed: 0, maze: 0 });
  assert.equal(isValidHighscores(emptyHighscores()), true);
});

test('valid highscores restore and only improve monotonically', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ classic: 40, speed: 80, maze: 20 }) });
  const scores = loadHighscores(storage);
  assert.deepEqual(scores, { classic: 40, speed: 80, maze: 20 });
  assert.deepEqual(recordHighscore(scores, 'classic', 30), scores);
  assert.deepEqual(recordHighscore(scores, 'classic', 70), { classic: 70, speed: 80, maze: 20 });
});

test('malformed and structurally invalid storage is discarded safely', () => {
  const malformed = memoryStorage({ [STORAGE_KEY]: '{oops' });
  assert.deepEqual(loadHighscores(malformed), emptyHighscores());
  assert.equal(malformed.read(STORAGE_KEY), undefined);

  const invalid = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ classic: 2, speed: -1, maze: 4 }) });
  assert.deepEqual(loadHighscores(invalid), emptyHighscores());
  assert.equal(invalid.read(STORAGE_KEY), undefined);
});

test('storage access and writes may fail without blocking the game', () => {
  const root = {};
  Object.defineProperty(root, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getSafeStorage(root), null);

  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadHighscores(broken), emptyHighscores());
  assert.equal(saveHighscores(broken, emptyHighscores()), false);
});

test('valid highscores persist as compact local JSON', () => {
  const storage = memoryStorage();
  const scores = { classic: 100, speed: 90, maze: 110 };
  assert.equal(saveHighscores(storage, scores), true);
  assert.deepEqual(JSON.parse(storage.read(STORAGE_KEY)), scores);
});
