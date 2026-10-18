import { validateSession } from './game.js';

export const SESSION_KEY = 'tromu-freecell-session-v1';
export const STATS_KEY = 'tromu-freecell-stats-v1';

export function getSafeStorage(scope = globalThis) {
  try {
    const storage = scope?.localStorage;
    if (!storage) return null;
    const probe = `${SESSION_KEY}-probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function emptyStats() {
  return { attempts: 0, wins: 0 };
}

export function sanitizeStats(value) {
  if (!value || value.version !== 1) return null;
  const attempts = value.attempts;
  const wins = value.wins;
  if (!Number.isInteger(attempts) || !Number.isInteger(wins) || attempts < 0 || wins < 0 || wins > attempts) return null;
  return { attempts, wins };
}

function readJson(storage, key) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try { storage.removeItem(key); } catch {}
    return null;
  }
}

export function loadSession(storage) {
  const value = readJson(storage, SESSION_KEY);
  if (!value) return null;
  if (value.version === 1 && validateSession(value.session)) return value.session;
  try { storage?.removeItem(SESSION_KEY); } catch {}
  return null;
}

export function saveSession(storage, session) {
  if (!storage || !validateSession(session)) return false;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, session }));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadStats(storage) {
  const value = readJson(storage, STATS_KEY);
  if (!value) return emptyStats();
  const stats = sanitizeStats(value);
  if (stats) return stats;
  try { storage?.removeItem(STATS_KEY); } catch {}
  return emptyStats();
}

export function saveStats(storage, stats) {
  if (!storage) return false;
  const clean = sanitizeStats({ version: 1, ...stats });
  if (!clean) return false;
  try {
    storage.setItem(STATS_KEY, JSON.stringify({ version: 1, ...clean }));
    return true;
  } catch {
    return false;
  }
}

export function recordAttempt(stats) {
  const clean = sanitizeStats({ version: 1, ...stats }) ?? emptyStats();
  return { ...clean, attempts: clean.attempts + 1 };
}

export function recordWin(stats) {
  const clean = sanitizeStats({ version: 1, ...stats }) ?? emptyStats();
  if (clean.attempts === 0 || clean.wins >= clean.attempts) return clean;
  return { ...clean, wins: clean.wins + 1 };
}
