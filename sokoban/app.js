import { connectionStatus } from '../connectivity.js';
import { LEVELS } from './levels.js';
import { createGame, movePlayer, positionKey, restartLevel, restoreGame, undoMove } from './game.js';
import { getSafeStorage, loadProgress, recordCompletion, saveProgress, withResume } from './storage.js';

const board = document.querySelector('#sokoban-board');
const levelNumber = document.querySelector('#level-number');
const moveCount = document.querySelector('#moves');
const pushCount = document.querySelector('#pushes');
const bestScore = document.querySelector('#best-score');
const levelSelect = document.querySelector('#level-select');
const undoButton = document.querySelector('#undo-move');
const restartButton = document.querySelector('#restart-level');
const nextButton = document.querySelector('#next-level');
const statusElement = document.querySelector('#game-status');
const lessonElement = document.querySelector('#lesson');
const connectionElement = document.querySelector('#connection-status');
const directionButtons = [...document.querySelectorAll('[data-direction]')];

const storage = getSafeStorage(window);
let progress = loadProgress(storage);
let game = progress.resume ? restoreGame(progress.resume) : null;
if (!game) game = createGame(Math.max(0, Math.min(LEVELS.length - 1, progress.unlocked - 1)));
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function refreshLevelSelect() {
  levelSelect.replaceChildren(...LEVELS.map((level, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1} · ${level.title}`;
    option.disabled = index >= progress.unlocked;
    return option;
  }));
  levelSelect.value = String(game.levelIndex);
}

function cellType(key, wallKeys, goalKeys, crateKeys, playerKey) {
  if (wallKeys.has(key)) return ['wall', '█'];
  const goal = goalKeys.has(key);
  const crate = crateKeys.has(key);
  if (key === playerKey) return goal ? ['player-goal', '◎'] : ['player', '●'];
  if (crate) return goal ? ['crate-goal', '◆'] : ['crate', '□'];
  return goal ? ['goal', '·'] : ['floor', ''];
}

function renderBoard() {
  const wallKeys = new Set(game.walls.map(positionKey));
  const goalKeys = new Set(game.goals.map(positionKey));
  const crateKeys = new Set(game.crates.map(positionKey));
  const playerKey = positionKey(game.player);
  const fragment = document.createDocumentFragment();

  for (let y = 0; y < game.height; y += 1) {
    for (let x = 0; x < game.width; x += 1) {
      const cell = document.createElement('span');
      const [type, marker] = cellType(`${x},${y}`, wallKeys, goalKeys, crateKeys, playerKey);
      cell.className = 'sokoban-cell';
      cell.dataset.type = type;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-hidden', 'true');
      cell.textContent = marker;
      fragment.append(cell);
    }
  }

  board.replaceChildren(fragment);
  board.style.gridTemplateColumns = `repeat(${game.width}, minmax(0, 1fr))`;
  board.style.aspectRatio = `${game.width} / ${game.height}`;
  board.dataset.level = String(game.levelIndex + 1);
  board.dataset.playerX = String(game.player.x);
  board.dataset.playerY = String(game.player.y);
  board.dataset.cratesOnGoal = String(game.crates.filter((crate) => goalKeys.has(positionKey(crate))).length);
  board.dataset.won = String(game.won);
  board.setAttribute('aria-label', `Sokoban Level ${game.levelIndex + 1}. Spieler Spalte ${game.player.x + 1}, Reihe ${game.player.y + 1}. ${game.crates.length} Kisten, ${game.crates.filter((crate) => goalKeys.has(positionKey(crate))).length} auf Ziel. ${game.moves} Züge, ${game.pushes} Schübe.`);
}

function renderMeta() {
  const level = LEVELS[game.levelIndex];
  const best = progress.best[level.id];
  levelNumber.textContent = `${game.levelIndex + 1}/${LEVELS.length}`;
  moveCount.textContent = String(game.moves);
  pushCount.textContent = String(game.pushes);
  bestScore.textContent = best ? `${best.pushes}S · ${best.moves}Z` : '–';
  lessonElement.textContent = `${level.title}: ${level.lesson}`;
  undoButton.disabled = game.history.length === 0;
  nextButton.hidden = !(game.won && game.levelIndex + 1 < progress.unlocked && game.levelIndex + 1 < LEVELS.length);
  levelSelect.value = String(game.levelIndex);
}

function render(message = '') {
  renderBoard();
  renderMeta();
  const level = LEVELS[game.levelIndex];
  const solvedCount = game.crates.filter((crate) => game.goals.some((goal) => positionKey(goal) === positionKey(crate))).length;
  const fallback = game.won
    ? `${level.title} gelöst: ${game.moves} Züge, ${game.pushes} Schübe.`
    : `${level.title} · ${solvedCount}/${game.crates.length} Kisten auf Ziel.`;
  statusElement.textContent = message || fallback;
}

function persistCurrent() {
  if (game.won) return;
  progress = withResume(progress, game);
  saveProgress(storage, progress);
}

function commitCompletion() {
  if (!game.won) return;
  progress = recordCompletion(progress, game);
  saveProgress(storage, progress);
  refreshLevelSelect();
}

function chooseLevel(levelIndex, focus = true) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= progress.unlocked || levelIndex >= LEVELS.length) return;
  game = createGame(levelIndex);
  persistCurrent();
  refreshLevelSelect();
  render(`Level ${levelIndex + 1}: ${LEVELS[levelIndex].title}.`);
  if (focus) board.focus({ preventScroll: true });
}

function applyDirection(direction) {
  const next = movePlayer(game, direction);
  if (next === game) {
    render('Dort ist kein gültiger Zug.');
    return false;
  }
  game = next;
  if (game.won) commitCompletion(); else persistCurrent();
  render();
  return true;
}

function undo() {
  const next = undoMove(game);
  if (next === game) return;
  game = next;
  persistCurrent();
  render(`Undo · ${game.moves} Züge, ${game.pushes} Schübe.`);
}

function restart() {
  game = restartLevel(game);
  persistCurrent();
  render('Level neu gestartet.');
  board.focus({ preventScroll: true });
}

for (const button of directionButtons) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    applyDirection(button.dataset.direction);
  });
}
undoButton.addEventListener('click', undo);
restartButton.addEventListener('click', restart);
nextButton.addEventListener('click', () => chooseLevel(game.levelIndex + 1));
levelSelect.addEventListener('change', () => chooseLevel(Number(levelSelect.value)));

const keyDirections = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);

document.addEventListener('keydown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    if (!target?.closest('input, textarea')) {
      event.preventDefault();
      undo();
    }
    return;
  }
  if (target?.closest('a, select, input, textarea')) return;
  const direction = keyDirections.get(event.key);
  if (direction) {
    event.preventDefault();
    applyDirection(direction);
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restart();
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

refreshLevelSelect();
updateConnection();
render();
