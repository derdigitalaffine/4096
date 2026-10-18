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
