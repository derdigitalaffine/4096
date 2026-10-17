export function wrappedDialogFocusTarget(buttons, activeElement, backwards = false) {
  const focusable = buttons.filter((button) => !button.hidden && !button.disabled);
  if (!focusable.length) return null;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!focusable.includes(activeElement)) return backwards ? last : first;
  if (backwards && activeElement === first) return last;
  if (!backwards && activeElement === last) return first;
  return null;
}
