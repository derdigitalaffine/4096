import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './levels.js';
import {
  POWER_TICKS, STARTING_LIVES, availableDirections, chooseEnemyDirection, createGame, isWall,
  positionKey, queueDirection, setPaused, stepGame, tickMsForState, validateLevel,
} from './game.js';

test('alle eigenen Labyrinthe sind rechteckig, geschlossen und werden schneller', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) assert.equal(validateLevel(level), true, level.id);
  assert.ok(LEVELS[1].tickMs < LEVELS[0].tickMs);
  assert.ok(LEVELS[2].tickMs < LEVELS[1].tickMs);
});

test('neue Runde ist reproduzierbar und enthält Leben, Sammelziele und mehrere Gegner', () => {
  const one = createGame(0);
  assert.deepEqual(one, createGame(0));
  assert.equal(one.lives, STARTING_LIVES);
  assert.ok(one.pellets.length > 70);
  assert.equal(one.powers.length, 2);
  assert.equal(one.enemies.length, 2);
  assert.equal(isWall(one, { x: 0, y: 0 }), true);
  assert.equal(tickMsForState(one), LEVELS[0].tickMs);
});

test('Richtungs-Buffer hält eine blockierte Kurve bis zum nächsten möglichen Abzweig', () => {
  let state = createGame(0);
  state = {
    ...state,
    player: { ...state.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
  };
  state = queueDirection(state, 'down');
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y, next: state.player.nextDirection }, { x: 3, y: 1, next: 'down' });
  state = stepGame(stepGame(state));
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 5, y: 1 });
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y, direction: state.player.direction }, { x: 5, y: 2, direction: 'down' });
});

test('Wände stoppen Bewegung und Pause stoppt den Tick', () => {
  let state = queueDirection(createGame(0), 'left');
  state = stepGame(state);
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 1, y: 1 });
  const paused = setPaused(state, true);
  assert.equal(stepGame(paused), paused);
});

test('Gegnerprofile entscheiden deterministisch und Power kehrt das Distanzziel um', () => {
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
  assert.notEqual(chooseEnemyDirection({ ...state, powerTicks: 4 }, hunter), 'right');
  const ambusher = { ...hunter, id: 'a', profile: 'ambusher', direction: null };
  assert.equal(chooseEnemyDirection(state, ambusher), 'right');
});

test('Pellet und Power-Zelle erhöhen Score und aktivieren den Power-Zustand', () => {
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

test('normaler Kontakt kostet Leben; Power-Kontakt setzt Gegner zurück und gibt Bonus', () => {
  let normal = createGame(0);
  normal = {
    ...normal,
    lives: 2,
    player: { ...normal.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  normal = stepGame(normal);
  assert.equal(normal.lives, 1);
  assert.deepEqual({ x: normal.player.x, y: normal.player.y }, normal.player.spawn);

  let powered = createGame(0);
  powered = {
    ...powered,
    powerTicks: 5,
    player: { ...powered.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  powered = stepGame(powered);
  assert.equal(powered.lives, STARTING_LIVES);
  assert.equal(powered.score, 210);
  assert.deepEqual({ x: powered.enemies[0].x, y: powered.enemies[0].y }, { x: 7, y: 7 });
});

test('letztes Sammelziel wechselt Level mit Bonus; letzter Level gewinnt', () => {
  let state = createGame(0);
  state = {
    ...state,
    player: { ...state.player, direction: 'right', nextDirection: 'right' },
    pellets: [{ x: 2, y: 1 }], powers: [], score: 40, lives: 2,
  };
  state = stepGame(state);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.score, 550);
  assert.equal(state.lives, 2);

  let win = createGame(2);
  win = {
    ...win,
    player: { ...win.player, direction: 'right', nextDirection: 'right' },
    pellets: [{ x: 2, y: 1 }], powers: [], enemies: [],
  };
  win = stepGame(win);
  assert.equal(win.over, true);
  assert.equal(win.won, true);
});

test('Kontakt mit letztem Leben beendet die Runde', () => {
  let state = createGame(0);
  state = {
    ...state,
    lives: 1,
    player: { ...state.player, x: 2, y: 1, direction: 'right', nextDirection: 'right' },
    enemies: [{ id: 'h', profile: 'hunter', x: 3, y: 1, spawn: { x: 7, y: 7 }, direction: null }],
  };
  state = stepGame(state);
  assert.equal(state.over, true);
  assert.equal(state.won, false);
  assert.equal(state.lives, 0);
});
