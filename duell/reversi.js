export const SIZE = 8;
export const EMPTY = 0;
export const PLAYER_ONE = 1;
export const PLAYER_TWO = 2;

const DIRECTIONS = Object.freeze([
  Object.freeze({ row: -1, column: -1 }), Object.freeze({ row: -1, column: 0 }), Object.freeze({ row: -1, column: 1 }),
  Object.freeze({ row: 0, column: -1 }), Object.freeze({ row: 0, column: 1 }),
  Object.freeze({ row: 1, column: -1 }), Object.freeze({ row: 1, column: 0 }), Object.freeze({ row: 1, column: 1 }),
]);

export function boardIndex(row, column) {
  return row * SIZE + column;
}

function inside(row, column) {
  return row >= 0 && row < SIZE && column >= 0 && column < SIZE;
}

export function createReversi() {
  const board = Array(SIZE * SIZE).fill(EMPTY);
  board[boardIndex(3, 3)] = PLAYER_TWO;
  board[boardIndex(4, 4)] = PLAYER_TWO;
  board[boardIndex(3, 4)] = PLAYER_ONE;
  board[boardIndex(4, 3)] = PLAYER_ONE;
  return {
    board,
    current: PLAYER_ONE,
    status: 'playing',
    winner: EMPTY,
    moves: 0,
    passedPlayer: EMPTY,
  };
}

export function pieceCounts(board) {
  let one = 0;
  let two = 0;
  for (const cell of board) {
    if (cell === PLAYER_ONE) one += 1;
    else if (cell === PLAYER_TWO) two += 1;
  }
  return { one, two, empty: SIZE * SIZE - one - two };
}

export function flipsForMove(board, index, player) {
  if (!Array.isArray(board) || board.length !== SIZE * SIZE || !Number.isInteger(index) || index < 0 || index >= board.length || board[index] !== EMPTY || ![PLAYER_ONE, PLAYER_TWO].includes(player)) return [];
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const opponent = player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
  const flips = [];

  for (const direction of DIRECTIONS) {
    const line = [];
    let nextRow = row + direction.row;
    let nextColumn = column + direction.column;
    while (inside(nextRow, nextColumn) && board[boardIndex(nextRow, nextColumn)] === opponent) {
      line.push(boardIndex(nextRow, nextColumn));
      nextRow += direction.row;
      nextColumn += direction.column;
    }
    if (line.length && inside(nextRow, nextColumn) && board[boardIndex(nextRow, nextColumn)] === player) flips.push(...line);
  }
  return flips;
}

export function legalMoves(stateOrBoard, player = stateOrBoard?.current) {
  const board = Array.isArray(stateOrBoard) ? stateOrBoard : stateOrBoard?.board;
  if (!Array.isArray(board) || board.length !== SIZE * SIZE || ![PLAYER_ONE, PLAYER_TWO].includes(player)) return [];
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    if (flipsForMove(board, index, player).length) moves.push(index);
  }
  return moves;
}

function resultForBoard(board, base) {
  const counts = pieceCounts(board);
  const winner = counts.one === counts.two ? EMPTY : counts.one > counts.two ? PLAYER_ONE : PLAYER_TWO;
  return { ...base, board, status: counts.one === counts.two ? 'draw' : 'won', winner, passedPlayer: EMPTY };
}

export function playReversi(state, index) {
  if (!state || state.status !== 'playing') return state;
  const flips = flipsForMove(state.board, index, state.current);
  if (!flips.length) return state;

  const board = [...state.board];
  board[index] = state.current;
  for (const flip of flips) board[flip] = state.current;
  const moves = state.moves + 1;
  const opponent = state.current === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
  const opponentMoves = legalMoves(board, opponent);
  if (opponentMoves.length) {
    return { ...state, board, moves, current: opponent, passedPlayer: EMPTY };
  }

  const currentMoves = legalMoves(board, state.current);
  if (currentMoves.length) {
    return { ...state, board, moves, current: state.current, passedPlayer: opponent };
  }

  return resultForBoard(board, { ...state, moves });
}

export function finishIfBlocked(state) {
  if (!state || state.status !== 'playing') return state;
  if (legalMoves(state, state.current).length) return state;
  const opponent = state.current === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
  if (legalMoves(state, opponent).length) return { ...state, current: opponent, passedPlayer: state.current };
  return resultForBoard([...state.board], state);
}
