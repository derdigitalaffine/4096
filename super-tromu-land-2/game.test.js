import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST,
  attack,
  createGame,
  interact,
  isQuestComplete,
  isValidGameState,
  movePlayer,
  publicSnapshot,
  questObjective,
} from './game.js';
import { validateWorld } from './world.js';

const clone = (value) => structuredClone(value);

function place(state, zoneId, x, y, facing) {
  const next = clone(state);
  next.zoneId = zoneId;
  next.player = { ...next.player, x, y, facing };
  return next;
}

function interactAt(state, zoneId, x, y, facing) {
  return interact(place(state, zoneId, x, y, facing));
}

function attackEnemy(state, enemyId, times = 1) {
  let next = state;
  for (let index = 0; index < times; index += 1) {
    const enemy = next.enemies.find((item) => item.id === enemyId);
    assert.ok(enemy, `enemy ${enemyId} missing`);
    next = place(next, enemy.zoneId, enemy.x - 1, enemy.y, 'right');
    next = attack(next);
  }
  return next;
}

function completeIntroQuest() {
  let state = createGame();
  state = interactAt(state, 'village', 5, 4, 'up');
  assert.equal(state.quest, QUEST.GET_BLADE);

  state = interactAt(state, 'village', 12, 4, 'up');
  assert.equal(state.inventory.blade, true);
  assert.equal(state.quest, QUEST.DEFEAT_LEAFLINGS);

  for (const id of ['leaf-a', 'leaf-b', 'leaf-c']) state = attackEnemy(state, id);
  assert.equal(state.quest, QUEST.GET_SEAL);
  assert.equal(state.defeated.filter((id) => id.startsWith('leaf-')).length, 3);

  state = interactAt(state, 'meadow', 13, 4, 'up');
  assert.equal(state.inventory.seal, true);
  assert.equal(state.quest, QUEST.OPEN_SHRINE);

  state = interactAt(state, 'meadow', 14, 6, 'right');
  assert.equal(state.zoneId, 'shrine');
  assert.equal(state.quest, QUEST.ACTIVATE_RUNES);

  state = interactAt(state, 'shrine', 3, 4, 'up');
  state = interactAt(state, 'shrine', 12, 4, 'up');
  state = interactAt(state, 'shrine', 8, 10, 'up');
  assert.equal(state.activatedRunes.length, 3);
  assert.equal(state.quest, QUEST.DEFEAT_GUARDIAN);

  state = attackEnemy(state, 'guardian', 3);
  assert.equal(state.guardianDefeated, true);
  assert.equal(state.quest, QUEST.CLAIM_CORE);

  state = interactAt(state, 'shrine', 8, 2, 'up');
  assert.equal(state.inventory.core, true);
  assert.equal(state.quest, QUEST.RETURN_HOME);

  state = interactAt(state, 'village', 5, 4, 'up');
  assert.equal(isQuestComplete(state), true);
  assert.equal(state.status, 'completed');
  return state;
}

test('world and initial state are deterministic and valid', () => {
  assert.equal(validateWorld(), true);
  assert.deepEqual(createGame(), createGame());
  assert.equal(isValidGameState(createGame()), true);
  assert.match(questObjective(createGame()), /Mira/);
});

test('village portal leads to meadow and static collision blocks houses', () => {
  let state = createGame();
  state = place(state, 'village', 14, 6, 'right');
  state = movePlayer(state, 'right');
  assert.equal(state.zoneId, 'meadow');
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 1, y: 6 });

  state = place(state, 'village', 2, 3, 'up');
  const blocked = movePlayer(state, 'up');
  assert.deepEqual({ x: blocked.player.x, y: blocked.player.y }, { x: 2, y: 3 });
});

test('quest gates cannot be skipped out of order', () => {
  let state = createGame();
  state = interactAt(state, 'village', 12, 4, 'up');
  assert.equal(state.inventory.blade, false);
  assert.equal(state.quest, QUEST.WAKE);

  state = interactAt(state, 'meadow', 13, 4, 'up');
  assert.equal(state.inventory.seal, false);
  assert.equal(state.quest, QUEST.WAKE);

  state = interactAt(state, 'meadow', 14, 6, 'right');
  assert.equal(state.zoneId, 'meadow');
  assert.equal(state.quest, QUEST.WAKE);

  state = interactAt(state, 'shrine', 8, 2, 'up');
  assert.equal(state.inventory.core, false);
  assert.equal(state.quest, QUEST.WAKE);
});

test('blade attacks, leafling trial and guardian health advance the quest', () => {
  let state = createGame();
  state = interactAt(state, 'village', 5, 4, 'up');
  state = interactAt(state, 'village', 12, 4, 'up');
  for (const id of ['leaf-a', 'leaf-b', 'leaf-c']) state = attackEnemy(state, id);
  assert.equal(state.quest, QUEST.GET_SEAL);

  state = interactAt(state, 'meadow', 13, 4, 'up');
  state = interactAt(state, 'meadow', 14, 6, 'right');
  state = interactAt(state, 'shrine', 3, 4, 'up');
  state = interactAt(state, 'shrine', 12, 4, 'up');
  state = interactAt(state, 'shrine', 8, 10, 'up');

  const guardian = state.enemies.find((enemy) => enemy.id === 'guardian');
  state = place(state, 'shrine', guardian.x - 1, guardian.y, 'right');
  state = attack(state);
  assert.equal(state.enemies.find((enemy) => enemy.id === 'guardian').hp, 2);
  assert.equal(state.quest, QUEST.DEFEAT_GUARDIAN);
});

test('complete introduction quest reaches a stable completed state', () => {
  const state = completeIntroQuest();
  assert.equal(state.quest, QUEST.COMPLETE);
  assert.equal(state.inventory.blade, true);
  assert.equal(state.inventory.seal, true);
  assert.equal(state.inventory.core, true);
  assert.equal(state.activatedRunes.length, 3);
  assert.equal(state.guardianDefeated, true);
  assert.match(state.message, /Einführungsquest abgeschlossen/);
  assert.equal(isValidGameState(state), true);
  assert.equal(publicSnapshot(state).status, 'completed');
});

test('invalid save-state combinations are rejected', () => {
  const noBlade = clone(createGame());
  noBlade.quest = QUEST.GET_SEAL;
  assert.equal(isValidGameState(noBlade), false);

  const fakeComplete = clone(createGame());
  fakeComplete.quest = QUEST.COMPLETE;
  fakeComplete.status = 'playing';
  fakeComplete.inventory.blade = true;
  fakeComplete.inventory.seal = true;
  fakeComplete.inventory.core = true;
  assert.equal(isValidGameState(fakeComplete), false);
});
