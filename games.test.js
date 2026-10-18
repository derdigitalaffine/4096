import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_COUNT, GAMES, gameRoutes, getGame, routeHref } from './games.js';
import { navigationEntries } from './game-nav.js';

test('game registry is the unique canonical source for local games', () => {
  assert.equal(GAME_COUNT, GAMES.length);
  assert.ok(GAME_COUNT >= 4);
  assert.equal(new Set(GAMES.map((game) => game.id)).size, GAME_COUNT);
  assert.equal(new Set(gameRoutes()).size, GAME_COUNT);

  for (const game of GAMES) {
    assert.match(game.id, /^[a-z0-9-]+$/);
    assert.ok(game.name.length > 0);
    assert.match(game.route, /^\/[a-z0-9-]+\/$/);
    assert.ok(game.description.length >= 20);
    assert.ok(game.shell.includes(game.route), `${game.id}: kanonische Route fehlt im Shell-Vertrag.`);
    assert.ok(game.shell.includes(`${game.route}index.html`), `${game.id}: index.html fehlt im Shell-Vertrag.`);
    assert.equal(getGame(game.id), game);
  }
});

test('legacy routes never collide with canonical game routes', () => {
  const canonical = new Set(gameRoutes());
  const legacy = GAMES.flatMap((game) => game.legacyRoutes);
  assert.equal(new Set(legacy).size, legacy.length);
  for (const route of legacy) assert.equal(canonical.has(route), false, `${route} ist zugleich kanonisch und Legacy.`);
});

test('shared navigation grows from the registry and omits only the current game', () => {
  for (const current of GAMES) {
    const entries = navigationEntries(current.id);
    assert.equal(entries.length, GAME_COUNT);
    assert.deepEqual(entries.map((entry) => entry.route), ['/', ...GAMES.filter((game) => game.id !== current.id).map((game) => game.route)]);
    assert.equal(entries.some((entry) => entry.id === current.id), false);
  }
});

test('canonical routes resolve inside the deployed webroot instead of escaping to domain root', () => {
  const webroot = 'https://example.test/tromu/';
  assert.equal(routeHref('/', webroot), 'https://example.test/tromu/');
  assert.equal(routeHref('/4096/', webroot), 'https://example.test/tromu/4096/');
  assert.equal(routeHref('/dr-tromu/', webroot), 'https://example.test/tromu/dr-tromu/');
});

test('Super Tromu Land registry copy reflects the full current campaign', () => {
  const game = getGame('super-tromu-land');
  assert.match(game.description, /Vier Welten/);
  assert.match(game.description, /zwölf/);
});
