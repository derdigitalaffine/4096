import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES, DIFFICULTY_IDS, armGame, createGame, neighborIndexes, remainingMines,
  restartGame, revealCell, toggleFlag, validateGame,
} from './game.js';

test('three compact difficulties expose increasing boards and mine counts', () => {
  assert.equal(DIFFICULTY_IDS.length, 3);
  const levels = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id]);
  assert.deepEqual(levels.map(({ rows, columns, mines }) => [rows, columns, mines]), [[8, 8, 10], [9, 9, 16], [10, 10, 24]]);
  for (const id of DIFFICULTY_IDS) assert.equal(validateGame(createGame(id, 7)), true);
});

test('first reveal arms deterministically and guarantees a mine-free zero neighborhood', () => {
  const firstIndex = 27;
  const first = revealCell(createGame('beginner', 12345), firstIndex);
  const second = revealCell(createGame('beginner', 12345), firstIndex);
  assert.equal(first.armed, true);
  assert.equal(first.status, 'playing');
  assert.equal(first.mines[firstIndex], false);
  assert.equal(first.adjacent[firstIndex], 0);
  assert.equal(first.mines.filter(Boolean).length, DIFFICULTIES.beginner.mines);
  assert.deepEqual(first.mines, second.mines);
  for (const neighbor of neighborIndexes(firstIndex, first.rows, first.columns)) assert.equal(first.mines[neighbor], false);
});

test('different seeds produce different deterministic mine layouts', () => {
  const a = armGame(createGame('intermediate', 1), 40);
  const b = armGame(createGame('intermediate', 2), 40);
  assert.notDeepEqual(a.mines, b.mines);
  assert.equal(a.mines.filter(Boolean).length, a.mineCount);
  assert.equal(b.mines.filter(Boolean).length, b.mineCount);
});

test('adjacent numbers equal the actual neighboring mine count', () => {
  const state = armGame(createGame('expert', 77), 55);
  state.adjacent.forEach((count, index) => {
    const expected = neighborIndexes(index, state.rows, state.columns).filter((neighbor) => state.mines[neighbor]).length;
    assert.equal(count, expected);
  });
});

test('flags toggle on hidden cells, cap at mine count and block reveal', () => {
  let state = createGame('beginner', 4);
  state = toggleFlag(state, 0);
  assert.equal(state.flagged[0], true);
  assert.equal(remainingMines(state), 9);
  assert.equal(revealCell(state, 0), state);
  state = toggleFlag(state, 0);
  assert.equal(state.flagged[0], false);
  assert.equal(remainingMines(state), 10);
});

test('zero reveal floods connected safe cells without revealing mines', () => {
  const state = revealCell(createGame('beginner', 9), 27);
  const revealedCount = state.revealed.filter(Boolean).length;
  assert.ok(revealedCount > 1);
  state.revealed.forEach((revealed, index) => {
    if (revealed) assert.equal(state.mines[index], false);
  });
});

test('revealing a mine ends the round and exposes every mine', () => {
  const armed = armGame(createGame('beginner', 18), 27);
  const mineIndex = armed.mines.findIndex(Boolean);
  const lost = revealCell(armed, mineIndex);
  assert.equal(lost.status, 'lost');
  lost.mines.forEach((mine, index) => {
    if (mine) assert.equal(lost.revealed[index], true);
  });
});

test('revealing every safe cell wins and marks exactly the mines as flags', () => {
  let state = revealCell(createGame('beginner', 31), 27);
  for (let index = 0; index < state.mines.length && state.status !== 'won'; index += 1) {
    if (!state.mines[index]) state = revealCell(state, index);
  }
  assert.equal(state.status, 'won');
  assert.deepEqual(state.flagged, state.mines);
  assert.equal(remainingMines(state), 0);
});

test('restart preserves difficulty while resetting board state with a fresh seed', () => {
  const played = revealCell(createGame('expert', 100), 55);
  const restarted = restartGame(played);
  assert.equal(restarted.difficultyId, 'expert');
  assert.equal(restarted.seed, 101);
  assert.equal(restarted.status, 'ready');
  assert.equal(restarted.armed, false);
  assert.equal(restarted.revealed.some(Boolean), false);
});
