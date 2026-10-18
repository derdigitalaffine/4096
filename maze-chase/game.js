import { LEVELS } from './levels.js';

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1, opposite: 'down' }),
  down: Object.freeze({ x: 0, y: 1, opposite: 'up' }),
  left: Object.freeze({ x: -1, y: 0, opposite: 'right' }),
  right: Object.freeze({ x: 1, y: 0, opposite: 'left' }),
});
export const POWER_TICKS = 28;
export const STARTING_LIVES = 3;

const ENEMY_PROFILES = Object.freeze({
  H: Object.freeze({ profile: 'hunter', priority: Object.freeze(['up', 'left', 'down', 'right']) }),
  A: Object.freeze({ profile: 'ambusher', priority: Object.freeze(['left', 'up', 'right', 'down']) }),
  R: Object.freeze({ profile: 'patrol', priority: Object.freeze(['right', 'down', 'left', 'up']) }),
});

export function positionKey(position) {
  return `${position.x},${position.y}`;
}

export function validateLevel(level) {
  if (!level || typeof level !== 'object' || !Array.isArray(level.map) || level.map.length < 5) return false;
  const width = level.map[0]?.length ?? 0;
  if (width < 5 || level.map.some((row) => typeof row !== 'string' || row.length !== width)) return false;
  if (!Number.isInteger(level.tickMs) || level.tickMs < 60) return false;

  let players = 0;
  let enemies = 0;
  for (let y = 0; y < level.map.length; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = level.map[y][x];
      if (!'#.o PHAR'.includes(cell)) return false;
      if ((x === 0 || y === 0 || x === width - 1 || y === level.map.length - 1) && cell !== '#') return false;
      if (cell === 'P') players += 1;
      if (Object.hasOwn(ENEMY_PROFILES, cell)) enemies += 1;
    }
  }
  return players === 1 && enemies >= 2;
}

function parseLevel(level) {
  if (!validateLevel(level)) throw new Error('Ungültiges Maze-Chase-Level.');
  const walls = [];
  const pellets = [];
  const powers = [];
  const enemies = [];
  let playerSpawn = null;

  for (let y = 0; y < level.map.length; y += 1) {
    for (let x = 0; x < level.map[y].length; x += 1) {
      const cell = level.map[y][x];
      const position = { x, y };
      if (cell === '#') walls.push(position);
      else if (cell === 'o') powers.push(position);
      else if (cell === 'P') playerSpawn = position;
      else if (Object.hasOwn(ENEMY_PROFILES, cell)) {
        const config = ENEMY_PROFILES[cell];
        enemies.push({
          id: `${config.profile}-${enemies.length + 1}`,
          profile: config.profile,
          x,
          y,
          spawn: { x, y },
          direction: null,
        });
      }
      if (cell !== '#' && cell !== 'P' && !Object.hasOwn(ENEMY_PROFILES, cell) && cell !== 'o') pellets.push(position);
    }
  }
  return {
    width: level.map[0].length,
    height: level.map.length,
    walls,
    pellets,
    powers,
    playerSpawn,
    enemies,
  };
}

export function createGame(levelIndex = 0, carry = {}) {
  const safeIndex = Number.isInteger(levelIndex) && levelIndex >= 0 && levelIndex < LEVELS.length ? levelIndex : 0;
  const level = LEVELS[safeIndex];
  const parsed = parseLevel(level);
  const lives = Number.isInteger(carry.lives) && carry.lives > 0 ? carry.lives : STARTING_LIVES;
  const score = Number.isInteger(carry.score) && carry.score >= 0 ? carry.score : 0;
  return {
    levelIndex: safeIndex,
    levelId: level.id,
    width: parsed.width,
    height: parsed.height,
    walls: parsed.walls,
    pellets: parsed.pellets,
    powers: parsed.powers,
    player: { ...parsed.playerSpawn, spawn: { ...parsed.playerSpawn }, direction: null, nextDirection: null },
    enemies: parsed.enemies,
    score,
    lives,
    powerTicks: 0,
    tick: 0,
    paused: false,
    over: false,
    won: false,
  };
}

export function tickMsForState(state) {
  return LEVELS[state.levelIndex]?.tickMs ?? LEVELS[0].tickMs;
}

export function isWall(state, position) {
  const key = positionKey(position);
  return state.walls.some((wall) => positionKey(wall) === key);
}

export function canMove(state, position, direction) {
  const vector = DIRECTIONS[direction];
  if (!vector) return false;
  const next = { x: position.x + vector.x, y: position.y + vector.y };
  return next.x >= 0 && next.y >= 0 && next.x < state.width && next.y < state.height && !isWall(state, next);
}

export function queueDirection(state, direction) {
  if (!DIRECTIONS[direction] || state.over) return state;
  return { ...state, player: { ...state.player, nextDirection: direction } };
}

export function setPaused(state, paused) {
  if (state.over) return state;
  return { ...state, paused: Boolean(paused) };
}

function movePosition(position, direction) {
  const vector = DIRECTIONS[direction];
  return vector ? { x: position.x + vector.x, y: position.y + vector.y } : { x: position.x, y: position.y };
}

function playerStep(state) {
  const { player } = state;
  let direction = player.direction;
  if (player.nextDirection && canMove(state, player, player.nextDirection)) direction = player.nextDirection;
  if (!direction || !canMove(state, player, direction)) return { ...player, direction, nextDirection: player.nextDirection };
  const next = movePosition(player, direction);
  return { ...player, ...next, direction, nextDirection: player.nextDirection };
}

