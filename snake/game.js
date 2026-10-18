export const BOARD_SIZE = 18;
export const COMBO_WINDOW = 16;

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, opposite: 'down' }),
  down: Object.freeze({ x: 0, y: 1, opposite: 'up' }),
  left: Object.freeze({ x: -1, y: 0, opposite: 'right' }),
  right: Object.freeze({ x: 1, y: 0, opposite: 'left' }),
});

const MAZE_WALLS = Object.freeze([
  ...[2, 3, 4, 5, 6, 11, 12, 13, 14, 15].map((y) => Object.freeze({ x: 3, y })),
  ...[2, 3, 4, 5, 6, 11, 12, 13, 14, 15].map((y) => Object.freeze({ x: 14, y })),
  ...[6, 7, 8, 9, 10, 11].map((x) => Object.freeze({ x, y: 3 })),
  ...[6, 7, 8, 9, 10, 11].map((x) => Object.freeze({ x, y: 14 })),
]);

export const MODES = Object.freeze({
  classic: Object.freeze({ id: 'classic', label: 'Classic', tickMs: 135, walls: Object.freeze([]) }),
  speed: Object.freeze({ id: 'speed', label: 'Speed', tickMs: 82, walls: Object.freeze([]) }),
  maze: Object.freeze({ id: 'maze', label: 'Maze', tickMs: 118, walls: MAZE_WALLS }),
});

export function positionKey({ x, y }) {
  return `${x},${y}`;
}

function normalizeRandom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(0.999999999, number));
}

export function spawnPickup(snake, walls, random = Math.random) {
  const blocked = new Set([...snake, ...walls].map(positionKey));
  const free = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!blocked.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(normalizeRandom(random()) * free.length)];
}

export function createGame(modeId = 'classic', random = Math.random) {
  const mode = MODES[modeId] ?? MODES.classic;
  const snake = [
    { x: 8, y: 9 },
    { x: 7, y: 9 },
    { x: 6, y: 9 },
  ];
  const walls = mode.walls.map(({ x, y }) => ({ x, y }));
  return {
    mode: mode.id,
    snake,
    walls,
    direction: 'right',
    nextDirection: 'right',
    pickup: spawnPickup(snake, walls, random),
    score: 0,
    combo: 0,
    pickups: 0,
    stepsSincePickup: COMBO_WINDOW + 1,
    paused: false,
    over: false,
    won: false,
  };
}

export function setDirection(state, direction) {
  if (!DIRECTIONS[direction] || state.over) return state;
  if (DIRECTIONS[state.direction].opposite === direction) return state;
  return { ...state, nextDirection: direction };
}

export function setPaused(state, paused) {
  if (state.over) return state;
  return { ...state, paused: Boolean(paused) };
}

export function tickMsForState(state) {
  const mode = MODES[state.mode] ?? MODES.classic;
  if (state.mode !== 'speed') return mode.tickMs;
  return Math.max(54, mode.tickMs - Math.floor(state.pickups / 4) * 4);
}

function isOutside({ x, y }) {
  return x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE;
}

function collidesWithWall(position, walls) {
  const key = positionKey(position);
  return walls.some((wall) => positionKey(wall) === key);
}

export function stepGame(state, random = Math.random) {
  if (state.over || state.paused) return state;

  const direction = state.nextDirection;
  const vector = DIRECTIONS[direction];
  const head = state.snake[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  const eating = Boolean(state.pickup && positionKey(nextHead) === positionKey(state.pickup));
  const collisionBody = eating ? state.snake : state.snake.slice(0, -1);
  const bodyKeys = new Set(collisionBody.map(positionKey));

  if (isOutside(nextHead) || collidesWithWall(nextHead, state.walls) || bodyKeys.has(positionKey(nextHead))) {
    return { ...state, direction, nextDirection: direction, over: true, paused: false };
  }

  if (eating) {
    const snake = [nextHead, ...state.snake];
    const combo = state.combo > 0 && state.stepsSincePickup <= COMBO_WINDOW ? Math.min(5, state.combo + 1) : 1;
    const score = state.score + 10 * combo;
    const pickup = spawnPickup(snake, state.walls, random);
    return {
      ...state,
      snake,
      direction,
      nextDirection: direction,
      pickup,
      score,
      combo,
      pickups: state.pickups + 1,
      stepsSincePickup: 0,
      over: pickup === null,
      won: pickup === null,
    };
  }

  const stepsSincePickup = state.stepsSincePickup + 1;
  return {
    ...state,
    snake: [nextHead, ...state.snake.slice(0, -1)],
    direction,
    nextDirection: direction,
    combo: stepsSincePickup > COMBO_WINDOW ? 0 : state.combo,
    stepsSincePickup,
  };
}
