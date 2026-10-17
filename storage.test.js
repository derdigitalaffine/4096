import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEST_KEY,
  STORAGE_KEY,
  getSafeStorage,
  persistStoredState,
  readBestScore,
  restoreStoredState,
} from './storage.js';

const validBoard = [
  [2, 4, 0, 0],
  [8, 16, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test('getSafeStorage tolerates an unavailable localStorage getter', () => {
  const source = Object.create(null, {
    localStorage: {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    },
  });
  assert.equal(getSafeStorage(source), null);
});

test('restoreStoredState keeps compatible v1 saves and monotonic best score', () => {
  const storage = new MemoryStorage([
    [BEST_KEY, '64'],
    [STORAGE_KEY, JSON.stringify({ board: validBoard, score: 32, best: 16, wonAcknowledged: false })],
  ]);

  assert.deepEqual(restoreStoredState(storage), {
    board: validBoard,
    score: 32,
    best: 64,
    wonAcknowledged: false,
    undo: null,
  });
});

test('restoreStoredState restores a valid one-level undo snapshot', () => {
  const undoBoard = validBoard.map((row) => [...row]);
  undoBoard[0][1] = 0;
  const storage = new MemoryStorage([
    [STORAGE_KEY, JSON.stringify({
      board: validBoard,
      score: 24,
      best: 40,
      wonAcknowledged: true,
      undo: { board: undoBoard, score: 16, wonAcknowledged: false },
    })],
  ]);

  assert.deepEqual(restoreStoredState(storage)?.undo, {
    board: undoBoard,
    score: 16,
    wonAcknowledged: false,
  });
});

test('restoreStoredState rejects corrupt JSON, invalid boards and invalid scores', () => {
  assert.equal(restoreStoredState(new MemoryStorage([[STORAGE_KEY, '{bad json']])), null);

  const invalidBoard = validBoard.map((row) => [...row]);
  invalidBoard[0][0] = 3;
  assert.equal(restoreStoredState(new MemoryStorage([[
    STORAGE_KEY,
    JSON.stringify({ board: invalidBoard, score: 0, best: 0, wonAcknowledged: false }),
  ]])), null);

  assert.equal(restoreStoredState(new MemoryStorage([[
    STORAGE_KEY,
    JSON.stringify({ board: validBoard, score: 1.5, best: 0, wonAcknowledged: false }),
  ]])), null);
});

test('invalid undo snapshot is discarded without losing an otherwise valid save', () => {
  const storage = new MemoryStorage([[
    STORAGE_KEY,
    JSON.stringify({
      board: validBoard,
      score: 8,
      best: 8,
      wonAcknowledged: false,
      undo: { board: validBoard, score: 16, wonAcknowledged: false },
    }),
  ]]);

  assert.equal(restoreStoredState(storage)?.undo, null);
});

test('storage read and write failures degrade to safe defaults', () => {
  const throwingStorage = {
    getItem() {
      throw new DOMException('blocked', 'SecurityError');
    },
    setItem() {
      throw new DOMException('blocked', 'SecurityError');
    },
  };

  assert.equal(readBestScore(throwingStorage), 0);
  assert.equal(restoreStoredState(throwingStorage), null);
  assert.equal(persistStoredState(throwingStorage, { best: 10 }), false);
});

test('persistStoredState stores state and best score when storage is available', () => {
  const storage = new MemoryStorage();
  const state = { board: validBoard, score: 8, best: 24, wonAcknowledged: false, undo: null };

  assert.equal(persistStoredState(storage, state), true);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), state);
  assert.equal(storage.getItem(BEST_KEY), '24');
});
