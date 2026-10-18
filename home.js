import { connectionStatus } from './connectivity.js';
import { GAMES } from './games.js';

const connectionElement = document.querySelector('#connection-status');
const installButton = document.querySelector('#install-app');
const gameGrid = document.querySelector('#game-grid');

function renderGameCards() {
  const fragment = document.createDocumentFragment();

  GAMES.forEach((game, index) => {
    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = game.route;
    card.dataset.gameId = game.id;

    const number = document.createElement('span');
    number.className = 'game-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const title = document.createElement('strong');
    title.textContent = game.name;

    const description = document.createElement('span');
    description.textContent = game.description;

    const playLabel = document.createElement('span');
    playLabel.className = 'play-label';
    playLabel.textContent = 'START →';

    card.append(number, title, description, playLabel);
    fragment.append(card);
  });

  gameGrid.replaceChildren(fragment);
}

let installPrompt = null;
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

function updateConnectionStatus() {
  const online = navigator.onLine;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.offlineReady = String(offlineReady);
  connectionElement.dataset.warning = String(!offlineReady && (!online || offlineError));
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = Boolean(navigator.serviceWorker.controller);
    if (offlineReady) offlineError = false;
    updateConnectionStatus();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      registration.update().catch(() => {});
      await navigator.serviceWorker.ready;
      offlineReady = true;
      offlineError = false;
      updateConnectionStatus();
    } catch (error) {
      offlineReady = false;
      offlineError = true;
      updateConnectionStatus();
      console.warn('Service Worker konnte nicht registriert werden:', error);
    }
  });
}

renderGameCards();
updateConnectionStatus();
