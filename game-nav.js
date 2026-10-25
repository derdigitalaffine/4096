import { routeHref } from './games.js';

const HOME_ENTRY = Object.freeze({
  id: 'home',
  name: '← Zurück zur Spielewelt',
  route: '/',
});

const THEME_ID = 'tromu-mantine-theme';

export function navigationEntries() {
  return [HOME_ENTRY];
}

export function ensureMantineTheme(root = document) {
  const doc = root?.ownerDocument ?? root;
  if (!doc?.head || doc.getElementById(THEME_ID)) return;

  const link = doc.createElement('link');
  link.id = THEME_ID;
  link.rel = 'stylesheet';
  link.href = routeHref('/mantine-theme.css');
  doc.head.append(link);
  doc.documentElement.dataset.mantineColorScheme = 'dark';
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
  ensureMantineTheme(root);
  for (const nav of root.querySelectorAll('[data-game-nav]')) renderGameNavigation(nav);
}

if (typeof document !== 'undefined') renderAllGameNavigation(document);
