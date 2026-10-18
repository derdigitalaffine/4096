import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_Y,
  LEVEL_COUNT,
  LEVELS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  WORLD_COUNT,
  WORLD_HEIGHT,
  campaignPosition,
  collectedCoins,
  createGame,
  getLevel,
  progressPercent,
  stepGame,
} from './game.js';

function hitQuestionBlock(state, blockIndex = 0) {
  const block = state.blocks[blockIndex];
  state.player = {
    ...state.player,
    x: block.x + 4,
    y: block.y + block.height + 1,
    vy: -400,
    onGround: false,
  };
  return stepGame(state, {}, 0.05);
}

function reachGoal(state) {
  state.player = { ...state.player, x: getLevel(state).goalX - PLAYER_WIDTH };
  return stepGame(state, {}, 0);
}

test('new Super Mario Land campaign starts in world 1-1 with three lives', () => {
  const state = createGame();
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(WORLD_COUNT, 4);
  assert.deepEqual(campaignPosition(0), { world: 1, stage: 1, number: 1 });
  assert.deepEqual(campaignPosition(11), { world: 4, stage: 3, number: 12 });
  assert.equal(state.levelIndex, 0);
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 3);
  assert.equal(state.power, 'small');
  assert.equal(state.player.onGround, true);
  assert.equal(collectedCoins(state), 0);
  assert.equal(progressPercent(state), 2);
});

test('campaign has four worlds with three distinct original stages each', () => {
  assert.deepEqual(LEVELS.map((level) => level.name), [
    'Wiesenpfad', 'Höhenbrücke', 'Steintor',
    'Dünenweg', 'Säulenpfad', 'Pyramidenkern',
    'Inselufer', 'Wolkenklippen', 'Himmelsbastion',
    'Nachtgarten', 'Maschinenwall', 'Sternenfestung',
  ]);
  assert.equal(new Set(LEVELS.map((level) => level.width)).size, 12);

  for (const [index, level] of LEVELS.entries()) {
    const position = campaignPosition(index);
    assert.equal(level.world, position.world);
    assert.equal(level.stage, position.stage);
    assert.equal(level.kind, position.stage === 3 ? 'fortress' : position.stage === 2 ? 'height' : 'route');
    assert.ok(level.solids.length >= 10, `${level.name} hat zu wenig Plattformen/Bodenflächen.`);
    assert.ok(level.coins.length >= 16, `${level.name} hat zu wenig Münzen.`);
    assert.ok(level.enemies.length >= 5, `${level.name} hat zu wenig Gegner.`);
    assert.deepEqual(level.blocks.map((block) => block.powerup), ['mushroom', 'flower']);
    assert.ok(level.goalX > 2500 && level.goalX < level.width);
  }
});

test('right input advances the player and jump leaves the ground', () => {
  let state = createGame();
  const startX = state.player.x;
  state = stepGame(state, { right: true }, 0.05);
  assert.ok(state.player.x > startX);

  const beforeJumpY = state.player.y;
  state = stepGame(state, { jump: true }, 0.016);
  assert.ok(state.player.y < beforeJumpY);
  assert.ok(state.player.vy < 0);
  assert.equal(state.player.onGround, false);
});

test('touching a coin collects it exactly once and awards points', () => {
  const state = createGame();
  const coin = getLevel(state).coins[0];
  state.player = {
    ...state.player,
    x: coin.x - 12,
    y: coin.y - 15,
    onGround: false,
    vy: 0,
  };

  const collected = stepGame(state, {}, 0);
  assert.equal(collectedCoins(collected), 1);
  assert.equal(collected.score, 100);

  const again = stepGame(collected, {}, 0);
  assert.equal(collectedCoins(again), 1);
  assert.equal(again.score, 100);
});

test('question block activates once and spawns its configured power-up', () => {
  let state = hitQuestionBlock(createGame(), 0);
  assert.equal(state.blocks[0].used, true);
  assert.equal(state.powerups.length, 1);
  assert.equal(state.powerups[0].type, 'mushroom');
  assert.equal(state.score, 50);

  state = hitQuestionBlock(state, 0);
  assert.equal(state.powerups.length, 1);
  assert.equal(state.score, 50);
});

