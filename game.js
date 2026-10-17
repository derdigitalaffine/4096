export const SIZE = 4;
export const TARGET = 4096;

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function isValidBoard(board) {
  return Array.isArray(board) &&
    board.length === SIZE &&
    board.every((row) =>
      Array.isArray(row) &&
      row.length === SIZE &&
      row.every((value) => Number.isInteger(value) && value >= 0)
    );
}

export function mergeLine(line) {
  const compact = line.filter(Boolean);
  const merged = [];
  let scoreGain = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index];
    if (current === compact[index + 1]) {
      const value = current * 2;
      merged.push(value);
      scoreGain += value;
      index += 1;
    } else {
      merged.push(current);
    }
  }

  while (merged.length < SIZE) merged.push(0);
  return { line: merged, scoreGain };
}

function readLine(board, direction, index) {
  if (direction === 'left') return [...board[index]];
  if (direction === 'right') return [...board[index]].reverse();
  if (direction === 'up') return board.map((row) => row[index]);
  if (direction === 'down') return board.map((row) => row[index]).reverse();
  throw new Error(`Unknown direction: ${direction}`);
}

function writeLine(board, direction, index, line) {
  const values = direction === 'right' || direction === 'down' ? [...line].reverse() : line;
  if (direction === 'left' || direction === 'right') {
    board[index] = values;
    return;
  }
  for (let row = 0; row < SIZE; row += 1) board[row][index] = values[row];
}

export function moveBoard(board, direction) {
  if (!isValidBoard(board)) throw new Error('Invalid board');
  const next = cloneBoard(board);
  let scoreGain = 0;

  for (let index = 0; index < SIZE; index += 1) {
    const result = mergeLine(readLine(board, direction, index));
    writeLine(next, direction, index, result.line);
    scoreGain += result.scoreGain;
  }

  const moved = JSON.stringify(next) !== JSON.stringify(board);
  return { board: next, moved, scoreGain };
}

export function emptyCells(board) {
  const cells = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === 0) cells.push([row, col]);
    }
  }
  return cells;
}

export function addRandomTile(board, random = Math.random) {
  const next = cloneBoard(board);
  const cells = emptyCells(next);
  if (!cells.length) return next;

  const cellIndex = Math.min(cells.length - 1, Math.floor(random() * cells.length));
  const [row, col] = cells[cellIndex];
  next[row][col] = random() < 0.9 ? 2 : 4;
  return next;
}

export function playTurn(board, direction, random = Math.random) {
  const result = moveBoard(board, direction);
  if (!result.moved) return result;
  return { ...result, board: addRandomTile(result.board, random) };
}

export function newBoard(random = Math.random) {
  let board = emptyBoard();
  board = addRandomTile(board, random);
  board = addRandomTile(board, random);
  return board;
}

export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= TARGET));
}

export function canMove(board) {
  if (emptyCells(board).length) return true;
  return ['left', 'right', 'up', 'down'].some((direction) => moveBoard(board, direction).moved);
}
