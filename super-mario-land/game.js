export const WORLD_HEIGHT = 450;
export const GROUND_Y = 384;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 30;

const MOVE_SPEED = 220;
const JUMP_SPEED = 650;
const GRAVITY = 1850;
const MAX_FALL_SPEED = 850;
const ENEMY_SPEED = 52;

export const LEVELS = Object.freeze([
  Object.freeze({
    name: 'Grüner Pfad',
    width: 3200,
    goalX: 3040,
    parTime: 120,
    solids: Object.freeze([
      { x: 0, y: GROUND_Y, width: 640, height: WORLD_HEIGHT - GROUND_Y },
      { x: 736, y: GROUND_Y, width: 672, height: WORLD_HEIGHT - GROUND_Y },
      { x: 1504, y: GROUND_Y, width: 704, height: WORLD_HEIGHT - GROUND_Y },
      { x: 2304, y: GROUND_Y, width: 896, height: WORLD_HEIGHT - GROUND_Y },
      { x: 320, y: 304, width: 160, height: 32 },
      { x: 896, y: 272, width: 160, height: 32 },
      { x: 1248, y: 320, width: 128, height: 32 },
      { x: 1664, y: 272, width: 192, height: 32 },
      { x: 2464, y: 304, width: 160, height: 32 },
      { x: 2752, y: 256, width: 128, height: 32 },
    ]),
    coins: Object.freeze([
      { x: 224, y: 334 }, { x: 352, y: 258 }, { x: 416, y: 258 }, { x: 800, y: 334 },
      { x: 928, y: 226 }, { x: 992, y: 226 }, { x: 1280, y: 274 }, { x: 1568, y: 334 },
      { x: 1696, y: 226 }, { x: 1760, y: 226 }, { x: 2016, y: 334 }, { x: 2368, y: 334 },
      { x: 2496, y: 258 }, { x: 2560, y: 258 }, { x: 2784, y: 210 }, { x: 2944, y: 334 },
    ]),
    enemies: Object.freeze([
      { x: 544, direction: -1 }, { x: 1072, direction: 1 }, { x: 1320, direction: -1 },
      { x: 1904, direction: 1 }, { x: 2592, direction: -1 },
    ]),
  }),
  Object.freeze({
    name: 'Höhenweg',
    width: 3360,
    goalX: 3200,
    parTime: 135,
    solids: Object.freeze([
      { x: 0, y: GROUND_Y, width: 608, height: WORLD_HEIGHT - GROUND_Y },
      { x: 704, y: GROUND_Y, width: 704, height: WORLD_HEIGHT - GROUND_Y },
      { x: 1504, y: GROUND_Y, width: 704, height: WORLD_HEIGHT - GROUND_Y },
      { x: 2304, y: GROUND_Y, width: 1056, height: WORLD_HEIGHT - GROUND_Y },
      { x: 288, y: 304, width: 128, height: 32 },
      { x: 768, y: 256, width: 160, height: 32 },
      { x: 1088, y: 304, width: 160, height: 32 },
      { x: 1568, y: 240, width: 160, height: 32 },
      { x: 1856, y: 304, width: 128, height: 32 },
      { x: 2384, y: 272, width: 192, height: 32 },
      { x: 2752, y: 224, width: 160, height: 32 },
      { x: 3040, y: 288, width: 128, height: 32 },
    ]),
    coins: Object.freeze([
      { x: 192, y: 334 }, { x: 320, y: 258 }, { x: 384, y: 258 }, { x: 752, y: 334 },
      { x: 800, y: 210 }, { x: 864, y: 210 }, { x: 1120, y: 258 }, { x: 1312, y: 334 },
      { x: 1600, y: 194 }, { x: 1664, y: 194 }, { x: 1920, y: 258 }, { x: 2144, y: 334 },
      { x: 2416, y: 226 }, { x: 2480, y: 226 }, { x: 2784, y: 178 }, { x: 2848, y: 178 },
      { x: 3072, y: 242 }, { x: 3264, y: 334 },
    ]),
    enemies: Object.freeze([
      { x: 496, direction: -1 }, { x: 896, direction: 1 }, { x: 1280, direction: -1 },
      { x: 1664, direction: 1 }, { x: 2048, direction: -1 }, { x: 2496, direction: 1 },
      { x: 3120, direction: -1 },
    ]),
  }),
  Object.freeze({
    name: 'Festungslauf',
    width: 3600,
    goalX: 3440,
    parTime: 150,
    solids: Object.freeze([
      { x: 0, y: GROUND_Y, width: 480, height: WORLD_HEIGHT - GROUND_Y },
      { x: 576, y: GROUND_Y, width: 480, height: WORLD_HEIGHT - GROUND_Y },
      { x: 1152, y: GROUND_Y, width: 448, height: WORLD_HEIGHT - GROUND_Y },
      { x: 1696, y: GROUND_Y, width: 480, height: WORLD_HEIGHT - GROUND_Y },
      { x: 2272, y: GROUND_Y, width: 512, height: WORLD_HEIGHT - GROUND_Y },
      { x: 2880, y: GROUND_Y, width: 720, height: WORLD_HEIGHT - GROUND_Y },
      { x: 224, y: 288, width: 128, height: 32 },
      { x: 640, y: 240, width: 128, height: 32 },
      { x: 896, y: 304, width: 96, height: 32 },
      { x: 1216, y: 256, width: 160, height: 32 },
      { x: 1456, y: 208, width: 96, height: 32 },
      { x: 1760, y: 288, width: 128, height: 32 },
      { x: 1984, y: 224, width: 128, height: 32 },
      { x: 2336, y: 272, width: 128, height: 32 },
      { x: 2560, y: 208, width: 160, height: 32 },
      { x: 2944, y: 288, width: 128, height: 32 },
      { x: 3168, y: 224, width: 160, height: 32 },
    ]),
    coins: Object.freeze([
      { x: 160, y: 334 }, { x: 256, y: 242 }, { x: 320, y: 242 }, { x: 624, y: 334 },
      { x: 672, y: 194 }, { x: 736, y: 194 }, { x: 928, y: 258 }, { x: 1216, y: 210 },
      { x: 1280, y: 210 }, { x: 1488, y: 162 }, { x: 1744, y: 334 }, { x: 1792, y: 242 },
      { x: 2016, y: 178 }, { x: 2080, y: 178 }, { x: 2368, y: 226 }, { x: 2432, y: 226 },
      { x: 2592, y: 162 }, { x: 2656, y: 162 }, { x: 2944, y: 242 }, { x: 3008, y: 242 },
      { x: 3200, y: 178 }, { x: 3264, y: 178 }, { x: 3376, y: 334 },
    ]),
    enemies: Object.freeze([
      { x: 400, direction: -1 }, { x: 800, direction: 1 }, { x: 992, direction: -1 },
      { x: 1392, direction: 1 }, { x: 1872, direction: -1 }, { x: 2112, direction: 1 },
      { x: 2496, direction: -1 }, { x: 2752, direction: 1 }, { x: 3072, direction: -1 },
      { x: 3344, direction: 1 },
    ]),
  }),
]);

