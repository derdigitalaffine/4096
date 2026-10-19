import { connectionStatus } from '../connectivity.js';
import { LEVELS } from './levels.js';
import { LOOP_TICKS, TICK_MS, WAIT, actorSnapshot, createGame, positionKey, stepGame } from './game.js';
import { getSafeStorage, loadProgress, recordWin, saveProgress } from './storage.js';

const board = document.querySelector('#echo-board');
const levelSelect = document.querySelector('#level-select');
const levelNumber = document.querySelector('#level-number');
const loopNumber = document.querySelector('#loop-number');
const tickNumber = document.querySelector('#tick-number');
const bestLoops = document.querySelector('#best-loops');
const connectionElement = document.querySelector('#connection-status');
const statusElement = document.querySelector('#game-status');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const inputButtons = [...document.querySelectorAll('[data-input]')];

const storage = getSafeStorage(window);
let progress = loadProgress(storage);
let game = createGame(0);
let paused = true;
let pendingInput = WAIT;
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

const echoGlyphs = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function renderLevels() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < LEVELS.length; index += 1) {
    const level = LEVELS[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.level = String(index);
    button.disabled = index + 1 > progress.unlocked;
    button.setAttribute('aria-pressed', String(index === game.levelIndex));
    const best = progress.bestLoops[index];
    button.textContent = `${index + 1} · ${level.title}${best ? ` · ${best}L` : ''}`;
    button.setAttribute('aria-label', `${level.title}${button.disabled ? ', gesperrt' : best ? `, Bestwert ${best} Loops` : ', freigeschaltet'}`);
    fragment.append(button);
  }
  levelSelect.replaceChildren(fragment);
}

function cellLabel(x, y, wall, crystal, collected, current, echoes) {
  const parts = [`Reihe ${y + 1}, Spalte ${x + 1}`];
  if (wall) parts.push('Wand');
  else {
    if (crystal) parts.push(collected ? 'Kristall bereits gesammelt' : 'Kristall');
    if (current) parts.push('aktuelle Figur');
    if (echoes.length) parts.push(`Echos ${echoes.map((index) => index + 1).join(', ')}`);
    if (!crystal && !current && !echoes.length) parts.push('frei');
  }
  return parts.join(', ');
}

function renderBoard() {
  const level = LEVELS[game.levelIndex];
  const walls = new Set(level.walls.map(positionKey));
  const crystals = new Set(level.crystals.map(positionKey));
  const collected = new Set(game.collected);
  const actors = actorSnapshot(game);
  const echoesByCell = new Map();
  for (let index = 1; index < actors.length; index += 1) {
    const key = positionKey(actors[index]);
    const list = echoesByCell.get(key) ?? [];
    list.push(index - 1);
    echoesByCell.set(key, list);
  }
  const currentKey = positionKey(game.player);
  const fragment = document.createDocumentFragment();

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = `${x},${y}`;
      const wall = walls.has(key);
      const crystal = crystals.has(key);
      const isCollected = collected.has(key);
      const current = key === currentKey;
      const echoIndexes = echoesByCell.get(key) ?? [];
      const cell = document.createElement('span');
      cell.className = 'echo-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.dataset.wall = String(wall);
      cell.dataset.crystal = String(crystal);
      cell.dataset.collected = String(isCollected);
      cell.dataset.current = String(current);
      cell.dataset.echoCount = String(echoIndexes.length);
      cell.setAttribute('aria-label', cellLabel(x, y, wall, crystal, isCollected, current, echoIndexes));

      if (wall) cell.textContent = '▦';
      else {
        const tokens = [];
        if (crystal && !isCollected) tokens.push('◆');
        if (crystal && isCollected) tokens.push('◇');
        if (current) tokens.push('●');
        for (const index of echoIndexes) tokens.push(echoGlyphs[index] ?? `E${index + 1}`);
        cell.textContent = tokens.join('');
      }
      fragment.append(cell);
    }
  }
  board.replaceChildren(fragment);
  board.dataset.level = String(game.levelIndex + 1);
  board.dataset.loop = String(game.loop);
  board.dataset.tick = String(game.tick);
  board.dataset.echoCount = String(game.echoes.length);
  board.dataset.playerX = String(game.player.x);
  board.dataset.playerY = String(game.player.y);
  board.dataset.echoOneX = game.echoPositions[0] ? String(game.echoPositions[0].x) : '';
  board.dataset.echoOneY = game.echoPositions[0] ? String(game.echoPositions[0].y) : '';
  board.dataset.collected = String(game.collected.length);
  board.dataset.status = game.status;
  board.dataset.paused = String(paused);
  board.dataset.pending = pendingInput;
  board.dataset.collision = String(game.collision);
  board.setAttribute('aria-label', `${level.title}. Loop ${game.loop}, Tick ${game.tick} von ${LOOP_TICKS}. ${game.echoes.length} Echos. ${game.collected.length} von ${level.crystals.length} Kristallen gesammelt.`);
}

