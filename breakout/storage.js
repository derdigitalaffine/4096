export const STORAGE_KEY = 'tromu-breakout-best-v1';

export function getSafeStorage(scope = globalThis) {
  try {
    const storage = scope?.localStorage;
    if (!storage) return null;
    const probe = `${STORAGE_KEY}-probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function loadBest(storage) {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const value = JSON.parse(raw);
    if (Number.isInteger(value) && value >= 0) return value;
    storage.removeItem(STORAGE_KEY);
  } catch {
    try { storage.removeItem(STORAGE_KEY); } catch {}
  }
  return 0;
}

export function saveBest(storage, score) {
  if (!storage || !Number.isInteger(score) || score < 0) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(score));
    return true;
  } catch {
    return false;
  }
}
