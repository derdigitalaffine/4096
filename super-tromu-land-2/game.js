import { GRID_HEIGHT, GRID_WIDTH, ZONES, getZone, inside, positionKey, staticBlockSet, validateWorld } from './world.js';

export const QUEST = Object.freeze({
  WAKE: 0,
  GET_BLADE: 1,
  DEFEAT_LEAFLINGS: 2,
  GET_SEAL: 3,
  OPEN_SHRINE: 4,
  ACTIVATE_RUNES: 5,
  DEFEAT_GUARDIAN: 6,
  CLAIM_CORE: 7,
  RETURN_HOME: 8,
  COMPLETE: 9,
});

export const MAX_HEARTS = 5;
export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
export const VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const clonePlayer = (player) => ({ ...player });
const cloneInventory = (inventory) => ({ ...inventory });
const cloneEnemies = (enemies) => enemies.map((enemy) => ({ ...enemy }));

function enemySeed() {
  return Object.values(ZONES).flatMap((zone) => zone.enemies.map((enemy) => ({
    id: enemy.id,
    kind: enemy.kind,
    zoneId: zone.id,
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    maxHp: enemy.hp,
    alive: true,
  })));
}

export function createGame() {
  if (!validateWorld()) throw new Error('Invalid Super Tromu Land 2 world.');
  const start = getZone('village').start;
  return {
    version: 1,
    zoneId: 'village',
    player: { x: start.x, y: start.y, facing: 'up', hearts: MAX_HEARTS, maxHearts: MAX_HEARTS },
    quest: QUEST.WAKE,
    inventory: { blade: false, seal: false, core: false },
    chestOpened: false,
    activatedRunes: [],
    defeated: [],
    enemies: enemySeed(),
    guardianDefeated: false,
    status: 'playing',
    turn: 0,
    message: 'Der Morgen beginnt in Lindenquell. Sprich mit Hüterin Mira.',
  };
}

function cloneState(state) {
  return {
    ...state,
    player: clonePlayer(state.player),
    inventory: cloneInventory(state.inventory),
    activatedRunes: [...state.activatedRunes],
    defeated: [...state.defeated],
    enemies: cloneEnemies(state.enemies),
  };
}

export function frontPosition(player) {
  const vector = VECTORS[player?.facing] ?? VECTORS.down;
  return { x: player.x + vector.x, y: player.y + vector.y };
}

export function activeEnemy(enemy, state) {
  if (!enemy?.alive) return false;
  if (enemy.id === 'guardian') return state.quest >= QUEST.DEFEAT_GUARDIAN && !state.guardianDefeated;
  return state.quest >= QUEST.DEFEAT_LEAFLINGS;
}

export function enemiesInZone(state, zoneId = state.zoneId) {
  return state.enemies.filter((enemy) => enemy.zoneId === zoneId && activeEnemy(enemy, state));
}

function npcAt(zone, position) {
  return zone.npcs.find((npc) => npc.x === position.x && npc.y === position.y) ?? null;
}

function objectAt(zone, position) {
  return zone.objects.find((object) => object.x === position.x && object.y === position.y) ?? null;
}

function enemyAt(state, position, zoneId = state.zoneId) {
  return enemiesInZone(state, zoneId).find((enemy) => enemy.x === position.x && enemy.y === position.y) ?? null;
}

function isBlockingObject(object) {
  return Boolean(object && ['chest', 'well', 'gate', 'altar'].includes(object.kind));
}

export function isBlocked(state, position, zoneId = state.zoneId, { ignoreEnemies = false } = {}) {
  if (!inside(position)) return true;
  const zone = getZone(zoneId);
  if (!zone) return true;
  if (staticBlockSet(zoneId).has(positionKey(position))) return true;
  if (npcAt(zone, position)) return true;
  if (isBlockingObject(objectAt(zone, position))) return true;
  if (!ignoreEnemies && enemyAt(state, position, zoneId)) return true;
  return false;
}

function portalAt(zone, position) {
  return zone.portals.find((portal) => portal.x === position.x && portal.y === position.y) ?? null;
}

