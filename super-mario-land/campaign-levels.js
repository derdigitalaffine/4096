export const WORLD_HEIGHT = 450;
export const GROUND_Y = 384;
export const WORLD_COUNT = 4;
export const STAGES_PER_WORLD = 3;

const LEVEL_CONFIGS = Object.freeze([
  { world: 1, stage: 1, name: 'Wiesenpfad', width: 3200, parTime: 120, gaps: [[640, 96], [1408, 96], [2208, 96]], platforms: 7, enemies: 5, seed: 1 },
  { world: 1, stage: 2, name: 'Höhenbrücke', width: 3328, parTime: 126, gaps: [[608, 96], [1344, 80], [2048, 112], [2784, 80]], platforms: 8, enemies: 6, seed: 2 },
  { world: 1, stage: 3, name: 'Steintor', width: 3456, parTime: 132, gaps: [[544, 96], [1184, 96], [1888, 112], [2656, 96]], platforms: 9, enemies: 7, seed: 3 },

  { world: 2, stage: 1, name: 'Dünenweg', width: 3584, parTime: 136, gaps: [[704, 96], [1456, 112], [2240, 96], [3008, 80]], platforms: 8, enemies: 7, seed: 4 },
  { world: 2, stage: 2, name: 'Säulenpfad', width: 3712, parTime: 142, gaps: [[576, 80], [1248, 112], [1984, 96], [2672, 112], [3296, 80]], platforms: 9, enemies: 8, seed: 5 },
  { world: 2, stage: 3, name: 'Pyramidenkern', width: 3840, parTime: 148, gaps: [[512, 96], [1120, 112], [1760, 96], [2432, 112], [3168, 96]], platforms: 10, enemies: 9, seed: 6 },

  { world: 3, stage: 1, name: 'Inselufer', width: 3968, parTime: 152, gaps: [[736, 112], [1504, 96], [2288, 112], [3104, 96], [3552, 80]], platforms: 9, enemies: 8, seed: 7 },
  { world: 3, stage: 2, name: 'Wolkenklippen', width: 4096, parTime: 158, gaps: [[608, 96], [1248, 112], [1920, 96], [2592, 112], [3264, 96], [3648, 80]], platforms: 11, enemies: 9, seed: 8 },
  { world: 3, stage: 3, name: 'Himmelsbastion', width: 4224, parTime: 164, gaps: [[544, 96], [1152, 112], [1792, 96], [2432, 112], [3104, 96], [3712, 96]], platforms: 11, enemies: 10, seed: 9 },

  { world: 4, stage: 1, name: 'Nachtgarten', width: 4352, parTime: 168, gaps: [[672, 96], [1344, 112], [2016, 96], [2688, 112], [3360, 96], [3936, 80]], platforms: 10, enemies: 9, seed: 10 },
  { world: 4, stage: 2, name: 'Maschinenwall', width: 4480, parTime: 174, gaps: [[576, 96], [1184, 112], [1824, 96], [2464, 112], [3136, 96], [3776, 112], [4144, 80]], platforms: 12, enemies: 10, seed: 11 },
  { world: 4, stage: 3, name: 'Sternenfestung', width: 4608, parTime: 180, gaps: [[512, 96], [1088, 112], [1696, 96], [2304, 112], [2944, 96], [3584, 112], [4192, 96]], platforms: 13, enemies: 12, seed: 12 },
]);

const HEIGHT_PATTERNS = Object.freeze([
  [304, 272, 320, 256, 288],
  [288, 240, 304, 224, 272],
  [272, 224, 304, 208, 256],
  [304, 256, 224, 288, 208],
]);

