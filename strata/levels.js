const freezeAction = (action) => Object.freeze({ ...action });
const freezeLayer = (layer) => Object.freeze({
  ...layer,
  cells: Object.freeze(layer.cells.map((cell) => Object.freeze({ ...cell }))),
});
const freezeLevel = (level) => Object.freeze({
  ...level,
  start: Object.freeze({ ...level.start }),
  goal: Object.freeze({ ...level.goal }),
  layers: Object.freeze(level.layers.map(freezeLayer)),
  reference: Object.freeze(level.reference.map(freezeAction)),
  alternate: Object.freeze((level.alternate ?? []).map(freezeAction)),
});

const P = (x, y) => ({ x, y });
const move = (direction) => ({ type: 'move', direction });
const shift = (layer, direction) => ({ type: 'shift', layer, direction });
const vertical = (x, from = 1, to = 5) => Array.from({ length: to - from + 1 }, (_, i) => P(x, from + i));
const horizontal = (y, from = 1, to = 5) => Array.from({ length: to - from + 1 }, (_, i) => P(from + i, y));

export const LEVELS = Object.freeze([
  freezeLevel({
    id: 'double-matter', title: 'Doppelte Materie', lesson: 'Zwei gleiche Wände löschen sich aus.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: vertical(3) },
      { id: 'B', label: 'Schicht B · Punkte', cells: vertical(4) },
    ],
    reference: [shift(1, 'left'), move('right'), move('right'), move('right'), move('right')],
    note: 'Die zweite Linie wird auf die erste geschoben; fünf überlagerte Paare werden begehbar.',
  }),
  freezeLevel({
    id: 'lift-the-wall', title: 'Wand anheben', lesson: 'Eine globale Verschiebung kann einen lokalen Weg öffnen.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: [P(3, 3), P(3, 5)] },
      { id: 'B', label: 'Schicht B · Punkte', cells: [P(1, 1)] },
    ],
    reference: [shift(0, 'up'), move('right'), move('right'), move('right'), move('right')],
    note: 'Die sichtbare Wand weicht nach oben; gleichzeitig bewegt sich auch ihr zweites Fragment.',
  }),
  freezeLevel({
    id: 'shortcut-theory', title: 'Abkürzung', lesson: 'Gelöst ist gut; elegant ist besser.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: [P(3, 3)] },
      { id: 'B', label: 'Schicht B · Punkte', cells: [] },
    ],
    reference: [shift(0, 'up'), move('right'), move('right'), move('right'), move('right')],
    alternate: [move('up'), move('right'), move('right'), move('right'), move('right'), move('down')],
    note: 'Der Umweg funktioniert, aber eine einzige Schichtbewegung erzeugt die kürzere Lösung.',
  }),
  freezeLevel({
    id: 'crossfade', title: 'Crossfade', lesson: 'Teilweise Überlagerung erzeugt ein Fenster statt einer offenen Fläche.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: vertical(3) },
      { id: 'B', label: 'Schicht B · Punkte', cells: vertical(4, 2, 4) },
    ],
    reference: [shift(1, 'left'), move('right'), move('right'), move('right'), move('right')],
    note: 'Nur die überlagerten mittleren Zellen verschwinden; oben und unten bleibt Materie bestehen.',
  }),
  freezeLevel({
    id: 'floor-fold', title: 'Bodenfalte', lesson: 'Die gleiche Parität funktioniert horizontal genauso.',
    width: 7, height: 7, start: P(3, 1), goal: P(3, 5),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: horizontal(3) },
      { id: 'B', label: 'Schicht B · Punkte', cells: horizontal(2) },
    ],
    reference: [shift(1, 'down'), move('down'), move('down'), move('down'), move('down')],
    note: 'Die obere Schicht rutscht in die Barriere und löscht sie aus.',
  }),
  freezeLevel({
    id: 'two-step-register', title: 'Zweifach versetzt', lesson: 'Schichten dürfen mehrfach verschoben werden.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: vertical(2) },
      { id: 'B', label: 'Schicht B · Punkte', cells: vertical(4) },
    ],
    reference: [shift(1, 'left'), shift(1, 'left'), move('right'), move('right'), move('right'), move('right')],
    note: 'Erst nach zwei globalen Verschiebungen liegen die Muster exakt übereinander.',
  }),
  freezeLevel({
    id: 'open-close', title: 'Öffnen heißt schließen', lesson: 'Ein geöffneter Weg kann gleichzeitig einen anderen versperren.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: [P(3, 3), P(3, 1)] },
      { id: 'B', label: 'Schicht B · Punkte', cells: [P(4, 3), P(4, 2)] },
    ],
    reference: [shift(1, 'left'), move('right'), move('right'), move('right'), move('right')],
    note: 'Die Mitte wird durch Überlagerung frei, während darüber neue Materie sichtbar wird.',
  }),
  freezeLevel({
    id: 'vertical-register', title: 'Vertikalregister', lesson: 'Ausrichtung ist eine zweidimensionale Entscheidung.',
    width: 7, height: 7, start: P(3, 1), goal: P(3, 6),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: horizontal(3, 1, 5) },
      { id: 'B', label: 'Schicht B · Punkte', cells: horizontal(5, 1, 5) },
    ],
    reference: [shift(1, 'up'), shift(1, 'up'), move('down'), move('down'), move('down'), move('down'), move('down')],
    note: 'Zwei vertikale Verschiebungen bringen die zweite Reihe exakt auf die erste.',
  }),
  freezeLevel({
    id: 'two-hazards', title: 'Zwei Störungen', lesson: 'Nicht jede Lösung braucht Auslöschung; beide Schichten können getrennt weichen.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: [P(2, 3), P(6, 6)] },
      { id: 'B', label: 'Schicht B · Punkte', cells: [P(4, 3), P(0, 0)] },
    ],
    reference: [shift(0, 'up'), shift(1, 'down'), move('right'), move('right'), move('right'), move('right')],
    note: 'Zwei unabhängige Blocker werden mit zwei unterschiedlichen Schichtbewegungen aus dem Weg geräumt.',
  }),
  freezeLevel({
    id: 'parallax-gate', title: 'Parallax Gate', lesson: 'Verschieben verändert mehrere relevante Stellen gleichzeitig.',
    width: 7, height: 7, start: P(1, 3), goal: P(5, 3),
    layers: [
      { id: 'A', label: 'Schicht A · Linien', cells: [P(3, 1), P(3, 2), P(3, 3), P(3, 4), P(3, 5), P(5, 1)] },
      { id: 'B', label: 'Schicht B · Punkte', cells: [P(4, 2), P(4, 3), P(4, 4), P(6, 1)] },
    ],
    reference: [shift(1, 'left'), move('right'), move('right'), move('right'), move('right')],
    note: 'Die mittlere Passage verschwindet aus der Materie, während ein fernes Muster ebenfalls neu zusammengesetzt wird.',
  }),
]);
