import { connectionStatus } from '../connectivity.js';
import { COLUMNS, ROWS, createConnectFour, dropDisc, legalColumns } from './connect-four.js';
import { SIZE, createReversi, legalMoves, pieceCounts, playReversi } from './reversi.js';
import { getSafeStorage, loadStats, recordResult, saveStats } from './storage.js';

const boardElement = document.querySelector('#duell-board');
const columnControls = document.querySelector('#column-controls');
const turnElement = document.querySelector('#turn');
const recordElement = document.querySelector('#record');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const restartButton = document.querySelector('#restart-game');
const modeButtons = [...document.querySelectorAll('[data-mode]')];

const storage = getSafeStorage(window);
let stats = loadStats(storage);
let mode = 'connect-four';
let connectFour = createConnectFour();
let reversi = createReversi();
let reversiFocus = legalMoves(reversi)[0] ?? 0;
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

function playerLabel(player) {
  if (player === 1) return 'A ●';
  if (player === 2) return 'B ○';
  return '–';
}

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function currentState() {
  return mode === 'connect-four' ? connectFour : reversi;
}

function modeName() {
  return mode === 'connect-four' ? 'Vier gewinnt' : 'Reversi';
}

function statusText() {
  const state = currentState();
  if (state.status === 'won') {
    if (mode === 'reversi') {
      const counts = pieceCounts(state.board);
      return `${modeName()} · ${playerLabel(state.winner)} gewinnt ${counts.one}:${counts.two}.`;
    }
    return `${modeName()} · ${playerLabel(state.winner)} gewinnt.`;
  }
  if (state.status === 'draw') {
    if (mode === 'reversi') {
      const counts = pieceCounts(state.board);
      return `${modeName()} · Remis ${counts.one}:${counts.two}.`;
    }
    return `${modeName()} · Remis.`;
  }
  if (mode === 'reversi') {
    const counts = pieceCounts(state.board);
    const pass = state.passedPlayer ? ` · ${playerLabel(state.passedPlayer)} muss passen` : '';
    return `Reversi · ${playerLabel(state.current)} am Zug · ${counts.one}:${counts.two}${pass}.`;
  }
  return `Vier gewinnt · ${playerLabel(state.current)} am Zug.`;
}

function updateMeta() {
  const state = currentState();
  const modeStats = stats[mode];
  turnElement.textContent = state.status === 'playing' ? playerLabel(state.current) : '–';
  recordElement.textContent = `${modeStats.p1}:${modeStats.p2} · ${modeStats.draws}=`;
  statusElement.textContent = statusText();
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  boardElement.dataset.mode = mode;
  boardElement.dataset.status = state.status;
  boardElement.dataset.current = String(state.current);
  boardElement.dataset.winner = String(state.winner);
  boardElement.dataset.moves = String(state.moves);
  boardElement.dataset.games = String(modeStats.games);
}

function renderConnectFour(focusColumn = null) {
  columnControls.hidden = false;
  const legal = new Set(legalColumns(connectFour));
  const controls = document.createDocumentFragment();
  for (let column = 0; column < COLUMNS; column += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.column = String(column);
    button.disabled = !legal.has(column);
    button.setAttribute('aria-label', `Stein in Spalte ${column + 1} einwerfen`);
    button.textContent = `↓${column + 1}`;
    controls.append(button);
  }
  columnControls.replaceChildren(controls);

  const cells = document.createDocumentFragment();
  const winning = new Set(connectFour.winning);
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = row * COLUMNS + column;
      const player = connectFour.board[index];
      const cell = document.createElement('div');
      cell.className = 'duell-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.index = String(index);
      cell.dataset.column = String(column);
      cell.dataset.player = String(player);
      cell.dataset.winning = String(winning.has(index));
      cell.textContent = player === 1 ? '●' : player === 2 ? '○' : '';
      cell.setAttribute('aria-label', `Reihe ${row + 1}, Spalte ${column + 1}: ${player ? playerLabel(player) : 'leer'}`);
      cells.append(cell);
    }
  }
  boardElement.replaceChildren(cells);
  boardElement.setAttribute('aria-label', `Vier gewinnt. ${statusText()}`);
  boardElement.dataset.legalCount = String(legal.size);
  updateMeta();
  if (focusColumn !== null) columnControls.querySelector(`[data-column="${focusColumn}"]`)?.focus({ preventScroll: true });
}

function reversiCellLabel(index, player, isLegal) {
  const row = Math.floor(index / SIZE) + 1;
  const column = (index % SIZE) + 1;
  if (player) return `Reihe ${row}, Spalte ${column}: ${playerLabel(player)}`;
  return `Reihe ${row}, Spalte ${column}: leer${isLegal ? ', gültiger Zug' : ', kein gültiger Zug'}`;
}

