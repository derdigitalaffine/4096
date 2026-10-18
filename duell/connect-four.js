export const ROWS = 6;
export const COLUMNS = 7;
export const EMPTY = 0;
export const PLAYER_ONE = 1;
export const PLAYER_TWO = 2;

const DIRECTIONS = Object.freeze([
  Object.freeze({ row: 0, column: 1 }),
  Object.freeze({ row: 1, column: 0 }),
  Object.freeze({ row: 1, column: 1 }),
  Object.freeze({ row: 1, column: -1 }),
]);

export function boardIndex(row, column) {
  return row * COLUMNS + column;
}

export function createConnectFour() {
  return {
    board: Array(ROWS * COLUMNS).fill(EMPTY),
    current: PLAYER_ONE,
    status: 'playing',
    winner: EMPTY,
    moves: 0,
    winning: [],
  };
}

function inside(row, column) {
  return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS;
}

export function legalColumns(state) {
  if (!state || state.status !== 'playing') return [];
  const columns = [];
  for (let column = 0; column < COLUMNS; column += 1) {
    if (state.board[boardIndex(0, column)] === EMPTY) columns.push(column);
  }
  return columns;
}

export function findWinningLine(board, player) {
  if (!Array.isArray(board) || board.length !== ROWS * COLUMNS || ![PLAYER_ONE, PLAYER_TWO].includes(player)) return [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      if (board[boardIndex(row, column)] !== player) continue;
      for (const direction of DIRECTIONS) {
        const line = [];
        for (let step = 0; step < 4; step += 1) {
          const nextRow = row + direction.row * step;
          const nextColumn = column + direction.column * step;
          if (!inside(nextRow, nextColumn) || board[boardIndex(nextRow, nextColumn)] !== player) break;
          line.push(boardIndex(nextRow, nextColumn));
        }
        if (line.length === 4) return line;
      }
    }
  }
  return [];
}

export function dropDisc(state, column) {
  if (!state || state.status !== 'playing' || !Number.isInteger(column) || column < 0 || column >= COLUMNS) return state;
  let row = ROWS - 1;
  while (row >= 0 && state.board[boardIndex(row, column)] !== EMPTY) row -= 1;
  if (row < 0) return state;

  const board = [...state.board];
  board[boardIndex(row, column)] = state.current;
  const moves = state.moves + 1;
  const winning = findWinningLine(board, state.current);
  if (winning.length) {
    return { ...state, board, moves, status: 'won', winner: state.current, winning };
  }
  if (moves === ROWS * COLUMNS) {
    return { ...state, board, moves, status: 'draw', winner: EMPTY, winning: [] };
  }
  return {
    ...state,
    board,
    moves,
    current: state.current === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE,
    winning: [],
  };
}
