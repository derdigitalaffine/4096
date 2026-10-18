import { connectionStatus } from '../connectivity.js';
import {
  LEVEL_COUNT,
  collectedCoins,
  createGame,
  getLevel,
  progressPercent,
  stepGame,
} from './game.js';

const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const coinsElement = document.querySelector('#coins');
const livesElement = document.querySelector('#lives');
const bestElement = document.querySelector('#best');
const levelElement = document.querySelector('#level');
const progressElement = document.querySelector('#progress');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const newGameButton = document.querySelector('#new-game');
const leftButton = document.querySelector('#move-left');
const rightButton = document.querySelector('#move-right');
const jumpButton = document.querySelector('#jump');

const BEST_KEY = 'super-mario-land-best-v1';
const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const controls = { left: false, right: false };
const LEVEL_THEMES = [
  { sky: '#9bbc0f', hills: '#8bac0f', clouds: '#306230' },
  { sky: '#8bac0f', hills: '#9bbc0f', clouds: '#306230' },
  { sky: '#9bbc0f', hills: '#306230', clouds: '#8bac0f' },
];
let jumpQueued = false;
let game = createGame();
let lastFrame = performance.now();
let bestScore = loadBestScore();
let offlineReady = Boolean(navigator.serviceWorker?.controller);
let offlineError = false;

function loadBestScore() {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function persistBestScore() {
  try {
    localStorage.setItem(BEST_KEY, String(bestScore));
  } catch {
    // Storage is optional; gameplay stays available without it.
  }
}

function setStatus(message) {
  statusElement.textContent = message;
}

function updateConnection() {
  connectionElement.textContent = connectionStatus({
    online: navigator.onLine,
    offlineReady,
    offlineError,
  });
  connectionElement.dataset.offlineReady = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!navigator.onLine && !offlineReady));
}

function updateHud() {
  const level = getLevel(game);
  scoreElement.textContent = String(game.score);
  coinsElement.textContent = `${collectedCoins(game)}/${level.coins.length}`;
  livesElement.textContent = String(game.lives);
  bestElement.textContent = String(bestScore);
  levelElement.textContent = `${game.levelIndex + 1}/${LEVEL_COUNT}`;
  progressElement.textContent = `${progressPercent(game)}%`;

  const terminal = game.status !== 'playing';
  leftButton.disabled = terminal;
  rightButton.disabled = terminal;
  jumpButton.disabled = terminal;
}

function drawBackground(cameraX, levelIndex) {
  const theme = LEVEL_THEMES[levelIndex % LEVEL_THEMES.length];
  context.fillStyle = theme.sky;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.fillStyle = theme.hills;
  for (let index = -1; index < 7; index += 1) {
    const x = index * 180 - ((cameraX * 0.18) % 180);
    const peak = 230 - levelIndex * 12 + (index % 2) * 18;
    context.beginPath();
    context.moveTo(x, 360);
    context.lineTo(x + 90, peak);
    context.lineTo(x + 180, 360);
    context.closePath();
    context.fill();
  }

  context.fillStyle = theme.clouds;
  for (let index = 0; index < 8; index += 1) {
    const x = index * 150 - ((cameraX * 0.08) % 150);
    const y = 72 + (index % 3) * 28 + levelIndex * 6;
    context.fillRect(x, y, 54, 12);
    context.fillRect(x + 12, y - 10, 32, 10);
  }
}

function drawSolid(solid, cameraX) {
  const x = Math.round(solid.x - cameraX);
  if (x + solid.width < 0 || x > VIEW_WIDTH) return;

  context.fillStyle = '#306230';
  context.fillRect(x, solid.y, solid.width, solid.height);
  context.fillStyle = '#0f380f';
  context.fillRect(x, solid.y, solid.width, 5);

  for (let px = x + 8; px < x + solid.width; px += 32) {
    context.fillRect(px, solid.y + 14, 4, 4);
  }
}

function drawCoin(coin, cameraX) {
  if (coin.collected) return;
  const x = Math.round(coin.x - cameraX);
  if (x < -20 || x > VIEW_WIDTH + 20) return;
  context.fillStyle = '#0f380f';
  context.beginPath();
  context.arc(x, coin.y, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#9bbc0f';
  context.fillRect(x - 2, coin.y - 5, 4, 10);
}

function drawEnemy(enemy, cameraX) {
  if (!enemy.alive) return;
  const x = Math.round(enemy.x - cameraX);
  if (x + enemy.width < 0 || x > VIEW_WIDTH) return;
  context.fillStyle = '#0f380f';
  context.fillRect(x + 3, enemy.y + 5, enemy.width - 6, enemy.height - 5);
  context.fillRect(x, enemy.y + 12, enemy.width, enemy.height - 12);
  context.fillStyle = '#9bbc0f';
  context.fillRect(x + 6, enemy.y + 9, 4, 4);
  context.fillRect(x + enemy.width - 10, enemy.y + 9, 4, 4);
}

function drawGoal(goalX, cameraX) {
  const x = Math.round(goalX - cameraX);
  if (x < -40 || x > VIEW_WIDTH + 40) return;
  context.fillStyle = '#0f380f';
  context.fillRect(x, 152, 5, 232);
  context.fillRect(x - 22, 152, 22, 16);
  context.fillStyle = '#306230';
  context.fillRect(x - 18, 156, 14, 8);
}

function drawPlayer(cameraX) {
  const player = game.player;
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y);
  const flip = player.facing < 0;

  context.fillStyle = '#0f380f';
  context.fillRect(x + 4, y, 16, 5);
  context.fillRect(x + (flip ? 7 : 5), y + 5, 13, 8);
  context.fillRect(x + 3, y + 13, 18, 10);
  context.fillRect(x + 1, y + 22, 8, 8);
  context.fillRect(x + 15, y + 22, 8, 8);
  context.fillStyle = '#8bac0f';
  context.fillRect(x + (flip ? 8 : 13), y + 8, 3, 3);
}

