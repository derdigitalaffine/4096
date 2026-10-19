const BORDER = Object.freeze([
  ...Array.from({ length: 9 }, (_, x) => Object.freeze({ x, y: 0 })),
  ...Array.from({ length: 9 }, (_, x) => Object.freeze({ x, y: 8 })),
  ...Array.from({ length: 7 }, (_, y) => Object.freeze({ x: 0, y: y + 1 })),
  ...Array.from({ length: 7 }, (_, y) => Object.freeze({ x: 8, y: y + 1 })),
]);

const freezeLevel = (level) => Object.freeze({
  ...level,
  start: Object.freeze({ ...level.start }),
  walls: Object.freeze(level.walls.map((wall) => Object.freeze({ ...wall }))),
  crystals: Object.freeze(level.crystals.map((crystal) => Object.freeze({ ...crystal }))),
});

export const LEVELS = Object.freeze([
  freezeLevel({
    id: 'first-trace',
    title: 'First Trace',
    lesson: 'Ein Loop zeichnet jede Bewegung exakt auf.',
    width: 9,
    height: 9,
    start: { x: 4, y: 4 },
    walls: BORDER,
    crystals: [{ x: 7, y: 7 }],
    referenceLoops: 1,
  }),
  freezeLevel({
    id: 'split-memory',
    title: 'Split Memory',
    lesson: 'Ein früheres Echo kann gleichzeitig den anderen Weg übernehmen.',
    width: 9,
    height: 9,
    start: { x: 4, y: 4 },
    walls: BORDER,
    crystals: [{ x: 1, y: 1 }, { x: 7, y: 7 }],
    referenceLoops: 2,
  }),
  freezeLevel({
    id: 'three-times',
    title: 'Three Times',
    lesson: 'Mehrere frühere Entscheidungen existieren gleichzeitig.',
    width: 9,
    height: 9,
    start: { x: 4, y: 4 },
    walls: BORDER,
    crystals: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 4, y: 7 }],
    referenceLoops: 3,
  }),
]);
