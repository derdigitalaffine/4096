const CAMERA_ANCHOR = 0.34;
const CAMERA_RESPONSE = 11;

function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function cameraTargetX(playerX, levelWidth, viewWidth) {
  const width = Math.max(0, finiteOrZero(viewWidth));
  const maxCamera = Math.max(0, finiteOrZero(levelWidth) - width);
  const desired = finiteOrZero(playerX) - width * CAMERA_ANCHOR;
  return Math.max(0, Math.min(maxCamera, desired));
}

export function nextCameraX(currentX, targetX, deltaSeconds) {
  const current = finiteOrZero(currentX);
  const target = finiteOrZero(targetX);
  const seconds = Math.max(0, Math.min(0.05, finiteOrZero(deltaSeconds)));
  if (Math.abs(target - current) < 0.5) return target;
  if (seconds === 0) return current;
  const response = 1 - Math.exp(-CAMERA_RESPONSE * seconds);
  return current + (target - current) * response;
}

export function pixelCameraX(value) {
  return Math.round(finiteOrZero(value));
}
