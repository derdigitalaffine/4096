import { addRandomTile, canMove, hasWon, isValidBoard, moveBoard, newBoard } from './game.js';

const STORAGE_KEY = '4096:state:v1';
const BEST_KEY = '4096:best:v1';

const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const bestElement = document.querySelector('#best');
const connectionElement = document.querySelector('#connection-status');
const newGameButton = document.querySelector('#new-game');
const installButton = document.querySelector('#install-app');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const continueButton = document.querySelector('#continue-game');
const overlayNewGameButton = document.querySelector('#overlay-new-game');

let installPrompt = null;
let pointerStart = null;
let state = restoreState();

function safeBestScore() {
  const value = Number.parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function freshState() {
  return {
    board: newBoard(),
    score: 0,
    best: safeBestScore(),
    wonAcknowledged: false,
  };
}

function restoreState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      parsed &&
      isValidBoard(parsed.board) &&
      Number.isFinite(parsed.score) &&
      parsed.score >= 0 &&
      typeof parsed.wonAcknowledged === 'boolean'
    ) {
      return {
        board: parsed.board,
        score: parsed.score,
        best: Math.max(safeBestScore(), Number(parsed.best) || 0, parsed.score),
        wonAcknowledged: parsed.wonAcknowledged,
      };
    }
  } catch {
    // Corrupt or old state falls back to a clean game.
  }
  return freshState();
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    // Gameplay must remain available even when storage is unavailable.
  }
}

function tileLabel(value, row, col) {
  return value ? `Zeile ${row + 1}, Spalte ${col + 1}: ${value}` : `Zeile ${row + 1}, Spalte ${col + 1}: leer`;
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

  scoreElement.textContent = String(state.score);
  bestElement.textContent = String(state.best);
}

function hideOverlay() {
  overlay.hidden = true;
  boardElement.focus({ preventScroll: true });
}

function showOverlay(kind) {
  overlay.hidden = false;
  if (kind === 'win') {
    overlayTitle.textContent = '4096 erreicht!';
    overlayMessage.textContent = 'Stark gespielt. Du kannst weiterspielen oder eine neue Runde starten.';
    continueButton.hidden = false;
    continueButton.focus();
  } else {
    overlayTitle.textContent = 'Keine Züge mehr';
    overlayMessage.textContent = `Endstand: ${state.score}. Starte eine neue Runde und greif den Bestwert an.`;
    continueButton.hidden = true;
    overlayNewGameButton.focus();
  }
}

function evaluateTerminalState() {
  if (hasWon(state.board) && !state.wonAcknowledged) {
    showOverlay('win');
    return;
  }
  if (!canMove(state.board)) showOverlay('game-over');
}

function performMove(direction) {
  if (!overlay.hidden) return;

  const result = moveBoard(state.board, direction);
  if (!result.moved) return;

  state.board = addRandomTile(result.board);
  state.score += result.scoreGain;
  state.best = Math.max(state.best, state.score);
  persistState();
  render();
  evaluateTerminalState();
}

function startNewGame() {
  const best = Math.max(state.best, state.score, safeBestScore());
  state = { board: newBoard(), score: 0, best, wonAcknowledged: false };
  persistState();
  overlay.hidden = true;
  render();
  boardElement.focus({ preventScroll: true });
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
