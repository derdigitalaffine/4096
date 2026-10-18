export const LEVELS = Object.freeze([
  Object.freeze({
    id: 'first-push', title: 'Erster Schub', lesson: 'Eine Kiste wird nur durch Schieben bewegt.',
    map: Object.freeze(['#####', '# . #', '# $ #', '# @ #', '#####']),
    solution: 'U',
  }),
  Object.freeze({
    id: 'two-lanes', title: 'Zwei Spuren', lesson: 'Plane, von welcher Seite du die zweite Kiste erreichst.',
    map: Object.freeze(['######', '# .. #', '# $$ #', '# @  #', '######']),
    solution: 'UDRU',
  }),
  Object.freeze({
    id: 'around-the-post', title: 'Um den Pfosten', lesson: 'Manche Schübe brauchen zuerst einen Umweg.',
    map: Object.freeze(['#######', '#  .  #', '#  $  #', '#  #  #', '# @   #', '#######']),
    solution: 'UURURRDDLURUL',
  }),
  Object.freeze({
    id: 'split-goals', title: 'Geteilte Ziele', lesson: 'Zwei Kisten teilen sich einen engen Arbeitsraum.',
    map: Object.freeze(['#######', '# . . #', '# $ $ #', '#  #  #', '#  @  #', '#######']),
    solution: 'LUUDDRRUU',
  }),
  Object.freeze({
    id: 'long-corner', title: 'Langer Winkel', lesson: 'Ein Ziel am Rand verlangt frühes Positionsspiel.',
    map: Object.freeze(['########', '#  .   #', '#  $   #', '# ###  #', '#   $ .#', '# @    #', '########']),
    solution: 'ULUURRRLLLDDRRRRUURULL',
  }),
  Object.freeze({
    id: 'double-turn', title: 'Doppelte Wende', lesson: 'Halte genug Raum frei, um beide Kisten anzulaufen.',
    map: Object.freeze(['########', '# .  . #', '# $$   #', '#   #  #', '#   @  #', '########']),
    solution: 'LULURRURRDDLU',
  }),
  Object.freeze({
    id: 'narrow-mouth', title: 'Engpass', lesson: 'Die Reihenfolge der Schübe entscheidet.',
    map: Object.freeze(['########', '#  ..  #', '#  $$  #', '# #  # #', '#   @  #', '########']),
    solution: 'UUDLU',
  }),
  Object.freeze({
    id: 'twin-pillars', title: 'Zwillingspfeiler', lesson: 'Arbeite auf beiden Seiten eines Hindernisses.',
    map: Object.freeze(['#########', '# .   . #', '# $ # $ #', '#   #   #', '#   @   #', '#########']),
    solution: 'LULUDDRRRURU',
  }),
  Object.freeze({
    id: 'three-step', title: 'Dreischritt', lesson: 'Drei Ziele zwingen zu sauberer Reihenfolge.',
    map: Object.freeze(['#########', '#  . .  #', '#  $ $  #', '# ###   #', '#   $ . #', '#   @   #', '#########']),
    solution: 'LURRUULULLDRRRDRRULULLRRDDLU',
  }),
  Object.freeze({
    id: 'final-grid', title: 'Finales Raster', lesson: 'Drei Kisten, drei Ziele und kaum verschenkter Raum.',
    map: Object.freeze(['#########', '# . . . #', '# $ $ $ #', '# # #   #', '#     @ #', '#########']),
    solution: 'UULULLLLDRLDDRRUURULDRRDRRUULLDDRU',
  }),
]);
