import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyStats, getSafeStorage, loadStats, recordResult, saveStats } from './storage.js';

function memoryStorage(initial = new Map()) {
  const data = new Map(initial);
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    data,
  };
}

test('fehlender oder gesperrter Storage blockiert keine Partie', () => {
  assert.deepEqual(loadStats(null), emptyStats());
  const root = {};
  Object.defineProperty(root, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getSafeStorage(root), null);
});

test('Siege und Remis werden pro Spielmodus getrennt gezählt', () => {
  let stats = emptyStats();
  stats = recordResult(stats, 'connect-four', 1);
  stats = recordResult(stats, 'connect-four', 0);
  stats = recordResult(stats, 'reversi', 2);
  assert.deepEqual(stats['connect-four'], { games: 2, p1: 1, p2: 0, draws: 1 });
  assert.deepEqual(stats.reversi, { games: 1, p1: 0, p2: 1, draws: 0 });
});

test('gültige Statistik wird gespeichert und unverändert wieder geladen', () => {
  const storage = memoryStorage();
  const stats = recordResult(recordResult(emptyStats(), 'reversi', 1), 'reversi', 2);
  assert.equal(saveStats(storage, stats), true);
  assert.deepEqual(loadStats(storage), stats);
});

test('kaputte oder semantisch widersprüchliche Statistik wird entfernt', () => {
  const invalid = [
    '{broken',
    JSON.stringify({ version: 1, 'connect-four': { games: 2, p1: 2, p2: 2, draws: 0 }, reversi: { games: 0, p1: 0, p2: 0, draws: 0 } }),
    JSON.stringify({ version: 2, 'connect-four': { games: 0, p1: 0, p2: 0, draws: 0 }, reversi: { games: 0, p1: 0, p2: 0, draws: 0 } }),
  ];
  for (const raw of invalid) {
    const storage = memoryStorage([[STORAGE_KEY, raw]]);
    assert.deepEqual(loadStats(storage), emptyStats());
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});
