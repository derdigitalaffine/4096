import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNS, EMPTY, PLAYER_ONE, PLAYER_TWO, ROWS, boardIndex, createConnectFour, dropDisc,
  findWinningLine, legalColumns,
} from './connect-four.js';

test('Vier gewinnt startet leer mit sieben legalen Spalten', () => {
  const state = createConnectFour();
  assert.equal(state.board.length, ROWS * COLUMNS);
  assert.equal(state.board.every((cell) => cell === EMPTY), true);
  assert.deepEqual(legalColumns(state), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(state.current, PLAYER_ONE);
});

test('Steine fallen nach unten und Spieler wechseln', () => {
  let state = createConnectFour();
  state = dropDisc(state, 2);
  assert.equal(state.board[boardIndex(5, 2)], PLAYER_ONE);
  assert.equal(state.current, PLAYER_TWO);
  state = dropDisc(state, 2);
  assert.equal(state.board[boardIndex(4, 2)], PLAYER_TWO);
  assert.equal(state.moves, 2);
});

test('volle und ungültige Spalten ändern den Zustand nicht', () => {
  let state = createConnectFour();
  for (let index = 0; index < ROWS; index += 1) state = dropDisc(state, 0);
  const full = state;
  assert.equal(legalColumns(state).includes(0), false);
  assert.equal(dropDisc(state, 0), full);
  assert.equal(dropDisc(state, -1), full);
  assert.equal(dropDisc(state, 7), full);
});

test('horizontale Viererlinie gewinnt und beendet weitere Züge', () => {
  let state = createConnectFour();
  for (const column of [0, 0, 1, 1, 2, 2, 3]) state = dropDisc(state, column);
  assert.equal(state.status, 'won');
  assert.equal(state.winner, PLAYER_ONE);
  assert.deepEqual(state.winning, [35, 36, 37, 38]);
  assert.equal(dropDisc(state, 4), state);
});

test('vertikale und diagonale Linien werden erkannt', () => {
  const vertical = Array(ROWS * COLUMNS).fill(EMPTY);
  for (let row = 2; row <= 5; row += 1) vertical[boardIndex(row, 4)] = PLAYER_TWO;
  assert.deepEqual(findWinningLine(vertical, PLAYER_TWO), [18, 25, 32, 39]);

  const diagonal = Array(ROWS * COLUMNS).fill(EMPTY);
  diagonal[boardIndex(5, 0)] = PLAYER_ONE;
  diagonal[boardIndex(4, 1)] = PLAYER_ONE;
  diagonal[boardIndex(3, 2)] = PLAYER_ONE;
  diagonal[boardIndex(2, 3)] = PLAYER_ONE;
  assert.deepEqual(findWinningLine(diagonal, PLAYER_ONE), [17, 23, 29, 35]);
});

test('vollständiges Board ohne Viererlinie endet Remis', () => {
  const board = [
    1, 1, 2, 2, 1, 1, 2,
    2, 2, 1, 1, 2, 2, 1,
    1, 1, 2, 2, 1, 1, 2,
    2, 2, 1, 1, 2, 2, 1,
    1, 1, 2, 2, 1, 1, 2,
    2, 2, 1, 1, 2, 2, 1,
  ];
  board[0] = EMPTY;
  const state = { board, current: PLAYER_ONE, status: 'playing', winner: EMPTY, moves: 41, winning: [] };
  const next = dropDisc(state, 0);
  assert.equal(next.status, 'draw');
  assert.equal(next.winner, EMPTY);
  assert.equal(next.moves, 42);
  assert.deepEqual(next.winning, []);
});
