import { connectionStatus } from '../connectivity.js';
import { WAVES } from './waves.js';
import {
  PLAYER_HEIGHT, PLAYER_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, createGame, enemySpec, firePlayer,
  movePlayer, restartRun, setPlayerPosition, stepGame, togglePause,
} from './game.js';
import { getSafeStorage, loadBest, recordBest, saveBest } from './storage.js';

const canvas = document.querySelector('#shooter-canvas');
const context = canvas.getContext('2d', { alpha: false });
const waveElement = document.querySelector('#wave');
const scoreElement = document.querySelector('#score');
const livesElement = document.querySelector('#lives');
const bestElement = document.querySelector('#best-score');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const fireButton = document.querySelector('#fire');
const directionButtons = [...document.querySelectorAll('[data-direction]')];

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
  const next = recordBest(bestScore, game.score);
  if (next === bestScore) return;
  bestScore = next;
  saveBest(storage, bestScore);
}

function statusText() {
  if (game.status === 'paused') return `Pause · Welle ${game.waveIndex + 1}.`;
  if (game.status === 'gameover') return `Game over · ${game.score} Punkte. R startet neu.`;
  if (game.status === 'won') return `Alle ${WAVES.length} Wellen geschafft · ${game.score} Punkte.`;
  const powers = [];
  if (game.player.shieldTicks > 0) powers.push('Schild');
  if (game.player.spreadTicks > 0) powers.push('Spread');
  if (game.player.rapidTicks > 0) powers.push('Rapid');
  return `${WAVES[game.waveIndex].title} · ${game.enemies.length} Gegner${powers.length ? ` · ${powers.join(' + ')}` : ''}.`;
}

function updateMeta() {
  syncBest();
  waveElement.textContent = `${game.waveIndex + 1}/${WAVES.length}`;
  scoreElement.textContent = String(game.score);
  livesElement.textContent = String(game.lives);
  bestElement.textContent = String(bestScore);
  statusElement.textContent = statusText();
  pauseButton.disabled = !['running', 'paused'].includes(game.status);
  pauseButton.textContent = game.status === 'paused' ? 'Weiter' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(game.status === 'paused'));
  fireButton.disabled = game.status !== 'running';
  canvas.dataset.status = game.status;
  canvas.dataset.wave = String(game.waveIndex + 1);
  canvas.dataset.score = String(game.score);
  canvas.dataset.lives = String(game.lives);
  canvas.dataset.enemyCount = String(game.enemies.length);
  canvas.dataset.bulletCount = String(game.bullets.length);
  canvas.dataset.enemyBulletCount = String(game.enemyBullets.length);
  canvas.dataset.playerX = game.player.x.toFixed(2);
  canvas.dataset.playerY = game.player.y.toFixed(2);
  canvas.dataset.held = String(held.size);
  canvas.dataset.shield = String(game.player.shieldTicks > 0);
  canvas.dataset.spread = String(game.player.spreadTicks > 0);
  canvas.dataset.rapid = String(game.player.rapidTicks > 0);
  canvas.setAttribute('aria-label', `Tromu Space Shooter, Welle ${game.waveIndex + 1} von ${WAVES.length}. ${game.score} Punkte, ${game.lives} Leben, ${game.enemies.length} Gegner. Status ${game.status}.`);
}

function drawBackground() {
  context.fillStyle = '#050b18';
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  for (let index = 0; index < 42; index += 1) {
    const x = (index * 73 + 19) % WORLD_WIDTH;
    const y = (index * 47 + game.tick * (index % 3 === 0 ? 0.18 : 0.08)) % WORLD_HEIGHT;
    context.fillStyle = index % 5 === 0 ? '#8bdfff' : '#314a68';
    context.fillRect(x, y, index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1);
  }
  context.strokeStyle = '#18304e';
  context.beginPath();
  context.moveTo(0, WORLD_HEIGHT * 0.54);
  context.lineTo(WORLD_WIDTH, WORLD_HEIGHT * 0.54);
  context.stroke();
}

