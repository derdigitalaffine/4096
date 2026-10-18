import { WAVES } from './waves.js';

export const WORLD_WIDTH = 320;
export const WORLD_HEIGHT = 420;
export const STARTING_LIVES = 3;
export const PLAYER_WIDTH = 26;
export const PLAYER_HEIGHT = 18;
export const PLAYER_SPEED = 5.6;
export const PLAYER_Y = 374;
export const BULLET_SPEED = 7.2;
export const ENEMY_BULLET_SPEED = 3.1;
export const POWER_TICKS = 300;
export const SHIELD_TICKS = 360;

const ENEMY_SPECS = Object.freeze({
  scout: Object.freeze({ width: 24, height: 16, hp: 1, score: 100, speed: 1.15 }),
  tank: Object.freeze({ width: 30, height: 20, hp: 2, score: 220, speed: 0.72 }),
  diver: Object.freeze({ width: 22, height: 18, hp: 1, score: 160, speed: 1.0 }),
});

const DIRECTIONS = Object.freeze({
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function playerRect(player) {
  return { x: player.x - PLAYER_WIDTH / 2, y: player.y - PLAYER_HEIGHT / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
}

function projectileRect(projectile) {
  return { x: projectile.x - 2, y: projectile.y - 6, width: 4, height: 12 };
}

function powerRect(powerUp) {
  return { x: powerUp.x - 7, y: powerUp.y - 7, width: 14, height: 14 };
}

function enemyRect(enemy) {
  const spec = ENEMY_SPECS[enemy.type];
  return { x: enemy.x - spec.width / 2, y: enemy.y - spec.height / 2, width: spec.width, height: spec.height };
}

export function validateWaves(waves = WAVES) {
  const waveIds = new Set();
  for (const wave of waves) {
    if (!wave.id || waveIds.has(wave.id)) throw new Error('Space Shooter wave ids must be unique.');
    waveIds.add(wave.id);
    if (!Number.isInteger(wave.shotEvery) || wave.shotEvery < 30) throw new Error(`${wave.id}: invalid shot cadence.`);
    if (!Array.isArray(wave.enemies) || wave.enemies.length < 4) throw new Error(`${wave.id}: too few enemies.`);
    const enemyIds = new Set();
    for (const enemy of wave.enemies) {
      if (!enemy.id || enemyIds.has(enemy.id)) throw new Error(`${wave.id}: duplicate enemy id.`);
      enemyIds.add(enemy.id);
      if (!ENEMY_SPECS[enemy.type]) throw new Error(`${wave.id}: unknown enemy type ${enemy.type}.`);
      if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) || enemy.x < 18 || enemy.x > WORLD_WIDTH - 18 || enemy.y < 20 || enemy.y > 150) throw new Error(`${wave.id}: enemy outside spawn band.`);
      if (enemy.drop !== null && !['spread', 'shield', 'rapid'].includes(enemy.drop)) throw new Error(`${wave.id}: invalid drop.`);
    }
  }
  return true;
}

export function spawnWave(waveIndex) {
  const wave = WAVES[waveIndex];
  if (!wave) throw new RangeError('Invalid Space Shooter wave.');
  return wave.enemies.map((enemy, index) => {
    const spec = ENEMY_SPECS[enemy.type];
    return {
      ...enemy,
      hp: spec.hp,
      maxHp: spec.hp,
      direction: index % 2 === 0 ? 1 : -1,
      anchorX: enemy.x,
    };
  });
}

export function createGame({ waveIndex = 0, score = 0, lives = STARTING_LIVES } = {}) {
  if (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex >= WAVES.length) throw new RangeError('Invalid Space Shooter wave.');
  return {
    waveIndex,
    score,
    lives,
    player: {
      x: WORLD_WIDTH / 2,
      y: PLAYER_Y,
      fireCooldown: 0,
      shieldTicks: 0,
      spreadTicks: 0,
      rapidTicks: 0,
    },
    enemies: spawnWave(waveIndex),
    bullets: [],
    enemyBullets: [],
    powerUps: [],
    tick: 0,
    status: 'running',
  };
}

export function movePlayer(state, direction, distance = PLAYER_SPEED) {
  if (state.status !== 'running' || !DIRECTIONS[direction] || !Number.isFinite(distance) || distance <= 0) return state;
  const vector = DIRECTIONS[direction];
  const halfW = PLAYER_WIDTH / 2;
  const halfH = PLAYER_HEIGHT / 2;
  const player = {
    ...state.player,
    x: clamp(state.player.x + vector.x * distance, halfW, WORLD_WIDTH - halfW),
    y: clamp(state.player.y + vector.y * distance, WORLD_HEIGHT * 0.54, WORLD_HEIGHT - halfH - 8),
  };
  if (player.x === state.player.x && player.y === state.player.y) return state;
  return { ...state, player };
}

export function setPlayerPosition(state, x, y = state.player.y) {
  if (state.status !== 'running' || !Number.isFinite(x) || !Number.isFinite(y)) return state;
  const halfW = PLAYER_WIDTH / 2;
  const halfH = PLAYER_HEIGHT / 2;
  const player = {
    ...state.player,
    x: clamp(x, halfW, WORLD_WIDTH - halfW),
    y: clamp(y, WORLD_HEIGHT * 0.54, WORLD_HEIGHT - halfH - 8),
  };
  return player.x === state.player.x && player.y === state.player.y ? state : { ...state, player };
}

export function firePlayer(state) {
  if (state.status !== 'running' || state.player.fireCooldown > 0) return state;
  const spread = state.player.spreadTicks > 0;
  const bullets = spread
    ? [
      { x: state.player.x - 5, y: state.player.y - 14, vx: -1.55, vy: -BULLET_SPEED },
      { x: state.player.x, y: state.player.y - 16, vx: 0, vy: -BULLET_SPEED - 0.35 },
      { x: state.player.x + 5, y: state.player.y - 14, vx: 1.55, vy: -BULLET_SPEED },
    ]
    : [{ x: state.player.x, y: state.player.y - 16, vx: 0, vy: -BULLET_SPEED }];
  return {
    ...state,
    player: { ...state.player, fireCooldown: state.player.rapidTicks > 0 ? 5 : 10 },
    bullets: [...state.bullets, ...bullets],
  };
}

export function togglePause(state) {
  if (state.status === 'running') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'running' };
  return state;
}

