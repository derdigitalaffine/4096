import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS } from './levels.js';
import { composeLayers, createGame, isSolid, movePlayer, redo, runActions, shiftLayer, undo, validateLevel } from './game.js';

const P = (x, y) => ({ x, y });

test('parity composition yields matter only for odd overlap counts 0..4', () => {
  const layers = [0, 1, 2, 3].map((index) => ({ id: String(index), cells: [P(1, 1)] }));
  for (let count = 0; count <= 4; count += 1) {
    const composed = composeLayers(layers.slice(0, count), 3, 3);
    assert.equal(composed.counts.get('1,1') ?? 0, count);
    assert.equal(composed.solid.has('1,1'), count % 2 === 1, `count ${count}`);
  }
});

test('all handcrafted levels validate and their reference solutions solve deterministically', () => {
  assert.equal(LEVELS.length, 10);
  LEVELS.forEach((level, index) => {
    assert.equal(validateLevel(level), true, level.id);
    const a = runActions(createGame(index), level.reference);
    const b = runActions(createGame(index), level.reference);
    assert.equal(a.status, 'won', `${level.id} reference did not solve`);
    assert.deepEqual(a, b, `${level.id} was not deterministic`);
  });
});

test('shortcut level keeps both a valid baseline and a shorter elegant solution', () => {
  const index = LEVELS.findIndex((level) => level.id === 'shortcut-theory');
  const level = LEVELS[index];
  const elegant = runActions(createGame(index), level.reference);
  const baseline = runActions(createGame(index), level.alternate);
  assert.equal(elegant.status, 'won');
  assert.equal(baseline.status, 'won');
  assert.ok(elegant.actions < baseline.actions);
});

test('open-close puzzle opens the center while closing another previously free cell', () => {
  const index = LEVELS.findIndex((level) => level.id === 'open-close');
  const initial = createGame(index);
  assert.equal(isSolid(initial, 3, 3), true);
  assert.equal(isSolid(initial, 3, 2), false);
  const shifted = shiftLayer(initial, 1, 'left');
  assert.equal(isSolid(shifted, 3, 3), false);
  assert.equal(isSolid(shifted, 3, 2), true);
});

test('shifts wrap at board edges and are rejected if they would materialize on the player', () => {
  let state = createGame(8);
  state = shiftLayer(state, 1, 'left');
  assert.equal(state.offsets[1].x, 6, 'left shift wraps offset on a 7-wide board');

  const levelIndex = 0;
  const blocked = createGame(levelIndex);
  const moved = movePlayer(blocked, 'up');
  assert.equal(moved.player.y, 2);
  const shifted = shiftLayer(moved, 1, 'left');
  assert.notEqual(shifted, moved);
});

test('undo and redo reconstruct every accepted state exactly and clear redo after a new branch', () => {
  let state = createGame(0);
  state = shiftLayer(state, 1, 'left');
  state = movePlayer(state, 'right');
  state = movePlayer(state, 'right');
  const snapshot = JSON.parse(JSON.stringify(state));

  state = undo(state);
  state = undo(state);
  assert.equal(state.actions, 1);
  assert.equal(state.future.length, 2);
  state = redo(state);
  state = redo(state);
  assert.deepEqual(state, snapshot);

  state = undo(state);
  state = movePlayer(state, 'left');
  assert.equal(state.future.length, 0);
});
