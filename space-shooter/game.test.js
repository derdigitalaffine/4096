import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVES } from './waves.js';
import {
  POWER_TICKS, SHIELD_TICKS, STARTING_LIVES, WORLD_HEIGHT, WORLD_WIDTH, applyPowerUp,
  createGame, enemySpec, firePlayer, movePlayer, setPlayerPosition, spawnWave, stepGame,
  togglePause, validateWaves,
} from './game.js';

test('drei deterministische Wellen besitzen mehrere unterscheidbare Gegnertypen und gültige Drops', () => {
  assert.equal(WAVES.length, 3);
  assert.equal(validateWaves(), true);
  assert.deepEqual(spawnWave(0), spawnWave(0));
  assert.deepEqual(new Set(WAVES.flatMap((wave) => wave.enemies.map((enemy) => enemy.type))), new Set(['scout', 'tank', 'diver']));
  assert.ok(enemySpec('tank').hp > enemySpec('scout').hp);
});

test('neuer Run ist reproduzierbar und startet mit drei Leben in Welle 1', () => {
  const one = createGame();
  const two = createGame();
  assert.deepEqual(one, two);
  assert.equal(one.waveIndex, 0);
  assert.equal(one.lives, STARTING_LIVES);
  assert.equal(one.status, 'running');
  assert.equal(one.enemies.length, WAVES[0].enemies.length);
});

test('Spielerschiff bewegt sich in vier Richtungen und bleibt im unteren Spielfeld', () => {
  let state = createGame();
  const start = { ...state.player };
  state = movePlayer(state, 'left', 25);
  assert.ok(state.player.x < start.x);
  state = movePlayer(state, 'up', 25);
  assert.ok(state.player.y < start.y);
  state = setPlayerPosition(state, -100, 0);
  assert.ok(state.player.x >= 0);
  assert.ok(state.player.y >= WORLD_HEIGHT * 0.54);
  state = setPlayerPosition(state, WORLD_WIDTH + 100, WORLD_HEIGHT + 100);
  assert.ok(state.player.x <= WORLD_WIDTH);
  assert.ok(state.player.y <= WORLD_HEIGHT);
});

test('Feuern besitzt Cooldown; Spread erzeugt drei Projektile und Rapid verkürzt Cooldown', () => {
  let state = firePlayer(createGame());
  assert.equal(state.bullets.length, 1);
  assert.equal(firePlayer(state), state);

  state = { ...createGame(), player: { ...createGame().player, spreadTicks: 5 } };
  state = firePlayer(state);
  assert.equal(state.bullets.length, 3);

  state = applyPowerUp(createGame(), 'rapid');
  state = firePlayer(state);
  assert.equal(state.player.rapidTicks, POWER_TICKS);
  assert.equal(state.player.fireCooldown, 5);
});

test('Power-ups setzen feste Zustandsdauer', () => {
  assert.equal(applyPowerUp(createGame(), 'shield').player.shieldTicks, SHIELD_TICKS);
  assert.equal(applyPowerUp(createGame(), 'spread').player.spreadTicks, POWER_TICKS);
  assert.equal(applyPowerUp(createGame(), 'rapid').player.rapidTicks, POWER_TICKS);
});

test('Spielerprojektile treffen Gegner deterministisch, Tank benötigt zwei Treffer', () => {
  let state = createGame({ waveIndex: 1 });
  const tank = state.enemies.find((enemy) => enemy.type === 'tank');
  state = {
    ...state,
    enemies: [{ ...tank, x: 160, y: 120, direction: 1 }],
    bullets: [
      { x: 160, y: 128, vx: 0, vy: -7.2 },
    ],
    enemyBullets: [],
  };
  state = stepGame(state);
  assert.equal(state.enemies.length, 1);
  assert.equal(state.enemies[0].hp, 1);

  state = {
    ...state,
    bullets: [{ x: state.enemies[0].x, y: state.enemies[0].y + 8, vx: 0, vy: -7.2 }],
  };
  state = stepGame(state);
  assert.ok(state.score >= enemySpec('tank').score);
  assert.ok(state.waveIndex >= 1);
});

test('zerstörter Drop-Gegner erzeugt Power-up', () => {
  let state = createGame();
  const target = state.enemies.find((enemy) => enemy.drop === 'shield');
  state = {
    ...state,
    enemies: [{ ...target, x: 160, y: 120 }],
    bullets: [{ x: 160, y: 128, vx: 0, vy: -7.2 }],
    enemyBullets: [],
  };
  state = stepGame(state);
  assert.equal(state.powerUps.some((powerUp) => powerUp.type === 'shield'), true);
});

test('Gegnerschuss kostet Leben; Schild verhindert Schaden', () => {
  let state = createGame();
  state = {
    ...state,
    enemies: [],
    enemyBullets: [{ x: state.player.x, y: state.player.y - 3, vx: 0, vy: 3.1 }],
  };
  const damaged = stepGame(state);
  assert.equal(damaged.lives, STARTING_LIVES - 1);

  state = applyPowerUp(createGame(), 'shield');
  state = {
    ...state,
    enemies: state.enemies.slice(0, 1),
    enemyBullets: [{ x: state.player.x, y: state.player.y - 3, vx: 0, vy: 3.1 }],
  };
  const protectedState = stepGame(state);
  assert.equal(protectedState.lives, STARTING_LIVES);
});

test('Wellenwechsel übernimmt Score/Leben; letzte geleerte Welle gewinnt', () => {
  let state = { ...createGame(), enemies: [], score: 700, lives: 2 };
  state = stepGame(state);
  assert.equal(state.waveIndex, 1);
  assert.equal(state.score, 700);
  assert.equal(state.lives, 2);
  assert.equal(state.enemies.length, WAVES[1].enemies.length);

  state = { ...createGame({ waveIndex: WAVES.length - 1, score: 900, lives: 1 }), enemies: [] };
  state = stepGame(state);
  assert.equal(state.status, 'won');
  assert.equal(state.score, 900);
});

test('null Leben führt zu Game-over und Pause friert Regeln ein', () => {
  let state = createGame();
  state = {
    ...state,
    lives: 1,
    enemyBullets: [{ x: state.player.x, y: state.player.y - 3, vx: 0, vy: 3.1 }],
  };
  state = stepGame(state);
  assert.equal(state.status, 'gameover');
  assert.equal(state.lives, 0);

  const paused = togglePause(createGame());
  assert.equal(paused.status, 'paused');
  assert.equal(stepGame(paused), paused);
  assert.equal(togglePause(paused).status, 'running');
});
