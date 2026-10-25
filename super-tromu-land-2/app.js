import { connectionStatus } from '../connectivity.js';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  QUEST,
  attack,
  createGame,
  enemiesInZone,
  getZone,
  interact,
  movePlayer,
  questObjective,
  questStep,
} from './game.js';
import { staticBlockSet } from './world.js';
import { clearGame, getSafeStorage, loadGame, saveGame } from './storage.js';

const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const areaName = document.querySelector('#area-name');
const hearts = document.querySelector('#hearts');
const questStepElement = document.querySelector('#quest-step');
const questObjectiveElement = document.querySelector('#quest-objective');
const connectionElement = document.querySelector('#connection-status');
const statusElement = document.querySelector('#game-status');
const attackButton = document.querySelector('#attack-button');
const actionButton = document.querySelector('#action-button');
const newGameButton = document.querySelector('#new-game');
const moveButtons = [...document.querySelectorAll('[data-move]')];
const inventoryItems = [...document.querySelectorAll('[data-item]')];

const storage = getSafeStorage(window);
let game = loadGame(storage);
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

const TILE = canvas.width / GRID_WIDTH;
const PALETTES = Object.freeze({
  village: ['#d7dea1', '#a8b86f', '#557448', '#142b20'],
  meadow: ['#d3d996', '#95ad60', '#466842', '#13291e'],
  shrine: ['#cbd3a0', '#879b68', '#465943', '#18231d'],
});

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function fillTile(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function drawGround(zone, palette) {
  context.fillStyle = palette[0];
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if ((x + y) % 2 === 0) {
        context.fillStyle = `${palette[1]}55`;
        context.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
  if (zone.id === 'shrine') {
    context.strokeStyle = palette[2];
    context.lineWidth = 1;
    for (let x = 1; x < GRID_WIDTH; x += 2) {
      context.beginPath();
      context.moveTo(x * TILE, 0);
      context.lineTo(x * TILE, canvas.height);
      context.stroke();
    }
  }
}

function drawDecor(zone, palette) {
  for (const decor of zone.decor) {
    const cx = decor.x * TILE + TILE / 2;
    const cy = decor.y * TILE + TILE / 2;
    context.fillStyle = palette[2];
    if (decor.kind === 'flower') {
      context.fillRect(cx - 1, cy - 4, 2, 8);
      context.fillRect(cx - 4, cy - 1, 8, 2);
    } else if (decor.kind === 'rune-floor') {
      context.strokeStyle = palette[2];
      context.strokeRect(decor.x * TILE + 3, decor.y * TILE + 3, TILE - 6, TILE - 6);
    } else {
      context.fillRect(cx - 4, cy, 2, 5);
      context.fillRect(cx, cy - 2, 2, 7);
      context.fillRect(cx + 4, cy + 1, 2, 4);
    }
  }
}

function drawObstacles(zone, palette) {
  const obstacles = staticBlockSet(zone.id);
  for (const key of obstacles) {
    const [x, y] = key.split(',').map(Number);
    fillTile(x, y, palette[2]);
    context.fillStyle = palette[3];
    context.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
    context.fillStyle = palette[1];
    context.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, 3);
  }
}

function drawPortals(zone, palette) {
  for (const portal of zone.portals) {
    context.fillStyle = palette[1];
    context.fillRect(portal.x * TILE + 2, portal.y * TILE + 2, TILE - 4, TILE - 4);
    context.fillStyle = palette[3];
    context.fillRect(portal.x * TILE + 6, portal.y * TILE + 2, 4, TILE - 4);
  }
}

function drawNPC(npc, palette) {
  const px = npc.x * TILE;
  const py = npc.y * TILE;
  context.fillStyle = palette[3];
  context.fillRect(px + 5, py + 3, 6, 5);
  context.fillRect(px + 4, py + 8, 8, 6);
  context.fillStyle = palette[0];
  context.fillRect(px + 7, py + 4, 2, 2);
  context.fillStyle = palette[1];
  context.fillRect(px + 5, py + 10, 2, 3);
  context.fillRect(px + 9, py + 10, 2, 3);
}

function drawObject(object, palette) {
  const px = object.x * TILE;
  const py = object.y * TILE;
  const activeRune = game.activatedRunes.includes(object.id);
  context.lineWidth = 2;
  switch (object.kind) {
    case 'chest':
      context.fillStyle = game.chestOpened ? palette[1] : palette[3];
      context.fillRect(px + 2, py + 5, TILE - 4, TILE - 8);
      context.fillStyle = palette[0];
      context.fillRect(px + 6, py + 8, 4, 3);
      break;
    case 'well':
      context.strokeStyle = palette[3];
      context.strokeRect(px + 3, py + 4, TILE - 6, TILE - 7);
      context.fillStyle = palette[2];
      context.fillRect(px + 5, py + 7, TILE - 10, 4);
      break;
    case 'gate':
      context.fillStyle = palette[3];
      context.fillRect(px + 2, py + 1, 3, TILE - 2);
      context.fillRect(px + 7, py + 1, 3, TILE - 2);
      context.fillRect(px + 12, py + 1, 2, TILE - 2);
      break;
    case 'sign':
      context.fillStyle = palette[3];
      context.fillRect(px + 3, py + 3, TILE - 6, 7);
      context.fillRect(px + 7, py + 10, 2, 5);
      break;
    case 'rune':
      context.strokeStyle = palette[3];
      context.fillStyle = activeRune ? palette[3] : palette[1];
      context.beginPath();
      context.moveTo(px + 8, py + 2);
      context.lineTo(px + 14, py + 8);
      context.lineTo(px + 8, py + 14);
      context.lineTo(px + 2, py + 8);
      context.closePath();
      context.fill();
      if (activeRune) {
        context.fillStyle = palette[0];
        context.fillRect(px + 7, py + 5, 2, 6);
      }
      break;
    case 'altar':
      context.fillStyle = palette[3];
      context.fillRect(px + 2, py + 8, TILE - 4, 6);
      context.fillStyle = palette[2];
      context.fillRect(px + 5, py + 5, TILE - 10, 3);
      if (game.quest >= QUEST.CLAIM_CORE && !game.inventory.core) {
        context.fillStyle = palette[0];
        context.fillRect(px + 6, py + 1, 4, 4);
        context.fillStyle = palette[3];
        context.fillRect(px + 7, py + 2, 2, 2);
      }
      break;
    default:
      break;
  }
}

function drawEnemy(enemy, palette) {
  const px = enemy.x * TILE;
  const py = enemy.y * TILE;
  context.fillStyle = palette[3];
  if (enemy.kind === 'guardian') {
    context.fillRect(px + 3, py + 3, 10, 10);
    context.fillStyle = palette[1];
    context.fillRect(px + 5, py + 5, 2, 2);
    context.fillRect(px + 9, py + 5, 2, 2);
    context.fillStyle = palette[0];
    for (let index = 0; index < enemy.hp; index += 1) context.fillRect(px + 3 + index * 4, py + 14, 3, 1);
  } else {
    context.beginPath();
    context.moveTo(px + 8, py + 2);
    context.lineTo(px + 14, py + 8);
    context.lineTo(px + 8, py + 14);
    context.lineTo(px + 2, py + 8);
    context.closePath();
    context.fill();
    context.fillStyle = palette[0];
    context.fillRect(px + 7, py + 6, 2, 2);
  }
}

function drawPlayer(palette) {
  const { x, y, facing } = game.player;
  const px = x * TILE;
  const py = y * TILE;
  context.fillStyle = palette[3];
  context.fillRect(px + 5, py + 3, 6, 5);
  context.fillRect(px + 4, py + 8, 8, 6);
  context.fillStyle = palette[0];
  const eye = {
    up: [7, 4], down: [7, 6], left: [5, 5], right: [9, 5],
  }[facing];
  context.fillRect(px + eye[0], py + eye[1], 2, 2);
  if (game.inventory.blade) {
    context.fillStyle = palette[2];
    if (facing === 'left') context.fillRect(px, py + 9, 5, 2);
    if (facing === 'right') context.fillRect(px + 11, py + 9, 5, 2);
    if (facing === 'up') context.fillRect(px + 10, py, 2, 5);
    if (facing === 'down') context.fillRect(px + 10, py + 11, 2, 5);
  }
}

function renderCanvas() {
  const zone = getZone(game.zoneId);
  const palette = PALETTES[zone.palette] ?? PALETTES.village;
  context.imageSmoothingEnabled = false;
  drawGround(zone, palette);
  drawDecor(zone, palette);
  drawPortals(zone, palette);
  drawObstacles(zone, palette);
  for (const object of zone.objects) drawObject(object, palette);
  for (const npc of zone.npcs) drawNPC(npc, palette);
  for (const enemy of enemiesInZone(game)) drawEnemy(enemy, palette);
  drawPlayer(palette);

  const leafKills = game.defeated.filter((id) => id.startsWith('leaf-')).length;
  const guardian = game.enemies.find((enemy) => enemy.id === 'guardian');
  canvas.dataset.zone = game.zoneId;
  canvas.dataset.quest = String(game.quest);
  canvas.dataset.playerX = String(game.player.x);
  canvas.dataset.playerY = String(game.player.y);
  canvas.dataset.facing = game.player.facing;
  canvas.dataset.hearts = String(game.player.hearts);
  canvas.dataset.blade = String(game.inventory.blade);
  canvas.dataset.seal = String(game.inventory.seal);
  canvas.dataset.core = String(game.inventory.core);
  canvas.dataset.leafKills = String(leafKills);
  canvas.dataset.runes = String(game.activatedRunes.length);
  canvas.dataset.guardianHp = String(guardian?.hp ?? 0);
  canvas.dataset.status = game.status;
  canvas.setAttribute('aria-label', `${zone.name}. ${questObjective(game)} ${game.player.hearts} von ${game.player.maxHearts} Herzen.`);
}

function renderInventory() {
  for (const element of inventoryItems) {
    const owned = Boolean(game.inventory[element.dataset.item]);
    element.dataset.owned = String(owned);
    const label = { blade: 'Klinge', seal: 'Siegel', core: 'Kern' }[element.dataset.item];
    element.textContent = `${label} ${owned ? '●' : '○'}`;
  }
}

function render() {
  const zone = getZone(game.zoneId);
  renderCanvas();
  renderInventory();
  areaName.textContent = zone.name;
  hearts.textContent = '♥'.repeat(game.player.hearts) + '♡'.repeat(game.player.maxHearts - game.player.hearts);
  hearts.setAttribute('aria-label', `${game.player.hearts} von ${game.player.maxHearts} Herzen`);
  questStepElement.textContent = questStep(game);
  questObjectiveElement.textContent = questObjective(game);
  statusElement.textContent = game.message || questObjective(game);
  const disabled = game.status === 'completed';
  for (const button of moveButtons) button.disabled = disabled;
  actionButton.disabled = disabled;
  attackButton.disabled = disabled || !game.inventory.blade;
}

function commit(next) {
  game = next;
  saveGame(storage, game);
  render();
}

function move(direction) {
  commit(movePlayer(game, direction));
}

function doAction() {
  commit(interact(game));
}

function doAttack() {
  commit(attack(game));
}

for (const button of moveButtons) button.addEventListener('click', () => {
  move(button.dataset.move);
  canvas.focus({ preventScroll: true });
});
actionButton.addEventListener('click', () => {
  doAction();
  canvas.focus({ preventScroll: true });
});
attackButton.addEventListener('click', () => {
  doAttack();
  canvas.focus({ preventScroll: true });
});
newGameButton.addEventListener('click', () => {
  clearGame(storage);
  game = createGame();
  saveGame(storage, game);
  render();
  canvas.focus({ preventScroll: true });
});

const keyMoves = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right'],
]);

document.addEventListener('keydown', (event) => {
  const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea');
  if (interactive) return;
  const direction = keyMoves.get(event.key);
  if (direction) {
    event.preventDefault();
    move(direction);
    return;
  }
  if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
    event.preventDefault();
    doAction();
  } else if (event.key === 'x' || event.key === 'X' || event.key === 'k' || event.key === 'K' || event.code === 'Space') {
    event.preventDefault();
    doAttack();
  } else if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    newGameButton.click();
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

updateConnection();
render();
