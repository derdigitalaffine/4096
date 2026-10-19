import { LEVELS } from './levels.js';

export const LOOP_TICKS = 16;
export const TICK_MS = 180;
export const WAIT = 'wait';
export const INPUTS = Object.freeze(['up', 'down', 'left', 'right', WAIT]);

const VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
  wait: Object.freeze({ x: 0, y: 0 }),
});

export function positionKey({ x, y }) {
  return `${x},${y}`;
}

export function validateLevel(level) {
  if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 5 || level.height < 5) return false;
  if (!Array.isArray(level.walls) || !Array.isArray(level.crystals) || level.crystals.length < 1) return false;
  const inside = ({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < level.width && y < level.height;
  if (!inside(level.start) || level.walls.some((item) => !inside(item)) || level.crystals.some((item) => !inside(item))) return false;
  const walls = new Set(level.walls.map(positionKey));
  const crystals = new Set(level.crystals.map(positionKey));
  if (walls.has(positionKey(level.start)) || crystals.has(positionKey(level.start))) return false;
  if (crystals.size !== level.crystals.length || level.walls.length !== walls.size) return false;
  if (level.crystals.some((item) => walls.has(positionKey(item)))) return false;
  for (let x = 0; x < level.width; x += 1) {
    if (!walls.has(`${x},0`) || !walls.has(`${x},${level.height - 1}`)) return false;
  }
  for (let y = 0; y < level.height; y += 1) {
    if (!walls.has(`0,${y}`) || !walls.has(`${level.width - 1},${y}`)) return false;
  }
  return true;
}

function levelFor(index) {
  const level = LEVELS[index];
  if (!level || !validateLevel(level)) throw new RangeError('Invalid ECHOLOOP level.');
  return level;
}

function clonePosition(position) {
  return { x: position.x, y: position.y };
}

export function createGame(levelIndex = 0) {
  const level = levelFor(levelIndex);
  return {
    levelIndex,
    loop: 1,
    tick: 0,
    player: clonePosition(level.start),
    echoPositions: [],
    echoes: [],
    recording: [],
    collected: [],
    status: 'playing',
    collision: false,
    totalTicks: 0,
  };
}

export function isWall(level, position) {
  return level.walls.some((wall) => wall.x === position.x && wall.y === position.y);
}

function desiredPosition(level, position, input) {
  const vector = VECTORS[input] ?? VECTORS.wait;
  const next = { x: position.x + vector.x, y: position.y + vector.y };
  if (next.x < 0 || next.y < 0 || next.x >= level.width || next.y >= level.height || isWall(level, next)) return clonePosition(position);
  return next;
}

export function resolveActorMoves(positions, inputs, level) {
  const desired = positions.map((position, index) => desiredPosition(level, position, INPUTS.includes(inputs[index]) ? inputs[index] : WAIT));
  const blocked = new Set();
  const destinations = new Map();

  for (let index = 0; index < desired.length; index += 1) {
    const key = positionKey(desired[index]);
    const indexes = destinations.get(key) ?? [];
    indexes.push(index);
    destinations.set(key, indexes);
  }
  for (const indexes of destinations.values()) {
    if (indexes.length > 1) for (const index of indexes) blocked.add(index);
  }

  for (let a = 0; a < positions.length; a += 1) {
    for (let b = a + 1; b < positions.length; b += 1) {
      const swapped = positionKey(desired[a]) === positionKey(positions[b])
        && positionKey(desired[b]) === positionKey(positions[a])
        && positionKey(positions[a]) !== positionKey(positions[b]);
      if (swapped) {
        blocked.add(a);
        blocked.add(b);
      }
    }
  }

  return {
    positions: desired.map((position, index) => blocked.has(index) ? clonePosition(positions[index]) : position),
    collision: blocked.size > 0,
  };
}

export function collectCrystals(level, collected, positions) {
  const found = new Set(collected);
  const crystals = new Set(level.crystals.map(positionKey));
  for (const position of positions) {
    const key = positionKey(position);
    if (crystals.has(key)) found.add(key);
  }
  return [...found].sort();
}

export function isSolved(state) {
  const level = levelFor(state.levelIndex);
  return state.collected.length === level.crystals.length;
}

export function finishLoop(state) {
  if (state.status !== 'playing') return state;
  const level = levelFor(state.levelIndex);
  const recording = [...state.recording];
  while (recording.length < LOOP_TICKS) recording.push(WAIT);
  const echoes = [...state.echoes, Object.freeze({ id: state.echoes.length + 1, inputs: Object.freeze(recording.slice(0, LOOP_TICKS)) })];
  return {
    ...state,
    loop: state.loop + 1,
    tick: 0,
    player: clonePosition(level.start),
    echoPositions: echoes.map(() => clonePosition(level.start)),
    echoes,
    recording: [],
    collected: [],
    collision: false,
  };
}

export function stepGame(state, input = WAIT) {
  if (!state || state.status !== 'playing') return state;
  const level = levelFor(state.levelIndex);
  const normalized = INPUTS.includes(input) ? input : WAIT;
  const positions = [state.player, ...state.echoPositions];
  const inputs = [normalized, ...state.echoes.map((echo) => echo.inputs[state.tick] ?? WAIT)];
  const resolved = resolveActorMoves(positions, inputs, level);
  const collected = collectCrystals(level, state.collected, resolved.positions);
  const recording = [...state.recording, normalized];
  const next = {
    ...state,
    player: resolved.positions[0],
    echoPositions: resolved.positions.slice(1),
    recording,
    collected,
    tick: state.tick + 1,
    totalTicks: state.totalTicks + 1,
    collision: resolved.collision,
  };
  if (collected.length === level.crystals.length) return { ...next, status: 'won' };
  if (next.tick >= LOOP_TICKS) return finishLoop(next);
  return next;
}

export function runInputs(state, inputs) {
  let current = state;
  for (const input of inputs) current = stepGame(current, input);
  return current;
}

export function restartLevel(state) {
  return createGame(state?.levelIndex ?? 0);
}

export function startLevel(levelIndex) {
  return createGame(levelIndex);
}

export function nextLevel(state) {
  if (!state || state.status !== 'won' || state.levelIndex >= LEVELS.length - 1) return state;
  return createGame(state.levelIndex + 1);
}

export function actorSnapshot(state) {
  return [
    { id: 'current', ...state.player },
    ...state.echoPositions.map((position, index) => ({ id: `echo-${index + 1}`, ...position })),
  ];
}
