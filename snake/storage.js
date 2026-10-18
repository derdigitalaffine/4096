import { MODES } from './game.js';

export const STORAGE_KEY = 'tromu-snake-highscores-v1';

export function emptyHighscores() {
  return Object.fromEntries(Object.keys(MODES).map((mode) => [mode, 0]));
}

function isValidScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

export function isValidHighscores(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(MODES).every((mode) => isValidScore(value[mode])));
}

export function getSafeStorage(root = globalThis) {
  try {
    return root?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadHighscores(storage) {
  if (!storage) return emptyHighscores();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyHighscores();
    const parsed = JSON.parse(raw);
    if (isValidHighscores(parsed)) return { ...parsed };
    storage.removeItem?.(STORAGE_KEY);
    return emptyHighscores();
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return emptyHighscores();
  }
}

export function saveHighscores(storage, highscores) {
  if (!storage || !isValidHighscores(highscores)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(highscores));
    return true;
  } catch {
    return false;
  }
}

export function recordHighscore(highscores, mode, score) {
  const safe = isValidHighscores(highscores) ? highscores : emptyHighscores();
  if (!Object.hasOwn(MODES, mode) || !isValidScore(score)) return { ...safe };
  return { ...safe, [mode]: Math.max(safe[mode], score) };
}
