import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL_X,
  LEVEL_COINS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  WORLD_HEIGHT,
  collectedCoins,
  createGame,
  progressPercent,
  stepGame,
} from './game.js';

test('new Super Mario Land round starts playable with three lives', () => {
  const state = createGame();
  assert.equal(state.status, 'playing');
  assert.equal(state.lives, 3);
  assert.equal(state.player.onGround, true);
  assert.equal(collectedCoins(state), 0);
  assert.equal(progressPercent(state), 2);
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
  const coin = LEVEL_COINS[0];
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

test('falling out of the level costs a life and resets the player', () => {
  const state = createGame();
  state.player = { ...state.player, y: WORLD_HEIGHT + 70, onGround: false };

  const next = stepGame(state, {}, 0);
  assert.equal(next.lives, 2);
  assert.equal(next.status, 'playing');
  assert.equal(next.player.x, 64);
});

test('reaching the goal wins the round and freezes terminal state', () => {
  const state = createGame();
  state.player = {
    ...state.player,
    x: GOAL_X - PLAYER_WIDTH,
  };

  const won = stepGame(state, {}, 0);
  assert.equal(won.status, 'won');
  assert.ok(won.score >= 1000);
  assert.equal(stepGame(won, { left: true }, 0.05), won);
});
