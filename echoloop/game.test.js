import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './levels.js';
import {
  LOOP_TICKS, WAIT, actorSnapshot, createGame, finishLoop, resolveActorMoves, runInputs,
  stepGame, validateLevel,
} from './game.js';

const pad = (inputs) => [...inputs, ...Array(Math.max(0, LOOP_TICKS - inputs.length)).fill(WAIT)].slice(0, LOOP_TICKS);

test('alle MVP-Level sind geschlossene 9×9-Eigenbauten mit eindeutigen Kristallen', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) {
    assert.equal(validateLevel(level), true, level.id);
    assert.equal(level.width, 9);
    assert.equal(level.height, 9);
  }
  assert.deepEqual(LEVELS.map((level) => level.referenceLoops), [1, 2, 3]);
});

test('gleicher Startzustand plus gleiche Inputs erzeugt exakt denselben Zustand', () => {
  const inputs = ['left', 'left', 'up', WAIT, 'up', 'right', 'down'];
  assert.deepEqual(runInputs(createGame(0), inputs), runInputs(createGame(0), inputs));
});

test('Wände blockieren, Wait hält Position und Aufnahme bleibt tickgenau', () => {
  let state = createGame(0);
  state = runInputs(state, ['up', 'up', 'up', 'up']);
  assert.deepEqual(state.player, { x: 4, y: 1 });
  const before = state.player;
  state = stepGame(state, 'up');
  assert.deepEqual(state.player, before);
  state = stepGame(state, WAIT);
  assert.deepEqual(state.player, before);
  assert.deepEqual(state.recording.slice(-2), ['up', WAIT]);
});

test('gleiche Zielzelle und Positions-Tausch werden für alle beteiligten Akteure blockiert', () => {
  const level = LEVELS[0];
  const sameTarget = resolveActorMoves([{ x: 4, y: 4 }, { x: 4, y: 4 }], ['left', 'left'], level);
  assert.equal(sameTarget.collision, true);
  assert.deepEqual(sameTarget.positions, [{ x: 4, y: 4 }, { x: 4, y: 4 }]);

  const swap = resolveActorMoves([{ x: 3, y: 4 }, { x: 4, y: 4 }], ['right', 'left'], level);
  assert.equal(swap.collision, true);
  assert.deepEqual(swap.positions, [{ x: 3, y: 4 }, { x: 4, y: 4 }]);
});

test('Loop-Ende friert exakt 16 Inputs als Echo ein und setzt Weltziele zurück', () => {
  const inputs = pad(['left', 'left', 'left']);
  let state = runInputs(createGame(1), inputs);
  assert.equal(state.loop, 2);
  assert.equal(state.tick, 0);
  assert.equal(state.echoes.length, 1);
  assert.deepEqual(state.echoes[0].inputs, inputs);
  assert.deepEqual(state.player, LEVELS[1].start);
  assert.deepEqual(state.echoPositions, [LEVELS[1].start]);
  assert.deepEqual(state.collected, []);
});

test('ein Echo spielt seine frühere Aufzeichnung tickgenau wieder ab', () => {
  let state = runInputs(createGame(0), pad(['left', 'up']));
  assert.equal(state.loop, 2);
  state = stepGame(state, WAIT);
  assert.deepEqual(state.echoPositions[0], { x: 3, y: 4 });
  state = stepGame(state, WAIT);
  assert.deepEqual(state.echoPositions[0], { x: 3, y: 3 });
  assert.equal(actorSnapshot(state)[1].id, 'echo-1');
});

test('First Trace ist in einem Loop allein lösbar', () => {
  const state = runInputs(createGame(0), ['down', 'down', 'down', 'right', 'right', 'right']);
  assert.equal(state.status, 'won');
  assert.equal(state.loop, 1);
  assert.deepEqual(state.player, { x: 7, y: 7 });
});

test('Split Memory verliert unvollständige Kristalle am Loop-Ende und benötigt dann Echo-Kooperation', () => {
  const firstPath = pad(['left', 'left', 'left', 'up', 'up', 'up']);
  let state = runInputs(createGame(1), firstPath);
  assert.equal(state.status, 'playing');
  assert.equal(state.loop, 2);
  assert.deepEqual(state.collected, []);
  assert.equal(state.echoes.length, 1);

  state = runInputs(state, ['right', 'right', 'right', 'down', 'down', 'down']);
  assert.equal(state.status, 'won');
  assert.equal(state.loop, 2);
  assert.equal(state.collected.length, 2);
  assert.deepEqual(state.echoPositions[0], { x: 1, y: 1 });
  assert.deepEqual(state.player, { x: 7, y: 7 });
});

test('Three Times lässt drei Zeitlinien im dritten Loop gleichzeitig drei Ziele bedienen', () => {
  let state = runInputs(createGame(2), pad(['left', 'left', 'left', 'up', 'up', 'up']));
  state = runInputs(state, pad(['right', 'right', 'right', 'up', 'up', 'up']));
  assert.equal(state.loop, 3);
  assert.equal(state.echoes.length, 2);
  state = runInputs(state, ['down', 'down', 'down', WAIT, WAIT, WAIT]);
  assert.equal(state.status, 'won');
  assert.equal(state.collected.length, 3);
});

test('finishLoop und Schritte ändern gewonnene Zustände nicht weiter', () => {
  const won = runInputs(createGame(0), ['down', 'down', 'down', 'right', 'right', 'right']);
  assert.equal(stepGame(won, 'left'), won);
  assert.equal(finishLoop(won), won);
});