function setMessage(state, message) {
  return { ...state, message };
}

function withTurn(state) {
  return { ...state, turn: state.turn + 1 };
}

function respawnIfNeeded(state) {
  if (state.player.hearts > 0) return state;
  const zone = getZone(state.zoneId);
  return {
    ...state,
    player: { ...state.player, x: zone.start.x, y: zone.start.y, hearts: MAX_HEARTS },
    message: 'Tromu sammelt sich wieder am Gebietseingang. Die Quest bleibt erhalten.',
  };
}

function damagePlayer(state, amount = 1) {
  if (amount <= 0) return state;
  const next = cloneState(state);
  next.player.hearts = Math.max(0, next.player.hearts - amount);
  next.message = `Treffer! ${next.player.hearts}/${next.player.maxHearts} Herzen.`;
  return respawnIfNeeded(next);
}

function enemyOccupiedSet(state, exceptId = null) {
  return new Set(enemiesInZone(state).filter((enemy) => enemy.id !== exceptId).map(positionKey));
}

function enemyCandidate(state, enemy, dx, dy) {
  const candidate = { x: enemy.x + dx, y: enemy.y + dy };
  if (!inside(candidate)) return null;
  if (candidate.x === state.player.x && candidate.y === state.player.y) return { ...candidate, hitsPlayer: true };
  if (isBlocked(state, candidate, enemy.zoneId, { ignoreEnemies: true })) return null;
  if (enemyOccupiedSet(state, enemy.id).has(positionKey(candidate))) return null;
  return candidate;
}

function chaseStep(state, enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const distance = Math.abs(dx) + Math.abs(dy);
  const range = enemy.kind === 'guardian' ? 8 : 5;
  if (distance > range || distance === 0) return { enemy, hit: false };

  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
  const attempts = horizontalFirst
    ? [[Math.sign(dx), 0], [0, Math.sign(dy)]]
    : [[0, Math.sign(dy)], [Math.sign(dx), 0]];

  for (const [stepX, stepY] of attempts) {
    if (stepX === 0 && stepY === 0) continue;
    const candidate = enemyCandidate(state, enemy, stepX, stepY);
    if (!candidate) continue;
    if (candidate.hitsPlayer) return { enemy, hit: true };
    return { enemy: { ...enemy, x: candidate.x, y: candidate.y }, hit: false };
  }
  return { enemy, hit: false };
}

export function stepEnemies(state) {
  if (state.status !== 'playing') return state;
  let next = cloneState(state);
  const current = enemiesInZone(next);
  let hit = false;

  for (const source of current) {
    if (source.kind === 'leafling' && next.turn % 2 !== 0) continue;
    const index = next.enemies.findIndex((enemy) => enemy.id === source.id);
    if (index < 0) continue;
    const result = chaseStep(next, next.enemies[index]);
    next.enemies[index] = result.enemy;
    hit ||= result.hit;
  }
  if (hit) next = damagePlayer(next, 1);
  return next;
}

export function movePlayer(state, direction) {
  if (!state || state.status !== 'playing' || !DIRECTIONS.includes(direction)) return state;
  let next = cloneState(state);
  next.player.facing = direction;
  const vector = VECTORS[direction];
  const target = { x: next.player.x + vector.x, y: next.player.y + vector.y };
  if (isBlocked(next, target)) return setMessage(next, 'Der Weg ist hier versperrt.');

  next.player.x = target.x;
  next.player.y = target.y;
  const zone = getZone(next.zoneId);
  const portal = portalAt(zone, target);
  if (portal) {
    next.zoneId = portal.toZone;
    next.player.x = portal.toX;
    next.player.y = portal.toY;
    next.message = `${getZone(next.zoneId).name}: ${getZone(next.zoneId).subtitle}.`;
  } else {
    next.message = '';
  }
  next = withTurn(next);
  return stepEnemies(next);
}

function adjacentTarget(state) {
  const zone = getZone(state.zoneId);
  const target = frontPosition(state.player);
  return {
    target,
    npc: npcAt(zone, target),
    object: objectAt(zone, target),
    enemy: enemyAt(state, target),
  };
}

