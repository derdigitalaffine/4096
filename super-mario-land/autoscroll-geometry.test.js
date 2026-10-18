import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_Y, LEVELS } from './game.js';

function groundGaps(level) {
  const grounds = level.solids
    .filter((solid) => solid.y === GROUND_Y)
    .sort((a, b) => a.x - b.x);
  return grounds.slice(0, -1).map((solid, index) => grounds[index + 1].x - (solid.x + solid.width));
}

test('auto-scroll stages keep ground gaps inside the safely landable 112px contract', () => {
  for (const id of ['2-3', '4-3']) {
    const level = LEVELS.find((candidate) => candidate.id === id);
    assert.ok(level, `${id} fehlt.`);
    assert.equal(level.autoScroll, true, `${id} ist keine Auto-Scroll-Stage.`);
    const gaps = groundGaps(level);
    assert.ok(gaps.length >= 5, `${id} hat nicht die erwartete Folge von Bodenlücken.`);
    assert.ok(gaps.every((gap) => gap <= 112), `${id} enthält eine zu breite Bodenlücke: ${gaps.join(', ')}`);
    assert.equal(Math.max(...gaps), 112, `${id} soll die 112px-Sprunggrenze explizit ausreizen.`);
  }
});
