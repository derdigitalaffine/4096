import { LEVELS } from './levels.js';

export const STORAGE_KEY = 'tromu-echoloop-progress-v1';

export function emptyProgress() {
  return {
    version: 1,
    unlocked: 1,
    bestLoops: LEVELS.map(() => null),
  };
}

function validBest(value) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 9999);
}

export function isValidProgress(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && value.version === 1
    && Number.isInteger(value.unlocked) && value.unlocked >= 1 && value.unlocked <= LEVELS.length
    && Array.isArray(value.bestLoops) && value.bestLoops.length === LEVELS.length
    && value.bestLoops.every(validBest));
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
    if (isValidProgress(parsed)) return { ...parsed, bestLoops: [...parsed.bestLoops] };
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

export function recordWin(progress, levelIndex, loops) {
  const safe = isValidProgress(progress) ? progress : emptyProgress();
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length || !Number.isInteger(loops) || loops < 1) {
    return { ...safe, bestLoops: [...safe.bestLoops] };
  }
  const bestLoops = [...safe.bestLoops];
  bestLoops[levelIndex] = bestLoops[levelIndex] === null ? loops : Math.min(bestLoops[levelIndex], loops);
  return {
    version: 1,
    unlocked: Math.max(safe.unlocked, Math.min(LEVELS.length, levelIndex + 2)),
    bestLoops,
  };
}