function renderReversi(focus = false) {
  columnControls.hidden = true;
  const legal = new Set(legalMoves(reversi));
  if (!Number.isInteger(reversiFocus) || reversiFocus < 0 || reversiFocus >= SIZE * SIZE) reversiFocus = legal.values().next().value ?? 0;
  const cells = document.createDocumentFragment();
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const player = reversi.board[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'duell-cell';
    button.setAttribute('role', 'gridcell');
    button.dataset.index = String(index);
    button.dataset.player = String(player);
    button.dataset.legal = String(legal.has(index));
    button.tabIndex = index === reversiFocus ? 0 : -1;
    button.setAttribute('aria-label', reversiCellLabel(index, player, legal.has(index)));
    button.setAttribute('aria-disabled', String(!legal.has(index)));
    button.textContent = player === 1 ? '●' : player === 2 ? '○' : '';
    cells.append(button);
  }
  boardElement.replaceChildren(cells);
  const counts = pieceCounts(reversi.board);
  boardElement.setAttribute('aria-label', `Reversi. A ${counts.one}, B ${counts.two}. ${statusText()}`);
  boardElement.dataset.legalCount = String(legal.size);
  boardElement.dataset.countOne = String(counts.one);
  boardElement.dataset.countTwo = String(counts.two);
  updateMeta();
  if (focus) boardElement.querySelector(`[data-index="${reversiFocus}"]`)?.focus({ preventScroll: true });
}

function render(options = {}) {
  if (mode === 'connect-four') renderConnectFour(options.focusColumn ?? null);
  else renderReversi(Boolean(options.focusReversi));
}

function recordTerminal(previous, next) {
  if (previous.status !== 'playing' || next.status === 'playing') return;
  stats = recordResult(stats, mode, next.winner);
  saveStats(storage, stats);
}

function playConnectFour(column, focus = false) {
  const previous = connectFour;
  const next = dropDisc(previous, column);
  if (next === previous) return;
  connectFour = next;
  recordTerminal(previous, next);
  render({ focusColumn: focus ? column : null });
}

function playReversiIndex(index, focus = false) {
  const previous = reversi;
  const next = playReversi(previous, index);
  if (next === previous) return;
  reversi = next;
  reversiFocus = index;
  recordTerminal(previous, next);
  render({ focusReversi: focus });
}

columnControls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-column]');
  if (!button) return;
  playConnectFour(Number(button.dataset.column), true);
});

columnControls.addEventListener('keydown', (event) => {
  const button = event.target.closest('button[data-column]');
  if (!button) return;
  if (event.key === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    playConnectFour(Number(button.dataset.column), true);
    return;
  }
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const delta = event.key === 'ArrowLeft' ? -1 : 1;
  const start = Number(button.dataset.column);
  for (let step = 1; step <= COLUMNS; step += 1) {
    const column = (start + delta * step + COLUMNS) % COLUMNS;
    const target = columnControls.querySelector(`[data-column="${column}"]:not(:disabled)`);
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
  }
});

boardElement.addEventListener('click', (event) => {
  if (mode === 'connect-four') {
    const cell = event.target.closest('.duell-cell[data-column]');
    if (cell) playConnectFour(Number(cell.dataset.column));
    return;
  }
  const cell = event.target.closest('button.duell-cell[data-index]');
  if (!cell) return;
  reversiFocus = Number(cell.dataset.index);
  playReversiIndex(reversiFocus, true);
});

boardElement.addEventListener('keydown', (event) => {
  if (mode !== 'reversi') return;
  const cell = event.target.closest('button.duell-cell[data-index]');
  if (!cell) return;
  if (event.key === 'Enter' || event.code === 'Space') {
    event.preventDefault();
    reversiFocus = Number(cell.dataset.index);
    playReversiIndex(reversiFocus, true);
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const index = Number(cell.dataset.index);
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const nextRow = Math.max(0, Math.min(SIZE - 1, row + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)));
  const nextColumn = Math.max(0, Math.min(SIZE - 1, column + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)));
  reversiFocus = nextRow * SIZE + nextColumn;
  for (const button of boardElement.querySelectorAll('button.duell-cell')) button.tabIndex = Number(button.dataset.index) === reversiFocus ? 0 : -1;
  boardElement.querySelector(`[data-index="${reversiFocus}"]`)?.focus({ preventScroll: true });
});

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;
    render();
  });
}

restartButton.addEventListener('click', () => {
  if (mode === 'connect-four') connectFour = createConnectFour();
  else {
    reversi = createReversi();
    reversiFocus = legalMoves(reversi)[0] ?? 0;
  }
  render();
});

document.addEventListener('keydown', (event) => {
  const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea');
  if (interactive) return;
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restartButton.click();
  }
});

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
render();