function leafKills(state) {
  return state.defeated.filter((id) => id.startsWith('leaf-')).length;
}

function interactMira(state) {
  const next = cloneState(state);
  if (next.quest === QUEST.WAKE) {
    next.quest = QUEST.GET_BLADE;
    next.message = 'Mira: „Der Tauhain ist verstummt. Hol dir zuerst die Trainingsklinge aus der Werkstatttruhe.“';
    return next;
  }
  if (next.quest === QUEST.RETURN_HOME && next.inventory.core) {
    next.quest = QUEST.COMPLETE;
    next.status = 'completed';
    next.message = 'Mira: „Der Morgenkern antwortet wieder. Lindenquell ist sicher – und dein erster Weg ist geschafft.“ Einführungsquest abgeschlossen!';
    return next;
  }
  if (next.quest < QUEST.RETURN_HOME) {
    next.message = `Mira: „${questObjective(next)}“`;
    return next;
  }
  next.message = 'Mira: „Du hast Lindenquell den Morgen zurückgebracht.“';
  return next;
}

function interactKaro(state) {
  const next = cloneState(state);
  if (next.quest === QUEST.GET_SEAL && leafKills(next) >= 3) {
    next.inventory.seal = true;
    next.quest = QUEST.OPEN_SHRINE;
    next.message = 'Karo: „Saubere Klinge. Nimm das Hain-Siegel und öffne das Tor im Osten.“';
    return next;
  }
  if (next.quest < QUEST.GET_SEAL) {
    next.message = 'Karo: „Der Tauhain ist unruhig. Zeig erst, dass du die Blattlinge beherrschst.“';
    return next;
  }
  next.message = next.inventory.seal
    ? 'Karo: „Das Hain-Siegel gehört jetzt dir. Das Schrein-Tor liegt direkt östlich.“'
    : 'Karo wartet auf deine Kampfprobe.';
  return next;
}

function interactChest(state) {
  const next = cloneState(state);
  if (next.chestOpened) return setMessage(next, 'Die Werkstatttruhe ist leer.');
  if (next.quest !== QUEST.GET_BLADE) return setMessage(next, 'Die Truhe ist verriegelt. Mira sollte wissen, warum.');
  next.chestOpened = true;
  next.inventory.blade = true;
  next.quest = QUEST.DEFEAT_LEAFLINGS;
  next.message = 'Trainingsklinge erhalten! X/K/Leertaste greift in Blickrichtung an. Besiege die drei Blattlinge am Moosweg.';
  return next;
}

function interactGate(state) {
  const next = cloneState(state);
  if (next.quest < QUEST.OPEN_SHRINE || !next.inventory.seal) return setMessage(next, 'Das Schrein-Tor reagiert nicht. Dir fehlt das Hain-Siegel.');
  next.zoneId = 'shrine';
  next.player = { ...next.player, x: getZone('shrine').start.x, y: getZone('shrine').start.y };
  if (next.quest === QUEST.OPEN_SHRINE) next.quest = QUEST.ACTIVATE_RUNES;
  next.message = 'Das Hain-Siegel öffnet den Tauhain-Schrein. Aktiviere die drei Runen.';
  return next;
}

function interactRune(state, object) {
  const next = cloneState(state);
  if (next.quest < QUEST.ACTIVATE_RUNES) return setMessage(next, 'Die Rune bleibt dunkel.');
  if (next.quest > QUEST.ACTIVATE_RUNES) return setMessage(next, 'Die Rune leuchtet bereits ruhig.');
  if (next.activatedRunes.includes(object.id)) return setMessage(next, 'Diese Rune ist bereits aktiv.');
  next.activatedRunes.push(object.id);
  next.activatedRunes.sort();
  if (next.activatedRunes.length === 3) {
    next.quest = QUEST.DEFEAT_GUARDIAN;
    next.message = 'Alle drei Runen antworten. Der Schreinwächter erwacht – besiege ihn mit der Klinge.';
  } else {
    next.message = `Rune aktiviert (${next.activatedRunes.length}/3).`;
  }
  return next;
}

