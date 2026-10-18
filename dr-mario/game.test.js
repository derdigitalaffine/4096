import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEIGHT,
  WIDTH,
  boardIndex,
  collapsePills,
  emptyBoard,
  findMatches,
  hardDrop,
  isRestorableState,
  moveActive,
  resolveBoard,
  rotateActive,
} from './game.js';

function playingState(overrides = {}) {
  return {
    board: emptyBoard(),
    active: { x: 3, y: 0, orientation: 'horizontal', colors: ['red', 'blue'] },
    nextColors: ['yellow', 'red'],
    score: 0,
    viruses: 1,
    status: 'playing',
    ...overrides,
  };
}

test('findMatches detects horizontal and vertical runs of four', () => {
  const board = emptyBoard();
  for (let x = 1; x <= 4; x += 1) board[boardIndex(x, 12)] = { color: 'red', type: 'pill' };
  for (let y = 5; y <= 8; y += 1) board[boardIndex(7, y)] = { color: 'blue', type: 'virus' };

  const matches = findMatches(board);
  assert.equal(matches.size, 8);
  assert.equal(matches.has(boardIndex(2, 12)), true);
  assert.equal(matches.has(boardIndex(7, 7)), true);
});

test('resolveBoard clears matched viruses and scores them', () => {
  const board = emptyBoard();
  for (let x = 0; x < 4; x += 1) board[boardIndex(x, HEIGHT - 1)] = { color: 'yellow', type: 'virus' };

  const result = resolveBoard(board);
  assert.equal(result.cleared, 4);
  assert.equal(result.clearedViruses, 4);
  assert.equal(result.chains, 1);
  assert.equal(result.scoreGain, 1600);
  assert.equal(result.board.every((cell) => cell === null), true);
});

test('collapsePills lets loose capsule halves fall until blocked', () => {
  const board = emptyBoard();
  board[boardIndex(2, 7)] = { color: 'blue', type: 'pill' };
  board[boardIndex(2, HEIGHT - 1)] = { color: 'red', type: 'virus' };

  const collapsed = collapsePills(board);
  assert.deepEqual(collapsed[boardIndex(2, HEIGHT - 2)], { color: 'blue', type: 'pill' });
  assert.deepEqual(collapsed[boardIndex(2, HEIGHT - 1)], { color: 'red', type: 'virus' });
});

test('moveActive rejects movement outside the bottle', () => {
  const state = playingState({ active: { x: 0, y: 0, orientation: 'horizontal', colors: ['red', 'blue'] } });
  assert.equal(moveActive(state, -1, 0), state);
  assert.equal(moveActive(state, 1, 0).active.x, 1);
});

test('rotateActive uses a one-cell wall kick when necessary', () => {
  const state = playingState({ active: { x: WIDTH - 1, y: 2, orientation: 'vertical', colors: ['red', 'yellow'] } });
  const rotated = rotateActive(state);
  assert.equal(rotated.active.orientation, 'horizontal');
  assert.equal(rotated.active.x, WIDTH - 2);
});

test('hardDrop locks the capsule and spawns the queued capsule', () => {
  const board = emptyBoard();
  board[boardIndex(0, HEIGHT - 1)] = { color: 'yellow', type: 'virus' };
  const state = playingState({ board });
  const dropped = hardDrop(state, () => 0);

  assert.equal(dropped.status, 'playing');
  assert.deepEqual(dropped.board[boardIndex(3, HEIGHT - 1)], { color: 'red', type: 'pill' });
  assert.deepEqual(dropped.board[boardIndex(4, HEIGHT - 1)], { color: 'blue', type: 'pill' });
  assert.deepEqual(dropped.active.colors, ['yellow', 'red']);
  assert.deepEqual(dropped.nextColors, ['red', 'red']);
});

test('clearing the last viruses ends the round', () => {
  const board = emptyBoard();
  for (let x = 0; x < 3; x += 1) board[boardIndex(x, HEIGHT - 1)] = { color: 'red', type: 'virus' };
  const state = playingState({
    board,
    viruses: 3,
    active: { x: 3, y: 0, orientation: 'horizontal', colors: ['red', 'red'] },
  });

  const won = hardDrop(state, () => 0.5);
  assert.equal(won.status, 'won');
  assert.equal(won.viruses, 0);
  assert.equal(won.active, null);
  assert.ok(won.score > 0);
});

test('isRestorableState accepts a coherent saved game and rejects corrupt state', () => {
  const board = emptyBoard();
  board[boardIndex(0, HEIGHT - 1)] = { color: 'blue', type: 'virus' };
  const state = playingState({ board, viruses: 1 });
  assert.equal(isRestorableState(state), true);
  assert.equal(isRestorableState({ ...state, viruses: 2 }), false);
  assert.equal(isRestorableState({ ...state, board: state.board.slice(1) }), false);
});
