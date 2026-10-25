import { LEVELS } from './levels.js';

export const STORAGE_KEY = 'tromu-strata-progress-v1';

export function emptyProgress() {
  return {
    version: 1,
    lastLevel: 0,
    solved: LEVELS.map(() => false),
    bestActions: LEVELS.map(() => null),
    bestShifts: LEVELS.map(() => null),
  };
}

const validBest = (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= 99999);

export function isValidProgress(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && value.version === 1
    && Number.isInteger(value.lastLevel) && value.lastLevel >= 0 && value.lastLevel < LEVELS.length
    && Array.isArray(value.solved) && value.solved.length === LEVELS.length && value.solved.every((item) => typeof item === 'boolean')
    && Array.isArray(value.bestActions) && value.bestActions.length === LEVELS.length && value.bestActions.every(validBest)
    && Array.isArray(value.bestShifts) && value.bestShifts.length === LEVELS.length && value.bestShifts.every(validBest));
}

function cloneProgress(progress) {
  return {
    version: 1,
    lastLevel: progress.lastLevel,
    solved: [...progress.solved],
    bestActions: [...progress.bestActions],
    bestShifts: [...progress.bestShifts],
  };
}

export function getSafeStorage(root = globalThis) {
  try {
    return root?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProgress(storage) {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (isValidProgress(parsed)) return cloneProgress(parsed);
    storage.removeItem?.(STORAGE_KEY);
    return emptyProgress();
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return emptyProgress();
  }
}

export function saveProgress(storage, progress) {
  if (!storage || !isValidProgress(progress)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function selectLevel(progress, levelIndex) {
  const safe = isValidProgress(progress) ? cloneProgress(progress) : emptyProgress();
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) return safe;
  safe.lastLevel = levelIndex;
  return safe;
}

export function recordWin(progress, levelIndex, actions, shifts) {
  const safe = isValidProgress(progress) ? cloneProgress(progress) : emptyProgress();
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length
      || !Number.isInteger(actions) || actions < 0 || !Number.isInteger(shifts) || shifts < 0) return safe;
  safe.lastLevel = levelIndex;
  safe.solved[levelIndex] = true;
  safe.bestActions[levelIndex] = safe.bestActions[levelIndex] === null ? actions : Math.min(safe.bestActions[levelIndex], actions);
  safe.bestShifts[levelIndex] = safe.bestShifts[levelIndex] === null ? shifts : Math.min(safe.bestShifts[levelIndex], shifts);
  return safe;
}
