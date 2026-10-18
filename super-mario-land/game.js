export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 450;
export const GROUND_Y = 384;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 30;
export const GOAL_X = 3040;

const MOVE_SPEED = 220;
const JUMP_SPEED = 650;
const GRAVITY = 1850;
const MAX_FALL_SPEED = 850;
const ENEMY_SPEED = 52;

export const LEVEL_SOLIDS = Object.freeze([
  { x: 0, y: GROUND_Y, width: 640, height: WORLD_HEIGHT - GROUND_Y },
  { x: 736, y: GROUND_Y, width: 672, height: WORLD_HEIGHT - GROUND_Y },
  { x: 1504, y: GROUND_Y, width: 704, height: WORLD_HEIGHT - GROUND_Y },
  { x: 2304, y: GROUND_Y, width: WORLD_WIDTH - 2304, height: WORLD_HEIGHT - GROUND_Y },
  { x: 320, y: 304, width: 160, height: 32 },
  { x: 896, y: 272, width: 160, height: 32 },
  { x: 1248, y: 320, width: 128, height: 32 },
  { x: 1664, y: 272, width: 192, height: 32 },
  { x: 2464, y: 304, width: 160, height: 32 },
  { x: 2752, y: 256, width: 128, height: 32 },
]);

export const LEVEL_COINS = Object.freeze([
  { x: 224, y: 334 },
  { x: 352, y: 258 },
  { x: 416, y: 258 },
  { x: 800, y: 334 },
  { x: 928, y: 226 },
  { x: 992, y: 226 },
  { x: 1280, y: 274 },
  { x: 1568, y: 334 },
  { x: 1696, y: 226 },
  { x: 1760, y: 226 },
  { x: 2016, y: 334 },
  { x: 2368, y: 334 },
  { x: 2496, y: 258 },
  { x: 2560, y: 258 },
  { x: 2784, y: 210 },
  { x: 2944, y: 334 },
]);

const ENEMY_STARTS = Object.freeze([
  { x: 544, y: GROUND_Y - 24, direction: -1 },
  { x: 1072, y: GROUND_Y - 24, direction: 1 },
  { x: 1320, y: GROUND_Y - 24, direction: -1 },
  { x: 1904, y: GROUND_Y - 24, direction: 1 },
  { x: 2592, y: GROUND_Y - 24, direction: -1 },
]);

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

export function createGame() {
  return {
    player: playerSpawn(),
    coins: LEVEL_COINS.map((coin, index) => ({ ...coin, id: index, collected: false })),
    enemies: ENEMY_STARTS.map((enemy, index) => ({
      id: index,
      x: enemy.x,
      y: enemy.y,
      width: 26,
      height: 24,
      vx: ENEMY_SPEED * enemy.direction,
      alive: true,
    })),
    score: 0,
    lives: 3,
    status: 'playing',
    elapsed: 0,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function pointHitsSolid(x, y) {
  return LEVEL_SOLIDS.some((solid) => x >= solid.x
    && x <= solid.x + solid.width
    && y >= solid.y
    && y <= solid.y + solid.height);
}

function movePlayerHorizontally(player, deltaX) {
  const moved = { ...player, x: player.x + deltaX };
  for (const solid of LEVEL_SOLIDS) {
    if (!overlaps(moved, solid)) continue;
    if (deltaX > 0) moved.x = solid.x - moved.width;
    else if (deltaX < 0) moved.x = solid.x + solid.width;
    moved.vx = 0;
  }
  moved.x = Math.max(0, Math.min(WORLD_WIDTH - moved.width, moved.x));
  return moved;
}

function movePlayerVertically(player, deltaY) {
  const moved = { ...player, y: player.y + deltaY, onGround: false };
  for (const solid of LEVEL_SOLIDS) {
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

function moveEnemies(enemies, seconds) {
  return enemies.map((enemy) => {
    if (!enemy.alive) return { ...enemy };
    let vx = enemy.vx;
    let x = enemy.x + vx * seconds;
    const probe = { ...enemy, x };
    const hitWall = LEVEL_SOLIDS.some((solid) => overlaps(probe, solid));
    const leadingX = vx > 0 ? x + enemy.width + 2 : x - 2;
    const hasFloor = pointHitsSolid(leadingX, enemy.y + enemy.height + 3);
    if (hitWall || !hasFloor) {
      vx *= -1;
      x = enemy.x + vx * seconds;
    }
    return { ...enemy, x, vx };
  });
}

export function stepGame(current, input = {}, deltaSeconds = 0) {
  if (current.status !== 'playing') return current;

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

  player = movePlayerHorizontally(player, player.vx * seconds);
  player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * seconds);
  player = movePlayerVertically(player, player.vy * seconds);

  let next = {
    ...current,
    player,
    coins: current.coins.map((coin) => ({ ...coin })),
    enemies: moveEnemies(current.enemies, seconds),
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

  if (next.player.x + next.player.width >= GOAL_X) {
    const timeBonus = Math.max(0, Math.round((120 - next.elapsed) * 10));
    return {
      ...next,
      score: next.score + 1000 + timeBonus,
      status: 'won',
      player: { ...next.player, vx: 0 },
    };
  }

  return next;
}

export function collectedCoins(state) {
  return state.coins.filter((coin) => coin.collected).length;
}

export function progressPercent(state) {
  return Math.max(0, Math.min(100, Math.round((state.player.x / GOAL_X) * 100)));
}
