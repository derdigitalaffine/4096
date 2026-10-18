import { LEVELS } from './levels.js';
import { restoreGame, serializeGame } from './game.js';

export const STORAGE_KEY = 'tromu-sokoban-v1';

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

export function emptyProgress() {
  return { version: 1, unlocked: 1, best: {}, resume: null };
}

function sanitizeBest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const best = {};
  for (const level of LEVELS) {
    const entry = value[level.id];
    if (!entry || !Number.isInteger(entry.moves) || !Number.isInteger(entry.pushes)) continue;
    if (entry.moves < 0 || entry.pushes < 0 || entry.pushes > entry.moves) continue;
    best[level.id] = { moves: entry.moves, pushes: entry.pushes };
  }
  return best;
}

export function sanitizeProgress(value) {
  if (!value || value.version !== 1) return null;
  if (!Number.isInteger(value.unlocked) || value.unlocked < 1 || value.unlocked > LEVELS.length) return null;
  const resumeGame = value.resume ? restoreGame(value.resume) : null;
  if (value.resume && !resumeGame) return null;
  if (resumeGame && resumeGame.levelIndex >= value.unlocked) return null;
  return {
    version: 1,
    unlocked: value.unlocked,
    best: sanitizeBest(value.best),
    resume: resumeGame ? serializeGame(resumeGame) : null,
  };
}

export function loadProgress(storage) {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const progress = sanitizeProgress(JSON.parse(raw));
    if (progress) return progress;
    storage.removeItem(STORAGE_KEY);
  } catch {
    try { storage.removeItem(STORAGE_KEY); } catch {}
  }
  return emptyProgress();
}

export function saveProgress(storage, progress) {
  if (!storage) return false;
  const clean = sanitizeProgress(progress);
  if (!clean) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function withResume(progress, state) {
  return { ...progress, resume: serializeGame(state) };
}

export function recordCompletion(progress, state) {
  const level = LEVELS[state.levelIndex];
  const previous = progress.best[level.id];
  const score = { moves: state.moves, pushes: state.pushes };
  const better = !previous || score.pushes < previous.pushes || (score.pushes === previous.pushes && score.moves < previous.moves);
  const best = better ? { ...progress.best, [level.id]: score } : progress.best;
  return {
    ...progress,
    unlocked: Math.min(LEVELS.length, Math.max(progress.unlocked, state.levelIndex + 2)),
    best,
    resume: null,
  };
}