function renderGame() {
  const level = getLevel(game);
  const cameraX = Math.max(0, Math.min(level.width - VIEW_WIDTH, game.player.x - VIEW_WIDTH * 0.34));
  drawBackground(cameraX, game.levelIndex);
  for (const solid of level.solids) drawSolid(solid, cameraX);
  for (const coin of game.coins) drawCoin(coin, cameraX);
  for (const enemy of game.enemies) drawEnemy(enemy, cameraX);
  drawGoal(level.goalX, cameraX);
  drawPlayer(cameraX);

  context.fillStyle = '#0f380f';
  context.font = 'bold 16px ui-monospace, monospace';
  context.fillText(`LEVEL ${game.levelIndex + 1}/${LEVEL_COUNT} · ZIEL ${Math.max(0, Math.ceil((level.goalX - game.player.x) / 32))}`, 12, 24);
}

function resetGame(message = `Los geht’s: Drei Level warten. Erreiche in jedem Level die Fahne.`) {
  game = createGame();
  controls.left = false;
  controls.right = false;
  jumpQueued = false;
  setStatus(message);
  updateHud();
  renderGame();
}

function handleStateFeedback(previous) {
  if (game.score > bestScore) {
    bestScore = game.score;
    persistBestScore();
  }

  if (game.levelIndex !== previous.levelIndex) {
    const level = getLevel(game);
    setStatus(`Level ${previous.levelIndex + 1} geschafft! Weiter mit Level ${game.levelIndex + 1}: ${level.name}. Punkte und Leben bleiben erhalten.`);
  } else if (game.status === 'won' && previous.status !== 'won') {
    setStatus(`Alle ${LEVEL_COUNT} Level geschafft! ${game.score} Punkte – starke Runde.`);
  } else if (game.status === 'lost' && previous.status !== 'lost') {
    setStatus('Runde verloren. Starte eine neue Runde und versuche die drei Level noch einmal.');
  } else if (game.lives < previous.lives && game.status === 'playing') {
    setStatus(`Treffer! Noch ${game.lives} Leben übrig.`);
  }
}

function frame(now) {
  const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const previous = game;
  game = stepGame(game, { ...controls, jump: jumpQueued }, delta);
  jumpQueued = false;
  handleStateFeedback(previous);
  updateHud();
  renderGame();
  requestAnimationFrame(frame);
}

function setDirection(key, active) {
  controls[key] = active && game.status === 'playing';
}

function queueJump() {
  if (game.status === 'playing') jumpQueued = true;
}

function bindHoldButton(button, direction) {
  const start = (event) => {
    event.preventDefault();
    setDirection(direction, true);
    button.setPointerCapture?.(event.pointerId);
  };
  const stop = (event) => {
    event.preventDefault();
    setDirection(direction, false);
  };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', () => setDirection(direction, false));
}

bindHoldButton(leftButton, 'left');
bindHoldButton(rightButton, 'right');
jumpButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  queueJump();
});
newGameButton.addEventListener('click', () => resetGame('Neue Runde gestartet. Drei Level, drei Fahnen – los geht’s.'));

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') {
    event.preventDefault();
    setDirection('left', true);
  } else if (event.key === 'ArrowRight' || key === 'd') {
    event.preventDefault();
    setDirection('right', true);
  } else if (event.key === 'ArrowUp' || event.key === ' ' || key === 'w') {
    event.preventDefault();
    if (!event.repeat) queueJump();
  } else if (key === 'r') {
    event.preventDefault();
    resetGame('Neue Runde gestartet. Drei Level, drei Fahnen – los geht’s.');
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') setDirection('left', false);
  if (event.key === 'ArrowRight' || key === 'd') setDirection('right', false);
});

window.addEventListener('blur', () => {
  controls.left = false;
  controls.right = false;
});
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = true;
    updateConnection();
  });

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
}

updateConnection();
resetGame();
requestAnimationFrame((now) => {
  lastFrame = now;
  requestAnimationFrame(frame);
});
