import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_Y, LEVELS, QUESTION_BLOCK_SIZE } from './game.js';

function groundSegments(level) {
  return level.solids
    .filter((solid) => solid.y === GROUND_Y)
    .sort((a, b) => a.x - b.x);
}

function groundGaps(level) {
  const grounds = groundSegments(level);
  return grounds.slice(0, -1).map((solid, index) => grounds[index + 1].x - (solid.x + solid.width));
}

test('auto-scroll stages keep their classic gaps but never place question blocks over pits', () => {
  for (const id of ['2-3', '4-3']) {
    const level = LEVELS.find((candidate) => candidate.id === id);
    assert.ok(level, `${id} fehlt.`);
    assert.equal(level.autoScroll, true, `${id} ist keine Auto-Scroll-Stage.`);

    const grounds = groundSegments(level);
    const gaps = groundGaps(level);
    assert.ok(gaps.length >= 5, `${id} hat nicht die erwartete Folge von Bodenlücken.`);
    assert.equal(Math.max(...gaps), 128, `${id} soll die ursprüngliche 128px-Sprunglücke behalten.`);

    for (const block of level.blocks) {
      const centerX = block.x + QUESTION_BLOCK_SIZE / 2;
      assert.ok(
        grounds.some((ground) => centerX >= ground.x && centerX <= ground.x + ground.width),
        `${id} hat einen ?-Block über einer Grube bei x=${block.x}.`,
      );
    }
  }
});
