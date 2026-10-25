import { connectionStatus } from '../connectivity.js';
import { LEVELS } from './levels.js';
import { actionLabel, compositionForState, createGame, movePlayer, positionKey, redo, shiftLayer, translateCell, undo } from './game.js';
import { getSafeStorage, loadProgress, recordWin, saveProgress, selectLevel } from './storage.js';

const board = document.querySelector('#strata-board');
const levelSelect = document.querySelector('#level-select');
const levelNumber = document.querySelector('#level-number');
const actionCount = document.querySelector('#action-count');
const shiftCount = document.querySelector('#shift-count');
const bestScore = document.querySelector('#best-score');
const connectionElement = document.querySelector('#connection-status');
const statusElement = document.querySelector('#game-status');
const lessonElement = document.querySelector('#lesson');
const historyElement = document.querySelector('#action-history');
const undoButton = document.querySelector('#undo-action');
const redoButton = document.querySelector('#redo-action');
const restartButton = document.querySelector('#restart-game');
const layerButtons = [...document.querySelectorAll('[data-layer]')];
const moveButtons = [...document.querySelectorAll('[data-move]')];
const shiftButtons = [...document.querySelectorAll('[data-shift]')];

const storage = getSafeStorage(window);
let progress = loadProgress(storage);
let game = createGame(progress.lastLevel);
let selectedLayer = 0;
let notice = '';
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function layerCells(level, layerIndex) {
  const offset = game.offsets[layerIndex];
  return new Set(level.layers[layerIndex].cells.map((cell) => positionKey(translateCell(cell, offset, level.width, level.height))));
}

function cellLabel({ x, y, solid, a, b, player, goal }) {
  const parts = [`Reihe ${y + 1}, Spalte ${x + 1}`];
  if (player) parts.push('Figur');
  if (goal) parts.push('Ziel');
  if (a && b) parts.push('Schicht A und B überlagern sich, gerade Parität, frei');
  else if (a) parts.push('Schicht A, Materie');
  else if (b) parts.push('Schicht B, Materie');
  else parts.push('leer');
  if (solid) parts.push('nicht begehbar');
  return parts.join(', ');
}

function renderBoard() {
  const level = LEVELS[game.levelIndex];
  const composed = compositionForState(game);
  const aCells = layerCells(level, 0);
  const bCells = layerCells(level, 1);
  const playerKey = positionKey(game.player);
  const goalKey = positionKey(level.goal);
  const fragment = document.createDocumentFragment();

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = `${x},${y}`;
      const a = aCells.has(key);
      const b = bCells.has(key);
      const solid = composed.solid.has(key);
      const player = key === playerKey;
      const goal = key === goalKey;
      const cell = document.createElement('span');
      cell.className = 'strata-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.dataset.layerA = String(a);
      cell.dataset.layerB = String(b);
      cell.dataset.count = String(composed.counts.get(key) ?? 0);
      cell.dataset.solid = String(solid);
      cell.dataset.player = String(player);
      cell.dataset.goal = String(goal);
      cell.setAttribute('aria-label', cellLabel({ x, y, solid, a, b, player, goal }));

      const tokens = [];
      if (goal) tokens.push('◎');
      if (a && b) tokens.push('⊕');
      else if (a) tokens.push('╱');
      else if (b) tokens.push('•');
      if (player) tokens.push('●');
      cell.textContent = tokens.join('');
      fragment.append(cell);
    }
  }

  board.replaceChildren(fragment);
  board.dataset.level = String(game.levelIndex + 1);
  board.dataset.actions = String(game.actions);
  board.dataset.shifts = String(game.shifts);
  board.dataset.status = game.status;
  board.dataset.selectedLayer = String(selectedLayer);
  board.dataset.playerX = String(game.player.x);
  board.dataset.playerY = String(game.player.y);
  board.dataset.layerAX = String(game.offsets[0].x);
  board.dataset.layerAY = String(game.offsets[0].y);
  board.dataset.layerBX = String(game.offsets[1].x);
  board.dataset.layerBY = String(game.offsets[1].y);
  board.setAttribute('aria-label', `${level.title}. Figur Reihe ${game.player.y + 1}, Spalte ${game.player.x + 1}. ${game.actions} Aktionen, ${game.shifts} Schichtverschiebungen.`);
}

