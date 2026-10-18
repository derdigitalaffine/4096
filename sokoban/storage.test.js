import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, movePlayer } from './game.js';
import { STORAGE_KEY, emptyProgress, loadProgress, recordCompletion, saveProgress, withResume } from './storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

test('missing and malformed progress recover to a fresh unlocked first level', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadProgress(storage), emptyProgress());
  storage.setItem(STORAGE_KEY, '{oops');
  assert.deepEqual(loadProgress(storage), emptyProgress());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('resume state saves and restores through validated progress', () => {
  const storage = memoryStorage();
  let game = createGame(0);
  game = movePlayer(game, 'down');
  const progress = withResume(emptyProgress(), game);
  assert.equal(saveProgress(storage, progress), true);
  const loaded = loadProgress(storage);
  assert.equal(loaded.resume.levelIndex, 0);
  assert.equal(loaded.resume.moves, game.moves);
});

test('completing a level unlocks the next level and keeps the better score', () => {
  let game = movePlayer(createGame(0), 'up');
  let progress = recordCompletion(emptyProgress(), game);
  assert.equal(progress.unlocked, 2);
  assert.deepEqual(progress.best['first-push'], { moves: 1, pushes: 1 });
  assert.equal(progress.resume, null);

  const worse = { ...game, moves: 5, pushes: 2 };
  progress = recordCompletion(progress, worse);
  assert.deepEqual(progress.best['first-push'], { moves: 1, pushes: 1 });
});

test('storage failures never block gameplay state creation', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadProgress(broken), emptyProgress());
  assert.equal(saveProgress(broken, emptyProgress()), false);
});