function freezeItems(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

function pointIsGrounded(x, gaps) {
  return !gaps.some(([gapX, gapWidth]) => x >= gapX && x <= gapX + gapWidth);
}

function safeGroundX(target, gaps, width) {
  let x = Math.max(128, Math.min(width - 256, target));
  for (const [gapX, gapWidth] of gaps) {
    if (x >= gapX - 24 && x <= gapX + gapWidth + 24) x = gapX + gapWidth + 72;
  }
  return Math.min(width - 256, x);
}

function createGround(width, gaps) {
  const solids = [];
  let cursor = 0;
  for (const [gapX, gapWidth] of gaps) {
    if (gapX > cursor) {
      solids.push({ x: cursor, y: GROUND_Y, width: gapX - cursor, height: WORLD_HEIGHT - GROUND_Y });
    }
    cursor = gapX + gapWidth;
  }
  if (cursor < width) solids.push({ x: cursor, y: GROUND_Y, width: width - cursor, height: WORLD_HEIGHT - GROUND_Y });
  return solids;
}

function createPlatforms(config) {
  const heights = HEIGHT_PATTERNS[config.world - 1];
  const span = config.width - 720;
  const spacing = span / (config.platforms + 1);
  return Array.from({ length: config.platforms }, (_, index) => {
    const x = Math.round(288 + spacing * (index + 1) + ((config.seed * 29 + index * 17) % 54) - 27);
    const y = heights[(index + config.stage + config.seed) % heights.length];
    const width = 96 + ((index + config.seed) % 3) * 32;
    return { x, y, width, height: 32 };
  });
}

function createBlocks(config) {
  const firstX = safeGroundX(Math.round(config.width * 0.2), config.gaps, config.width);
  const secondX = safeGroundX(Math.round(config.width * 0.56), config.gaps, config.width);
  const firstY = config.world >= 3 ? 272 : 304;
  const secondY = config.stage === 3 ? 240 : 272;
  return [
    { x: firstX, y: firstY, powerup: 'mushroom' },
    { x: secondX, y: secondY, powerup: 'flower' },
  ];
}

function createCoins(config, platforms) {
  const coins = [];
  for (const platform of platforms) {
    coins.push({ x: platform.x + 28, y: platform.y - 46 });
    coins.push({ x: platform.x + Math.max(60, platform.width - 28), y: platform.y - 46 });
  }
  for (let x = 192 + config.seed * 11; x < config.width - 220; x += 430) {
    if (pointIsGrounded(x, config.gaps)) coins.push({ x, y: GROUND_Y - 50 });
  }
  return coins;
}

function createEnemies(config) {
  const enemies = [];
  for (let x = 448 + config.seed * 19; x < config.width - 260 && enemies.length < config.enemies; x += 248) {
    if (!pointIsGrounded(x, config.gaps)) continue;
    enemies.push({ x, direction: enemies.length % 2 === 0 ? -1 : 1 });
  }
  for (let x = 560; enemies.length < config.enemies && x < config.width - 220; x += 176) {
    if (!pointIsGrounded(x, config.gaps) || enemies.some((enemy) => Math.abs(enemy.x - x) < 110)) continue;
    enemies.push({ x, direction: enemies.length % 2 === 0 ? 1 : -1 });
  }
  return enemies;
}

function createLevel(config) {
  const platforms = createPlatforms(config);
  return Object.freeze({
    world: config.world,
    stage: config.stage,
    name: config.name,
    kind: config.stage === 3 ? 'fortress' : config.stage === 2 ? 'height' : 'route',
    width: config.width,
    goalX: config.width - 160,
    parTime: config.parTime,
    solids: freezeItems([...createGround(config.width, config.gaps), ...platforms]),
    blocks: freezeItems(createBlocks(config)),
    coins: freezeItems(createCoins(config, platforms)),
    enemies: freezeItems(createEnemies(config)),
  });
}

export const LEVELS = Object.freeze(LEVEL_CONFIGS.map(createLevel));
export const LEVEL_COUNT = LEVELS.length;

export function campaignPosition(levelIndex = 0) {
  const normalized = Math.max(0, Math.min(LEVEL_COUNT - 1, Number.isInteger(levelIndex) ? levelIndex : 0));
  return {
    world: Math.floor(normalized / STAGES_PER_WORLD) + 1,
    stage: (normalized % STAGES_PER_WORLD) + 1,
    number: normalized + 1,
  };
}
