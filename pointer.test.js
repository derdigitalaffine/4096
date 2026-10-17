import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCancelPointerGesture, shouldStartPointerGesture } from './pointer.js';

test('primary main-button pointer can start a gesture', () => {
  assert.equal(shouldStartPointerGesture({ isPrimary: true, button: 0 }), true);
});

test('secondary buttons and non-primary pointers cannot start a gesture', () => {
  assert.equal(shouldStartPointerGesture({ isPrimary: true, button: 1 }), false);
  assert.equal(shouldStartPointerGesture({ isPrimary: true, button: 2 }), false);
  assert.equal(shouldStartPointerGesture({ isPrimary: false, button: 0 }), false);
});

test('an active pointer cannot be overwritten by another pointerdown', () => {
  assert.equal(
    shouldStartPointerGesture({ isPrimary: true, button: 0 }, { id: 7, x: 10, y: 10 }),
    false
  );
});

test('only cancel from the active pointer clears the gesture', () => {
  const active = { id: 7, x: 10, y: 10 };
  assert.equal(shouldCancelPointerGesture(active, 8), false);
  assert.equal(shouldCancelPointerGesture(active, 7), true);
  assert.equal(shouldCancelPointerGesture(null, 7), false);
});