function renderLevels() {
  const fragment = document.createDocumentFragment();
  LEVELS.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.level = String(index);
    button.dataset.solved = String(progress.solved[index]);
    button.setAttribute('aria-pressed', String(index === game.levelIndex));
    button.textContent = String(index + 1);
    const best = progress.bestActions[index];
    button.setAttribute('aria-label', `${index + 1}. ${level.title}${progress.solved[index] ? ', gelöst' : ''}${best === null ? '' : `, Bestwert ${best} Aktionen`}`);
    fragment.append(button);
  });
  levelSelect.replaceChildren(fragment);
}

function actionHistory() {
  const actions = [...game.history.slice(1).map((entry) => entry.lastAction), game.lastAction]
    .filter((entry) => entry && entry !== 'start')
    .map(actionLabel)
    .filter(Boolean);
  return actions.slice(-8).join(' · ');
}

function renderStatus() {
  const level = LEVELS[game.levelIndex];
  if (game.status === 'won') statusElement.textContent = `${level.title} gelöst: ${game.actions} Aktionen, ${game.shifts} Shifts.`;
  else if (notice) statusElement.textContent = notice;
  else statusElement.textContent = `${level.title} · aktive Schicht ${selectedLayer === 0 ? 'A' : 'B'}.`;
}

function render() {
  const level = LEVELS[game.levelIndex];
  renderLevels();
  renderBoard();
  layerButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.layer) === selectedLayer)));
  levelNumber.textContent = `${game.levelIndex + 1}/${LEVELS.length}`;
  actionCount.textContent = String(game.actions);
  shiftCount.textContent = String(game.shifts);
  const actions = progress.bestActions[game.levelIndex];
  const shifts = progress.bestShifts[game.levelIndex];
  bestScore.textContent = actions === null ? '–' : `${actions}A/${shifts}S`;
  undoButton.disabled = game.history.length === 0;
  redoButton.disabled = game.future.length === 0;
  lessonElement.textContent = level.lesson;
  historyElement.textContent = actionHistory() || 'Noch keine Aktion.';
  renderStatus();
}

function finishWin(previousStatus) {
  if (previousStatus === 'won' || game.status !== 'won') return;
  progress = recordWin(progress, game.levelIndex, game.actions, game.shifts);
  saveProgress(storage, progress);
}

function apply(next, blockedMessage) {
  const previous = game;
  notice = '';
  if (next === previous) {
    notice = blockedMessage;
    render();
    return;
  }
  game = next;
  finishWin(previous.status);
  render();
}

function move(direction) {
  apply(movePlayer(game, direction), 'Bewegung blockiert: dort liegt Materie oder der Spielfeldrand.');
}

function shift(direction) {
  apply(shiftLayer(game, selectedLayer, direction), 'Schicht blockiert: die Verschiebung würde Materie auf der Figur erzeugen.');
}

function chooseLayer(index) {
  if (index !== 0 && index !== 1) return;
  selectedLayer = index;
  notice = `Schicht ${index === 0 ? 'A' : 'B'} ausgewählt.`;
  render();
}

function startLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return;
  progress = selectLevel(progress, index);
  saveProgress(storage, progress);
  game = createGame(index);
  selectedLayer = 0;
  notice = '';
  render();
  board.focus({ preventScroll: true });
}

levelSelect.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-level]');
  if (button) startLevel(Number(button.dataset.level));
});
for (const button of layerButtons) button.addEventListener('click', () => chooseLayer(Number(button.dataset.layer)));
for (const button of moveButtons) button.addEventListener('click', () => move(button.dataset.move));
for (const button of shiftButtons) button.addEventListener('click', () => shift(button.dataset.shift));
undoButton.addEventListener('click', () => {
  const next = undo(game);
  notice = next === game ? 'Nichts zum Rückgängigmachen.' : 'Undo.';
  game = next;
  render();
});
redoButton.addEventListener('click', () => {
  const previous = game.status;
  const next = redo(game);
  notice = next === game ? 'Nichts zum Wiederholen.' : 'Redo.';
  game = next;
  finishWin(previous);
  render();
});
restartButton.addEventListener('click', () => startLevel(game.levelIndex));

const keyDirections = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoButton.click();
    else undoButton.click();
    return;
  }

  const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea');
  if (interactive) return;

  if (event.key === '1' || event.key === '2') {
    event.preventDefault();
    chooseLayer(Number(event.key) - 1);
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restartButton.click();
    return;
  }
  const direction = keyDirections.get(event.key);
  if (!direction) return;
  event.preventDefault();
  if (event.shiftKey && event.key.startsWith('Arrow')) shift(direction);
  else move(direction);
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