function projectPlayer(player, distance = 3) {
  const direction = player.direction ?? player.nextDirection;
  if (!direction) return { x: player.x, y: player.y };
  const vector = DIRECTIONS[direction];
  return { x: player.x + vector.x * distance, y: player.y + vector.y * distance };
}

function patrolTarget(state) {
  const phase = Math.floor(state.tick / 16) % 4;
  const targets = [
    { x: 1, y: 1 },
    { x: state.width - 2, y: 1 },
    { x: state.width - 2, y: state.height - 2 },
    { x: 1, y: state.height - 2 },
  ];
  return targets[phase];
}

function targetForEnemy(state, enemy, player) {
  if (enemy.profile === 'ambusher') return projectPlayer(player, 3);
  if (enemy.profile === 'patrol') return patrolTarget(state);
  return { x: player.x, y: player.y };
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function availableDirections(state, enemy) {
  const all = Object.keys(DIRECTIONS).filter((direction) => canMove(state, enemy, direction));
  if (all.length <= 1 || !enemy.direction) return all;
  const reverse = DIRECTIONS[enemy.direction].opposite;
  const withoutReverse = all.filter((direction) => direction !== reverse);
  return withoutReverse.length ? withoutReverse : all;
}

export function chooseEnemyDirection(state, enemy, player = state.player) {
  const options = availableDirections(state, enemy);
  if (!options.length) return null;
  const marker = enemy.profile === 'hunter' ? 'H' : enemy.profile === 'ambusher' ? 'A' : 'R';
  const priority = ENEMY_PROFILES[marker].priority;
  const target = targetForEnemy(state, enemy, player);
  const vulnerable = state.powerTicks > 0;
  return [...options].sort((a, b) => {
    const distanceA = manhattan(movePosition(enemy, a), vulnerable ? player : target);
    const distanceB = manhattan(movePosition(enemy, b), vulnerable ? player : target);
    if (distanceA !== distanceB) return vulnerable ? distanceB - distanceA : distanceA - distanceB;
    return priority.indexOf(a) - priority.indexOf(b);
  })[0];
}

function enemiesStep(state, player) {
  const cadence = state.levelIndex >= 2 ? 1 : 2;
  if ((state.tick + 1) % cadence !== 0) return state.enemies.map((enemy) => ({ ...enemy, spawn: { ...enemy.spawn } }));
  return state.enemies.map((enemy) => {
    const direction = chooseEnemyDirection(state, enemy, player);
    if (!direction) return { ...enemy, spawn: { ...enemy.spawn } };
    const next = movePosition(enemy, direction);
    return { ...enemy, ...next, direction, spawn: { ...enemy.spawn } };
  });
}

function withoutPosition(items, position) {
  const key = positionKey(position);
  return items.filter((item) => positionKey(item) !== key);
}

function resetActors(state) {
  return {
    ...state,
    player: { ...state.player, ...state.player.spawn, direction: null, nextDirection: null },
    enemies: state.enemies.map((enemy) => ({ ...enemy, ...enemy.spawn, direction: null, spawn: { ...enemy.spawn } })),
    powerTicks: 0,
  };
}

function collisionIndexes(previousPlayer, nextPlayer, previousEnemies, nextEnemies) {
  const collisions = [];
  nextEnemies.forEach((enemy, index) => {
    const same = enemy.x === nextPlayer.x && enemy.y === nextPlayer.y;
    const crossed = previousEnemies[index].x === nextPlayer.x && previousEnemies[index].y === nextPlayer.y
      && enemy.x === previousPlayer.x && enemy.y === previousPlayer.y;
    if (same || crossed) collisions.push(index);
  });
  return collisions;
}

function advanceLevel(state) {
  if (state.pellets.length || state.powers.length) return state;
  if (state.levelIndex >= LEVELS.length - 1) return { ...state, over: true, won: true, paused: false };
  return createGame(state.levelIndex + 1, { score: state.score + 500, lives: state.lives });
}

export function stepGame(state) {
  if (state.over || state.paused) return state;
  const previousPlayer = state.player;
  const previousEnemies = state.enemies;
  const player = playerStep(state);
  let pellets = state.pellets;
  let powers = state.powers;
  let score = state.score;
  let powerTicks = Math.max(0, state.powerTicks - 1);
  const playerKey = positionKey(player);

  if (pellets.some((item) => positionKey(item) === playerKey)) {
    pellets = withoutPosition(pellets, player);
    score += 10;
  }
  if (powers.some((item) => positionKey(item) === playerKey)) {
    powers = withoutPosition(powers, player);
    score += 50;
    powerTicks = POWER_TICKS;
  }

  let movingState = { ...state, player, pellets, powers, score, powerTicks };
  let enemies = enemiesStep(movingState, player);
  const collisions = collisionIndexes(previousPlayer, player, previousEnemies, enemies);

  if (collisions.length && powerTicks > 0) {
    const collided = new Set(collisions);
    enemies = enemies.map((enemy, index) => collided.has(index)
      ? { ...enemy, ...enemy.spawn, direction: null, spawn: { ...enemy.spawn } }
      : enemy);
    score += collisions.length * 200;
  } else if (collisions.length) {
    const lives = state.lives - 1;
    movingState = { ...movingState, enemies, score, lives, tick: state.tick + 1 };
    if (lives <= 0) return { ...movingState, over: true, won: false, paused: false };
    return resetActors(movingState);
  }

  const next = {
    ...movingState,
    enemies,
    score,
    tick: state.tick + 1,
  };
  return advanceLevel(next);
}
