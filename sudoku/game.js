export const BOARD_SIZE = 9;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const DIGITS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const RAW_PUZZLES = [
  {
    id: 'easy-1',
    difficulty: 'easy',
    puzzle: '030769000801253760700800200600030590079648132023000008050080001010005986008420075',
    solution: '235769814841253769796814253684132597579648132123597648357986421412375986968421375',
  },
  {
    id: 'easy-2',
    difficulty: 'easy',
    puzzle: '860590170000806940040210068400000096030089514698001207300900001006142700000370650',
    solution: '863594172271836945549217368415723896732689514698451237387965421956142783124378659',
  },
  {
    id: 'medium-1',
    difficulty: 'medium',
    puzzle: '000800713020701900137006800000000090000000486913060000401000507206073040070004608',
    solution: '649825713528731964137946852864257391752319486913468275491682537286573149375194628',
  },
  {
    id: 'medium-2',
    difficulty: 'medium',
    puzzle: '840000370072480000601002800007000000000325900030090060003000526018250793000970008',
    solution: '849561372372489651651732849987614235164325987235897164793148526418256793526973418',
  },
  {
    id: 'hard-1',
    difficulty: 'hard',
    puzzle: '650004000783000024000000950006045000207000090000102630005400001902780000070000000',
    solution: '659214387783596124421837956836945712217368495594172638365429871942781563178653249',
  },
  {
    id: 'hard-2',
    difficulty: 'hard',
    puzzle: '047300000060000054010050320032009000090000040000240860000038105000070030000100402',
    solution: '547326981263981754819754326432869517698517243175243869724638195951472638386195472',
  },
];

export function parseGrid(encoded) {
  if (typeof encoded !== 'string' || !/^[0-9]{81}$/.test(encoded)) {
    throw new TypeError('Sudoku grid must contain exactly 81 digits.');
  }
  return [...encoded].map(Number);
}

export const PUZZLES = Object.freeze(RAW_PUZZLES.map((entry) => Object.freeze({
  ...entry,
  values: Object.freeze(parseGrid(entry.puzzle)),
  solvedValues: Object.freeze(parseGrid(entry.solution)),
})));

export function getPuzzle(id) {
  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function puzzlesForDifficulty(difficulty) {
  return PUZZLES.filter((puzzle) => puzzle.difficulty === difficulty);
}

export function clueCount(puzzle) {
  return puzzle.values.filter(Boolean).length;
}

export function rowIndexes(index) {
  const row = Math.floor(index / BOARD_SIZE);
  return Array.from({ length: BOARD_SIZE }, (_, offset) => row * BOARD_SIZE + offset);
}

export function columnIndexes(index) {
  const column = index % BOARD_SIZE;
  return Array.from({ length: BOARD_SIZE }, (_, offset) => offset * BOARD_SIZE + column);
}

export function boxIndexes(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const startRow = Math.floor(row / 3) * 3;
  const startColumn = Math.floor(column / 3) * 3;
  const indexes = [];
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      indexes.push((startRow + rowOffset) * BOARD_SIZE + startColumn + columnOffset);
    }
  }
  return indexes;
}

export function peerIndexes(index) {
  return [...new Set([...rowIndexes(index), ...columnIndexes(index), ...boxIndexes(index)])]
    .filter((peer) => peer !== index)
    .sort((a, b) => a - b);
}

export function candidateValues(values, index) {
  if (!Array.isArray(values) || values.length !== CELL_COUNT || values[index]) return [];
  const used = new Set(peerIndexes(index).map((peer) => values[peer]).filter(Boolean));
  return DIGITS.filter((digit) => !used.has(digit));
}

function collectUnitConflicts(values, indexes, conflicts) {
  const positions = new Map();
  for (const index of indexes) {
    const value = values[index];
    if (!value) continue;
    const matches = positions.get(value) ?? [];
    matches.push(index);
    positions.set(value, matches);
  }
  for (const matches of positions.values()) {
    if (matches.length > 1) matches.forEach((index) => conflicts.add(index));
  }
}

export function conflictIndexes(values) {
  const conflicts = new Set();
  if (!Array.isArray(values) || values.length !== CELL_COUNT) return conflicts;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    collectUnitConflicts(values, rowIndexes(row * BOARD_SIZE), conflicts);
  }
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    collectUnitConflicts(values, columnIndexes(column), conflicts);
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      collectUnitConflicts(values, boxIndexes((boxRow * 3) * BOARD_SIZE + boxColumn * 3), conflicts);
    }
  }
  return conflicts;
}

function unitIsComplete(values, indexes) {
  return indexes.every((index) => DIGITS.includes(values[index]))
    && new Set(indexes.map((index) => values[index])).size === BOARD_SIZE;
}

export function isValidSolvedGrid(values) {
  if (!Array.isArray(values) || values.length !== CELL_COUNT) return false;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (!unitIsComplete(values, rowIndexes(row * BOARD_SIZE))) return false;
  }
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    if (!unitIsComplete(values, columnIndexes(column))) return false;
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      if (!unitIsComplete(values, boxIndexes((boxRow * 3) * BOARD_SIZE + boxColumn * 3))) return false;
    }
  }
  return true;
}

export function puzzleIsConsistent(puzzle) {
  if (!puzzle || !isValidSolvedGrid([...puzzle.solvedValues])) return false;
  return puzzle.values.every((value, index) => value === 0 || value === puzzle.solvedValues[index]);
}

export function isSolved(values, puzzle) {
  return Boolean(puzzle)
    && Array.isArray(values)
    && values.length === CELL_COUNT
    && values.every((value, index) => value === puzzle.solvedValues[index]);
}

export function relatedIndexes(index) {
  return new Set([index, ...peerIndexes(index)]);
}