function statusText() {
  const level = LEVELS[game.levelIndex];
  if (game.status === 'won') return `${level.title} gelöst in ${game.loop} Loop${game.loop === 1 ? '' : 's'}.`;
  if (paused) return `${level.title} · ${game.tick === 0 && game.loop === 1 ? 'bereit' : 'pausiert'} · nächster Input: ${pendingInput}.`;
  if (game.collision) return `${level.title} · Kollision: beteiligte Zeitlinien bleiben für diesen Tick stehen.`;
  return `${level.title} · Loop ${game.loop} · Tick ${game.tick}/${LOOP_TICKS} · nächster Input: ${pendingInput}.`;
}

function render() {
  renderLevels();
  renderBoard();
  levelNumber.textContent = `${game.levelIndex + 1}/${LEVELS.length}`;
  loopNumber.textContent = String(game.loop);
  tickNumber.textContent = `${game.tick}/${LOOP_TICKS}`;
  bestLoops.textContent = progress.bestLoops[game.levelIndex] ?? '–';
  statusElement.textContent = statusText();
  pauseButton.textContent = game.status === 'won' ? 'Gelöst' : paused ? (game.tick === 0 && game.loop === 1 ? 'Start' : 'Weiter') : 'Pause';
  pauseButton.disabled = game.status === 'won';
  pauseButton.setAttribute('aria-pressed', String(paused));
}

function setPending(input) {
  pendingInput = input;
  render();
}

function finishWin(previousStatus) {
  if (previousStatus !== 'playing' || game.status !== 'won') return;
  progress = recordWin(progress, game.levelIndex, game.loop);
  saveProgress(storage, progress);
  paused = true;
  pendingInput = WAIT;
}

function tickGame() {
  if (paused || game.status !== 'playing') return;
  const previousStatus = game.status;
  game = stepGame(game, pendingInput);
  pendingInput = WAIT;
  finishWin(previousStatus);
  render();
}

function startLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= progress.unlocked || index >= LEVELS.length) return;
  game = createGame(index);
  paused = true;
  pendingInput = WAIT;
  render();
  board.focus({ preventScroll: true });
}

levelSelect.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-level]');
  if (!button || button.disabled) return;
  startLevel(Number(button.dataset.level));
});

for (const button of inputButtons) button.addEventListener('click', () => setPending(button.dataset.input));

pauseButton.addEventListener('click', () => {
  if (game.status === 'won') return;
  paused = !paused;
  render();
  if (!paused) board.focus({ preventScroll: true });
});

restartButton.addEventListener('click', () => startLevel(game.levelIndex));

const keyInputs = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);

document.addEventListener('keydown', (event) => {
  const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea');
  if (interactive) return;
  const input = keyInputs.get(event.key);
  if (input) {
    event.preventDefault();
    setPending(input);
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    setPending(WAIT);
  } else if (event.key === 'p' || event.key === 'P') {
    event.preventDefault();
    pauseButton.click();
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restartButton.click();
  }
});

window.addEventListener('blur', () => {
  if (!paused && game.status === 'playing') {
    paused = true;
    pendingInput = WAIT;
    render();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !paused && game.status === 'playing') {
    paused = true;
    pendingInput = WAIT;
    render();
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

setInterval(tickGame, TICK_MS);
updateConnection();
render();
