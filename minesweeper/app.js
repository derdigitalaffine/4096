import { connectionStatus } from '../connectivity.js';
import { DIFFICULTIES, createGame, coordinatesFor, remainingMines, restartGame, revealCell, toggleFlag } from './game.js';
import { getSafeStorage, loadBestTimes, recordBestTime, saveBestTimes } from './storage.js';

const board = document.querySelector('#mine-board');
const difficultySelect = document.querySelector('#difficulty');
const modeButton = document.querySelector('#input-mode');
const restartButton = document.querySelector('#restart-game');
const remainingElement = document.querySelector('#remaining-mines');
const timerElement = document.querySelector('#timer');
const bestElement = document.querySelector('#best-time');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');

const storage = getSafeStorage(window);
let bestTimes = loadBestTimes(storage);
let game = createGame('beginner', Date.now());
let inputMode = 'reveal';
let focusedIndex = 0;
let startedAt = null;
let elapsedMs = 0;
let cells = [];
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

const formatTime = (value) => `${(value / 1000).toFixed(1).replace('.', ',')} s`;

function currentElapsed() {
  return startedAt === null ? elapsedMs : elapsedMs + Math.max(0, performance.now() - startedAt);
}

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function cellLabel(index) {
  const { row, column } = coordinatesFor(index, game.columns);
  const prefix = `Reihe ${row + 1}, Spalte ${column + 1}`;
  if (game.flagged[index]) return `${prefix}: Flagge`;
  if (!game.revealed[index]) return `${prefix}: verdeckt`;
  if (game.mines[index]) return `${prefix}: Mine`;
  const count = game.adjacent[index];
  return count === 0 ? `${prefix}: leer` : `${prefix}: ${count} benachbarte ${count === 1 ? 'Mine' : 'Minen'}`;
}

function buildBoard() {
  board.replaceChildren();
  board.style.setProperty('--columns', String(game.columns));
  cells = [];
  for (let row = 0; row < game.rows; row += 1) {
    const rowElement = document.createElement('div');
    rowElement.className = 'mine-row';
    rowElement.setAttribute('role', 'row');
    for (let column = 0; column < game.columns; column += 1) {
      const index = row * game.columns + column;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'mine-cell';
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = index === focusedIndex ? 0 : -1;
      cell.addEventListener('click', () => applyCell(index));
      cell.addEventListener('focus', () => { focusedIndex = index; syncTabStops(); });
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        applyCell(index, 'flag');
      });
      cells.push(cell);
      rowElement.append(cell);
    }
    board.append(rowElement);
  }
  render();
}

function syncTabStops() {
  cells.forEach((cell, index) => { cell.tabIndex = index === focusedIndex ? 0 : -1; });
}

function renderCells() {
  cells.forEach((cell, index) => {
    const revealed = game.revealed[index];
    const flagged = game.flagged[index];
    const mine = game.mines[index];
    const count = game.adjacent[index];
    cell.textContent = flagged ? '⚑' : revealed && mine ? '✹' : revealed && count > 0 ? String(count) : '';
    cell.dataset.state = flagged ? 'flagged' : revealed && mine ? 'mine' : revealed ? 'revealed' : 'hidden';
    cell.dataset.count = revealed && !mine ? String(count) : '';
    cell.setAttribute('aria-label', cellLabel(index));
    cell.setAttribute('aria-disabled', String(['won', 'lost'].includes(game.status)));
  });
  board.dataset.status = game.status;
  board.dataset.armed = String(game.armed);
  board.dataset.difficulty = game.difficultyId;
  board.dataset.revealed = String(game.revealed.filter(Boolean).length);
  board.dataset.flagged = String(game.flagged.filter(Boolean).length);
  board.setAttribute('aria-label', `${DIFFICULTIES[game.difficultyId].name}: ${game.rows} mal ${game.columns}, ${remainingMines(game)} Minen übrig.`);
}

