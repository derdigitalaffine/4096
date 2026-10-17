import { applyTurn, canMove, hasWon, newBoard } from './game.js';
import { getSafeStorage, persistStoredState, readBestScore, restoreStoredState } from './storage.js';

const storage = getSafeStorage(window);

const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const bestElement = document.querySelector('#best');
const connectionElement = document.querySelector('#connection-status');
const statusElement = document.querySelector('#game-status');
const newGameButton = document.querySelector('#new-game');
const undoButton = document.querySelector('#undo');
const installButton = document.querySelector('#install-app');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const continueButton = document.querySelector('#continue-game');
const overlayUndoButton = document.querySelector('#overlay-undo');
const overlayNewGameButton = document.querySelector('#overlay-new-game');

let installPrompt = null;
let pointerStart = null;
let statusTimer = null;
let state = restoreState();

function freshState() {
  return {
    board: newBoard(),
    score: 0,
    best: readBestScore(storage),
    wonAcknowledged: false,
    undo: null,
  };
}

function restoreState() {
  return restoreStoredState(storage) ?? freshState();
}

function persistState() {
  persistStoredState(storage, state);
}

function tileLabel(value, row, col) {
  return value ? `Zeile ${row + 1}, Spalte ${col + 1}: ${value}` : `Zeile ${row + 1}, Spalte ${col + 1}: leer`;
}

function highestTile(board) {
  return Math.max(0, ...board.flat());
}

function directionLabel(direction) {
  return { left: 'links', right: 'rechts', up: 'oben', down: 'unten' }[direction];
}

function announce(message) {
  window.clearTimeout(statusTimer);
  statusElement.textContent = '';
  statusTimer = window.setTimeout(() => {
    statusElement.textContent = message;
  }, 0);
}

function render() {
  boardElement.replaceChildren();
  state.board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.value = String(value);
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', tileLabel(value, rowIndex, colIndex));
      tile.textContent = value || '';
      boardElement.append(tile);
    });
  });

  const maxTile = highestTile(state.board);
  boardElement.setAttribute(
    'aria-label',
    `4 mal 4 Spielfeld. Score ${state.score}. Höchster Stein ${maxTile}. Mit Pfeiltasten, WASD oder Wischgesten bewegen.`
  );
  scoreElement.textContent = String(state.score);
  bestElement.textContent = String(state.best);
  undoButton.disabled = !state.undo;
  overlayUndoButton.disabled = !state.undo;
}

function hideOverlay() {
  overlay.hidden = true;
  boardElement.focus({ preventScroll: true });
}

function showOverlay(kind) {
  overlay.hidden = false;
  if (kind === 'win') {
    overlayTitle.textContent = '4096 erreicht!';
    overlayMessage.textContent = 'Stark gespielt. Du kannst weiterspielen, den letzten Zug rückgängig machen oder eine neue Runde starten.';
    continueButton.hidden = false;
    continueButton.focus();
  } else {
    overlayTitle.textContent = 'Keine Züge mehr';
    overlayMessage.textContent = `Endstand: ${state.score}. Du kannst den letzten Zug rückgängig machen oder eine neue Runde starten.`;
    continueButton.hidden = true;
    if (state.undo) overlayUndoButton.focus();
    else overlayNewGameButton.focus();
  }
}

function evaluateTerminalState() {
  if (hasWon(state.board) && !state.wonAcknowledged) {
    showOverlay('win');
    return;
  }
  if (!canMove(state.board)) showOverlay('game-over');
}

function undoSnapshot() {
  return {
    board: state.board.map((row) => [...row]),
    score: state.score,
    wonAcknowledged: state.wonAcknowledged,
  };
}

function performMove(direction) {
  if (!overlay.hidden) return;

  const result = applyTurn(state.board, direction);
  if (!result.moved) {
    announce(`Zug nach ${directionLabel(direction)} nicht möglich.`);
    return;
  }

  const undo = undoSnapshot();
  state.board = result.board;
  state.score += result.scoreGain;
  state.best = Math.max(state.best, state.score);
  state.undo = undo;
  persistState();
  render();
  announce(`Zug nach ${directionLabel(direction)}. Score ${state.score}. Höchster Stein ${highestTile(state.board)}.`);
  evaluateTerminalState();
}

function undoLastMove() {
  if (!state.undo) {
    announce('Kein Zug zum Rückgängigmachen vorhanden.');
    return;
  }

  const snapshot = state.undo;
  state = {
    board: snapshot.board,
    score: snapshot.score,
    best: Math.max(state.best, readBestScore(storage)),
    wonAcknowledged: snapshot.wonAcknowledged,
    undo: null,
  };
  persistState();
  render();
  hideOverlay();
  announce(`Letzten Zug rückgängig gemacht. Score ${state.score}. Höchster Stein ${highestTile(state.board)}.`);
}

function startNewGame() {
  const best = Math.max(state.best, state.score, readBestScore(storage));
  state = { board: newBoard(), score: 0, best, wonAcknowledged: false, undo: null };
  persistState();
  overlay.hidden = true;
  render();
  boardElement.focus({ preventScroll: true });
  announce('Neue Runde gestartet. Score 0.');
}

function keyboardDirection(key) {
  return {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowUp: 'up',
    w: 'up',
    W: 'up',
    ArrowDown: 'down',
    s: 'down',
    S: 'down',
  }[key];
}

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoLastMove();
    return;
  }

  const direction = keyboardDirection(event.key);
  if (!direction) return;
  event.preventDefault();
  performMove(direction);
});

boardElement.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  boardElement.setPointerCapture?.(event.pointerId);
});

boardElement.addEventListener('pointerup', (event) => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  performMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

boardElement.addEventListener('pointercancel', () => {
  pointerStart = null;
});

newGameButton.addEventListener('click', startNewGame);
undoButton.addEventListener('click', undoLastMove);
overlayUndoButton.addEventListener('click', undoLastMove);
overlayNewGameButton.addEventListener('click', startNewGame);
continueButton.addEventListener('click', () => {
  state.wonAcknowledged = true;
  persistState();
  hideOverlay();
  if (!canMove(state.board)) showOverlay('game-over');
});

function updateConnectionStatus() {
  connectionElement.textContent = navigator.onLine ? 'Online · offline bereit' : 'Offline · spielbereit';
  connectionElement.dataset.offline = String(!navigator.onLine);
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
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('Service Worker konnte nicht registriert werden:', error);
    }
  });
}

updateConnectionStatus();
render();
evaluateTerminalState();
