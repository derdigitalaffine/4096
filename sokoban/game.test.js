import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './levels.js';
import { createGame, movePlayer, parseLevel, restartLevel, restoreGame, serializeGame, undoMove, validateLevels } from './game.js';

const directionFor = { U: 'up', D: 'down', L: 'left', R: 'right' };

function replay(levelIndex, sequence) {
  let state = createGame(levelIndex);
  for (const key of sequence) state = movePlayer(state, directionFor[key]);
  return state;
}

test('all handcrafted levels validate and expose balanced crates/goals', () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(validateLevels(), true);
  for (const level of LEVELS) {
    const parsed = parseLevel(level);
    assert.equal(parsed.crates.length, parsed.goals.length);
    assert.ok(parsed.crates.length >= 1);
  }
});

test('wall moves and blocked pushes are rejected without changing history', () => {
  let state = createGame(0);
  const wall = movePlayer(state, 'down');
  assert.equal(wall, state);
  state = movePlayer(state, 'up');
  assert.equal(state.won, true);
  assert.equal(state.moves, 1);
  assert.equal(state.pushes, 1);
  assert.equal(state.history.length, 1);
});

test('undo reconstructs multiple valid moves exactly', () => {
  let state = createGame(2);
  const start = serializeGame(state);
  state = movePlayer(state, 'up');
  state = movePlayer(state, 'up');
  state = movePlayer(state, 'right');
  assert.equal(state.history.length, 3);
  state = undoMove(undoMove(undoMove(state)));
  assert.deepEqual(serializeGame(state), start);
  assert.equal(state.history.length, 0);
});

test('restart restores the current level baseline', () => {
  let state = createGame(1);
  state = movePlayer(state, 'up');
  assert.notDeepEqual(serializeGame(state), serializeGame(createGame(1)));
  assert.deepEqual(serializeGame(restartLevel(state)), serializeGame(createGame(1)));
});

test('every level ships with a verified reference solution', () => {
  LEVELS.forEach((level, index) => {
    const solved = replay(index, level.solution);
    assert.equal(solved.won, true, `${level.id} reference solution does not solve the level.`);
    assert.ok(solved.pushes >= 1);
  });
});

test('serialized games restore only valid floor positions and counters', () => {
  let state = createGame(3);
  state = movePlayer(state, 'left');
  const restored = restoreGame(serializeGame(state));
  assert.deepEqual(serializeGame(restored), serializeGame(state));
  assert.equal(restored.history.length, 0);

  assert.equal(restoreGame({ ...serializeGame(state), player: { x: 0, y: 0 } }), null);
  assert.equal(restoreGame({ ...serializeGame(state), pushes: 99 }), null);
  assert.equal(restoreGame({ ...serializeGame(state), crates: [state.crates[0], state.crates[0]] }), null);
});
