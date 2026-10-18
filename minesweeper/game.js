export const DIFFICULTIES = Object.freeze({
  beginner: Object.freeze({ id: 'beginner', name: 'Leicht', rows: 8, columns: 8, mines: 10 }),
  intermediate: Object.freeze({ id: 'intermediate', name: 'Mittel', rows: 9, columns: 9, mines: 16 }),
  expert: Object.freeze({ id: 'expert', name: 'Schwer', rows: 10, columns: 10, mines: 24 }),
});

export const DIFFICULTY_IDS = Object.freeze(Object.keys(DIFFICULTIES));

function difficultyFor(id) {
  const difficulty = DIFFICULTIES[id];
  if (!difficulty) throw new RangeError(`Unknown Minesweeper difficulty: ${id}`);
  return difficulty;
}

function createSeededRandom(seed) {
  let value = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function indexFor(row, column, columns) {
  return row * columns + column;
}

export function coordinatesFor(index, columns) {
  return { row: Math.floor(index / columns), column: index % columns };
}

export function neighborIndexes(index, rows, columns) {
  const { row, column } = coordinatesFor(index, columns);
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns) continue;
      neighbors.push(indexFor(nextRow, nextColumn, columns));
    }
  }
  return neighbors;
}

export function createGame(difficultyId = 'beginner', seed = 1) {
  const difficulty = difficultyFor(difficultyId);
  const cellCount = difficulty.rows * difficulty.columns;
  return {
    difficultyId,
    rows: difficulty.rows,
    columns: difficulty.columns,
    mineCount: difficulty.mines,
    seed: Number(seed) >>> 0,
    armed: false,
    status: 'ready',
    mines: Array(cellCount).fill(false),
    adjacent: Array(cellCount).fill(0),
    revealed: Array(cellCount).fill(false),
    flagged: Array(cellCount).fill(false),
  };
}

function isValidIndex(state, index) {
  return Number.isInteger(index) && index >= 0 && index < state.rows * state.columns;
}

function safeZone(state, firstIndex) {
  return new Set([firstIndex, ...neighborIndexes(firstIndex, state.rows, state.columns)]);
}

export function armGame(state, firstIndex) {
  if (state.armed || !isValidIndex(state, firstIndex)) return state;
  let excluded = safeZone(state, firstIndex);
  const cellCount = state.rows * state.columns;
  if (cellCount - excluded.size < state.mineCount) excluded = new Set([firstIndex]);

  const candidates = Array.from({ length: cellCount }, (_, index) => index).filter((index) => !excluded.has(index));
  const random = createSeededRandom(state.seed);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  const mines = Array(cellCount).fill(false);
  for (const index of candidates.slice(0, state.mineCount)) mines[index] = true;
  const adjacent = mines.map((_, index) => neighborIndexes(index, state.rows, state.columns)
    .reduce((count, neighbor) => count + (mines[neighbor] ? 1 : 0), 0));

  return { ...state, armed: true, status: 'playing', mines, adjacent };
}

export function flaggedCount(state) {
  return state.flagged.reduce((count, flagged) => count + (flagged ? 1 : 0), 0);
}

export function remainingMines(state) {
  return Math.max(0, state.mineCount - flaggedCount(state));
}

export function toggleFlag(state, index) {
  if (!isValidIndex(state, index) || state.revealed[index] || ['won', 'lost'].includes(state.status)) return state;
  if (!state.flagged[index] && flaggedCount(state) >= state.mineCount) return state;
  const flagged = [...state.flagged];
  flagged[index] = !flagged[index];
  return { ...state, flagged };
}

function revealFlood(state, startIndex) {
  const revealed = [...state.revealed];
  const queued = new Set([startIndex]);
  const queue = [startIndex];

  while (queue.length > 0) {
    const index = queue.shift();
    if (state.flagged[index] || state.mines[index]) continue;
    revealed[index] = true;
    if (state.adjacent[index] !== 0) continue;
    for (const neighbor of neighborIndexes(index, state.rows, state.columns)) {
      if (revealed[neighbor] || state.flagged[neighbor] || state.mines[neighbor] || queued.has(neighbor)) continue;
      queued.add(neighbor);
      queue.push(neighbor);
    }
  }
  return revealed;
}

function allSafeCellsRevealed(state, revealed) {
  return revealed.every((isRevealed, index) => state.mines[index] || isRevealed);
}

export function revealCell(state, index) {
  if (!isValidIndex(state, index) || state.flagged[index] || state.revealed[index] || ['won', 'lost'].includes(state.status)) return state;
  let current = state.armed ? state : armGame(state, index);
  if (current === state && !current.armed) return state;

  if (current.mines[index]) {
    const revealed = current.revealed.map((value, cellIndex) => value || current.mines[cellIndex]);
    return { ...current, revealed, status: 'lost' };
  }

  const revealed = revealFlood(current, index);
  if (!allSafeCellsRevealed(current, revealed)) return { ...current, revealed };

  const flagged = current.mines.map(Boolean);
  return { ...current, revealed, flagged, status: 'won' };
}

export function restartGame(state, seed = (state.seed + 1) >>> 0) {
  return createGame(state.difficultyId, seed);
}

export function validateGame(state) {
  const difficulty = difficultyFor(state.difficultyId);
  const cellCount = difficulty.rows * difficulty.columns;
  if (state.rows !== difficulty.rows || state.columns !== difficulty.columns || state.mineCount !== difficulty.mines) return false;
  if (![state.mines, state.adjacent, state.revealed, state.flagged].every((array) => Array.isArray(array) && array.length === cellCount)) return false;
  if (!['ready', 'playing', 'won', 'lost'].includes(state.status)) return false;
  if (state.armed && state.mines.filter(Boolean).length !== state.mineCount) return false;
  if (!state.armed && state.mines.some(Boolean)) return false;
  if (state.adjacent.some((count) => !Number.isInteger(count) || count < 0 || count > 8)) return false;
  return true;
}
