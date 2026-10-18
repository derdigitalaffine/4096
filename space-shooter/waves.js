const freezeEnemy = (enemy) => Object.freeze({ ...enemy });
const freezeWave = (wave) => Object.freeze({
  ...wave,
  enemies: Object.freeze(wave.enemies.map(freezeEnemy)),
});

export const WAVES = Object.freeze([
  freezeWave({
    id: 'orbit-line',
    title: 'Orbit Line',
    shotEvery: 96,
    enemies: [
      { id: 'o1', type: 'scout', x: 56, y: 58, phase: 0, drop: null },
      { id: 'o2', type: 'scout', x: 104, y: 58, phase: 12, drop: 'shield' },
      { id: 'o3', type: 'scout', x: 152, y: 58, phase: 24, drop: null },
      { id: 'o4', type: 'scout', x: 200, y: 58, phase: 36, drop: null },
      { id: 'o5', type: 'scout', x: 248, y: 58, phase: 48, drop: null },
      { id: 'o6', type: 'scout', x: 296, y: 58, phase: 60, drop: null },
    ],
  }),
  freezeWave({
    id: 'split-guard',
    title: 'Split Guard',
    shotEvery: 82,
    enemies: [
      { id: 's1', type: 'scout', x: 64, y: 52, phase: 3, drop: null },
      { id: 's2', type: 'tank', x: 128, y: 78, phase: 17, drop: 'spread' },
      { id: 's3', type: 'scout', x: 192, y: 52, phase: 31, drop: null },
      { id: 's4', type: 'tank', x: 256, y: 78, phase: 45, drop: null },
      { id: 's5', type: 'scout', x: 96, y: 112, phase: 59, drop: null },
      { id: 's6', type: 'scout', x: 224, y: 112, phase: 71, drop: null },
    ],
  }),
  freezeWave({
    id: 'vector-storm',
    title: 'Vector Storm',
    shotEvery: 70,
    enemies: [
      { id: 'v1', type: 'diver', x: 54, y: 48, phase: 0, drop: null },
      { id: 'v2', type: 'tank', x: 112, y: 72, phase: 13, drop: 'rapid' },
      { id: 'v3', type: 'scout', x: 160, y: 48, phase: 26, drop: null },
      { id: 'v4', type: 'tank', x: 208, y: 72, phase: 39, drop: 'shield' },
      { id: 'v5', type: 'diver', x: 266, y: 48, phase: 52, drop: null },
      { id: 'v6', type: 'scout', x: 90, y: 118, phase: 65, drop: null },
      { id: 'v7', type: 'scout', x: 230, y: 118, phase: 78, drop: null },
    ],
  }),
]);
