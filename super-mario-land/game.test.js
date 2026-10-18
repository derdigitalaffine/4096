import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_COUNT,
  LEVELS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  WORLD_HEIGHT,
  collectedCoins,
  createGame,
  getLevel,
  progressPercent,
  stepGame,
} from './game.js';

test('new Super Mario Land round starts in level one with three lives', () => {
  const state = createGame();
  assert.equal(LEVEL_COUNT, 3);
  assert.equal(state.levelIndex, 0);
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 3);
  assert.equal(state.player.onGround, true);
  assert.equal(collectedCoins(state), 0);
  assert.equal(progressPercent(state), 2);
});

test('all three levels have distinct playable layouts', () => {
  assert.deepEqual(LEVELS.map((level) => level.name), ['Grüner Pfad', 'Höhenweg', 'Festungslauf']);
  assert.equal(new Set(LEVELS.map((level) => level.width)).size, 3);

  for (const level of LEVELS) {
    assert.ok(level.solids.length >= 10, `${level.name} hat zu wenig Plattformen/Bodenflächen.`);
    assert.ok(level.coins.length >= 16, `${level.name} hat zu wenig Münzen.`);
    assert.ok(level.enemies.length >= 5, `${level.name} hat zu wenig Gegner.`);
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

test('falling out of a later level costs one life without resetting level progress', () => {
  const state = createGame(2);
  state.score = 900;
  state.player = { ...state.player, y: WORLD_HEIGHT + 70, onGround: false };

  const next = stepGame(state, {}, 0);
  assert.equal(next.levelIndex, 2);
  assert.equal(next.lives, 2);
  assert.equal(next.score, 900);
  assert.equal(next.status, 'playing');
  assert.equal(next.player.x, 64);
});

test('reaching the first goal starts level two and carries score and lives', () => {
  const state = createGame();
  state.score = 500;
  state.lives = 2;
  state.player = { ...state.player, x: getLevel(state).goalX - PLAYER_WIDTH };

  const next = stepGame(state, {}, 0);
  assert.equal(next.status, 'playing');
  assert.equal(next.levelIndex, 1);
  assert.equal(next.lives, 2);
  assert.ok(next.score >= 1500);
  assert.equal(next.player.x, 64);
  assert.equal(collectedCoins(next), 0);
  assert.equal(next.coins.length, LEVELS[1].coins.length);
});

test('reaching the second goal starts level three with accumulated score', () => {
  const state = createGame(1);
  state.score = 2400;
  state.player = { ...state.player, x: getLevel(state).goalX - PLAYER_WIDTH };

  const next = stepGame(state, {}, 0);
  assert.equal(next.status, 'playing');
  assert.equal(next.levelIndex, 2);
  assert.ok(next.score >= 3400);
  assert.equal(next.lives, 3);
  assert.equal(next.enemies.length, LEVELS[2].enemies.length);
});

test('only the final goal wins the complete round and freezes terminal state', () => {
  const state = createGame(2);
  state.player = { ...state.player, x: getLevel(state).goalX - PLAYER_WIDTH };

  const won = stepGame(state, {}, 0);
  assert.equal(won.levelIndex, 2);
  assert.equal(won.status, 'won');
  assert.ok(won.score >= 1000);
  assert.equal(stepGame(won, { left: true }, 0.05), won);
});
