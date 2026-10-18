import { connectionStatus } from '../connectivity.js';
import {
  RANKS, SUITS, SUIT_NAMES, canMove, cardColor, cardSuit, createSession, playMove, selectedCards, undo,
} from './game.js';
import {
  getSafeStorage, loadSession, loadStats, recordAttempt, recordWin, saveSession, saveStats,
} from './storage.js';

const SYMBOLS = Object.freeze({ C: '♣', D: '♦', H: '♥', S: '♠' });
const RANK_NAMES = Object.freeze({ A: 'Ass', J: 'Bube', Q: 'Dame', K: 'König' });

const freecellsElement = document.querySelector('#freecells');
const foundationsElement = document.querySelector('#foundations');
const cascadesElement = document.querySelector('#cascades');
const controlsForm = document.querySelector('#deal-controls');
const seedInput = document.querySelector('#deal-seed');
const newDealButton = document.querySelector('#new-deal');
const restartButton = document.querySelector('#restart-deal');
const undoButton = document.querySelector('#undo-move');
const dealElement = document.querySelector('#deal-number');
const moveElement = document.querySelector('#move-count');
const recordElement = document.querySelector('#record');
const statusElement = document.querySelector('#game-status');
const connectionElement = document.querySelector('#connection-status');

const storage = getSafeStorage(window);
let stats = loadStats(storage);
let session = loadSession(storage);
if (!session) {
  session = createSession(1);
  stats = recordAttempt(stats);
  saveStats(storage, stats);
  saveSession(storage, session);
}
let selection = null;
let transientStatus = '';
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);

function rankLabel(card) {
  const rank = card.slice(0, -1);
  return RANK_NAMES[rank] ?? rank;
}

function cardLabel(card) {
  return `${rankLabel(card)} ${SUIT_NAMES[cardSuit(card)]}`;
}

function cardMarkup(card) {
  const rank = card.slice(0, -1);
  return `<span class="card-rank">${rank}</span><span class="card-suit" aria-hidden="true">${SYMBOLS[cardSuit(card)]}</span>`;
}

function updateConnection() {
  const online = navigator.onLine !== false;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.ready = String(offlineReady);
  connectionElement.dataset.warning = String(offlineError || (!online && !offlineReady));
}

function selectionText() {
  if (!selection) return '';
  const cards = selectedCards(session.game, selection);
  if (!cards.length) return '';
  return cards.length === 1 ? `${cardLabel(cards[0])} gewählt. Ziel wählen.` : `${cards.length} Karten gewählt. Ziel wählen.`;
}

function statusText() {
  if (session.game.status === 'won') return `Gewonnen in ${session.game.moves} Zügen. Deal ${session.game.seed} bleibt reproduzierbar.`;
  return transientStatus || selectionText() || 'Wähle eine Karte oder gültige absteigende Rot/Schwarz-Folge und danach ihr Ziel.';
}

function sourceEquals(source) {
  if (!selection || selection.zone !== source.zone || selection.index !== source.index) return false;
  return source.zone !== 'cascade' || selection.cardIndex === source.cardIndex;
}

function targetValidity(target) {
  return selection ? canMove(session.game, selection, target) : false;
}

function installDropTarget(element, target) {
  element.dataset.valid = String(targetValidity(target));
  element.addEventListener('dragover', (event) => {
    if (!targetValidity(target)) return;
    event.preventDefault();
  });
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    applyTarget(target);
  });
}

function selectSource(source) {
  const cards = selectedCards(session.game, source);
  if (!cards.length) {
    transientStatus = 'Diese Karten bilden keine gültige absteigende Rot/Schwarz-Folge.';
    selection = null;
  } else {
    selection = source;
    transientStatus = '';
  }
  render();
}

function applyTarget(target) {
  if (!selection) return false;
  const before = session;
  const next = playMove(session, selection, target);
  if (next === before) {
    transientStatus = 'Dieses Ziel ist für die Auswahl nicht erlaubt.';
    renderStatus();
    return false;
  }
  session = next;
  selection = null;
  transientStatus = '';
  if (session.game.status === 'won' && !session.winRecorded) {
    stats = recordWin(stats);
    session = { ...session, winRecorded: true };
    saveStats(storage, stats);
  }
  saveSession(storage, session);
  render();
  return true;
}

function handleFreecell(index) {
  const card = session.game.freecells[index];
  const source = { zone: 'freecell', index };
  if (selection) {
    if (sourceEquals(source)) {
      selection = null;
      transientStatus = 'Auswahl aufgehoben.';
      render();
      return;
    }
    if (applyTarget(source)) return;
    if (!card) return;
  }
  if (card) selectSource(source);
}

function handleCascadeCard(cascadeIndex, cardIndex) {
  const source = { zone: 'cascade', index: cascadeIndex, cardIndex };
  if (selection) {
    if (selection.zone === 'cascade' && selection.index === cascadeIndex) {
      if (sourceEquals(source)) selection = null;
      else selection = source;
      transientStatus = '';
      render();
      return;
    }
    if (applyTarget({ zone: 'cascade', index: cascadeIndex })) return;
  }
  selectSource(source);
}

function cardDragStart(event, source) {
  const cards = selectedCards(session.game, source);
  if (!cards.length) {
    event.preventDefault();
    return;
  }
  selection = source;
  transientStatus = '';
  event.dataTransfer?.setData('text/plain', cards.join(','));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  renderStatus();
}

