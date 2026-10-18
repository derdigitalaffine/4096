import { GAMES } from './games.js';

export function navigationEntries(currentGameId) {
  return [
    Object.freeze({ id: 'home', name: 'Spielewelt', route: '/' }),
    ...GAMES.filter((game) => game.id !== currentGameId).map(({ id, name, route }) => Object.freeze({ id, name, route })),
  ];
}

export function renderGameNavigation(nav, currentGameId = document.body?.dataset?.gameId) {
  if (!nav) return;
  const linkClass = nav.dataset.linkClass ?? '';
  const fragment = document.createDocumentFragment();

  for (const entry of navigationEntries(currentGameId)) {
    const link = document.createElement('a');
    link.href = entry.route;
    link.textContent = entry.name;
    link.dataset.gameId = entry.id;
    if (linkClass) link.className = linkClass;
    fragment.append(link);
  }

  nav.replaceChildren(fragment);
}

export function renderAllGameNavigation(root = document) {
  const currentGameId = root.body?.dataset?.gameId ?? document.body?.dataset?.gameId;
  for (const nav of root.querySelectorAll('[data-game-nav]')) renderGameNavigation(nav, currentGameId);
}

if (typeof document !== 'undefined') renderAllGameNavigation(document);
