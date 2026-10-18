export const STORAGE_KEY = 'tromu-maze-chase-best-v1';

export function getSafeStorage(root = globalThis) {
  try {
    return root?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isValidBest(value) {
  return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

export function loadBest(storage) {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && isValidBest(parsed.best)) return parsed.best;
    storage.removeItem?.(STORAGE_KEY);
    return 0;
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return 0;
  }
}

export function saveBest(storage, best) {
  if (!storage || !isValidBest(best)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best }));
    return true;
  } catch {
    return false;
  }
}

export function recordBest(best, score) {
  const safeBest = isValidBest(best) ? best : 0;
  return isValidBest(score) ? Math.max(safeBest, score) : safeBest;
}
