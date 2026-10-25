export const WIDTH = 8;
export const HEIGHT = 16;
export const COLORS = ['red', 'blue', 'yellow'];

const ROTATION_OFFSETS = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: -1 }),
]);

export function emptyBoard() {
  return Array(WIDTH * HEIGHT).fill(null);
}

export function boardIndex(x, y) {
  return y * WIDTH + x;
}

function activeRotation(active) {
  if (Number.isInteger(active?.rotation) && active.rotation >= 0 && active.rotation < ROTATION_OFFSETS.length) {
    return active.rotation;
  }
  return active?.orientation === 'vertical' ? 1 : 0;
}

function orientationForRotation(rotation) {
  return rotation % 2 === 0 ? 'horizontal' : 'vertical';
}

export function activeCells(active) {
  if (!active) return [];
  const [first, second] = active.colors;
  const offset = ROTATION_OFFSETS[activeRotation(active)];
  return [
    { x: active.x, y: active.y, color: first },
    { x: active.x + offset.x, y: active.y + offset.y, color: second },
  ];
}

export function countViruses(board) {
  return board.reduce((count, cell) => count + (cell?.type === 'virus' ? 1 : 0), 0);
}

function randomColor(random) {
  const index = Math.min(COLORS.length - 1, Math.floor(random() * COLORS.length));
  return COLORS[Math.max(0, index)];
}

function randomPair(random) {
  return [randomColor(random), randomColor(random)];
}

function spawnActive(colors) {
  return { x: 3, y: 0, orientation: 'horizontal', rotation: 0, colors: [...colors] };
}

export function canPlace(board, active) {
  return activeCells(active).every(({ x, y }) => {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return false;
    return board[boardIndex(x, y)] === null;
  });
}

export function findMatches(board) {
  const matches = new Set();

  const scan = (line) => {
    let start = 0;
    while (start < line.length) {
      const firstIndex = line[start];
      const color = board[firstIndex]?.color;
      if (!color) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < line.length && board[line[end]]?.color === color) end += 1;
      if (end - start >= 4) {
        for (let cursor = start; cursor < end; cursor += 1) matches.add(line[cursor]);
      }
      start = end;
    }
  };

  for (let y = 0; y < HEIGHT; y += 1) {
    scan(Array.from({ length: WIDTH }, (_, x) => boardIndex(x, y)));
  }
  for (let x = 0; x < WIDTH; x += 1) {
    scan(Array.from({ length: HEIGHT }, (_, y) => boardIndex(x, y)));
  }

  return matches;
}

export function seedViruses(board, count, random = Math.random) {
  const next = [...board];
  const firstVirusRow = 6;
  const target = Math.min(count, WIDTH * (HEIGHT - firstVirusRow));
  let placed = 0;
  let attempts = 0;

  while (placed < target && attempts < 20_000) {
    attempts += 1;
    const x = Math.min(WIDTH - 1, Math.floor(random() * WIDTH));
    const y = firstVirusRow + Math.min(HEIGHT - firstVirusRow - 1, Math.floor(random() * (HEIGHT - firstVirusRow)));
    const index = boardIndex(x, y);
    if (next[index]) continue;

    next[index] = { color: randomColor(random), type: 'virus' };
    if (findMatches(next).has(index)) {
      next[index] = null;
      continue;
    }
    placed += 1;
  }

  return next;
}

export function collapsePills(board) {
  const next = board.map((cell) => (cell ? { ...cell } : null));
  let moved = true;

  while (moved) {
    moved = false;
    for (let y = HEIGHT - 2; y >= 0; y -= 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const index = boardIndex(x, y);
        const below = boardIndex(x, y + 1);
        if (next[index]?.type === 'pill' && next[below] === null) {
          next[below] = next[index];
          next[index] = null;
          moved = true;
        }
      }
    }
  }

  return next;
}

export function resolveBoard(board) {
  let next = board.map((cell) => (cell ? { ...cell } : null));
  let cleared = 0;
  let clearedViruses = 0;
  let chains = 0;

  while (true) {
    const matches = findMatches(next);
    if (matches.size === 0) break;
    chains += 1;
    cleared += matches.size;
    for (const index of matches) {
      if (next[index]?.type === 'virus') clearedViruses += 1;
      next[index] = null;
    }
    next = collapsePills(next);
  }

  return {
    board: next,
    cleared,
    clearedViruses,
    chains,
    scoreGain: cleared * 100 + clearedViruses * 300 + Math.max(0, chains - 1) * 500,
  };
}