test('mushroom protects against the next enemy hit without costing a life', () => {
  let state = hitQuestionBlock(createGame(), 0);
  state.player = {
    ...state.player,
    x: state.powerups[0].x,
    y: state.powerups[0].y,
    vy: 0,
    onGround: false,
  };
  state = stepGame(state, {}, 0);
  assert.equal(state.power, 'mushroom');
  assert.equal(state.score, 550);

  const enemy = state.enemies[0];
  state.player = { ...state.player, x: enemy.x, y: enemy.y, vy: 0, onGround: false };
  const hit = stepGame(state, {}, 0);
  assert.equal(hit.power, 'small');
  assert.equal(hit.lives, 3);
  assert.ok(hit.invulnerable > 0);
});

test('flower unlocks a projectile that defeats an enemy', () => {
  let state = hitQuestionBlock(createGame(), 1);
  state.player = {
    ...state.player,
    x: state.powerups[0].x,
    y: state.powerups[0].y,
    vy: 0,
    onGround: false,
  };
  state = stepGame(state, {}, 0);
  assert.equal(state.power, 'flower');

  state.player = { ...state.player, x: 64, y: GROUND_Y - PLAYER_HEIGHT, vy: 0, onGround: true, facing: 1 };
  state.enemies[0] = {
    ...state.enemies[0],
    x: state.player.x + PLAYER_WIDTH + 1,
    y: GROUND_Y - 24,
  };
  const fired = stepGame(state, { fire: true }, 0);
  assert.equal(fired.enemies[0].alive, false);
  assert.equal(fired.projectiles.length, 0);
  assert.ok(fired.score >= 1050);
});

test('landing on an enemy defeats it and bounces the player', () => {
  const state = createGame();
  const enemy = state.enemies[0];
  state.player = {
    ...state.player,
    x: enemy.x,
    y: enemy.y - PLAYER_HEIGHT - 2,
    vy: 200,
    onGround: false,
  };

  const next = stepGame(state, {}, 0.02);
  assert.equal(next.enemies[0].alive, false);
  assert.ok(next.player.vy < 0);
  assert.equal(next.score, 200);
  assert.equal(next.lives, 3);
});

test('falling out of a later world costs one life and keeps campaign progress', () => {
  const state = createGame(7);
  state.score = 900;
  state.power = 'flower';
  state.player = { ...state.player, y: WORLD_HEIGHT + 70, onGround: false };

  const next = stepGame(state, {}, 0);
  assert.equal(next.levelIndex, 7);
  assert.equal(next.lives, 2);
  assert.equal(next.score, 900);
  assert.equal(next.power, 'small');
  assert.equal(next.status, 'playing');
  assert.equal(next.player.x, 64);
});

test('crossing a world boundary carries score, lives and power into the next world', () => {
  const state = createGame(2);
  state.score = 500;
  state.lives = 2;
  state.power = 'flower';

  const next = reachGoal(state);
  assert.equal(next.status, 'playing');
  assert.equal(next.levelIndex, 3);
  assert.deepEqual(campaignPosition(next.levelIndex), { world: 2, stage: 1, number: 4 });
  assert.equal(next.lives, 2);
  assert.equal(next.power, 'flower');
  assert.ok(next.score >= 1500);
  assert.equal(next.player.x, 64);
  assert.equal(collectedCoins(next), 0);
  assert.equal(next.coins.length, LEVELS[3].coins.length);
});

test('only world 4-3 wins the complete twelve-stage campaign', () => {
  const penultimate = reachGoal(createGame(10));
  assert.equal(penultimate.status, 'playing');
  assert.equal(penultimate.levelIndex, 11);

  const won = reachGoal(penultimate);
  assert.equal(won.levelIndex, 11);
  assert.equal(won.status, 'won');
  assert.ok(won.score >= 2000);
  assert.equal(stepGame(won, { left: true }, 0.05), won);
});
