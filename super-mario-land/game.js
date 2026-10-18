export const WORLD_HEIGHT = 450;
export const GROUND_Y = 384;
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
const AUTO_SCROLL_SPEED = 0.48;

const ground = (x, width) => ({ x, y: GROUND_Y, width, height: WORLD_HEIGHT - GROUND_Y });
const ledge = (x, y, width, height = 32) => ({ x, y, width, height });
const pipe = (x, height) => ({ x, y: GROUND_Y - height, width: 48, height });
const coinLine = (x, y, count, step = 64) => Array.from({ length: count }, (_, index) => ({ x: x + index * step, y }));
const enemies = (...xs) => xs.map((x, index) => ({ x, direction: index % 2 === 0 ? -1 : 1 }));
const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

function stage({ world, stage, name, environment, width, goalX, parTime, autoScroll = false, finale = false, solids, blocks, coins, enemies: stageEnemies }) {
  return Object.freeze({
    world,
    stage,
    id: `${world}-${stage}`,
    name,
    environment,
    width,
    goalX,
    parTime,
    autoScroll,
    finale,
    solids: freezeItems(solids),
    blocks: freezeItems(blocks),
    coins: freezeItems(coins),
    enemies: freezeItems(stageEnemies),
  });
}

export const LEVELS = Object.freeze([
  stage({
    world: 1, stage: 1, name: 'Dünenpfad', environment: 'desert', width: 3040, goalX: 2880, parTime: 115,
    solids: [ground(0, 704), ground(800, 608), ground(1504, 640), ground(2240, 800), ledge(288, 304, 160), ledge(960, 288, 128), pipe(1248, 64), ledge(1648, 320, 160), pipe(2016, 96), ledge(2400, 288, 192), ledge(2704, 240, 128)],
    blocks: [{ x: 544, y: 288, powerup: 'mushroom' }, { x: 1840, y: 272, powerup: 'flower' }],
    coins: [...coinLine(192, 334, 3), ...coinLine(320, 258, 3), ...coinLine(864, 334, 3), ...coinLine(992, 242, 2), ...coinLine(1584, 334, 2), ...coinLine(1680, 274, 2), ...coinLine(2320, 334, 2), ...coinLine(2432, 242, 3)],
    enemies: enemies(480, 928, 1328, 1712, 2072, 2504),
  }),
  stage({
    world: 1, stage: 2, name: 'Pyramidenstufen', environment: 'desert', width: 3200, goalX: 3040, parTime: 125,
    solids: [ground(0, 576), ground(672, 576), ground(1344, 480), ground(1920, 512), ground(2528, 672), ledge(256, 320, 128), ledge(736, 288, 128), ledge(1056, 240, 128), ledge(1408, 304, 160), ledge(1696, 240, 96), pipe(2080, 80), ledge(2288, 272, 128), ledge(2608, 304, 128), ledge(2848, 240, 160)],
    blocks: [{ x: 512, y: 288, powerup: 'mushroom' }, { x: 1808, y: 272, powerup: 'flower' }],
    coins: [...coinLine(160, 334, 3), ...coinLine(288, 274, 2), ...coinLine(720, 334, 2), ...coinLine(768, 242, 2), ...coinLine(1088, 194, 2), ...coinLine(1440, 258, 3), ...coinLine(1984, 334, 2), ...coinLine(2320, 226, 2), ...coinLine(2640, 258, 3)],
    enemies: enemies(448, 832, 1184, 1488, 2016, 2368, 2784),
  }),
  stage({
    world: 1, stage: 3, name: 'Tempeltor', environment: 'ruins', width: 3360, goalX: 3200, parTime: 135, finale: true,
    solids: [ground(0, 480), ground(576, 448), ground(1120, 416), ground(1632, 448), ground(2176, 416), ground(2688, 672), ledge(192, 288, 96), pipe(416, 96), ledge(640, 240, 128), ledge(896, 304, 96), ledge(1184, 256, 128), pipe(1488, 80), ledge(1696, 208, 128), ledge(1952, 288, 96), pipe(2432, 96), ledge(2720, 240, 128), ledge(3008, 192, 128)],
    blocks: [{ x: 800, y: 272, powerup: 'mushroom' }, { x: 2112, y: 256, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(224, 242, 2), ...coinLine(624, 334, 2), ...coinLine(672, 194, 2), ...coinLine(1216, 210, 3), ...coinLine(1696, 162, 2), ...coinLine(2208, 334, 2), ...coinLine(2752, 194, 3), ...coinLine(3040, 146, 2)],
    enemies: enemies(352, 720, 960, 1280, 1744, 2048, 2320, 2816, 3104),
  }),
  stage({
    world: 2, stage: 1, name: 'Küstenpfad', environment: 'coast', width: 3120, goalX: 2960, parTime: 120,
    solids: [ground(0, 640), ground(768, 544), ground(1440, 608), ground(2208, 912), ledge(288, 304, 160), ledge(832, 272, 160), pipe(1168, 64), ledge(1504, 320, 128), ledge(1760, 256, 160), pipe(2112, 80), ledge(2368, 288, 128), ledge(2704, 240, 160)],
    blocks: [{ x: 544, y: 288, powerup: 'mushroom' }, { x: 2000, y: 272, powerup: 'flower' }],
    coins: [...coinLine(160, 334, 3), ...coinLine(320, 258, 3), ...coinLine(800, 334, 2), ...coinLine(864, 226, 3), ...coinLine(1472, 334, 2), ...coinLine(1536, 274, 2), ...coinLine(2240, 334, 3), ...coinLine(2400, 242, 2), ...coinLine(2736, 194, 2)],
    enemies: enemies(496, 880, 1200, 1568, 1856, 2312, 2784),
  }),
  stage({
    world: 2, stage: 2, name: 'Riffbrücken', environment: 'coast', width: 3280, goalX: 3120, parTime: 130,
    solids: [ground(0, 512), ground(672, 448), ground(1280, 480), ground(1920, 448), ground(2528, 752), ledge(224, 304, 128), ledge(704, 240, 128), ledge(960, 304, 96), ledge(1312, 256, 160), ledge(1600, 208, 96), ledge(1952, 288, 128), ledge(2208, 224, 128), ledge(2592, 272, 160), ledge(2880, 208, 160)],
    blocks: [{ x: 544, y: 272, powerup: 'mushroom' }, { x: 2384, y: 256, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(256, 258, 2), ...coinLine(704, 194, 2), ...coinLine(960, 258, 2), ...coinLine(1344, 210, 3), ...coinLine(1632, 162, 2), ...coinLine(1984, 242, 2), ...coinLine(2240, 178, 2), ...coinLine(2624, 226, 3), ...coinLine(2912, 162, 2)],
    enemies: enemies(416, 736, 1056, 1376, 1664, 2016, 2304, 2656, 3008),
  }),
  stage({
    world: 2, stage: 3, name: 'Strömungslauf', environment: 'tide', width: 3440, goalX: 3280, parTime: 140, autoScroll: true, finale: true,
    solids: [ground(0, 448), ground(576, 384), ground(1088, 416), ground(1632, 384), ground(2144, 416), ground(2688, 752), ledge(160, 304, 128), ledge(608, 256, 96), ledge(832, 192, 96), ledge(1120, 304, 128), ledge(1408, 224, 96), ledge(1664, 272, 128), ledge(1920, 192, 96), ledge(2176, 304, 128), ledge(2464, 224, 96), ledge(2720, 272, 128), ledge(3008, 192, 128)],
    blocks: [{ x: 96, y: 272, powerup: 'mushroom' }, { x: 2176, y: 256, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(192, 258, 2), ...coinLine(608, 210, 2), ...coinLine(832, 146, 2), ...coinLine(1152, 258, 2), ...coinLine(1440, 178, 2), ...coinLine(1696, 226, 2), ...coinLine(1952, 146, 2), ...coinLine(2208, 258, 2), ...coinLine(2752, 226, 2), ...coinLine(3040, 146, 2)],
    enemies: enemies(368, 672, 912, 1200, 1488, 1744, 2016, 2256, 2528, 2816, 3136),
  }),
  stage({
    world: 3, stage: 1, name: 'Steinland', environment: 'stone', width: 3200, goalX: 3040, parTime: 125,
    solids: [ground(0, 608), ground(704, 576), ground(1376, 544), ground(2016, 480), ground(2592, 608), ledge(256, 304, 128), pipe(544, 80), ledge(768, 256, 160), ledge(1120, 304, 96), ledge(1440, 240, 128), pipe(1840, 96), ledge(2080, 288, 128), ledge(2336, 224, 96), ledge(2656, 272, 160), ledge(2944, 208, 96)],
    blocks: [{ x: 640, y: 288, powerup: 'mushroom' }, { x: 2528, y: 272, powerup: 'flower' }],
    coins: [...coinLine(160, 334, 2), ...coinLine(288, 258, 2), ...coinLine(736, 334, 2), ...coinLine(800, 210, 3), ...coinLine(1440, 194, 2), ...coinLine(2048, 334, 2), ...coinLine(2112, 242, 2), ...coinLine(2368, 178, 2), ...coinLine(2688, 226, 3), ...coinLine(2976, 162, 2)],
    enemies: enemies(448, 832, 1184, 1504, 1904, 2144, 2416, 2720, 2864),
  }),
  stage({
    world: 3, stage: 2, name: 'Höhlenstieg', environment: 'cave', width: 3360, goalX: 3200, parTime: 135,
    solids: [ground(0, 480), ground(608, 448), ground(1184, 416), ground(1728, 448), ground(2304, 416), ground(2848, 512), ledge(192, 320, 96), ledge(640, 272, 128), ledge(896, 208, 96), ledge(1216, 304, 128), ledge(1472, 240, 96), ledge(1760, 288, 128), ledge(2048, 224, 96), ledge(2336, 272, 128), ledge(2592, 192, 96), ledge(2880, 256, 128), ledge(3136, 192, 96)],
    blocks: [{ x: 512, y: 272, powerup: 'mushroom' }, { x: 2208, y: 256, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(224, 274, 2), ...coinLine(640, 226, 2), ...coinLine(896, 162, 2), ...coinLine(1248, 258, 2), ...coinLine(1504, 194, 2), ...coinLine(1792, 242, 2), ...coinLine(2080, 178, 2), ...coinLine(2368, 226, 2), ...coinLine(2624, 146, 2), ...coinLine(2912, 210, 2), ...coinLine(3168, 146, 2)],
    enemies: enemies(384, 688, 960, 1280, 1536, 1824, 2112, 2400, 2656, 2944, 3040),
  }),
  stage({
    world: 3, stage: 3, name: 'Golemfestung', environment: 'ruins', width: 3520, goalX: 3360, parTime: 145, finale: true,
    solids: [ground(0, 416), ground(544, 384), ground(1056, 384), ground(1568, 384), ground(2080, 384), ground(2592, 384), ground(3104, 416), ledge(160, 288, 96), pipe(400, 112), ledge(576, 224, 128), ledge(832, 304, 96), pipe(1200, 96), ledge(1600, 240, 128), ledge(1856, 176, 96), pipe(2368, 112), ledge(2624, 224, 128), ledge(2880, 160, 96), ledge(3136, 256, 128)],
    blocks: [{ x: 960, y: 272, powerup: 'mushroom' }, { x: 2496, y: 240, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(192, 242, 2), ...coinLine(576, 178, 2), ...coinLine(832, 258, 2), ...coinLine(1088, 334, 2), ...coinLine(1632, 194, 2), ...coinLine(1888, 130, 2), ...coinLine(2112, 334, 2), ...coinLine(2656, 178, 2), ...coinLine(2912, 114, 2), ...coinLine(3168, 210, 2)],
    enemies: enemies(320, 640, 896, 1120, 1376, 1664, 1920, 2176, 2432, 2688, 2976, 3232),
  }),
  stage({
    world: 4, stage: 1, name: 'Bambushain', environment: 'bamboo', width: 3240, goalX: 3080, parTime: 125,
    solids: [ground(0, 576), ground(704, 544), ground(1376, 544), ground(2048, 480), ground(2656, 584), ledge(256, 304, 128), ledge(768, 272, 128), pipe(1136, 80), ledge(1440, 224, 128), ledge(1728, 288, 96), pipe(2400, 96), ledge(2688, 240, 160), ledge(2976, 304, 96)],
    blocks: [{ x: 608, y: 288, powerup: 'mushroom' }, { x: 1952, y: 256, powerup: 'flower' }],
    coins: [...coinLine(160, 334, 3), ...coinLine(288, 258, 2), ...coinLine(736, 334, 2), ...coinLine(800, 226, 2), ...coinLine(1440, 178, 3), ...coinLine(1760, 242, 2), ...coinLine(2080, 334, 2), ...coinLine(2720, 194, 3), ...coinLine(3008, 258, 2)],
    enemies: enemies(448, 800, 1184, 1504, 1792, 2144, 2464, 2784, 2912),
  }),
  stage({
    world: 4, stage: 2, name: 'Bergtempel', environment: 'mountain', width: 3400, goalX: 3240, parTime: 140,
    solids: [ground(0, 448), ground(576, 416), ground(1120, 384), ground(1632, 416), ground(2176, 384), ground(2688, 712), ledge(160, 320, 96), ledge(608, 272, 128), ledge(864, 208, 96), ledge(1152, 288, 128), ledge(1408, 224, 96), ledge(1664, 256, 128), ledge(1920, 192, 96), ledge(2208, 288, 128), ledge(2464, 224, 96), ledge(2720, 256, 128), ledge(2976, 192, 128)],
    blocks: [{ x: 480, y: 272, powerup: 'mushroom' }, { x: 2592, y: 240, powerup: 'flower' }],
    coins: [...coinLine(128, 334, 2), ...coinLine(192, 274, 2), ...coinLine(608, 226, 2), ...coinLine(864, 162, 2), ...coinLine(1184, 242, 2), ...coinLine(1440, 178, 2), ...coinLine(1696, 210, 2), ...coinLine(1952, 146, 2), ...coinLine(2240, 242, 2), ...coinLine(2496, 178, 2), ...coinLine(2752, 210, 2), ...coinLine(3008, 146, 2)],
    enemies: enemies(352, 640, 928, 1216, 1472, 1728, 1984, 2272, 2528, 2784, 3072),
  }),
  stage({
    world: 4, stage: 3, name: 'Wolkensturm', environment: 'sky', width: 3600, goalX: 3440, parTime: 150, autoScroll: true, finale: true,
    solids: [ground(0, 384), ground(512, 352), ground(992, 352), ground(1472, 352), ground(1952, 352), ground(2432, 352), ground(2912, 688), ledge(128, 288, 96), ledge(544, 224, 96), ledge(768, 160, 96), ledge(1024, 272, 128), ledge(1280, 192, 96), ledge(1504, 240, 128), ledge(1760, 160, 96), ledge(1984, 272, 128), ledge(2240, 192, 96), ledge(2464, 240, 128), ledge(2720, 160, 96), ledge(2944, 272, 128), ledge(3200, 192, 128)],
    blocks: [{ x: 96, y: 272, powerup: 'mushroom' }, { x: 1984, y: 224, powerup: 'flower' }],
    coins: [...coinLine(96, 334, 2), ...coinLine(160, 242, 2), ...coinLine(544, 178, 2), ...coinLine(768, 114, 2), ...coinLine(1056, 226, 2), ...coinLine(1312, 146, 2), ...coinLine(1536, 194, 2), ...coinLine(1792, 114, 2), ...coinLine(2016, 226, 2), ...coinLine(2272, 146, 2), ...coinLine(2496, 194, 2), ...coinLine(2752, 114, 2), ...coinLine(2976, 226, 2), ...coinLine(3232, 146, 2)],
    enemies: enemies(288, 576, 832, 1088, 1344, 1568, 1824, 2048, 2304, 2528, 2784, 3040, 3296),
  }),
]);

export const LEVEL_COUNT = LEVELS.length;
export const WORLD_COUNT = 4;
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
  const index = typeof stateOrIndex === 'object' && stateOrIndex !== null ? stateOrIndex.levelIndex : stateOrIndex;
  return LEVELS[normalizedLevelIndex(index)];
}

export function stageLabel(stateOrIndex = 0) {
  const level = getLevel(stateOrIndex);
  return `${level.world}-${level.stage}`;
}

function playerSpawn() {
  return { x: 64, y: GROUND_Y - PLAYER_HEIGHT, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, vx: 0, vy: 0, onGround: true, facing: 1 };
}

function createLevelState(levelIndex, score, lives, power = 'small') {
  const normalized = normalizedLevelIndex(levelIndex);
  const level = LEVELS[normalized];
  return {
    levelIndex: normalized,
    player: playerSpawn(),
    blocks: level.blocks.map((block, index) => ({ ...block, id: index, width: QUESTION_BLOCK_SIZE, height: QUESTION_BLOCK_SIZE, used: false })),
    powerups: [], projectiles: [], nextEntityId: 0, fireCooldown: 0, invulnerable: 0, power,
    coins: level.coins.map((coin, index) => ({ ...coin, id: index, collected: false })),
    enemies: level.enemies.map((enemy, index) => ({ id: index, x: enemy.x, y: GROUND_Y - 24, width: 26, height: 24, vx: ENEMY_SPEED * enemy.direction, alive: true })),
    score, lives, status: 'playing', elapsed: 0,
  };
}

export function createGame(startLevelIndex = 0) { return createLevelState(startLevelIndex, 0, 3, 'small'); }

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function blockRect(block) { return { x: block.x, y: block.y, width: block.width, height: block.height }; }
function collisionItems(level, blocks) { return [...level.solids.map((solid) => ({ ...solid, blockId: null })), ...blocks.map((block) => ({ ...blockRect(block), blockId: block.id }))]; }
function pointHitsSolid(solids, x, y) { return solids.some((solid) => x >= solid.x && x <= solid.x + solid.width && y >= solid.y && y <= solid.y + solid.height); }

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
    if (deltaY > 0) { moved.y = solid.y - moved.height; moved.vy = 0; moved.onGround = true; }
    else if (deltaY < 0) { moved.y = solid.y + solid.height; moved.vy = 0; if (solid.blockId !== null) hitBlockId = solid.blockId; }
  }
  return { player: moved, hitBlockId };
}

function loseLife(state) {
  const lives = state.lives - 1;
  if (lives <= 0) return { ...state, lives: 0, power: 'small', invulnerable: 0, projectiles: [], status: 'lost', player: { ...state.player, vx: 0, vy: 0 } };
  return { ...state, lives, power: 'small', invulnerable: 0, projectiles: [], player: playerSpawn() };
}

function takeEnemyHit(state) {
  if (state.invulnerable > 0) return state;
  if (state.power === 'flower') return { ...state, power: 'mushroom', invulnerable: HIT_INVULNERABILITY, player: { ...state.player, vy: -JUMP_SPEED * 0.3, onGround: false } };
  if (state.power === 'mushroom') return { ...state, power: 'small', invulnerable: HIT_INVULNERABILITY, player: { ...state.player, vy: -JUMP_SPEED * 0.3, onGround: false } };
  return loseLife(state);
}

function moveEnemies(currentEnemies, seconds, level) {
  return currentEnemies.map((enemy) => {
    if (!enemy.alive) return { ...enemy };
    let vx = enemy.vx;
    let x = enemy.x + vx * seconds;
    const probe = { ...enemy, x };
    const hitWall = level.solids.some((solid) => overlaps(probe, solid));
    const leadingX = vx > 0 ? x + enemy.width + 2 : x - 2;
    const hasFloor = pointHitsSolid(level.solids, leadingX, enemy.y + enemy.height + 3);
    if (hitWall || !hasFloor) { vx *= -1; x = enemy.x + vx * seconds; }
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
  state.powerups.push({ id, type: block.powerup, x: block.x + (QUESTION_BLOCK_SIZE - POWERUP_SIZE) / 2, y: block.y - POWERUP_SIZE - 2, width: POWERUP_SIZE, height: POWERUP_SIZE, collected: false });
  state.score += 50;
  return state;
}

function collectPowerups(state) {
  for (const item of state.powerups) {
    if (item.collected || !overlaps(state.player, item)) continue;
    item.collected = true;
    if (item.type === 'flower') { state.power = 'flower'; state.score += 800; }
    else { if (state.power === 'small') state.power = 'mushroom'; state.score += 500; }
  }
  return state;
}

function spawnProjectile(state) {
  if (state.power !== 'flower' || state.fireCooldown > 0) return state;
  const direction = state.player.facing < 0 ? -1 : 1;
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.projectiles.push({ id, x: direction > 0 ? state.player.x + state.player.width : state.player.x - PROJECTILE_SIZE, y: state.player.y + 10, width: PROJECTILE_SIZE, height: PROJECTILE_SIZE, vx: PROJECTILE_SPEED * direction });
  state.fireCooldown = FIRE_COOLDOWN;
  return state;
}

function moveProjectiles(state, seconds, level) {
  const solids = collisionItems(level, state.blocks);
  state.projectiles = state.projectiles.map((projectile) => ({ ...projectile, x: projectile.x + projectile.vx * seconds })).filter((projectile) => projectile.x + projectile.width >= 0 && projectile.x <= level.width && !solids.some((solid) => overlaps(projectile, solid)));
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
  if (state.levelIndex >= LEVEL_COUNT - 1) return { ...state, score, status: 'won', player: { ...state.player, vx: 0 } };
  return createLevelState(state.levelIndex + 1, score, state.lives, state.power);
}

export function stepGame(current, input = {}, deltaSeconds = 0) {
  if (current.status !== 'playing') return current;
  const level = getLevel(current);
  const seconds = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  let player = { ...current.player };
  const previousBottom = player.y + player.height;
  const requestedHorizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const horizontal = level.autoScroll ? Math.max(AUTO_SCROLL_SPEED, requestedHorizontal) : requestedHorizontal;
  player.vx = horizontal * MOVE_SPEED;
  if (requestedHorizontal !== 0) player.facing = requestedHorizontal;
  else if (level.autoScroll) player.facing = 1;

  if (input.jump && player.onGround) { player.vy = -JUMP_SPEED; player.onGround = false; }

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
    if (stomped) { enemy.alive = false; next.player.vy = -JUMP_SPEED * 0.48; next.player.onGround = false; next.score += 200; continue; }
    return takeEnemyHit(next);
  }

  if (next.player.y > WORLD_HEIGHT + 64) return loseLife(next);
  if (next.player.x + next.player.width >= level.goalX) return clearLevel(next, level);
  return next;
}

export function collectedCoins(state) { return state.coins.filter((coin) => coin.collected).length; }
export function progressPercent(state) {
  const level = getLevel(state);
  return Math.max(0, Math.min(100, Math.round((state.player.x / level.goalX) * 100)));
}
