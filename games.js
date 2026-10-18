const freezeGame = (game) => Object.freeze({
  ...game,
  legacyRoutes: Object.freeze([...(game.legacyRoutes ?? [])]),
  shell: Object.freeze([...game.shell]),
});

const WEBROOT_URL = new URL('./', import.meta.url);

export const GAMES = Object.freeze([
  freezeGame({
    id: '4096',
    name: '4096',
    route: '/4096/',
    description: 'Schiebe gleiche Zahlen zusammen und knacke die 4096.',
    shell: ['/4096/', '/4096/index.html', '/styles.css', '/app.js', '/connectivity.js', '/dialog.js', '/game.js', '/pointer.js', '/storage.js'],
  }),
  freezeGame({
    id: 'sudoku',
    name: 'Sudoku',
    route: '/sudoku/',
    description: 'Logik, Notizen, drei Schwierigkeitsstufen und lokaler Fortschritt.',
    shell: ['/sudoku/', '/sudoku/index.html', '/sudoku/styles.css', '/sudoku/app.js', '/sudoku/game.js'],
  }),
  freezeGame({
    id: 'dr-tromu',
    name: 'Dr. Tromu',
    route: '/dr-tromu/',
    description: 'Kapseln drehen, Farben verbinden und alle Viren beseitigen.',
    legacyRoutes: ['/dr-mario/'],
    shell: ['/dr-tromu/', '/dr-tromu/index.html', '/dr-tromu/styles.css', '/dr-tromu/app.js', '/dr-tromu/game.js'],
  }),
  freezeGame({
    id: 'super-tromu-land',
    name: 'Super Tromu Land',
    route: '/super-tromu-land/',
    description: 'Vier Welten mit zwölf Jump-’n’-Run-Stages, Münzen, Gegnern und Ziel-Fahnen.',
    legacyRoutes: ['/super-mario-land/'],
    shell: ['/super-tromu-land/', '/super-tromu-land/index.html', '/super-tromu-land/styles.css', '/super-tromu-land/app.js', '/super-tromu-land/game.js', '/super-tromu-land/view.js'],
  }),
  freezeGame({
    id: 'snake',
    name: 'Tromu Snake',
    route: '/snake/',
    description: 'Schnelles Score-Arcade mit Classic-, Speed- und Maze-Modus, Pickups und Combos.',
    shell: ['/snake/', '/snake/index.html', '/snake/styles.css', '/snake/app.js', '/snake/game.js', '/snake/storage.js'],
  }),
  freezeGame({
    id: 'sokoban',
    name: 'Tromu Sokoban',
    route: '/sokoban/',
    description: 'Zehn eigene Push-Puzzle mit Mehrfach-Undo, Level-Fortschritt und lokalen Bestwerten.',
    shell: ['/sokoban/', '/sokoban/index.html', '/sokoban/styles.css', '/sokoban/app.js', '/sokoban/game.js', '/sokoban/levels.js', '/sokoban/storage.js'],
  }),
  freezeGame({
    id: 'breakout',
    name: 'Tromu Breakout',
    route: '/breakout/',
    description: 'Fünf kurze Arcade-Level mit Paddle, Power-ups, Leben und lokalem Bestwert.',
    shell: ['/breakout/', '/breakout/index.html', '/breakout/styles.css', '/breakout/app.js', '/breakout/game.js', '/breakout/levels.js', '/breakout/storage.js'],
  }),
  freezeGame({
    id: 'minesweeper',
    name: 'Tromu Minesweeper',
    route: '/minesweeper/',
    description: 'Zugängliches Minenrätsel mit sicherem ersten Reveal, Flag-Modus und lokalen Bestzeiten.',
    shell: ['/minesweeper/', '/minesweeper/index.html', '/minesweeper/styles.css', '/minesweeper/app.js', '/minesweeper/game.js', '/minesweeper/storage.js'],
  }),
  freezeGame({
    id: 'freecell',
    name: 'Tromu FreeCell',
    route: '/freecell/',
    description: 'Ruhiges Solitaire mit reproduzierbaren Deals, Mehrfach-Undo und lokaler Fortsetzung.',
    shell: ['/freecell/', '/freecell/index.html', '/freecell/styles.css', '/freecell/keyboard.js', '/freecell/app.js', '/freecell/game.js', '/freecell/storage.js'],
  }),
  freezeGame({
    id: 'maze-chase',
    name: 'Tromu Maze-Chase',
    route: '/maze-chase/',
    description: 'Eigenes Labyrinth-Arcade mit Sammelzielen, Power-Zustand und deterministischen Gegnerprofilen.',
    shell: ['/maze-chase/', '/maze-chase/index.html', '/maze-chase/styles.css', '/maze-chase/app.js', '/maze-chase/game.js', '/maze-chase/levels.js', '/maze-chase/storage.js'],
  }),
  freezeGame({
    id: 'space-shooter',
    name: 'Tromu Space Shooter',
    route: '/space-shooter/',
    description: 'Top-down Score-Arcade mit deterministischen Wellen, drei Gegnerprofilen und lokalen Power-ups.',
    shell: ['/space-shooter/', '/space-shooter/index.html', '/space-shooter/styles.css', '/space-shooter/app.js', '/space-shooter/game.js', '/space-shooter/waves.js', '/space-shooter/storage.js'],
  }),
  freezeGame({
    id: 'duell',
    name: 'Tromu Duell',
    route: '/duell/',
    description: 'Lokale Hot-Seat-Partien in Vier gewinnt und Reversi mit robuster Geräte-Statistik.',
    shell: ['/duell/', '/duell/index.html', '/duell/styles.css', '/duell/app.js', '/duell/connect-four.js', '/duell/reversi.js', '/duell/storage.js'],
  }),
]);

export const GAME_COUNT = GAMES.length;

export function getGame(gameId) {
  return GAMES.find((game) => game.id === gameId) ?? null;
}

export function gameRoutes() {
  return GAMES.map((game) => game.route);
}

export function routeHref(route, webroot = WEBROOT_URL) {
  const relativeRoute = String(route ?? '').replace(/^\/+/, '');
  return new URL(relativeRoute || './', webroot).href;
}
