import { connectionStatus } from '../connectivity.js';
import { BOARD_SIZE, MODES, createGame, positionKey, setDirection, setPaused, stepGame, tickMsForState } from './game.js';
import { getSafeStorage, loadHighscores, recordHighscore, saveHighscores } from './storage.js';

const board = document.querySelector('#snake-board');
const scoreElement = document.querySelector('#score');
const comboElement = document.querySelector('#combo');
const bestElement = document.querySelector('#best-score');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const pauseButton = document.querySelector('#pause-game');
const newGameButton = document.querySelector('#new-game');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const directionButtons = [...document.querySelectorAll('[data-direction]')];

const storage = getSafeStorage(window);
let highscores = loadHighscores(storage);
let game = createGame('classic');
let timerId = null;
let offlineReady = false;
let offlineError = false;

const cells = [];
for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
  const cell = document.createElement('span');
  cell.className = 'snake-cell';
  cell.dataset.type = 'empty';
  cell.setAttribute('aria-hidden', 'true');
  board.append(cell);
  cells.push(cell);
}

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function renderBoard() {
  const wallKeys = new Set(game.walls.map(positionKey));
  const bodyKeys = new Set(game.snake.slice(1).map(positionKey));
  const headKey = positionKey(game.snake[0]);
  const pickupKey = game.pickup ? positionKey(game.pickup) : null;

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = cells[y * BOARD_SIZE + x];
      const key = `${x},${y}`;
      let type = 'empty';
      let marker = '';
      if (wallKeys.has(key)) { type = 'wall'; marker = '×'; }
      if (bodyKeys.has(key)) { type = 'body'; marker = '·'; }
      if (key === headKey) { type = 'head'; marker = '●'; }
      if (key === pickupKey) { type = 'pickup'; marker = '◆'; }
      if (cell.dataset.type !== type) cell.dataset.type = type;
      if (cell.textContent !== marker) cell.textContent = marker;
    }
  }

  const head = game.snake[0];
  board.dataset.mode = game.mode;
  board.dataset.score = String(game.score);
  board.dataset.combo = String(game.combo);
  board.dataset.headX = String(head.x);
  board.dataset.headY = String(head.y);
  board.dataset.wallCount = String(game.walls.length);
  board.dataset.tickMs = String(tickMsForState(game));
  board.dataset.paused = String(game.paused);
  board.dataset.over = String(game.over);
  board.setAttribute('aria-label', `${MODES[game.mode].label}-Snake. Kopf Spalte ${head.x + 1}, Reihe ${head.y + 1}. Punkte ${game.score}.`);
}

function renderStatus() {
  const mode = MODES[game.mode];
  scoreElement.textContent = String(game.score);
  comboElement.textContent = game.combo > 0 ? `×${game.combo}` : '–';
  bestElement.textContent = String(highscores[game.mode]);
  pauseButton.textContent = game.paused ? 'Weiter' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(game.paused));
  pauseButton.disabled = game.over;

  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.mode === game.mode));

  if (game.over) {
    statusElement.textContent = game.won
      ? `${mode.label} geschafft · Feld komplett gefüllt.`
      : `${mode.label} · Runde vorbei. R startet neu.`;
  } else if (game.paused) {
    statusElement.textContent = `${mode.label} · pausiert.`;
  } else if (game.combo > 1) {
    statusElement.textContent = `${mode.label} · Combo ×${game.combo} · ${game.pickups} Pickups.`;
  } else {
    statusElement.textContent = `${mode.label} · ${game.pickups} Pickups.`;
  }
}

function render() {
  renderBoard();
  renderStatus();
}

function cancelTick() {
  if (timerId !== null) clearTimeout(timerId);
  timerId = null;
}

function scheduleTick() {
  cancelTick();
  if (game.over || game.paused) return;
  timerId = setTimeout(runTick, tickMsForState(game));
}

function updateHighscore() {
  const next = recordHighscore(highscores, game.mode, game.score);
  if (next[game.mode] === highscores[game.mode]) return;
  highscores = next;
  saveHighscores(storage, highscores);
}

function runTick() {
  timerId = null;
  const previousScore = game.score;
  game = stepGame(game);
  if (game.score !== previousScore) updateHighscore();
  render();
  scheduleTick();
}

function startRound(mode = game.mode) {
  cancelTick();
  game = createGame(mode);
  render();
  board.focus({ preventScroll: true });
  scheduleTick();
}

function chooseDirection(direction) {
  const next = setDirection(game, direction);
  if (next !== game) {
    game = next;
    renderBoard();
  }
}

function togglePause() {
  if (game.over) return;
  game = setPaused(game, !game.paused);
  render();
  scheduleTick();
}

for (const button of directionButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    chooseDirection(button.dataset.direction);
  });
}

for (const button of modeButtons) {
  button.addEventListener('click', () => startRound(button.dataset.mode));
}

pauseButton.addEventListener('click', togglePause);
newGameButton.addEventListener('click', () => startRound());

const keyDirections = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);

document.addEventListener('keydown', (event) => {
  const interactive = event.target instanceof Element && event.target.closest('button, a, input, select, textarea');
  if (interactive) return;

  const direction = keyDirections.get(event.key);
  if (direction) {
    event.preventDefault();
    chooseDirection(direction);
    return;
  }
  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault();
    togglePause();
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    startRound();
  }
});

function pauseForInterruption() {
  if (game.over || game.paused) return;
  game = setPaused(game, true);
  render();
  cancelTick();
}

window.addEventListener('blur', pauseForInterruption);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pauseForInterruption();
});
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      offlineReady = true;
      offlineError = false;
      updateConnection();
    })
    .catch(() => {
      offlineError = true;
      updateConnection();
    });
} else {
  offlineError = true;
}

updateConnection();
render();
scheduleTick();
