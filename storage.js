import { isValidBoard } from './game.js';

export const STORAGE_KEY = '4096:state:v1';
export const BEST_KEY = '4096:best:v1';

function isValidScore(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function getSafeStorage(source) {
  try {
    return source?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readBestScore(storage) {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(BEST_KEY);
    if (raw === null) return 0;
    const value = Number(raw);
    return isValidScore(value) ? value : 0;
  } catch {
    return 0;
  }
}

function restoreUndoSnapshot(value, currentScore) {
  if (
    value &&
    isValidBoard(value.board) &&
    isValidScore(value.score) &&
    value.score <= currentScore &&
    typeof value.wonAcknowledged === 'boolean'
  ) {
    return {
      board: value.board,
      score: value.score,
      wonAcknowledged: value.wonAcknowledged,
    };
  }
  return null;
}

export function restoreStoredState(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !isValidBoard(parsed.board) ||
      !isValidScore(parsed.score) ||
      typeof parsed.wonAcknowledged !== 'boolean'
    ) {
      return null;
    }

    const storedBest = isValidScore(parsed.best) ? parsed.best : 0;
    return {
      board: parsed.board,
      score: parsed.score,
      best: Math.max(readBestScore(storage), storedBest, parsed.score),
      wonAcknowledged: parsed.wonAcknowledged,
      undo: restoreUndoSnapshot(parsed.undo, parsed.score),
    };
  } catch {
    return null;
  }
}

export function persistStoredState(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    storage.setItem(BEST_KEY, String(state.best));
    return true;
  } catch {
    return false;
  }
}