export function applyPowerUp(state, type) {
  if (type === 'shield') return { ...state, player: { ...state.player, shieldTicks: SHIELD_TICKS } };
  if (type === 'spread') return { ...state, player: { ...state.player, spreadTicks: POWER_TICKS } };
  if (type === 'rapid') return { ...state, player: { ...state.player, rapidTicks: POWER_TICKS, fireCooldown: Math.min(state.player.fireCooldown, 4) } };
  return state;
}

function moveEnemy(enemy, tick, delta) {
  const spec = ENEMY_SPECS[enemy.type];
  if (enemy.type === 'diver') {
    const y = enemy.y + spec.speed * 1.18 * delta;
    const wrappedY = y > WORLD_HEIGHT + 28 ? 42 + (enemy.phase % 36) : y;
    const x = clamp(enemy.anchorX + Math.sin((tick + enemy.phase) / 15) * 42, 16, WORLD_WIDTH - 16);
    return { ...enemy, x, y: wrappedY };
  }

  let x = enemy.x + spec.speed * enemy.direction * delta;
  let direction = enemy.direction;
  if (x < 18 || x > WORLD_WIDTH - 18) {
    direction *= -1;
    x = clamp(x, 18, WORLD_WIDTH - 18);
  }
  const y = enemy.y + (enemy.type === 'tank' ? 0.045 : 0.075) * delta;
  return { ...enemy, x, y, direction };
}

function enemyShots(state, enemies, tick) {
  const wave = WAVES[state.waveIndex];
  const shots = [];
  for (const enemy of enemies) {
    const offset = (enemy.phase + enemy.id.charCodeAt(enemy.id.length - 1)) % wave.shotEvery;
    if (tick % wave.shotEvery !== offset) continue;
    const dx = state.player.x - enemy.x;
    const vx = clamp(dx / 90, -1.15, 1.15);
    shots.push({ x: enemy.x, y: enemy.y + 10, vx, vy: ENEMY_BULLET_SPEED + state.waveIndex * 0.2 });
  }
  return shots;
}

