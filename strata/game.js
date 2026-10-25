import { LEVELS } from './levels.js';

export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
const VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export const positionKey = ({ x, y }) => `${x},${y}`;
const clonePosition = (position) => ({ x: position.x, y: position.y });
const cloneOffsets = (offsets) => offsets.map((offset) => ({ x: offset.x, y: offset.y }));
const mod = (value, size) => ((value % size) + size) % size;

export function translateCell(cell, offset, width, height) {
  return { x: mod(cell.x + offset.x, width), y: mod(cell.y + offset.y, height) };
}

export function composeLayers(layers, width, height, offsets = layers.map(() => ({ x: 0, y: 0 }))) {
  if (!Array.isArray(layers) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new TypeError('Invalid layer composition input.');
  }
  const counts = new Map();
  layers.forEach((layer, index) => {
    const offset = offsets[index] ?? { x: 0, y: 0 };
    for (const cell of layer.cells ?? []) {
      const translated = translateCell(cell, offset, width, height);
      const key = positionKey(translated);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  const solid = new Set();
  for (const [key, count] of counts) if (count % 2 === 1) solid.add(key);
  return { counts, solid };
}

export function validateLevel(level) {
  if (!level || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 5 || level.height < 5) return false;
  if (!Array.isArray(level.layers) || level.layers.length !== 2 || !Array.isArray(level.reference) || level.reference.length < 1) return false;
  const inside = ({ x, y } = {}) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < level.width && y < level.height;
  if (!inside(level.start) || !inside(level.goal) || positionKey(level.start) === positionKey(level.goal)) return false;
  const layerIds = new Set();
  for (const layer of level.layers) {
    if (!layer || typeof layer.id !== 'string' || !Array.isArray(layer.cells) || layerIds.has(layer.id)) return false;
    layerIds.add(layer.id);
    const cells = new Set();
    for (const cell of layer.cells) {
      if (!inside(cell)) return false;
      const key = positionKey(cell);
      if (cells.has(key)) return false;
      cells.add(key);
    }
  }
  const composed = composeLayers(level.layers, level.width, level.height);
  return !composed.solid.has(positionKey(level.start)) && !composed.solid.has(positionKey(level.goal));
}

function levelFor(index) {
  const level = LEVELS[index];
  if (!level || !validateLevel(level)) throw new RangeError('Invalid STRATA level.');
  return level;
}

function coreSnapshot(state) {
  return {
    levelIndex: state.levelIndex,
    player: clonePosition(state.player),
    offsets: cloneOffsets(state.offsets),
    actions: state.actions,
    shifts: state.shifts,
    lastAction: state.lastAction,
    status: state.status,
  };
}

function restoreSnapshot(snapshot, history, future) {
  return {
    ...coreSnapshot(snapshot),
    history: history.map(coreSnapshot),
    future: future.map(coreSnapshot),
  };
}

export function createGame(levelIndex = 0) {
  const level = levelFor(levelIndex);
  return {
    levelIndex,
    player: clonePosition(level.start),
    offsets: level.layers.map(() => ({ x: 0, y: 0 })),
    actions: 0,
    shifts: 0,
    lastAction: 'start',
    status: 'playing',
    history: [],
    future: [],
  };
}

export function compositionForState(state) {
  const level = levelFor(state.levelIndex);
  return composeLayers(level.layers, level.width, level.height, state.offsets);
}

export function isSolid(state, x, y) {
  const level = levelFor(state.levelIndex);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= level.width || y >= level.height) return true;
  return compositionForState(state).solid.has(`${x},${y}`);
}

export function isSolved(state) {
  const level = levelFor(state.levelIndex);
  return state.player.x === level.goal.x && state.player.y === level.goal.y;
}

function commit(state, nextCore) {
  const status = (() => {
    const level = levelFor(nextCore.levelIndex);
    return nextCore.player.x === level.goal.x && nextCore.player.y === level.goal.y ? 'won' : 'playing';
  })();
  return {
    ...nextCore,
    status,
    history: [...state.history.map(coreSnapshot), coreSnapshot(state)],
    future: [],
  };
}

export function movePlayer(state, direction) {
  if (!state || state.status === 'won' || !DIRECTIONS.includes(direction)) return state;
  const vector = VECTORS[direction];
  const next = { x: state.player.x + vector.x, y: state.player.y + vector.y };
  if (isSolid(state, next.x, next.y)) return state;
  return commit(state, {
    ...coreSnapshot(state),
    player: next,
    actions: state.actions + 1,
    lastAction: `walk:${direction}`,
  });
}

export function shiftLayer(state, layerIndex, direction) {
  if (!state || state.status === 'won' || !Number.isInteger(layerIndex) || !DIRECTIONS.includes(direction)) return state;
  const level = levelFor(state.levelIndex);
  if (layerIndex < 0 || layerIndex >= level.layers.length) return state;
  const vector = VECTORS[direction];
  const offsets = cloneOffsets(state.offsets);
  offsets[layerIndex] = {
    x: mod(offsets[layerIndex].x + vector.x, level.width),
    y: mod(offsets[layerIndex].y + vector.y, level.height),
  };
  const composition = composeLayers(level.layers, level.width, level.height, offsets);
  if (composition.solid.has(positionKey(state.player))) return state;
  return commit(state, {
    ...coreSnapshot(state),
    offsets,
    actions: state.actions + 1,
    shifts: state.shifts + 1,
    lastAction: `shift:${layerIndex}:${direction}`,
  });
}

export function undo(state) {
  if (!state || state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return restoreSnapshot(previous, state.history.slice(0, -1), [coreSnapshot(state), ...state.future]);
}

export function redo(state) {
  if (!state || state.future.length === 0) return state;
  const next = state.future[0];
  return restoreSnapshot(next, [...state.history, coreSnapshot(state)], state.future.slice(1));
}

export function restartLevel(state) {
  return createGame(state?.levelIndex ?? 0);
}

export function runActions(state, actions) {
  let current = state;
  for (const action of actions) {
    if (action?.type === 'move') current = movePlayer(current, action.direction);
    else if (action?.type === 'shift') current = shiftLayer(current, action.layer, action.direction);
  }
  return current;
}

export function actionLabel(action) {
  const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
  if (action?.startsWith('walk:')) return `WALK ${arrows[action.split(':')[1]] ?? ''}`.trim();
  if (action?.startsWith('shift:')) {
    const [, layer, direction] = action.split(':');
    return `${Number(layer) === 0 ? 'A' : 'B'}${arrows[direction] ?? ''}`;
  }
  return '';
}
