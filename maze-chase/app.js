import { connectionStatus } from '../connectivity.js';
import { LEVELS } from './levels.js';
import { createGame, positionKey, queueDirection, setPaused, stepGame, tickMsForState } from './game.js';
import { getSafeStorage, loadBest, recordBest, saveBest } from './storage.js';

const board = document.querySelector('#maze-board');
const levelElement = document.querySelector('#level-name');
const scoreElement = document.querySelector('#score');
const livesElement = document.querySelector('#lives');
const bestElement = document.querySelector('#best-score');
const powerElement = document.querySelector('#power-status');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const pauseButton = document.querySelector('#pause-game');
const newGameButton = document.querySelector('#new-game');
const directionButtons = [...document.querySelectorAll('[data-direction]')];

const storage = getSafeStorage(window);
let best = loadBest(storage);
let game = createGame(0);
let timerId = null;
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);
let transientStatus = '';

const cells = [];
for (let index = 0; index < 225; index += 1) {
  const cell = document.createElement('span');
  cell.className = 'maze-cell';
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
  const walls = new Set(game.walls.map(positionKey));
  const pellets = new Set(game.pellets.map(positionKey));
  const powers = new Set(game.powers.map(positionKey));
  const enemies = new Map(game.enemies.map((enemy) => [positionKey(enemy), enemy]));
  const playerKey = positionKey(game.player);

  for (let y = 0; y < game.height; y += 1) {
    for (let x = 0; x < game.width; x += 1) {
      const cell = cells[y * game.width + x];
      const key = `${x},${y}`;
      let type = 'empty';
      let marker = '';
      if (walls.has(key)) type = 'wall';
      else if (pellets.has(key)) { type = 'pellet'; marker = '·'; }
      else if (powers.has(key)) { type = 'power'; marker = '●'; }
      const enemy = enemies.get(key);
      if (enemy) {
        type = enemy.profile;
        marker = enemy.profile === 'hunter' ? 'H' : enemy.profile === 'ambusher' ? 'A' : 'R';
      }
      if (key === playerKey) { type = 'player'; marker = '◆'; }
      cell.dataset.type = type;
      cell.textContent = marker;
    }
  }

  board.dataset.level = String(game.levelIndex + 1);
  board.dataset.levelId = game.levelId;
  board.dataset.score = String(game.score);
  board.dataset.lives = String(game.lives);
  board.dataset.playerX = String(game.player.x);
  board.dataset.playerY = String(game.player.y);
  board.dataset.direction = game.player.direction ?? '';
  board.dataset.nextDirection = game.player.nextDirection ?? '';
  board.dataset.powered = String(game.powerTicks > 0);
  board.dataset.powerTicks = String(game.powerTicks);
  board.dataset.pellets = String(game.pellets.length + game.powers.length);
  board.dataset.tickMs = String(tickMsForState(game));
  board.dataset.paused = String(game.paused);
  board.dataset.over = String(game.over);
  board.setAttribute('aria-label', `${LEVELS[game.levelIndex].name}, Level ${game.levelIndex + 1} von ${LEVELS.length}. Spieler Spalte ${game.player.x + 1}, Reihe ${game.player.y + 1}. ${game.lives} Leben, ${game.score} Punkte, ${game.pellets.length + game.powers.length} Sammelziele.`);
}

function renderStatus() {
  levelElement.textContent = `${game.levelIndex + 1}/${LEVELS.length}`;
  scoreElement.textContent = String(game.score);
  livesElement.textContent = String(game.lives);
  bestElement.textContent = String(best);
  powerElement.textContent = game.powerTicks > 0 ? `Power ${game.powerTicks}` : 'Power –';
  powerElement.dataset.active = String(game.powerTicks > 0);
  pauseButton.textContent = game.paused ? 'Weiter' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(game.paused));
  pauseButton.disabled = game.over;

  if (transientStatus) statusElement.textContent = transientStatus;
  else if (game.won) statusElement.textContent = `Alle drei Labyrinthe geschafft · ${game.score} Punkte.`;
  else if (game.over) statusElement.textContent = `Runde vorbei · ${game.score} Punkte. R startet neu.`;
  else if (game.paused) statusElement.textContent = `${LEVELS[game.levelIndex].name} · pausiert.`;
  else if (game.powerTicks > 0) statusElement.textContent = `${LEVELS[game.levelIndex].name} · Power aktiv: Gegner können zurückgesetzt werden.`;
  else statusElement.textContent = `${LEVELS[game.levelIndex].name} · noch ${game.pellets.length + game.powers.length} Sammelziele.`;
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

function updateBest() {
  const next = recordBest(best, game.score);
  if (next === best) return;
  best = next;
  saveBest(storage, best);
}

function runTick() {
  timerId = null;
  const previousLevel = game.levelIndex;
  const previousLives = game.lives;
  const previousScore = game.score;
  game = stepGame(game);
  if (game.score !== previousScore) updateBest();
  if (game.levelIndex !== previousLevel) transientStatus = `${LEVELS[game.levelIndex].name} gestartet · Tempo steigt.`;
  else if (game.lives < previousLives && !game.over) transientStatus = `Treffer · noch ${game.lives} Leben.`;
  else transientStatus = '';
  render();
  scheduleTick();
}

function startRound() {
  cancelTick();
  game = createGame(0);
  transientStatus = 'Neue Runde · Gartenraster.';
  render();
  board.focus({ preventScroll: true });
  scheduleTick();
}

function chooseDirection(direction) {
  const next = queueDirection(game, direction);
  if (next === game) return;
  game = next;
  transientStatus = '';
  renderBoard();
}

function togglePause() {
  if (game.over) return;
  game = setPaused(game, !game.paused);
  transientStatus = '';
  render();
  scheduleTick();
}

for (const button of directionButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    chooseDirection(button.dataset.direction);
  });
}

pauseButton.addEventListener('click', togglePause);
newGameButton.addEventListener('click', startRound);

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
  transientStatus = 'Automatisch pausiert.';
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
scheduleTick();