function drawPlayer() {
  const { x, y } = game.player;
  if (game.player.shieldTicks > 0) {
    context.strokeStyle = '#8bf3ff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 20, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = '#f2f8ff';
  context.beginPath();
  context.moveTo(x, y - PLAYER_HEIGHT / 2 - 3);
  context.lineTo(x - PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
  context.lineTo(x - 4, y + 4);
  context.lineTo(x + 4, y + 4);
  context.lineTo(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT / 2);
  context.closePath();
  context.fill();
  context.fillStyle = '#63d9ff';
  context.fillRect(x - 3, y + 5, 6, 8);
}

function drawEnemy(enemy) {
  const spec = enemySpec(enemy.type);
  context.save();
  context.translate(enemy.x, enemy.y);
  if (enemy.type === 'scout') {
    context.fillStyle = '#ff8e9d';
    context.beginPath();
    context.moveTo(0, spec.height / 2);
    context.lineTo(-spec.width / 2, -spec.height / 2);
    context.lineTo(0, -3);
    context.lineTo(spec.width / 2, -spec.height / 2);
    context.closePath();
    context.fill();
  } else if (enemy.type === 'tank') {
    context.fillStyle = '#ffd477';
    context.fillRect(-spec.width / 2, -spec.height / 2, spec.width, spec.height);
    context.fillStyle = '#442d05';
    context.fillRect(-5, -spec.height / 2 - 4, 10, 8);
  } else {
    context.fillStyle = '#c89bff';
    context.beginPath();
    context.moveTo(0, -spec.height / 2);
    context.lineTo(spec.width / 2, 0);
    context.lineTo(0, spec.height / 2);
    context.lineTo(-spec.width / 2, 0);
    context.closePath();
    context.fill();
    context.strokeStyle = '#fff';
    context.stroke();
  }
  if (enemy.maxHp > 1) {
    context.fillStyle = '#351e00';
    context.fillRect(-12, spec.height / 2 + 4, 24, 3);
    context.fillStyle = '#fff0a7';
    context.fillRect(-12, spec.height / 2 + 4, 24 * (enemy.hp / enemy.maxHp), 3);
  }
  context.restore();
}

function render() {
  drawBackground();
  for (const enemy of game.enemies) drawEnemy(enemy);

  context.fillStyle = '#9deaff';
  for (const bullet of game.bullets) context.fillRect(bullet.x - 1.5, bullet.y - 7, 3, 12);
  context.fillStyle = '#ff6b80';
  for (const bullet of game.enemyBullets) context.fillRect(bullet.x - 2, bullet.y - 4, 4, 9);

  for (const powerUp of game.powerUps) {
    context.fillStyle = powerUp.type === 'shield' ? '#7ef0ff' : powerUp.type === 'spread' ? '#b98cff' : '#ffe477';
    context.fillRect(powerUp.x - 8, powerUp.y - 8, 16, 16);
    context.fillStyle = '#08111f';
    context.font = 'bold 10px ui-monospace, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(powerUp.type === 'shield' ? 'S' : powerUp.type === 'spread' ? '3' : 'R', powerUp.x, powerUp.y + 0.5);
  }

  drawPlayer();
  updateMeta();
}

function setGame(next) {
  game = next;
  if (game.status === 'gameover' || game.status === 'won') held.clear();
  render();
}

function restart() {
  held.clear();
  setGame(restartRun());
  canvas.focus({ preventScroll: true });
}

function pause() {
  held.clear();
  setGame(togglePause(game));
}

restartButton.addEventListener('click', restart);
pauseButton.addEventListener('click', pause);

function bindHeldButton(button, token, onPress) {
  const release = () => {
    held.delete(token);
    render();
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    held.add(token);
    button.setPointerCapture?.(event.pointerId);
    if (onPress) game = onPress(game);
    render();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

for (const button of directionButtons) {
  bindHeldButton(button, button.dataset.direction, (state) => movePlayer(state, button.dataset.direction, 10));
}
bindHeldButton(fireButton, 'fire', (state) => firePlayer(state));

const keyDirection = new Map([
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
]);

document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
  const direction = keyDirection.get(event.key);
  if (direction) {
    event.preventDefault();
    held.add(direction);
    game = movePlayer(game, direction);
    render();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    held.add('fire');
    game = firePlayer(game);
    render();
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
  if (event.code === 'Space') held.delete('fire');
  render();
});

function clearInputsAndPause() {
  held.clear();
  if (game.status === 'running') game = togglePause(game);
  render();
}
window.addEventListener('blur', clearInputsAndPause);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') clearInputsAndPause();
});

function pointerToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
  };
}
function dragShip(event) {
  if (game.status !== 'running') return;
  const point = pointerToWorld(event);
  if (point.y < WORLD_HEIGHT * 0.54) return;
  event.preventDefault();
  game = setPlayerPosition(game, point.x, point.y);
  render();
}
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  dragShip(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.buttons || event.pointerType === 'touch') dragShip(event);
});

function frame(now) {
  const elapsed = Math.min(80, Math.max(0, now - lastFrame));
  lastFrame = now;
  accumulator += elapsed;
  let changed = false;
  while (accumulator >= FRAME_MS) {
    if (game.status === 'running') {
      if (held.has('left') && !held.has('right')) game = movePlayer(game, 'left');
      if (held.has('right') && !held.has('left')) game = movePlayer(game, 'right');
      if (held.has('up') && !held.has('down')) game = movePlayer(game, 'up');
      if (held.has('down') && !held.has('up')) game = movePlayer(game, 'down');
      if (held.has('fire')) game = firePlayer(game);
      const next = stepGame(game);
      if (next !== game) game = next;
      if (game.status === 'gameover' || game.status === 'won') held.clear();
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
