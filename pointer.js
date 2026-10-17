export function shouldStartPointerGesture({ isPrimary, button }, activePointer = null) {
  return activePointer === null && isPrimary === true && button === 0;
}

export function shouldCancelPointerGesture(activePointer, pointerId) {
  return activePointer?.id === pointerId;
}