function resolvePlayerShots(state, bullets, enemies) {
  const remainingBullets = [];
  const enemyMap = new Map(enemies.map((enemy) => [enemy.id, { ...enemy }]));
  let score = state.score;
  const dropped = [];

  for (const bullet of bullets) {
    const target = [...enemyMap.values()].find((enemy) => enemy.hp > 0 && overlaps(projectileRect(bullet), enemyRect(enemy)));
    if (!target) {
      remainingBullets.push(bullet);
      continue;
    }
    target.hp -= 1;
    enemyMap.set(target.id, target);
    if (target.hp <= 0) {
      const spec = ENEMY_SPECS[target.type];
      score += spec.score;
      if (target.drop) dropped.push({ id: `${target.id}-${state.tick}`, type: target.drop, x: target.x, y: target.y });
    }
  }

  return {
    bullets: remainingBullets,
    enemies: [...enemyMap.values()].filter((enemy) => enemy.hp > 0),
    score,
    dropped,
  };
}

function collectPowerUps(state, powerUps, delta) {
  let next = state;
  const remaining = [];
  const player = playerRect(state.player);
  for (const powerUp of powerUps) {
    const moved = { ...powerUp, y: powerUp.y + 1.6 * delta };
    if (overlaps(powerRect(moved), player)) next = applyPowerUp(next, moved.type);
    else if (moved.y < WORLD_HEIGHT + 16) remaining.push(moved);
  }
  return { state: next, powerUps: remaining };
}

function damagePlayer(state) {
  if (state.player.shieldTicks > 0) return { ...state, enemyBullets: [] };
  const lives = state.lives - 1;
  if (lives <= 0) return { ...state, lives: 0, enemyBullets: [], status: 'gameover' };
  return {
    ...state,
    lives,
    enemyBullets: [],
    player: { ...state.player, x: WORLD_WIDTH / 2, y: PLAYER_Y, fireCooldown: 12 },
  };
}

function advanceWave(state) {
  if (state.enemies.length > 0 || state.status !== 'running') return state;
  if (state.waveIndex >= WAVES.length - 1) return { ...state, status: 'won', bullets: [], enemyBullets: [], powerUps: [] };
  const nextIndex = state.waveIndex + 1;
  return {
    ...state,
    waveIndex: nextIndex,
    enemies: spawnWave(nextIndex),
    bullets: [],
    enemyBullets: [],
    powerUps: [],
    player: { ...state.player, x: WORLD_WIDTH / 2, y: PLAYER_Y, fireCooldown: 16 },
  };
}

export function stepGame(state, delta = 1) {
  if (state.status !== 'running' || !Number.isFinite(delta) || delta <= 0) return state;
  const dt = Math.min(delta, 1.5);
  const tick = state.tick + 1;
  const player = {
    ...state.player,
    fireCooldown: Math.max(0, state.player.fireCooldown - 1),
    shieldTicks: Math.max(0, state.player.shieldTicks - 1),
    spreadTicks: Math.max(0, state.player.spreadTicks - 1),
    rapidTicks: Math.max(0, state.player.rapidTicks - 1),
  };

  const movedEnemies = state.enemies.map((enemy) => moveEnemy(enemy, tick, dt));
  const movedBullets = state.bullets
    .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * dt, y: bullet.y + bullet.vy * dt }))
    .filter((bullet) => bullet.y > -18 && bullet.x > -18 && bullet.x < WORLD_WIDTH + 18);
  const spawnedShots = enemyShots({ ...state, player }, movedEnemies, tick);
  const movedEnemyBullets = [...state.enemyBullets, ...spawnedShots]
    .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * dt, y: bullet.y + bullet.vy * dt }))
    .filter((bullet) => bullet.y < WORLD_HEIGHT + 18 && bullet.x > -18 && bullet.x < WORLD_WIDTH + 18);

  const resolved = resolvePlayerShots({ ...state, tick }, movedBullets, movedEnemies);
  let next = {
    ...state,
    tick,
    player,
    bullets: resolved.bullets,
    enemyBullets: movedEnemyBullets,
    enemies: resolved.enemies,
    score: resolved.score,
    powerUps: [...state.powerUps, ...resolved.dropped],
  };

  const collected = collectPowerUps(next, next.powerUps, dt);
  next = { ...collected.state, powerUps: collected.powerUps };

  const playerBox = playerRect(next.player);
  const hitByShot = next.enemyBullets.some((bullet) => overlaps(projectileRect(bullet), playerBox));
  const hitByEnemy = next.enemies.some((enemy) => overlaps(enemyRect(enemy), playerBox));
  if (hitByShot || hitByEnemy) next = damagePlayer(next);

  return advanceWave(next);
}

export function restartRun() {
  return createGame();
}

export function enemySpec(type) {
  const spec = ENEMY_SPECS[type];
  return spec ? { ...spec } : null;
}
