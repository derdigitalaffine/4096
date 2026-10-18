export const STORAGE_KEY = 'tromu-space-shooter-best-v1';

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
    const value = JSON.parse(raw);
    if (isValidBest(value)) return value;
    storage.removeItem?.(STORAGE_KEY);
    return 0;
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return 0;
  }
}

export function saveBest(storage, score) {
  if (!storage || !isValidBest(score)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(score));
    return true;
  } catch {
    return false;
  }
}

export function recordBest(current, score) {
  const safeCurrent = isValidBest(current) ? current : 0;
  return isValidBest(score) ? Math.max(safeCurrent, score) : safeCurrent;
}
