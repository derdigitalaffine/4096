export const STORAGE_KEY = 'tromu-duell-stats-v1';
export const MODES = Object.freeze(['connect-four', 'reversi']);

function emptyMode() {
  return { games: 0, p1: 0, p2: 0, draws: 0 };
}

export function emptyStats() {
  return {
    version: 1,
    'connect-four': emptyMode(),
    reversi: emptyMode(),
  };
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function validMode(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && validCount(value.games) && validCount(value.p1) && validCount(value.p2) && validCount(value.draws)
    && value.games === value.p1 + value.p2 + value.draws);
}

export function isValidStats(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && value.version === 1
    && MODES.every((mode) => validMode(value[mode])));
}

export function getSafeStorage(root = globalThis) {
  try {
    return root?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadStats(storage) {
  if (!storage) return emptyStats();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyStats();
    const parsed = JSON.parse(raw);
    if (isValidStats(parsed)) return structuredClone(parsed);
    storage.removeItem?.(STORAGE_KEY);
    return emptyStats();
  } catch {
    try { storage.removeItem?.(STORAGE_KEY); } catch {}
    return emptyStats();
  }
}

export function saveStats(storage, stats) {
  if (!storage || !isValidStats(stats)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function recordResult(stats, mode, winner) {
  const safe = isValidStats(stats) ? stats : emptyStats();
  if (!MODES.includes(mode) || ![0, 1, 2].includes(winner)) return structuredClone(safe);
  const current = safe[mode];
  const nextMode = {
    games: current.games + 1,
    p1: current.p1 + (winner === 1 ? 1 : 0),
    p2: current.p2 + (winner === 2 ? 1 : 0),
    draws: current.draws + (winner === 0 ? 1 : 0),
  };
  return { ...structuredClone(safe), [mode]: nextMode };
}