function renderFreecells() {
  freecellsElement.replaceChildren();
  session.game.freecells.forEach((card, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = card ? 'slot card-slot' : 'slot';
    button.dataset.zone = 'freecell';
    button.dataset.index = String(index);
    button.dataset.selected = String(sourceEquals({ zone: 'freecell', index }));
    button.setAttribute('aria-label', card ? `Freie Zelle ${index + 1}: ${cardLabel(card)}` : `Freie Zelle ${index + 1}: leer`);
    if (card) {
      button.dataset.card = card;
      button.dataset.color = cardColor(card);
      button.innerHTML = `<span class="slot-card">${cardMarkup(card)}</span>`;
      button.draggable = true;
      button.addEventListener('dragstart', (event) => cardDragStart(event, { zone: 'freecell', index }));
    } else {
      button.textContent = 'FREE';
    }
    button.addEventListener('click', () => handleFreecell(index));
    installDropTarget(button, { zone: 'freecell', index });
    freecellsElement.append(button);
  });
}

function renderFoundations() {
  foundationsElement.replaceChildren();
  SUITS.forEach((suit) => {
    const rank = session.game.foundations[suit];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot foundation';
    button.dataset.zone = 'foundation';
    button.dataset.suit = suit;
    button.dataset.color = ['D', 'H'].includes(suit) ? 'red' : 'black';
    button.setAttribute('aria-label', `${SUIT_NAMES[suit]}-Ablage: ${rank === 0 ? 'leer' : rankLabel(`${RANKS[rank - 1]}${suit}`)}`);
    button.innerHTML = `<span class="foundation-symbol" aria-hidden="true">${SYMBOLS[suit]}</span><span class="foundation-rank">${rank === 0 ? 'A–K' : RANKS[rank - 1]}</span>`;
    button.addEventListener('click', () => applyTarget({ zone: 'foundation', suit }));
    installDropTarget(button, { zone: 'foundation', suit });
    foundationsElement.append(button);
  });
}

function renderCascades() {
  cascadesElement.replaceChildren();
  session.game.cascades.forEach((cascade, cascadeIndex) => {
    const column = document.createElement('div');
    column.className = 'cascade';
    column.id = `cascade-${cascadeIndex}`;
    column.dataset.count = String(cascade.length);

    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'column-target';
    target.textContent = `C${cascadeIndex + 1}`;
    target.setAttribute('aria-label', `Ziel Kartenreihe ${cascadeIndex + 1}${cascade.length ? `, oben ${cardLabel(cascade.at(-1))}` : ', leer'}`);
    target.addEventListener('click', () => applyTarget({ zone: 'cascade', index: cascadeIndex }));
    installDropTarget(target, { zone: 'cascade', index: cascadeIndex });
    column.append(target);

    const stack = document.createElement('div');
    stack.className = 'card-stack';
    cascade.forEach((card, cardIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      button.dataset.zone = 'cascade';
      button.dataset.index = String(cascadeIndex);
      button.dataset.cardIndex = String(cardIndex);
      button.dataset.card = card;
      button.dataset.color = cardColor(card);
      const selected = selection?.zone === 'cascade' && selection.index === cascadeIndex && cardIndex >= selection.cardIndex;
      button.dataset.selected = String(Boolean(selected));
      button.setAttribute('aria-label', `${cardLabel(card)}, Kartenreihe ${cascadeIndex + 1}, Position ${cardIndex + 1} von ${cascade.length}`);
      button.innerHTML = cardMarkup(card);
      button.draggable = true;
      const source = { zone: 'cascade', index: cascadeIndex, cardIndex };
      button.addEventListener('click', () => handleCascadeCard(cascadeIndex, cardIndex));
      button.addEventListener('dragstart', (event) => cardDragStart(event, source));
      stack.append(button);
    });
    column.append(stack);
    cascadesElement.append(column);
  });
}

function renderMeta() {
  dealElement.textContent = String(session.game.seed);
  moveElement.textContent = String(session.game.moves);
  recordElement.textContent = `${stats.wins} / ${stats.attempts}`;
  seedInput.value = String(session.game.seed);
  undoButton.disabled = session.history.length === 0;
  undoButton.textContent = session.history.length ? `Undo · ${session.history.length}` : 'Undo';
  cascadesElement.dataset.seed = String(session.game.seed);
  cascadesElement.dataset.status = session.game.status;
  cascadesElement.dataset.moves = String(session.game.moves);
  cascadesElement.dataset.history = String(session.history.length);
}

function renderStatus() {
  statusElement.textContent = statusText();
}

function render() {
  renderFreecells();
  renderFoundations();
  renderCascades();
  renderMeta();
  renderStatus();
}

function normalizeSeed(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) return null;
  return parsed >>> 0;
}

function startDeal(seed) {
  session = createSession(seed);
  stats = recordAttempt(stats);
  selection = null;
  transientStatus = `Deal ${session.game.seed} gestartet.`;
  saveStats(storage, stats);
  saveSession(storage, session);
  render();
}

controlsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const seed = normalizeSeed(seedInput.value);
  if (seed === null) {
    transientStatus = 'Seed muss eine ganze Zahl zwischen 0 und 4294967295 sein.';
    renderStatus();
    seedInput.focus();
    return;
  }
  startDeal(seed);
});

newDealButton.addEventListener('click', () => startDeal(((session.game.seed + 1) >>> 0) || 1));
restartButton.addEventListener('click', () => startDeal(session.game.seed));
undoButton.addEventListener('click', () => {
  const next = undo(session);
  if (next === session) return;
  session = next;
  selection = null;
  transientStatus = 'Letzten Zug rückgängig gemacht.';
  saveSession(storage, session);
  render();
});

document.addEventListener('keydown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.matches('input')) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoButton.click();
    return;
  }
  if (event.key === 'Escape' && selection) {
    event.preventDefault();
    selection = null;
    transientStatus = 'Auswahl aufgehoben.';
    render();
    return;
  }
  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    newDealButton.click();
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    restartButton.click();
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
