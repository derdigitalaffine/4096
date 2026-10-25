import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST, createGame } from './game.js';
import { STORAGE_KEY, clearGame, getSafeStorage, loadGame, saveGame } from './storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

test('save and load preserve valid quest state', () => {
  const storage = memoryStorage();
  const state = createGame();
  state.quest = QUEST.GET_BLADE;
  state.message = 'Fortsetzung';
  assert.equal(saveGame(storage, state), true);
  assert.deepEqual(loadGame(storage), state);
});

test('corrupt or semantically invalid saves recover to a fresh game', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  assert.deepEqual(loadGame(storage), createGame());
  assert.equal(storage.getItem(STORAGE_KEY), null);

  const invalid = createGame();
  invalid.quest = QUEST.RETURN_HOME;
  storage.setItem(STORAGE_KEY, JSON.stringify(invalid));
  assert.deepEqual(loadGame(storage), createGame());
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('blocked storage never prevents startup', () => {
  const blockedRoot = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(getSafeStorage(blockedRoot), null);
  assert.deepEqual(loadGame(null), createGame());
  assert.equal(saveGame(null, createGame()), false);
  assert.equal(clearGame(null), false);
});

test('clearGame removes the continuation', () => {
  const storage = memoryStorage();
  saveGame(storage, createGame());
  assert.ok(storage.getItem(STORAGE_KEY));
  assert.equal(clearGame(storage), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
