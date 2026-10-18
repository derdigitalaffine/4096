import { connectionStatus } from '../connectivity.js';
import { LEVELS } from './levels.js';
import {
  WORLD_HEIGHT, WORLD_WIDTH, advanceLevel, createGame, launchBall, movePaddle, restartRun,
  setPaddleCenter, stepGame, togglePause,
} from './game.js';
import { getSafeStorage, loadBest, saveBest } from './storage.js';

const canvas = document.querySelector('#breakout-canvas');
const context = canvas.getContext('2d', { alpha: false });
const levelElement = document.querySelector('#level');
const scoreElement = document.querySelector('#score');
const livesElement = document.querySelector('#lives');
const bestElement = document.querySelector('#best-score');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const launchButton = document.querySelector('#launch-ball');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const nextButton = document.querySelector('#next-level');
const leftButton = document.querySelector('#move-left');
const rightButton = document.querySelector('#move-right');

const storage = getSafeStorage(window);
let bestScore = loadBest(storage);
let game = createGame();
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);
const held = new Set();
let lastFrame = performance.now();
let accumulator = 0;
const FRAME_MS = 1000 / 60;

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function syncBest() {
  if (game.score <= bestScore) return;
  bestScore = game.score;
  saveBest(storage, bestScore);
}

function statusText() {
  if (game.status === 'ready') return `Level ${game.levelIndex + 1}: Start drücken oder Leertaste.`;
  if (game.status === 'paused') return 'Pause · P oder Pause zum Fortsetzen.';
  if (game.status === 'level-cleared') return `${LEVELS[game.levelIndex].title} geschafft · nächstes Level bereit.`;
  if (game.status === 'won') return `Alle ${LEVELS.length} Level geschafft · ${game.score} Punkte.`;
  if (game.status === 'gameover') return `Game over · ${game.score} Punkte.`;
  return `${game.bricks.length} Blöcke übrig · ${game.balls.length} Ball${game.balls.length === 1 ? '' : 's'}.`;
}

function updateMeta() {
  syncBest();
  levelElement.textContent = `${game.levelIndex + 1}/${LEVELS.length}`;
  scoreElement.textContent = String(game.score);
  livesElement.textContent = String(game.lives);
  bestElement.textContent = String(bestScore);
  statusElement.textContent = statusText();
  launchButton.disabled = game.status !== 'ready';
  pauseButton.disabled = !['running', 'paused'].includes(game.status);
  pauseButton.textContent = game.status === 'paused' ? 'Weiter' : 'Pause';
  nextButton.hidden = game.status !== 'level-cleared';
  canvas.dataset.status = game.status;
  canvas.dataset.level = String(game.levelIndex + 1);
  canvas.dataset.score = String(game.score);
  canvas.dataset.lives = String(game.lives);
  canvas.dataset.paddleX = game.paddle.x.toFixed(2);
  canvas.dataset.ballCount = String(game.balls.length);
  canvas.dataset.brickCount = String(game.bricks.length);
  canvas.dataset.ballY = game.balls[0] ? game.balls[0].y.toFixed(2) : '';
  canvas.setAttribute('aria-label', `Tromu Breakout Level ${game.levelIndex + 1}. ${game.score} Punkte, ${game.lives} Leben, ${game.bricks.length} Blöcke, Status ${game.status}.`);
}

function drawRoundedRect(x, y, width, height, radius = 3) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function render() {
  context.fillStyle = '#071019';
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.strokeStyle = '#18334b';
  context.lineWidth = 1;
  for (let y = 22; y < WORLD_HEIGHT; y += 22) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }

  for (const brick of game.bricks) {
    context.fillStyle = brick.powerUp === 'wide' ? '#ffd166' : brick.powerUp === 'slow' ? '#8de6b4' : brick.powerUp === 'multiball' ? '#d3a3ff' : '#4eb5e8';
    drawRoundedRect(brick.x, brick.y, brick.width, brick.height, 3);
    if (brick.powerUp) {
      context.fillStyle = '#0b1118';
      context.font = 'bold 10px ui-monospace, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const label = brick.powerUp === 'wide' ? 'W' : brick.powerUp === 'slow' ? 'S' : 'M';
      context.fillText(label, brick.x + brick.width / 2, brick.y + brick.height / 2 + .5);
    }
  }

  for (const powerUp of game.powerUps) {
    context.fillStyle = powerUp.type === 'wide' ? '#ffd166' : powerUp.type === 'slow' ? '#8de6b4' : '#d3a3ff';
    context.fillRect(powerUp.x - 7, powerUp.y - 7, 14, 14);
  }

  context.fillStyle = '#f4f8ff';
  drawRoundedRect(game.paddle.x, game.paddle.y, game.paddle.width, game.paddle.height, 4);
  context.fillStyle = '#ff7d7d';
  for (const ball of game.balls) {
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
  }
  updateMeta();
}

function setGame(next) {
  game = next;
  render();
}

function restart() {
  held.clear();
  setGame(restartRun());
  canvas.focus({ preventScroll: true });
}

function launch() {
  setGame(launchBall(game));
  canvas.focus({ preventScroll: true });
}

function pause() { setGame(togglePause(game)); }
function nextLevel() { setGame(advanceLevel(game)); }

launchButton.addEventListener('click', launch);
pauseButton.addEventListener('click', pause);
restartButton.addEventListener('click', restart);
nextButton.addEventListener('click', nextLevel);

function bindDirection(button, direction) {
  const release = () => held.delete(direction);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    held.add(direction);
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
bindDirection(leftButton, 'left');
bindDirection(rightButton, 'right');

const keyDirection = new Map([
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);
document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea') && !canvas.contains(event.target)) return;
  const direction = keyDirection.get(event.key);
  if (direction) {
    event.preventDefault();
    held.add(direction);
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    launch();
  } else if (event.key === 'p' || event.key === 'P') {
    event.preventDefault();
    pause();
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restart();
  }
});
document.addEventListener('keyup', (event) => {
  const direction = keyDirection.get(event.key);
  if (direction) held.delete(direction);
});
window.addEventListener('blur', () => held.clear());

function pointerToWorldX(event) {
  const rect = canvas.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
}
function dragPaddle(event) {
  event.preventDefault();
  setGame(setPaddleCenter(game, pointerToWorldX(event)));
}
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  dragPaddle(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.buttons || event.pointerType === 'touch') dragPaddle(event);
});

function frame(now) {
  const elapsed = Math.min(80, Math.max(0, now - lastFrame));
  lastFrame = now;
  accumulator += elapsed;
  let changed = false;
  while (accumulator >= FRAME_MS) {
    if (held.has('left') && !held.has('right')) {
      game = movePaddle(game, 'left', 5.5);
      changed = true;
    }
    if (held.has('right') && !held.has('left')) {
      game = movePaddle(game, 'right', 5.5);
      changed = true;
    }
    const next = stepGame(game);
    if (next !== game) {
      game = next;
      changed = true;
    }
    accumulator -= FRAME_MS;
  }
  if (changed) render();
  requestAnimationFrame(frame);
}

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
requestAnimationFrame(frame);
