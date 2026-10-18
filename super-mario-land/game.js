import {
  GROUND_Y,
  LEVELS,
  LEVEL_COUNT,
  WORLD_COUNT,
  WORLD_HEIGHT,
  campaignPosition,
} from './campaign-levels.js';

export {
  GROUND_Y,
  LEVELS,
  LEVEL_COUNT,
  WORLD_COUNT,
  WORLD_HEIGHT,
  campaignPosition,
};

export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 30;
export const QUESTION_BLOCK_SIZE = 32;

const MOVE_SPEED = 220;
const JUMP_SPEED = 650;
const GRAVITY = 1850;
const MAX_FALL_SPEED = 850;
const ENEMY_SPEED = 52;
const POWERUP_SIZE = 24;
const PROJECTILE_SIZE = 10;
const PROJECTILE_SPEED = 440;
const FIRE_COOLDOWN = 0.28;
const HIT_INVULNERABILITY = 1;

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

function createLevelState(levelIndex, score, lives, power = 'small') {
  const normalized = normalizedLevelIndex(levelIndex);
  const level = LEVELS[normalized];
  return {
    levelIndex: normalized,
    player: playerSpawn(),
    blocks: level.blocks.map((block, index) => ({
      ...block,
      id: index,
      width: QUESTION_BLOCK_SIZE,
      height: QUESTION_BLOCK_SIZE,
      used: false,
    })),
    powerups: [],
    projectiles: [],
    nextEntityId: 0,
    fireCooldown: 0,
    invulnerable: 0,
    power,
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
  return createLevelState(startLevelIndex, 0, 3, 'small');
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function blockRect(block) {
  return { x: block.x, y: block.y, width: block.width, height: block.height };
}

function collisionItems(level, blocks) {
  return [
    ...level.solids.map((solid) => ({ ...solid, blockId: null })),
    ...blocks.map((block) => ({ ...blockRect(block), blockId: block.id })),
  ];
}

function pointHitsSolid(solids, x, y) {
  return solids.some((solid) => x >= solid.x
    && x <= solid.x + solid.width
    && y >= solid.y
    && y <= solid.y + solid.height);
}

function movePlayerHorizontally(player, deltaX, level, blocks) {
  const moved = { ...player, x: player.x + deltaX };
  for (const solid of collisionItems(level, blocks)) {
    if (!overlaps(moved, solid)) continue;
    if (deltaX > 0) moved.x = solid.x - moved.width;
    else if (deltaX < 0) moved.x = solid.x + solid.width;
    moved.vx = 0;
  }
  moved.x = Math.max(0, Math.min(level.width - moved.width, moved.x));
  return moved;
}

function movePlayerVertically(player, deltaY, level, blocks) {
  const moved = { ...player, y: player.y + deltaY, onGround: false };
  let hitBlockId = null;
  for (const solid of collisionItems(level, blocks)) {
    if (!overlaps(moved, solid)) continue;
    if (deltaY > 0) {
      moved.y = solid.y - moved.height;
      moved.vy = 0;
      moved.onGround = true;
    } else if (deltaY < 0) {
      moved.y = solid.y + solid.height;
      moved.vy = 0;
      if (solid.blockId !== null) hitBlockId = solid.blockId;
    }
  }
  return { player: moved, hitBlockId };
}

function loseLife(state) {
  const lives = state.lives - 1;
  if (lives <= 0) {
    return {
      ...state,
      lives: 0,
      power: 'small',
      invulnerable: 0,
      projectiles: [],
      status: 'lost',
      player: { ...state.player, vx: 0, vy: 0 },
    };
  }
  return {
    ...state,
    lives,
    power: 'small',
    invulnerable: 0,
    projectiles: [],
    player: playerSpawn(),
  };
}

function takeEnemyHit(state) {
  if (state.invulnerable > 0) return state;
  if (state.power === 'flower') {
    return {
      ...state,
      power: 'mushroom',
      invulnerable: HIT_INVULNERABILITY,
      player: { ...state.player, vy: -JUMP_SPEED * 0.3, onGround: false },
    };
  }
  if (state.power === 'mushroom') {
    return {
      ...state,
      power: 'small',
      invulnerable: HIT_INVULNERABILITY,
      player: { ...state.player, vy: -JUMP_SPEED * 0.3, onGround: false },
    };
  }
  return loseLife(state);
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

function activateBlock(state, blockId) {
  if (blockId === null) return state;
  const block = state.blocks.find((candidate) => candidate.id === blockId);
  if (!block || block.used) return state;
  block.used = true;
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.powerups.push({
    id,
    type: block.powerup,
    x: block.x + (QUESTION_BLOCK_SIZE - POWERUP_SIZE) / 2,
    y: block.y - POWERUP_SIZE - 2,
    width: POWERUP_SIZE,
    height: POWERUP_SIZE,
    collected: false,
  });
  state.score += 50;
  return state;
}

function collectPowerups(state) {
  for (const item of state.powerups) {
    if (item.collected || !overlaps(state.player, item)) continue;
    item.collected = true;
    if (item.type === 'flower') {
      state.power = 'flower';
      state.score += 800;
    } else {
      if (state.power === 'small') state.power = 'mushroom';
      state.score += 500;
    }
  }
  return state;
}

function spawnProjectile(state) {
  if (state.power !== 'flower' || state.fireCooldown > 0) return state;
  const direction = state.player.facing < 0 ? -1 : 1;
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.projectiles.push({
    id,
    x: direction > 0 ? state.player.x + state.player.width : state.player.x - PROJECTILE_SIZE,
    y: state.player.y + 10,
    width: PROJECTILE_SIZE,
    height: PROJECTILE_SIZE,
    vx: PROJECTILE_SPEED * direction,
  });
  state.fireCooldown = FIRE_COOLDOWN;
  return state;
}

function moveProjectiles(state, seconds, level) {
  const solids = collisionItems(level, state.blocks);
  state.projectiles = state.projectiles
    .map((projectile) => ({ ...projectile, x: projectile.x + projectile.vx * seconds }))
    .filter((projectile) => projectile.x + projectile.width >= 0
      && projectile.x <= level.width
      && !solids.some((solid) => overlaps(projectile, solid)));

  for (const projectile of state.projectiles) {
    const enemy = state.enemies.find((candidate) => candidate.alive && overlaps(projectile, candidate));
    if (!enemy) continue;
    enemy.alive = false;
    projectile.hit = true;
    state.score += 200;
  }
  state.projectiles = state.projectiles.filter((projectile) => !projectile.hit);
  return state;
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
  return createLevelState(state.levelIndex + 1, score, state.lives, state.power);
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

  const blocks = current.blocks.map((block) => ({ ...block }));
  player = movePlayerHorizontally(player, player.vx * seconds, level, blocks);
  player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * seconds);
  const verticalMove = movePlayerVertically(player, player.vy * seconds, level, blocks);
  player = verticalMove.player;

  let next = {
    ...current,
    player,
    blocks,
    powerups: current.powerups.map((item) => ({ ...item })),
    projectiles: current.projectiles.map((projectile) => ({ ...projectile })),
    coins: current.coins.map((coin) => ({ ...coin })),
    enemies: moveEnemies(current.enemies, seconds, level),
    elapsed: current.elapsed + seconds,
    fireCooldown: Math.max(0, current.fireCooldown - seconds),
    invulnerable: Math.max(0, current.invulnerable - seconds),
  };

  activateBlock(next, verticalMove.hitBlockId);
  collectPowerups(next);
  if (input.fire) spawnProjectile(next);
  moveProjectiles(next, seconds, level);

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
    return takeEnemyHit(next);
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
