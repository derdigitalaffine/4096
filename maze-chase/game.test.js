import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './levels.js';
import {
  POWER_TICKS, STARTING_LIVES, availableDirections, chooseEnemyDirection, createGame, isWall,
  positionKey, queueDirection, setPaused, stepGame, tickMsForState, validateLevel,
} from './game.js';

test('alle eigenen Labyrinthe sind rechteckig, geschlossen und besitzen mehrere Gegner', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) assert.equal(validateLevel(level), true, level.id);
  assert.ok(LEVELS[1].tickMs < LEVELS[0].tickMs);
  assert.ok(LEVELS[2].tickMs < LEVELS[1].tickMs);
});

test('neue Runde erzeugt reproduzierbaren Levelzustand mit Leben und Sammelzielen', () => {
  const one = createGame(0);
  const two = createGame(0);
  assert.deepEqual(one, two);
  assert.equal(one.lives, STARTING_LIVES);
  assert.equal(one.score, 0);
  assert.ok(one.pellets.length > 70);
  assert.equal(one.powers.length, 2);
  assert.equal(one.enemies.length, 2);
  assert.equal(isWall(one, { x: 0, y: 0 }), true);
  assert.equal(tickMsForState(one), LEVELS[0].tickMs);
});

test('Richtungs-Buffer hält eine noch blockierte Kurve bis zum nächsten möglichen Abzweig', () => {
  let state = createGame(0);
  state = {
    ...state,
    player: { ...state.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: state.enemies.map((enemy) => ({ ...enemy, x: enemy.spawn.x, y: enemy.spawn.y })),
  };
  state = queueDirection(state, 'down');
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y, next: state.player.nextDirection }, { x: 3, y: 1, next: 'down' });
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 4, y: 1 });
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 5, y: 1 });
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y, direction: state.player.direction }, { x: 5, y: 2, direction: 'down' });
});

test('Wände stoppen Bewegung, Pause stoppt den Tick', () => {
  let state = createGame(0);
  state = queueDirection(state, 'left');
  const blocked = stepGame(state);
  assert.deepEqual({ x: blocked.player.x, y: blocked.player.y }, { x: 1, y: 1 });
  const paused = setPaused(blocked, true);
  assert.equal(stepGame(paused), paused);
});

test('Gegnerprofile entscheiden deterministisch und vermeiden Rückwärtslauf wenn Alternativen existieren', () => {
  const state = {
    ...createGame(0),
    width: 7,
    height: 7,
    walls: [
      ...Array.from({ length: 7 }, (_, x) => ({ x, y: 0 })),
      ...Array.from({ length: 7 }, (_, x) => ({ x, y: 6 })),
      ...Array.from({ length: 5 }, (_, y) => ({ x: 0, y: y + 1 })),
      ...Array.from({ length: 5 }, (_, y) => ({ x: 6, y: y + 1 })),
    ],
    player: { x: 5, y: 3, spawn: { x: 5, y: 3 }, direction: 'right', nextDirection: 'right' },
    powerTicks: 0,
    tick: 0,
  };
  const hunter = { id: 'h', profile: 'hunter', x: 3, y: 3, spawn: { x: 3, y: 3 }, direction: 'up' };
  assert.deepEqual(availableDirections(state, hunter).sort(), ['left', 'right', 'up'].sort());
  assert.equal(chooseEnemyDirection(state, hunter), 'right');
  assert.equal(chooseEnemyDirection(state, hunter), 'right');

  const vulnerable = { ...state, powerTicks: 4 };
  assert.equal(chooseEnemyDirection(vulnerable, hunter), 'left');

  const ambusher = { ...hunter, id: 'a', profile: 'ambusher', direction: null };
  assert.equal(chooseEnemyDirection(state, ambusher), 'right');
});

test('Pellets und Power-Zellen erhöhen Score; Power-Zustand bleibt mehrere Ticks aktiv', () => {
  let state = createGame(0);
  state = {
    ...state,
    player: { ...state.player, direction: 'right', nextDirection: 'right' },
    pellets: [{ x: 2, y: 1 }, { x: 4, y: 1 }],
    powers: [{ x: 3, y: 1 }],
  };
  state = stepGame(state);
  assert.equal(state.score, 10);
  assert.equal(state.pellets.some((item) => positionKey(item) === '2,1'), false);
  state = stepGame(state);
  assert.equal(state.score, 60);
  assert.equal(state.powerTicks, POWER_TICKS);
});

test('normaler Gegnerkontakt kostet ein Leben und setzt Akteure zurück', () => {
  let state = createGame(0);
  state = {
    ...state,
    lives: 2,
    player: { ...state.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  state = stepGame(state);
  assert.equal(state.lives, 1);
  assert.deepEqual({ x: state.player.x, y: state.player.y }, state.player.spawn);
  assert.deepEqual({ x: state.enemies[0].x, y: state.enemies[0].y }, state.enemies[0].spawn);
  assert.equal(state.over, false);
});

test('Power-Kontakt setzt Gegner statt Spieler zurück und vergibt Bonus', () => {
  let state = createGame(0);
  state = {
    ...state,
    powerTicks: 5,
    player: { ...state.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  const score = state.score;
  state = stepGame(state);
  assert.equal(state.lives, STARTING_LIVES);
  assert.equal(state.score, score + 210);
  assert.deepEqual({ x: state.enemies[0].x, y: state.enemies[0].y }, { x: 7, y: 7 });
});

test('letztes Sammelziel schließt Level ab und übernimmt Score/Leben in das nächste Labyrinth', () => {
  let state = createGame(0);
  state = {
    ...state,
    player: { ...state.player, direction: 'right', nextDirection: 'right' },
    pellets: [{ x: 2, y: 1 }],
    powers: [],
    score: 40,
    lives: 2,
  };
  state = stepGame(state);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.score, 550);
  assert.equal(state.lives, 2);
});

test('dritter Level endet als Gesamtsieg und null Leben als Game-over', () => {
  let win = createGame(2);
  win = {
    ...win,
    player: { ...win.player, direction: 'right', nextDirection: 'right' },
    pellets: [{ x: 2, y: 1 }],
    powers: [],
    enemies: [],
  };
  win = stepGame(win);
  assert.equal(win.over, true);
  assert.equal(win.won, true);

  let loss = createGame(0);
  loss = {
    ...loss,
    lives: 1,
    player: { ...loss.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  loss = stepGame(loss);
  assert.equal(loss.over, true);
  assert.equal(loss.won, false);
  assert.equal(loss.lives, 0);
});
