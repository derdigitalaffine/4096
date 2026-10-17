import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRandomTile,
  applyTurn,
  canMove,
  emptyBoard,
  hasWon,
  isValidBoard,
  mergeLine,
  moveBoard,
  newBoard,
} from './game.js';

test('isValidBoard accepts empty cells and powers of two only', () => {
  assert.equal(isValidBoard([[0, 2, 4, 8], [16, 32, 64, 128], [256, 512, 1024, 2048], [4096, 8192, 0, 0]]), true);

  for (const invalid of [1, 3, -2, 2.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
    const board = emptyBoard();
    board[0][0] = invalid;
    assert.equal(isValidBoard(board), false, `expected ${invalid} to be rejected`);
  }
});

test('mergeLine merges each tile at most once', () => {
  assert.deepEqual(mergeLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], scoreGain: 8 });
  assert.deepEqual(mergeLine([4, 4, 8, 0]), { line: [8, 8, 0, 0], scoreGain: 8 });
  assert.deepEqual(mergeLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], scoreGain: 4 });
});

test('moveBoard moves and scores in every direction', () => {
  const board = [
    [2, 0, 2, 2],
    [4, 4, 0, 0],
    [0, 2, 0, 2],
    [0, 0, 0, 0],
  ];

  const left = moveBoard(board, 'left');
  assert.deepEqual(left.board, [
    [4, 2, 0, 0],
    [8, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(left.scoreGain, 16);

  const right = moveBoard([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right');
  assert.deepEqual(right.board[0], [0, 0, 4, 8]);

  const up = moveBoard([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]], 'up');
  assert.deepEqual(up.board.map((row) => row[0]), [4, 8, 0, 0]);

  const down = moveBoard([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]], 'down');
  assert.deepEqual(down.board.map((row) => row[0]), [0, 0, 4, 8]);
});

test('ineffective move is reported without mutation', () => {
  const board = [[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const result = moveBoard(board, 'left');
  assert.equal(result.moved, false);
  assert.deepEqual(result.board, board);
});

test('random tile only uses empty cells and creates 2 or 4', () => {
  const board = emptyBoard();
  board[0][0] = 8;
  const values = [0, 0.95];
  const next = addRandomTile(board, () => values.shift());
  assert.equal(next[0][0], 8);
  assert.equal(next[0][1], 4);
});

test('applyTurn spawns exactly one tile after a valid move and preserves score gain', () => {
  const board = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const values = [0, 0];
  const result = applyTurn(board, 'left', () => values.shift());

  assert.equal(result.moved, true);
  assert.equal(result.scoreGain, 4);
  assert.deepEqual(result.board[0], [4, 2, 0, 0]);
  assert.equal(result.board.flat().filter(Boolean).length, 2);
});

test('applyTurn does not spawn or consume randomness after an ineffective move', () => {
  const board = [[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  let randomCalls = 0;
  const result = applyTurn(board, 'left', () => {
    randomCalls += 1;
    return 0;
  });

  assert.equal(result.moved, false);
  assert.equal(result.scoreGain, 0);
  assert.equal(randomCalls, 0);
  assert.deepEqual(result.board, board);
});

test('new board starts with exactly two tiles', () => {
  const values = [0, 0, 0.5, 0];
  const board = newBoard(() => values.shift());
  assert.equal(board.flat().filter(Boolean).length, 2);
});

test('win and game-over detection', () => {
  assert.equal(hasWon([[4096, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), true);

  const locked = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];
  assert.equal(canMove(locked), false);

  const mergeAvailable = locked.map((row) => [...row]);
  mergeAvailable[3][3] = 4;
  assert.equal(canMove(mergeAvailable), true);
});