export const LEVEL_COUNT = LEVELS.length;
export const WORLD_WIDTH = LEVELS[0].width;
export const GOAL_X = LEVELS[0].goalX;
export const LEVEL_SOLIDS = LEVELS[0].solids;
export const LEVEL_COINS = LEVELS[0].coins;

function normalizedLevelIndex(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return 0;
  return Math.max(0, Math.min(LEVEL_COUNT - 1, number));
}

export function getLevel(stateOrIndex = 0) {
  const index = typeof stateOrIndex === 'object' && stateOrIndex !== null
    ? stateOrIndex.levelIndex
    : stateOrIndex;
  return LEVELS[normalizedLevelIndex(index)];
}

function playerSpawn() {
  return {
    x: 64,
    y: GROUND_Y - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
  };
}

function createLevelState(levelIndex, score, lives) {
  const normalized = normalizedLevelIndex(levelIndex);
  const level = LEVELS[normalized];
  return {
    levelIndex: normalized,
    player: playerSpawn(),
    coins: level.coins.map((coin, index) => ({ ...coin, id: index, collected: false })),
    enemies: level.enemies.map((enemy, index) => ({
      id: index,
      x: enemy.x,
      y: GROUND_Y - 24,
      width: 26,
      height: 24,
      vx: ENEMY_SPEED * enemy.direction,
      alive: true,
    })),
    score,
    lives,
    status: 'playing',
    elapsed: 0,
  };
}

