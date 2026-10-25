import { createGame, isValidGameState } from './game.js';

export const STORAGE_KEY = 'tromu-super-tromu-land-2-v1';

export function getSafeStorage(root = globalThis) {
  try {
    return root?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadGame(storage) {
  if (!storage) return createGame();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return createGame();
    const parsed = JSON.parse(raw);
    if (isValidGameState(parsed)) return structuredClone(parsed);
    storage.removeItem?.(STORAGE_KEY);
    return createGame();
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return createGame();
  }
}

export function saveGame(storage, state) {
  if (!storage || !isValidGameState(state)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
