import { connectionStatus } from '../connectivity.js';
import {
  HEIGHT,
  WIDTH,
  activeCells,
  boardIndex,
  createGame,
  hardDrop,
  isRestorableState,
  moveActive,
  rotateActive,
  softDrop,
} from './game.js';

const STORAGE_KEY = 'dr-mario-state-v1';
const DROP_INTERVAL_MS = 800;

const bottle = document.querySelector('#bottle');
const scoreElement = document.querySelector('#score');
const virusElement = document.querySelector('#viruses');
const nextElement = document.querySelector('#next-pill');
const gameStatus = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const newGameButton = document.querySelector('#new-game');
const leftButton = document.querySelector('#move-left');
const rotateButton = document.querySelector('#rotate');
const rightButton = document.querySelector('#move-right');
const downButton = document.querySelector('#move-down');
const dropButton = document.querySelector('#hard-drop');

const cells = [];
let offlineReady = Boolean(navigator.serviceWorker?.controller);
let offlineError = false;
let lastStatus = '';

function readSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRestorableState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage ist optional; das Spiel bleibt ohne Persistenz spielbar.
  }
}

let state = readSavedState() ?? createGame();

function colorLabel(color) {
  return ({ red: 'rot', blue: 'blau', yellow: 'gelb' })[color] ?? color;
}

function ensureCells() {
  if (cells.length) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'dm-cell';
    cell.setAttribute('role', 'gridcell');
    cell.dataset.index = String(index);
    fragment.append(cell);
    cells.push(cell);
  }
  bottle.append(fragment);
}

function renderedCells() {
  const rendered = state.board.map((cell) => (cell ? { ...cell } : null));
  for (const activeCell of activeCells(state.active)) {
    rendered[boardIndex(activeCell.x, activeCell.y)] = { color: activeCell.color, type: 'active' };
  }
  return rendered;
}

function renderNext() {
  nextElement.replaceChildren();
  for (const color of state.nextColors) {
    const half = document.createElement('span');
    half.className = `preview-half color-${color}`;
    half.setAttribute('aria-label', colorLabel(color));
    nextElement.append(half);
  }
}

function render() {
  ensureCells();
  const rendered = renderedCells();
  for (let index = 0; index < rendered.length; index += 1) {
    const cell = rendered[index];
    const element = cells[index];
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    element.className = 'dm-cell';
    element.textContent = '';
    element.removeAttribute('data-color');
    element.removeAttribute('data-type');

    if (!cell) {
      element.setAttribute('aria-label', `Reihe ${y + 1}, Spalte ${x + 1}: leer`);
      continue;
    }

    element.dataset.color = cell.color;
    element.dataset.type = cell.type;
    element.classList.add(`color-${cell.color}`, `type-${cell.type}`);
    element.textContent = cell.type === 'virus' ? '✦' : '●';
    const kind = cell.type === 'virus' ? 'Virus' : cell.type === 'active' ? 'fallende Kapsel' : 'Kapsel';
    element.setAttribute('aria-label', `Reihe ${y + 1}, Spalte ${x + 1}: ${colorLabel(cell.color)} ${kind}`);
  }

  scoreElement.textContent = String(state.score);
  virusElement.textContent = String(state.viruses);
  renderNext();

  const terminal = state.status !== 'playing';
  for (const button of [leftButton, rotateButton, rightButton, downButton, dropButton]) button.disabled = terminal;
  bottle.setAttribute('aria-label', `Dr.-Mario-Spielfeld, ${state.viruses} Viren verbleiben, Score ${state.score}.`);

  const statusText = state.status === 'won'
    ? 'Alle Viren beseitigt. Runde geschafft!'
    : state.status === 'lost'
      ? 'Die Flasche ist voll. Starte eine neue Runde.'
      : `${state.viruses} Viren verbleiben.`;
  if (statusText !== lastStatus) {
    gameStatus.textContent = statusText;
    lastStatus = statusText;
  }
}

function commit(nextState, announcement = '') {
  if (nextState === state && !announcement) return;
  state = nextState;
  saveState(state);
  render();
  if (announcement) {
    gameStatus.textContent = announcement;
    lastStatus = announcement;
  }
}

function startNewGame() {
  commit(createGame(), 'Neue Dr.-Mario-Runde gestartet.');
  bottle.focus();
}

function move(dx) {
  commit(moveActive(state, dx, 0));
}

function rotate() {
  commit(rotateActive(state));
}

function dropOne() {
  const beforeStatus = state.status;
  const beforeViruses = state.viruses;
  const next = softDrop(state);
  let announcement = '';
  if (next.status !== beforeStatus) announcement = next.status === 'won' ? 'Alle Viren beseitigt!' : 'Flasche voll. Runde beendet.';
  else if (next.viruses < beforeViruses) announcement = `${beforeViruses - next.viruses} Virus oder Viren beseitigt. Noch ${next.viruses}.`;
  commit(next, announcement);
}

function dropAll() {
  const beforeViruses = state.viruses;
  const next = hardDrop(state);
  const removed = beforeViruses - next.viruses;
  const announcement = next.status === 'won'
    ? 'Alle Viren beseitigt!'
    : next.status === 'lost'
      ? 'Flasche voll. Runde beendet.'
      : removed > 0
        ? `${removed} Virus oder Viren beseitigt. Noch ${next.viruses}.`
        : 'Kapsel abgelegt.';
  commit(next, announcement);
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('a, button, input, select, textarea, [contenteditable="true"]'));
}

function updateConnectionStatus() {
  const text = connectionStatus({ online: navigator.onLine, offlineReady, offlineError });
  connectionElement.textContent = text;
  connectionElement.dataset.offlineReady = String(offlineReady);
  connectionElement.dataset.warning = String(!offlineReady && (!navigator.onLine || offlineError));
}

newGameButton.addEventListener('click', startNewGame);
leftButton.addEventListener('click', () => move(-1));
rotateButton.addEventListener('click', rotate);
rightButton.addEventListener('click', () => move(1));
downButton.addEventListener('click', dropOne);
dropButton.addEventListener('click', dropAll);

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || state.status !== 'playing' || isInteractiveTarget(event.target)) return;
  const action = ({
    ArrowLeft: () => move(-1),
    a: () => move(-1),
    A: () => move(-1),
    ArrowRight: () => move(1),
    d: () => move(1),
    D: () => move(1),
    ArrowDown: dropOne,
    s: dropOne,
    S: dropOne,
    ArrowUp: rotate,
    w: rotate,
    W: rotate,
    ' ': dropAll,
    Enter: dropAll,
  })[event.key];
  if (!action) return;
  event.preventDefault();
  action();
});

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = true;
    offlineError = false;
    updateConnectionStatus();
  });

  navigator.serviceWorker.register('../sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      offlineReady = true;
      offlineError = false;
      updateConnectionStatus();
    })
    .catch(() => {
      offlineError = true;
      updateConnectionStatus();
    });
}

ensureCells();
render();
updateConnectionStatus();
saveState(state);

setInterval(() => {
  if (document.visibilityState === 'visible' && state.status === 'playing') dropOne();
}, DROP_INTERVAL_MS);
