import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, playMove } from './game.js';
import {
  SESSION_KEY, STATS_KEY, emptyStats, getSafeStorage, loadSession, loadStats, recordAttempt, recordWin,
  saveSession, saveStats,
} from './storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('session round-trips with history and rejects broken saves', () => {
  const storage = memoryStorage();
  const base = createSession(77);
  const session = playMove(base, { zone: 'cascade', index: 0, cardIndex: base.game.cascades[0].length - 1 }, { zone: 'freecell', index: 0 });
  assert.equal(saveSession(storage, session), true);
  assert.deepEqual(loadSession(storage), session);
  storage.setItem(SESSION_KEY, '{broken');
  assert.equal(loadSession(storage), null);
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test('stats track attempts and wins without allowing impossible totals', () => {
  let stats = emptyStats();
  stats = recordAttempt(stats);
  stats = recordAttempt(stats);
  stats = recordWin(stats);
  assert.deepEqual(stats, { attempts: 2, wins: 1 });
  const storage = memoryStorage();
  assert.equal(saveStats(storage, stats), true);
  assert.deepEqual(loadStats(storage), stats);
  storage.setItem(STATS_KEY, JSON.stringify({ version: 1, attempts: 1, wins: 2 }));
  assert.deepEqual(loadStats(storage), emptyStats());
  assert.equal(storage.getItem(STATS_KEY), null);
});

test('blocked storage degrades to null/false instead of throwing', () => {
  const scope = { get localStorage() { throw new Error('blocked'); } };
  assert.equal(getSafeStorage(scope), null);
  assert.equal(saveSession(null, createSession(1)), false);
  assert.equal(saveStats(null, { attempts: 0, wins: 0 }), false);
});
