import { routeHref } from './games.js';

const HOME_ENTRY = Object.freeze({
  id: 'home',
  name: '← Zurück zur Spielewelt',
  route: '/',
});

export function navigationEntries() {
  return [HOME_ENTRY];
}

export function renderGameNavigation(nav) {
  if (!nav) return;
  const linkClass = nav.dataset.linkClass ?? '';
  const link = document.createElement('a');
  link.href = routeHref(HOME_ENTRY.route);
  link.textContent = HOME_ENTRY.name;
  link.dataset.gameId = HOME_ENTRY.id;
  if (linkClass) link.className = linkClass;
  nav.replaceChildren(link);
}

export function renderAllGameNavigation(root = document) {
  for (const nav of root.querySelectorAll('[data-game-nav]')) renderGameNavigation(nav);
}

if (typeof document !== 'undefined') renderAllGameNavigation(document);