function statusText() {
  if (game.status === 'ready') return `${game.mineCount} Minen · erster Reveal und seine Nachbarn sind sicher.`;
  if (game.status === 'won') return `Gewonnen in ${formatTime(currentElapsed())}. Alle Minen markiert.`;
  if (game.status === 'lost') return `Mine getroffen. ${game.mineCount} Minen wurden aufgedeckt.`;
  return `${remainingMines(game)} Minen übrig · ${game.flagged.filter(Boolean).length} Flaggen gesetzt.`;
}

function renderMeta() {
  remainingElement.textContent = String(remainingMines(game));
  timerElement.textContent = formatTime(currentElapsed());
  const best = bestTimes[game.difficultyId];
  bestElement.textContent = best === null ? '–' : formatTime(best);
  statusElement.textContent = statusText();
  difficultySelect.value = game.difficultyId;
  modeButton.setAttribute('aria-pressed', String(inputMode === 'flag'));
  modeButton.textContent = inputMode === 'flag' ? 'Modus: Flagge' : 'Modus: Aufdecken';
}

function render() {
  renderCells();
  renderMeta();
}

function stopTimer() {
  if (startedAt === null) return;
  elapsedMs += Math.max(0, performance.now() - startedAt);
  startedAt = null;
}

function applyCell(index, forcedMode = null) {
  const action = forcedMode ?? inputMode;
  const beforeStatus = game.status;
  const next = action === 'flag' ? toggleFlag(game, index) : revealCell(game, index);
  if (next === game) return;
  game = next;
  if (beforeStatus === 'ready' && game.status === 'playing') startedAt = performance.now();
  if (['won', 'lost'].includes(game.status)) {
    stopTimer();
    if (game.status === 'won') {
      const finalTime = Math.max(1, Math.round(elapsedMs));
      const nextBest = recordBestTime(bestTimes, game.difficultyId, finalTime);
      if (nextBest !== bestTimes) {
        bestTimes = nextBest;
        saveBestTimes(storage, bestTimes);
      }
    }
  }
  render();
}

function resetRound({ difficultyId = game.difficultyId, seed = (Date.now() >>> 0) } = {}) {
  game = createGame(difficultyId, seed);
  focusedIndex = 0;
  startedAt = null;
  elapsedMs = 0;
  inputMode = 'reveal';
  buildBoard();
  cells[0]?.focus({ preventScroll: true });
}

function moveFocus(rowDelta, columnDelta) {
  const { row, column } = coordinatesFor(focusedIndex, game.columns);
  const nextRow = Math.max(0, Math.min(game.rows - 1, row + rowDelta));
  const nextColumn = Math.max(0, Math.min(game.columns - 1, column + columnDelta));
  focusedIndex = nextRow * game.columns + nextColumn;
  syncTabStops();
  cells[focusedIndex]?.focus({ preventScroll: true });
}

modeButton.addEventListener('click', () => {
  inputMode = inputMode === 'reveal' ? 'flag' : 'reveal';
  renderMeta();
});
restartButton.addEventListener('click', () => resetRound({ seed: (game.seed + 1) >>> 0 }));
difficultySelect.addEventListener('change', () => resetRound({ difficultyId: difficultySelect.value }));

document.addEventListener('keydown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('select')) return;
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    resetRound({ seed: (game.seed + 1) >>> 0 });
    return;
  }
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    applyCell(focusedIndex, 'flag');
    return;
  }
  if (!target?.classList.contains('mine-cell')) return;
  const directions = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
  };
  if (directions[event.key]) {
    event.preventDefault();
    moveFocus(...directions[event.key]);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    applyCell(focusedIndex);
  }
});

setInterval(() => {
  if (startedAt !== null && game.status === 'playing') timerElement.textContent = formatTime(currentElapsed());
}, 100);

window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = Boolean(navigator.serviceWorker.controller);
    if (offlineReady) offlineError = false;
    updateConnection();
  });
  navigator.serviceWorker.register('../sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      offlineReady = Boolean(navigator.serviceWorker.controller) || offlineReady;
      offlineError = false;
      updateConnection();
    })
    .catch(() => {
      offlineReady = Boolean(navigator.serviceWorker.controller);
      offlineError = !offlineReady;
      updateConnection();
    });
}

updateConnection();
buildBoard();