export function createGame({ random = Math.random, virusCount = 12 } = {}) {
  const board = seedViruses(emptyBoard(), virusCount, random);
  const active = spawnActive(randomPair(random));
  const state = {
    board,
    active,
    nextColors: randomPair(random),
    score: 0,
    viruses: countViruses(board),
    status: 'playing',
  };

  return canPlace(board, active) ? state : { ...state, active: null, status: 'lost' };
}

export function moveActive(state, dx, dy) {
  if (state.status !== 'playing' || !state.active) return state;
  const candidate = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
  return canPlace(state.board, candidate) ? { ...state, active: candidate } : state;
}

export function rotateActive(state) {
  if (state.status !== 'playing' || !state.active) return state;

  const rotation = (activeRotation(state.active) + 1) % ROTATION_OFFSETS.length;
  const orientation = orientationForRotation(rotation);
  const kicks = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const kick of kicks) {
    const candidate = {
      ...state.active,
      x: state.active.x + kick.x,
      y: state.active.y + kick.y,
      orientation,
      rotation,
    };
    if (canPlace(state.board, candidate)) return { ...state, active: candidate };
  }
  return state;
}

function lockActive(state, random) {
  const board = [...state.board];
  for (const { x, y, color } of activeCells(state.active)) {
    board[boardIndex(x, y)] = { color, type: 'pill' };
  }

  const resolved = resolveBoard(board);
  const viruses = countViruses(resolved.board);
  const score = state.score + resolved.scoreGain;
  if (viruses === 0) {
    return { ...state, board: resolved.board, active: null, score, viruses, status: 'won' };
  }

  const active = spawnActive(state.nextColors);
  const next = {
    ...state,
    board: resolved.board,
    active,
    nextColors: randomPair(random),
    score,
    viruses,
    status: 'playing',
  };
  return canPlace(next.board, active) ? next : { ...next, active: null, status: 'lost' };
}

export function softDrop(state, random = Math.random) {
  if (state.status !== 'playing' || !state.active) return state;
  const moved = moveActive(state, 0, 1);
  return moved === state ? lockActive(state, random) : moved;
}

export function hardDrop(state, random = Math.random) {
  if (state.status !== 'playing' || !state.active) return state;
  let next = state;
  while (true) {
    const moved = moveActive(next, 0, 1);
    if (moved === next) break;
    next = moved;
  }
  return lockActive(next, random);
}

export function isRestorableState(value) {
  if (!value || !Array.isArray(value.board) || value.board.length !== WIDTH * HEIGHT) return false;
  if (!['playing', 'won', 'lost'].includes(value.status)) return false;
  if (!Number.isSafeInteger(value.score) || value.score < 0) return false;
  if (!Number.isSafeInteger(value.viruses) || value.viruses < 0) return false;
  if (!Array.isArray(value.nextColors) || value.nextColors.length !== 2 || value.nextColors.some((color) => !COLORS.includes(color))) return false;

  const boardValid = value.board.every((cell) => cell === null || (
    COLORS.includes(cell.color) && ['virus', 'pill'].includes(cell.type)
  ));
  if (!boardValid || countViruses(value.board) !== value.viruses) return false;

  if (value.status === 'playing') {
    if (!value.active || !['horizontal', 'vertical'].includes(value.active.orientation)) return false;
    if (!Array.isArray(value.active.colors) || value.active.colors.length !== 2 || value.active.colors.some((color) => !COLORS.includes(color))) return false;
    if (!Number.isInteger(value.active.x) || !Number.isInteger(value.active.y)) return false;

    if (value.active.rotation !== undefined) {
      if (!Number.isInteger(value.active.rotation) || value.active.rotation < 0 || value.active.rotation >= ROTATION_OFFSETS.length) return false;
      if (value.active.orientation !== orientationForRotation(value.active.rotation)) return false;
    }

    if (!canPlace(value.board, value.active)) return false;
  } else if (value.active !== null) {
    return false;
  }

  return true;
}
