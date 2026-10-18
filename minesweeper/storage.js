import { DIFFICULTY_IDS } from './game.js';

export const STORAGE_KEY = 'tromu-minesweeper-best-v1';

export function emptyBestTimes() {
  return Object.fromEntries(DIFFICULTY_IDS.map((id) => [id, null]));
}

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

export function sanitizeBestTimes(value) {
  if (!value || value.version !== 1 || typeof value.best !== 'object' || value.best === null || Array.isArray(value.best)) return null;
  const best = emptyBestTimes();
  for (const id of DIFFICULTY_IDS) {
    const time = value.best[id];
    if (time === null || time === undefined) continue;
    if (!Number.isInteger(time) || time <= 0 || time > 86_400_000) return null;
    best[id] = time;
  }
  return best;
}

export function loadBestTimes(storage) {
  if (!storage) return emptyBestTimes();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyBestTimes();
    const best = sanitizeBestTimes(JSON.parse(raw));
    if (best) return best;
    storage.removeItem(STORAGE_KEY);
  } catch {
    try { storage.removeItem(STORAGE_KEY); } catch {}
  }
  return emptyBestTimes();
}

export function saveBestTimes(storage, best) {
  if (!storage) return false;
  const clean = sanitizeBestTimes({ version: 1, best });
  if (!clean) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: clean }));
    return true;
  } catch {
    return false;
  }
}

export function recordBestTime(best, difficultyId, elapsedMs) {
  if (!DIFFICULTY_IDS.includes(difficultyId) || !Number.isInteger(elapsedMs) || elapsedMs <= 0) return best;
  const previous = best[difficultyId];
  if (previous !== null && previous <= elapsedMs) return best;
  return { ...best, [difficultyId]: elapsedMs };
}
