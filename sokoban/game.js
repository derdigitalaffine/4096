import { LEVELS } from './levels.js';

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, key: 'U' }),
  down: Object.freeze({ x: 0, y: 1, key: 'D' }),
  left: Object.freeze({ x: -1, y: 0, key: 'L' }),
  right: Object.freeze({ x: 1, y: 0, key: 'R' }),
});

export const positionKey = ({ x, y }) => `${x},${y}`;
const clonePosition = ({ x, y }) => ({ x, y });
const samePosition = (a, b) => a.x === b.x && a.y === b.y;

export function parseLevel(level) {
  const rows = level?.map;
  if (!Array.isArray(rows) || rows.length < 3) throw new Error('Level map missing.');
  const width = Math.max(...rows.map((row) => row.length));
  const height = rows.length;
  const walls = [];
  const goals = [];
  const crates = [];
  let player = null;

  for (let y = 0; y < height; y += 1) {
    const row = rows[y].padEnd(width, ' ');
    for (let x = 0; x < width; x += 1) {
      const char = row[x];
      const position = { x, y };
      if (char === '#') walls.push(position);
      if (char === '.' || char === '*' || char === '+') goals.push(position);
      if (char === '$' || char === '*') crates.push(position);
      if (char === '@' || char === '+') {
        if (player) throw new Error(`Level ${level.id} has multiple players.`);
        player = position;
      }
      if (!'# .$@*+'.includes(char)) throw new Error(`Unsupported tile ${JSON.stringify(char)} in ${level.id}.`);
    }
  }

  if (!player) throw new Error(`Level ${level.id} has no player.`);
  if (crates.length === 0 || crates.length !== goals.length) throw new Error(`Level ${level.id} needs the same positive number of crates and goals.`);
  return { width, height, walls, goals, crates, player };
}

function staticFromLevel(levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) throw new RangeError('Invalid level index.');
  const parsed = parseLevel(LEVELS[levelIndex]);
  return {
    levelIndex,
    width: parsed.width,
    height: parsed.height,
    walls: parsed.walls,
    goals: parsed.goals,
  };
}

export function createGame(levelIndex = 0) {
  const level = staticFromLevel(levelIndex);
  const parsed = parseLevel(LEVELS[levelIndex]);
  return {
    ...level,
    player: clonePosition(parsed.player),
    crates: parsed.crates.map(clonePosition),
    moves: 0,
    pushes: 0,
    won: parsed.crates.every((crate) => parsed.goals.some((goal) => samePosition(goal, crate))),
    history: [],
  };
}

export function isBlocked(state, position, ignoreCrate = false) {
  if (state.walls.some((wall) => samePosition(wall, position))) return true;
  return !ignoreCrate && state.crates.some((crate) => samePosition(crate, position));
}

export function isSolved(state) {
  return state.crates.every((crate) => state.goals.some((goal) => samePosition(goal, crate)));
}

function snapshot(state) {
  return {
    player: clonePosition(state.player),
    crates: state.crates.map(clonePosition),
    moves: state.moves,
    pushes: state.pushes,
    won: state.won,
  };
}

export function movePlayer(state, directionId) {
  const direction = DIRECTIONS[directionId];
  if (!direction || state.won) return state;

  const target = { x: state.player.x + direction.x, y: state.player.y + direction.y };
  if (state.walls.some((wall) => samePosition(wall, target))) return state;

  const crateIndex = state.crates.findIndex((crate) => samePosition(crate, target));
  let crates = state.crates;
  let pushed = false;

  if (crateIndex >= 0) {
    const beyond = { x: target.x + direction.x, y: target.y + direction.y };
    if (isBlocked(state, beyond)) return state;
    crates = state.crates.map((crate, index) => index === crateIndex ? beyond : clonePosition(crate));
    pushed = true;
  }

  const history = [...state.history, snapshot(state)];
  const next = {
    ...state,
    player: target,
    crates: pushed ? crates : state.crates.map(clonePosition),
    moves: state.moves + 1,
    pushes: state.pushes + (pushed ? 1 : 0),
    history,
  };
  return { ...next, won: isSolved(next) };
}

export function undoMove(state) {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return {
    ...state,
    player: clonePosition(previous.player),
    crates: previous.crates.map(clonePosition),
    moves: previous.moves,
    pushes: previous.pushes,
    won: previous.won,
    history: state.history.slice(0, -1),
  };
}

export function restartLevel(state) {
  return createGame(state.levelIndex);
}

function positionInside(state, position) {
  return Number.isInteger(position?.x) && Number.isInteger(position?.y)
    && position.x >= 0 && position.y >= 0 && position.x < state.width && position.y < state.height;
}

function isFloor(state, position) {
  return positionInside(state, position) && !state.walls.some((wall) => samePosition(wall, position));
}

export function serializeGame(state) {
  return {
    version: 1,
    levelIndex: state.levelIndex,
    player: clonePosition(state.player),
    crates: state.crates.map(clonePosition),
    moves: state.moves,
    pushes: state.pushes,
  };
}

export function restoreGame(value) {
  if (!value || value.version !== 1 || !Number.isInteger(value.levelIndex)) return null;
  let state;
  try { state = createGame(value.levelIndex); } catch { return null; }
  if (!positionInside(state, value.player) || !isFloor(state, value.player)) return null;
  if (!Array.isArray(value.crates) || value.crates.length !== state.goals.length) return null;
  if (!value.crates.every((crate) => isFloor(state, crate))) return null;
  const crateKeys = value.crates.map(positionKey);
  if (new Set(crateKeys).size !== crateKeys.length || crateKeys.includes(positionKey(value.player))) return null;
  if (!Number.isInteger(value.moves) || value.moves < 0 || !Number.isInteger(value.pushes) || value.pushes < 0 || value.pushes > value.moves) return null;

  const restored = {
    ...state,
    player: clonePosition(value.player),
    crates: value.crates.map(clonePosition),
    moves: value.moves,
    pushes: value.pushes,
    history: [],
  };
  return { ...restored, won: isSolved(restored) };
}

export function validateLevels(levels = LEVELS) {
  const ids = new Set();
  for (const level of levels) {
    if (!level.id || ids.has(level.id)) throw new Error('Level ids must be unique.');
    ids.add(level.id);
    const parsed = parseLevel(level);
    const outer = [
      ...Array.from({ length: parsed.width }, (_, x) => ({ x, y: 0 })),
      ...Array.from({ length: parsed.width }, (_, x) => ({ x, y: parsed.height - 1 })),
      ...Array.from({ length: parsed.height }, (_, y) => ({ x: 0, y })),
      ...Array.from({ length: parsed.height }, (_, y) => ({ x: parsed.width - 1, y })),
    ];
    if (!outer.every((position) => parsed.walls.some((wall) => samePosition(wall, position)))) {
      throw new Error(`Level ${level.id} must be enclosed by walls.`);
    }
  }
  return true;
}
