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
  collectedCoins,
  createGame,
  getLevel,
  progressPercent,
  stageLabel,
  stepGame,
} from './game.js';

function hitQuestionBlock(state, blockIndex = 0) {
  const block = state.blocks[blockIndex];
  state.player = { ...state.player, x: block.x + 4, y: block.y + block.height + 1, vy: -400, onGround: false };
  return stepGame(state, {}, 0.05);
}

function clearCurrentStage(state) {
  state.player = { ...state.player, x: getLevel(state).goalX - PLAYER_WIDTH };
  return stepGame(state, {}, 0);
}

test('new Super Tromu Land round starts in world 1-1 with three lives', () => {
  const state = createGame();
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(WORLD_COUNT, 4);
  assert.equal(state.levelIndex, 0);
  assert.equal(stageLabel(state), '1-1');
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 3);
  assert.equal(state.power, 'small');
  assert.equal(state.player.onGround, true);
  assert.equal(collectedCoins(state), 0);
  assert.equal(progressPercent(state), 2);
});

test('campaign exposes four worlds with three distinct stages each', () => {
  assert.deepEqual(LEVELS.map((level) => level.id), ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3', '4-1', '4-2', '4-3']);
  for (let world = 1; world <= WORLD_COUNT; world += 1) {
    const stages = LEVELS.filter((level) => level.world === world);
    assert.deepEqual(stages.map((level) => level.stage), [1, 2, 3]);
    assert.equal(stages[2].finale, true);
  }
  assert.deepEqual(LEVELS.filter((level) => level.autoScroll).map((level) => level.id), ['2-3', '4-3']);
  assert.ok(new Set(LEVELS.map((level) => level.environment)).size >= 8);
  for (const level of LEVELS) {
    assert.ok(level.solids.length >= 10, `${level.id} hat zu wenig Plattformen/Bodenflächen.`);
    assert.ok(level.coins.length >= 18, `${level.id} hat zu wenig Münzen.`);
    assert.ok(level.enemies.length >= 6, `${level.id} hat zu wenig Gegner.`);
    assert.deepEqual(level.blocks.map((block) => block.powerup), ['mushroom', 'flower']);
    assert.ok(level.goalX > 2500 && level.goalX < level.width);
  }
});

test('stage 1-3 lowers the pipe directly before the central gap', () => {
  const level = LEVELS.find((candidate) => candidate.id === '1-3');
  const obstacle = level.solids.find((solid) => solid.x === 1488 && solid.width === 48);
  assert.ok(obstacle, '1-3 braucht das erwartete Rohr bei x=1488.');
  assert.equal(obstacle.height, 80);
  assert.equal(obstacle.y, GROUND_Y - 80);
  assert.ok(level.solids.some((solid) => solid.y === GROUND_Y && solid.x === 1632), 'Der Boden nach der Lücke muss unverändert beginnen.');
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

test('special stages 2-3 and 4-3 force forward movement without vehicle gameplay', () => {
  for (const index of [5, 11]) {
    const state = createGame(index);
    const startX = state.player.x;
    const next = stepGame(state, {}, 0.05);
    assert.ok(next.player.x > startX, `${stageLabel(index)} scrollt nicht automatisch vorwärts.`);
    assert.equal(getLevel(index).autoScroll, true);
  }
});

test('touching a coin collects it exactly once and awards points', () => {
  const state = createGame();
  const coin = getLevel(state).coins[0];
  state.player = { ...state.player, x: coin.x - 12, y: coin.y - 15, onGround: false, vy: 0 };
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
  state.player = { ...state.player, x: state.powerups[0].x, y: state.powerups[0].y, vy: 0, onGround: false };
  state = stepGame(state, {}, 0);
  assert.equal(state.power, 'mushroom');
  const enemy = state.enemies[0];
  state.player = { ...state.player, x: enemy.x, y: enemy.y, vy: 0, onGround: false };
  const hit = stepGame(state, {}, 0);
  assert.equal(hit.power, 'small');
  assert.equal(hit.lives, 3);
  assert.ok(hit.invulnerable > 0);
});

test('flower unlocks a projectile that defeats an enemy', () => {
  let state = hitQuestionBlock(createGame(), 1);
  state.player = { ...state.player, x: state.powerups[0].x, y: state.powerups[0].y, vy: 0, onGround: false };
  state = stepGame(state, {}, 0);
  assert.equal(state.power, 'flower');
  state.player = { ...state.player, x: 64, y: GROUND_Y - PLAYER_HEIGHT, vy: 0, onGround: true, facing: 1 };
  state.enemies[0] = { ...state.enemies[0], x: state.player.x + PLAYER_WIDTH + 1, y: GROUND_Y - 24 };
  const fired = stepGame(state, { fire: true }, 0);
  assert.equal(fired.enemies[0].alive, false);
  assert.equal(fired.projectiles.length, 0);
  assert.ok(fired.score >= 1050);
});

test('landing on an enemy defeats it and bounces the player', () => {
  const state = createGame();
  const enemy = state.enemies[0];
  state.player = { ...state.player, x: enemy.x, y: enemy.y - PLAYER_HEIGHT - 2, vy: 200, onGround: false };
  const next = stepGame(state, {}, 0.02);
  assert.equal(next.enemies[0].alive, false);
  assert.ok(next.player.vy < 0);
  assert.equal(next.score, 200);
  assert.equal(next.lives, 3);
});

test('falling out of a later world costs one life and keeps stage progress', () => {
  const state = createGame(8);
  state.score = 900;
  state.power = 'flower';
  state.player = { ...state.player, y: WORLD_HEIGHT + 70, onGround: false };
  const next = stepGame(state, {}, 0);
  assert.equal(next.levelIndex, 8);
  assert.equal(stageLabel(next), '3-3');
  assert.equal(next.lives, 2);
  assert.equal(next.score, 900);
  assert.equal(next.power, 'small');
  assert.equal(next.status, 'playing');
  assert.equal(next.player.x, 64);
});

test('stage clear carries score lives and power across a world boundary', () => {
  const state = createGame(2);
  state.score = 500;
  state.lives = 2;
  state.power = 'flower';
  const next = clearCurrentStage(state);
  assert.equal(stageLabel(next), '2-1');
  assert.equal(next.lives, 2);
  assert.equal(next.power, 'flower');
  assert.ok(next.score >= 1500);
  assert.equal(next.status, 'playing');
  assert.equal(next.player.x, 64);
});

test('all twelve goals must be cleared in order before the campaign is won', () => {
  let state = createGame();
  for (let index = 0; index < LEVEL_COUNT - 1; index += 1) {
    state = clearCurrentStage(state);
    assert.equal(state.levelIndex, index + 1);
    assert.equal(state.status, 'playing');
  }
  assert.equal(stageLabel(state), '4-3');
  state = clearCurrentStage(state);
  assert.equal(state.levelIndex, 11);
  assert.equal(state.status, 'won');
  assert.equal(stepGame(state, { left: true }, 0.05), state);
});