function interactAltar(state) {
  const next = cloneState(state);
  if (next.quest !== QUEST.CLAIM_CORE || !next.guardianDefeated) return setMessage(next, 'Der Morgenkern bleibt hinter einem stillen Lichtfeld verborgen.');
  next.inventory.core = true;
  next.quest = QUEST.RETURN_HOME;
  next.message = 'Morgenkern geborgen! Kehre zu Hüterin Mira nach Lindenquell zurück.';
  return next;
}

export function interact(state) {
  if (!state || state.status === 'completed') return state;
  const { npc, object } = adjacentTarget(state);
  let next = cloneState(state);
  if (npc?.id === 'mira') next = interactMira(next);
  else if (npc?.id === 'karo') next = interactKaro(next);
  else if (object?.id === 'workshop-chest') next = interactChest(next);
  else if (object?.id === 'shrine-gate') next = interactGate(next);
  else if (object?.kind === 'rune') next = interactRune(next, object);
  else if (object?.kind === 'altar') next = interactAltar(next);
  else if (object?.kind === 'sign') next.message = 'Wegschild: „← Lindenquell · Tauhain-Schrein →“';
  else if (object?.kind === 'well') next.message = 'Im Dorfbrunnen glitzert das Morgenlicht. Deine Herzen fühlen sich leichter an.';
  else next.message = 'Hier gibt es gerade nichts zu untersuchen.';
  return next;
}

export function attack(state) {
  if (!state || state.status !== 'playing') return state;
  if (!state.inventory.blade) return setMessage(cloneState(state), 'Du hast noch keine Klinge. Sprich mit Mira und hol sie aus der Werkstatt.');
  const target = frontPosition(state.player);
  const enemy = enemyAt(state, target);
  let next = cloneState(state);
  next = withTurn(next);
  if (!enemy) {
    next.message = 'Die Klinge schneidet nur durch Luft.';
    return stepEnemies(next);
  }

  const index = next.enemies.findIndex((item) => item.id === enemy.id);
  next.enemies[index].hp -= 1;
  if (next.enemies[index].hp <= 0) {
    next.enemies[index].hp = 0;
    next.enemies[index].alive = false;
    if (!next.defeated.includes(enemy.id)) next.defeated.push(enemy.id);
    next.defeated.sort();
    if (enemy.kind === 'leafling') {
      const count = leafKills(next);
      if (next.quest === QUEST.DEFEAT_LEAFLINGS && count >= 3) {
        next.quest = QUEST.GET_SEAL;
        next.message = 'Alle drei Blattlinge sind besiegt. Sprich mit Pfadwächter Karo am östlichen Moosweg.';
      } else {
        next.message = `Blattling besiegt (${count}/3).`;
      }
    } else if (enemy.id === 'guardian' && next.quest === QUEST.DEFEAT_GUARDIAN) {
      next.guardianDefeated = true;
      next.quest = QUEST.CLAIM_CORE;
      next.message = 'Der Schreinwächter zerfällt zu Mooslicht. Der Morgenkern am Nordaltar ist frei.';
    }
  } else {
    next.message = enemy.kind === 'guardian'
      ? `Treffer am Schreinwächter (${next.enemies[index].hp}/${next.enemies[index].maxHp}).`
      : 'Treffer!';
  }
  return stepEnemies(next);
}

export function questObjective(state) {
  switch (state?.quest) {
    case QUEST.WAKE: return 'Sprich mit Hüterin Mira im Dorf.';
    case QUEST.GET_BLADE: return 'Öffne die Werkstatttruhe und nimm die Trainingsklinge.';
    case QUEST.DEFEAT_LEAFLINGS: return `Besiege die Blattlinge am Moosweg (${leafKills(state)}/3).`;
    case QUEST.GET_SEAL: return 'Sprich mit Pfadwächter Karo und hole das Hain-Siegel.';
    case QUEST.OPEN_SHRINE: return 'Öffne mit dem Hain-Siegel das Tor zum Tauhain-Schrein.';
    case QUEST.ACTIVATE_RUNES: return `Aktiviere die drei Schreinrunen (${state.activatedRunes.length}/3).`;
    case QUEST.DEFEAT_GUARDIAN: {
      const guardian = state.enemies.find((enemy) => enemy.id === 'guardian');
      return `Besiege den Schreinwächter (${guardian?.hp ?? 0}/${guardian?.maxHp ?? 3}).`;
    }
    case QUEST.CLAIM_CORE: return 'Nimm den Morgenkern vom Nordaltar.';
    case QUEST.RETURN_HOME: return 'Kehre mit dem Morgenkern zu Mira nach Lindenquell zurück.';
    case QUEST.COMPLETE: return 'Einführungsquest abgeschlossen. Lindenquell ist gerettet.';
    default: return 'Finde deinen nächsten Weg.';
  }
}

