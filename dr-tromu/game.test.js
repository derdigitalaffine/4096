import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCells,
  emptyBoard,
  isRestorableState,
  rotateActive,
} from './game.js';

function playingState(active) {
  return {
    board: emptyBoard(),
    active,
    nextColors: ['yellow', 'red'],
    score: 0,
    viruses: 0,
    status: 'playing',
  };
}

test('Dr. Tromu rotates a two-color capsule through all four directions', () => {
  let state = playingState({
    x: 3,
    y: 4,
    orientation: 'horizontal',
    rotation: 0,
    colors: ['red', 'blue'],
  });

  assert.deepEqual(activeCells(state.active), [
    { x: 3, y: 4, color: 'red' },
    { x: 4, y: 4, color: 'blue' },
  ]);

  state = rotateActive(state);
  assert.equal(state.active.rotation, 1);
  assert.equal(state.active.orientation, 'vertical');
  assert.deepEqual(activeCells(state.active), [
    { x: 3, y: 4, color: 'red' },
    { x: 3, y: 5, color: 'blue' },
  ]);

  state = rotateActive(state);
  assert.equal(state.active.rotation, 2);
  assert.equal(state.active.orientation, 'horizontal');
  assert.deepEqual(activeCells(state.active), [
    { x: 3, y: 4, color: 'red' },
    { x: 2, y: 4, color: 'blue' },
  ]);

  state = rotateActive(state);
  assert.equal(state.active.rotation, 3);
  assert.equal(state.active.orientation, 'vertical');
  assert.deepEqual(activeCells(state.active), [
    { x: 3, y: 4, color: 'red' },
    { x: 3, y: 3, color: 'blue' },
  ]);

  state = rotateActive(state);
  assert.equal(state.active.rotation, 0);
  assert.equal(state.active.orientation, 'horizontal');
  assert.deepEqual(activeCells(state.active), [
    { x: 3, y: 4, color: 'red' },
    { x: 4, y: 4, color: 'blue' },
  ]);
});

test('rotation applies a one-cell vertical kick at the bottle ceiling', () => {
  const state = playingState({
    x: 3,
    y: 0,
    orientation: 'horizontal',
    rotation: 2,
    colors: ['red', 'yellow'],
  });

  const rotated = rotateActive(state);
  assert.equal(rotated.active.rotation, 3);
  assert.equal(rotated.active.y, 1);
  assert.deepEqual(activeCells(rotated.active), [
    { x: 3, y: 1, color: 'red' },
    { x: 3, y: 0, color: 'yellow' },
  ]);
});

test('saved Dr. Tromu states validate rotation parity and keep legacy saves restorable', () => {
  const legacy = playingState({
    x: 3,
    y: 4,
    orientation: 'vertical',
    colors: ['red', 'blue'],
  });
  assert.equal(isRestorableState(legacy), true);

  const current = playingState({
    x: 3,
    y: 4,
    orientation: 'horizontal',
    rotation: 2,
    colors: ['red', 'blue'],
  });
  assert.equal(isRestorableState(current), true);
  assert.equal(isRestorableState({
    ...current,
    active: { ...current.active, orientation: 'vertical' },
  }), false);
});