export function createGame(startLevelIndex = 0) {
  return createLevelState(startLevelIndex, 0, 3);
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function pointHitsSolid(solids, x, y) {
  return solids.some((solid) => x >= solid.x
    && x <= solid.x + solid.width
    && y >= solid.y
    && y <= solid.y + solid.height);
}

function movePlayerHorizontally(player, deltaX, level) {
  const moved = { ...player, x: player.x + deltaX };
  for (const solid of level.solids) {
    if (!overlaps(moved, solid)) continue;
    if (deltaX > 0) moved.x = solid.x - moved.width;
    else if (deltaX < 0) moved.x = solid.x + solid.width;
    moved.vx = 0;
  }
  moved.x = Math.max(0, Math.min(level.width - moved.width, moved.x));
  return moved;
}

function movePlayerVertically(player, deltaY, level) {
  const moved = { ...player, y: player.y + deltaY, onGround: false };
  for (const solid of level.solids) {
    if (!overlaps(moved, solid)) continue;
    if (deltaY > 0) {
      moved.y = solid.y - moved.height;
      moved.vy = 0;
      moved.onGround = true;
    } else if (deltaY < 0) {
      moved.y = solid.y + solid.height;
      moved.vy = 0;
    }
  }
  return moved;
}

function loseLife(state) {
  const lives = state.lives - 1;
  if (lives <= 0) {
    return {
      ...state,
      lives: 0,
      status: 'lost',
      player: { ...state.player, vx: 0, vy: 0 },
    };
  }
  return {
    ...state,
    lives,
    player: playerSpawn(),
  };
}

function moveEnemies(enemies, seconds, level) {
  return enemies.map((enemy) => {
    if (!enemy.alive) return { ...enemy };
    let vx = enemy.vx;
    let x = enemy.x + vx * seconds;
    const probe = { ...enemy, x };
    const hitWall = level.solids.some((solid) => overlaps(probe, solid));
    const leadingX = vx > 0 ? x + enemy.width + 2 : x - 2;
    const hasFloor = pointHitsSolid(level.solids, leadingX, enemy.y + enemy.height + 3);
    if (hitWall || !hasFloor) {
      vx *= -1;
      x = enemy.x + vx * seconds;
    }
    return { ...enemy, x, vx };
  });
}

function clearLevel(state, level) {
  const timeBonus = Math.max(0, Math.round((level.parTime - state.elapsed) * 10));
  const score = state.score + 1000 + timeBonus;
  if (state.levelIndex >= LEVEL_COUNT - 1) {
    return {
      ...state,
      score,
      status: 'won',
      player: { ...state.player, vx: 0 },
    };
  }
  return createLevelState(state.levelIndex + 1, score, state.lives);
}

export function stepGame(current, input = {}, deltaSeconds = 0) {
  if (current.status !== 'playing') return current;

  const level = getLevel(current);
  const seconds = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  let player = { ...current.player };
  const previousBottom = player.y + player.height;
  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = horizontal * MOVE_SPEED;
  if (horizontal !== 0) player.facing = horizontal;

  if (input.jump && player.onGround) {
    player.vy = -JUMP_SPEED;
    player.onGround = false;
  }

  player = movePlayerHorizontally(player, player.vx * seconds, level);
  player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * seconds);
  player = movePlayerVertically(player, player.vy * seconds, level);

  let next = {
    ...current,
    player,
    coins: current.coins.map((coin) => ({ ...coin })),
    enemies: moveEnemies(current.enemies, seconds, level),
    elapsed: current.elapsed + seconds,
  };

  for (const coin of next.coins) {
    if (coin.collected) continue;
    const coinBox = { x: coin.x - 9, y: coin.y - 9, width: 18, height: 18 };
    if (!overlaps(next.player, coinBox)) continue;
    coin.collected = true;
    next.score += 100;
  }

  for (const enemy of next.enemies) {
    if (!enemy.alive || !overlaps(next.player, enemy)) continue;
    const stomped = next.player.vy >= 0 && previousBottom <= enemy.y + 10;
    if (stomped) {
      enemy.alive = false;
      next.player.vy = -JUMP_SPEED * 0.48;
      next.player.onGround = false;
      next.score += 200;
      continue;
    }
    return loseLife(next);
  }

  if (next.player.y > WORLD_HEIGHT + 64) return loseLife(next);

  if (next.player.x + next.player.width >= level.goalX) return clearLevel(next, level);

  return next;
}

export function collectedCoins(state) {
  return state.coins.filter((coin) => coin.collected).length;
}

export function progressPercent(state) {
  const level = getLevel(state);
  return Math.max(0, Math.min(100, Math.round((state.player.x / level.goalX) * 100)));
}
