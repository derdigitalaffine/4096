import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraTargetX, nextCameraX, pixelCameraX } from './view.js';

test('camera target stays at the start, follows the player and clamps at the level end', () => {
  assert.equal(cameraTargetX(64, 3040, 800), 0);
  assert.equal(cameraTargetX(272, 3040, 800), 0);
  assert.equal(cameraTargetX(400, 3040, 800), 128);
  assert.equal(cameraTargetX(9999, 3040, 800), 2240);
});

test('smooth camera approaches the target without overshooting and settles exactly', () => {
  let camera = 0;
  const target = 240;
  const first = nextCameraX(camera, target, 1 / 60);
  assert.ok(first > 0 && first < target, `first camera step must be between 0 and ${target}: ${first}`);
  camera = first;
  for (let index = 0; index < 120; index += 1) camera = nextCameraX(camera, target, 1 / 60);
  assert.equal(camera, target);
  assert.equal(nextCameraX(target, target, 1 / 60), target);
});

test('camera smoothing clamps long frames and pixel snapping stays deterministic', () => {
  const normal = nextCameraX(0, 200, 0.05);
  const stalled = nextCameraX(0, 200, 2);
  assert.equal(stalled, normal);
  assert.equal(nextCameraX(50, 200, 0), 50);
  assert.equal(pixelCameraX(12.49), 12);
  assert.equal(pixelCameraX(12.5), 13);
});