export function questStep(state) {
  return `${Math.min((state?.quest ?? 0) + 1, 10)}/10`;
}

export function isQuestComplete(state) {
  return state?.quest === QUEST.COMPLETE && state?.status === 'completed' && state?.inventory?.core === true;
}

export function resetGame() {
  return createGame();
}

function validEnemyState(enemy, seeds) {
  const seed = seeds.find((item) => item.id === enemy?.id);
  return Boolean(seed && enemy.kind === seed.kind && enemy.zoneId === seed.zoneId
    && Number.isInteger(enemy.x) && Number.isInteger(enemy.y) && inside(enemy)
    && Number.isInteger(enemy.hp) && enemy.hp >= 0 && enemy.hp <= seed.maxHp
    && enemy.maxHp === seed.maxHp && typeof enemy.alive === 'boolean');
}

export function isValidGameState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return false;
  if (!getZone(value.zoneId) || !inside(value.player)) return false;
  if (!DIRECTIONS.includes(value.player.facing)) return false;
  if (!Number.isInteger(value.player.hearts) || value.player.hearts < 1 || value.player.hearts > MAX_HEARTS || value.player.maxHearts !== MAX_HEARTS) return false;
  if (!Number.isInteger(value.quest) || value.quest < QUEST.WAKE || value.quest > QUEST.COMPLETE) return false;
  if (!value.inventory || typeof value.inventory.blade !== 'boolean' || typeof value.inventory.seal !== 'boolean' || typeof value.inventory.core !== 'boolean') return false;
  if (typeof value.chestOpened !== 'boolean' || typeof value.guardianDefeated !== 'boolean') return false;
  if (!Array.isArray(value.activatedRunes) || value.activatedRunes.some((id) => !['rune-left', 'rune-right', 'rune-south'].includes(id)) || new Set(value.activatedRunes).size !== value.activatedRunes.length) return false;
  if (!Array.isArray(value.defeated) || new Set(value.defeated).size !== value.defeated.length) return false;
  if (!Array.isArray(value.enemies)) return false;
  const seeds = enemySeed();
  if (value.enemies.length !== seeds.length || value.enemies.some((enemy) => !validEnemyState(enemy, seeds))) return false;
  if (new Set(value.enemies.map((enemy) => enemy.id)).size !== seeds.length) return false;
  if (!['playing', 'completed'].includes(value.status) || !Number.isInteger(value.turn) || value.turn < 0 || typeof value.message !== 'string') return false;
  if (value.quest >= QUEST.DEFEAT_LEAFLINGS && !value.inventory.blade) return false;
  if (value.quest >= QUEST.OPEN_SHRINE && !value.inventory.seal) return false;
  if (value.quest >= QUEST.RETURN_HOME && !value.inventory.core) return false;
  if (value.quest === QUEST.COMPLETE && value.status !== 'completed') return false;
  if (value.status === 'completed' && value.quest !== QUEST.COMPLETE) return false;
  return true;
}

export function publicSnapshot(state) {
  return {
    zoneId: state.zoneId,
    player: { ...state.player },
    quest: state.quest,
    objective: questObjective(state),
    inventory: { ...state.inventory },
    leafKills: leafKills(state),
    runes: state.activatedRunes.length,
    guardianDefeated: state.guardianDefeated,
    status: state.status,
  };
}

export { GRID_WIDTH, GRID_HEIGHT, getZone };
