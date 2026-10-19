import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY, PLAYER_ONE, PLAYER_TWO, SIZE, boardIndex, createReversi, finishIfBlocked,
  flipsForMove, legalMoves, pieceCounts, playReversi,
} from './reversi.js';

test('Reversi startet mit Standardstellung und vier legalen Zügen für Spieler 1', () => {
  const state = createReversi();
  assert.equal(state.board.length, SIZE * SIZE);
  assert.deepEqual(pieceCounts(state.board), { one: 2, two: 2, empty: 60 });
  assert.deepEqual(legalMoves(state), [19, 26, 37, 44]);
});

test('legaler Zug dreht eingeschlossene Steine und wechselt den Spieler', () => {
  let state = createReversi();
  state = playReversi(state, 19);
  assert.equal(state.board[19], PLAYER_ONE);
  assert.equal(state.board[27], PLAYER_ONE);
  assert.deepEqual(pieceCounts(state.board), { one: 4, two: 1, empty: 59 });
  assert.equal(state.current, PLAYER_TWO);
  assert.equal(state.moves, 1);
});

test('ungültiger Zug bleibt ohne Seiteneffekt', () => {
  const state = createReversi();
  assert.equal(playReversi(state, boardIndex(0, 0)), state);
  assert.equal(playReversi(state, boardIndex(3, 3)), state);
});

test('ein Zug kann in mehreren Richtungen gleichzeitig drehen', () => {
  const board = Array(SIZE * SIZE).fill(EMPTY);
  const center = boardIndex(3, 3);
  const directions = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
  ];
  for (const [dr, dc] of directions) {
    board[boardIndex(3 + dr, 3 + dc)] = PLAYER_TWO;
    board[boardIndex(3 + dr * 2, 3 + dc * 2)] = PLAYER_ONE;
  }
  const flips = flipsForMove(board, center, PLAYER_ONE);
  assert.equal(flips.length, 8);
  const state = { board, current: PLAYER_ONE, status: 'playing', winner: EMPTY, moves: 0, passedPlayer: EMPTY };
  const next = playReversi(state, center);
  for (const index of flips) assert.equal(next.board[index], PLAYER_ONE);
});

test('fehlende gegnerische Möglichkeit erzeugt einen expliziten Pass-Zug', () => {
  const board = Array(SIZE * SIZE).fill(PLAYER_ONE);
  board[1] = PLAYER_TWO;
  board[2] = EMPTY;
  board[4] = PLAYER_TWO;
  board[5] = EMPTY;
  const state = { board, current: PLAYER_ONE, status: 'playing', winner: EMPTY, moves: 0, passedPlayer: EMPTY };
  const next = playReversi(state, 2);
  assert.equal(next.status, 'playing');
  assert.equal(next.current, PLAYER_ONE);
  assert.equal(next.passedPlayer, PLAYER_TWO);
  assert.deepEqual(legalMoves(next), [5]);
});

test('wenn beide Seiten blockiert sind, entscheidet die Steinzahl', () => {
  const board = Array(SIZE * SIZE).fill(PLAYER_ONE);
  board[0] = PLAYER_TWO;
  board[1] = PLAYER_TWO;
  const state = { board, current: PLAYER_TWO, status: 'playing', winner: EMPTY, moves: 50, passedPlayer: EMPTY };
  const next = finishIfBlocked(state);
  assert.equal(next.status, 'won');
  assert.equal(next.winner, PLAYER_ONE);
  assert.deepEqual(pieceCounts(next.board), { one: 62, two: 2, empty: 0 });
});

test('Endstand kann auch Remis sein', () => {
  const board = Array.from({ length: SIZE * SIZE }, (_, index) => index % 2 ? PLAYER_ONE : PLAYER_TWO);
  const state = { board, current: PLAYER_ONE, status: 'playing', winner: EMPTY, moves: 60, passedPlayer: EMPTY };
  const next = finishIfBlocked(state);
  assert.equal(next.status, 'draw');
  assert.equal(next.winner, EMPTY);
  assert.deepEqual(pieceCounts(next.board), { one: 32, two: 32, empty: 0 });
});
