import test from 'node:test';
import assert from 'node:assert/strict';
import { wrappedDialogFocusTarget } from './dialog.js';

function button({ hidden = false, disabled = false } = {}) {
  return { hidden, disabled };
}

test('Tab wraps from the last enabled dialog button to the first', () => {
  const first = button();
  const middle = button();
  const last = button();
  assert.equal(wrappedDialogFocusTarget([first, middle, last], last), first);
  assert.equal(wrappedDialogFocusTarget([first, middle, last], middle), null);
});

test('Shift+Tab wraps from the first enabled dialog button to the last', () => {
  const first = button();
  const middle = button();
  const last = button();
  assert.equal(wrappedDialogFocusTarget([first, middle, last], first, true), last);
  assert.equal(wrappedDialogFocusTarget([first, middle, last], middle, true), null);
});

test('hidden and disabled dialog buttons are skipped', () => {
  const hidden = button({ hidden: true });
  const disabled = button({ disabled: true });
  const undo = button();
  const newGame = button();

  assert.equal(wrappedDialogFocusTarget([hidden, disabled, undo, newGame], newGame), undo);
  assert.equal(wrappedDialogFocusTarget([hidden, disabled, undo, newGame], undo, true), newGame);
});

test('focus outside the active button set is pulled back into the dialog', () => {
  const first = button();
  const last = button();
  const outside = button();

  assert.equal(wrappedDialogFocusTarget([first, last], outside), first);
  assert.equal(wrappedDialogFocusTarget([first, last], outside, true), last);
});
