import { connectionStatus } from '../connectivity.js';
import { wrappedDialogFocusTarget } from '../dialog.js';
import {
  conflictIndexes,
  getPuzzle,
  isSolved,
  peerIndexes,
  puzzlesForDifficulty,
  relatedIndexes,
} from './game.js';

const STORAGE_KEY = 'sudoku-state-v1';
const MAX_HISTORY = 50;

const appShell = document.querySelector('#app-shell');
const gridElement = document.querySelector('#sudoku-grid');
const timerElement = document.querySelector('#timer');
const mistakesElement = document.querySelector('#mistakes');
const difficultyElement = document.querySelector('#difficulty');
const newGameButton = document.querySelector('#new-game');
const notesButton = document.querySelector('#notes-mode');
const eraseButton = document.querySelector('#erase');
const undoButton = document.querySelector('#undo');
const connectionElement = document.querySelector('#connection-status');
const statusElement = document.querySelector('#sudoku-status');
const overlay = document.querySelector('#completion-overlay');
const overlayMessage = document.querySelector('#completion-message');
const overlayNewGameButton = document.querySelector('#overlay-new-game');
const overlayActions = [...overlay.querySelectorAll('button, a[href]')];
const numberButtons = [...document.querySelectorAll('[data-number]')];

let history = [];
let statusTimer = null;
let offlineReady = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
let offlineError = !('serviceWorker' in navigator);
let state = restoreState() ?? freshState('easy');

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cloneNotes(notes) {
  return notes.map((entry) => [...entry]);
}

function normalizeNotes(notes, values) {
  if (!Array.isArray(notes) || notes.length !== 81) return null;
  const normalized = [];
  for (let index = 0; index < 81; index += 1) {
    if (!Array.isArray(notes[index])) return null;
    const digits = [...new Set(notes[index])]
      .filter((digit) => Number.isInteger(digit) && digit >= 1 && digit <= 9)
      .sort((a, b) => a - b);
    normalized.push(values[index] ? [] : digits);
  }
  return normalized;
}

function firstEditableIndex(puzzle) {
  const index = puzzle.values.findIndex((value) => value === 0);
  return index >= 0 ? index : 0;
}

function freshState(difficulty, previousPuzzleId = null) {
  const options = puzzlesForDifficulty(difficulty);
  const previousIndex = options.findIndex((puzzle) => puzzle.id === previousPuzzleId);
  const puzzle = options[previousIndex >= 0 ? (previousIndex + 1) % options.length : 0];

  return {
    version: 1,
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    values: [...puzzle.values],
    notes: Array.from({ length: 81 }, () => []),
    selected: firstEditableIndex(puzzle),
    notesMode: false,
    mistakes: 0,
    elapsedSeconds: 0,
    completed: false,
  };
}

function restoreState() {
  const storage = safeStorage();
  if (!storage) return null;

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!parsed || parsed.version !== 1) return null;
    const puzzle = getPuzzle(parsed.puzzleId);
    if (!puzzle || parsed.difficulty !== puzzle.difficulty) return null;
    if (!Array.isArray(parsed.values) || parsed.values.length !== 81) return null;

    const values = parsed.values.map(Number);
    if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 9)) return null;
    if (!puzzle.values.every((given, index) => given === 0 || values[index] === given)) return null;

    const notes = normalizeNotes(parsed.notes, values);
    if (!notes) return null;

    const selected = Number.isInteger(parsed.selected) && parsed.selected >= 0 && parsed.selected < 81
      ? parsed.selected
      : firstEditableIndex(puzzle);

    return {
      version: 1,
      puzzleId: puzzle.id,
      difficulty: puzzle.difficulty,
      values,
      notes,
      selected,
      notesMode: Boolean(parsed.notesMode),
      mistakes: Number.isInteger(parsed.mistakes) && parsed.mistakes >= 0 ? parsed.mistakes : 0,
      elapsedSeconds: Number.isInteger(parsed.elapsedSeconds) && parsed.elapsedSeconds >= 0 ? parsed.elapsedSeconds : 0,
      completed: isSolved(values, puzzle),
    };
  } catch {
    return null;
  }
}

function persistState() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage ist optional; das Spiel bleibt ohne Persistenz vollständig nutzbar.
  }
}

function currentPuzzle() {
  return getPuzzle(state.puzzleId);
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function announce(message) {
  window.clearTimeout(statusTimer);
  statusElement.textContent = '';
  statusTimer = window.setTimeout(() => {
    statusElement.textContent = message;
  }, 0);
}

function ensureGrid() {
  const existingRows = gridElement.querySelectorAll('.sudoku-row');
  const existingCells = gridElement.querySelectorAll('.sudoku-cell');
  if (existingRows.length === 9 && existingCells.length === 81) return;

  const fragment = document.createDocumentFragment();
  for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
    const row = document.createElement('div');
    row.className = 'sudoku-row';
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(rowIndex + 1));

    for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
      const index = rowIndex * 9 + columnIndex;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sudoku-cell';
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String(rowIndex + 1));
      cell.setAttribute('aria-colindex', String(columnIndex + 1));
      row.append(cell);
    }
    fragment.append(row);
  }
  gridElement.replaceChildren(fragment);
}

function renderNotes(cell, notes) {
  const noteGrid = document.createElement('span');
  noteGrid.className = 'notes-grid';
  noteGrid.setAttribute('aria-hidden', 'true');
  for (let digit = 1; digit <= 9; digit += 1) {
    const note = document.createElement('span');
    note.textContent = notes.includes(digit) ? String(digit) : '';
    noteGrid.append(note);
  }
  cell.replaceChildren(noteGrid);
}

function cellLabel(index, value, given, wrong, notes) {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  if (given) return `Zeile ${row}, Spalte ${column}: Vorgabe ${value}`;
  if (value) return `Zeile ${row}, Spalte ${column}: ${value}${wrong ? ', nicht korrekt' : ''}`;
  if (notes.length) return `Zeile ${row}, Spalte ${column}: leer, Notizen ${notes.join(', ')}`;
  return `Zeile ${row}, Spalte ${column}: leer`;
}

function renderGrid() {
  ensureGrid();
  const puzzle = currentPuzzle();
  const cells = gridElement.querySelectorAll('.sudoku-cell');
  const duplicateConflicts = conflictIndexes(state.values);
  const related = relatedIndexes(state.selected);
  const selectedValue = state.values[state.selected];

  cells.forEach((cell, index) => {
    const value = state.values[index];
    const given = puzzle.values[index] !== 0;
    const wrong = Boolean(value && !given && value !== puzzle.solvedValues[index]);
    const conflict = duplicateConflicts.has(index) || wrong;
    const same = Boolean(selectedValue && value === selectedValue);

    if (value) cell.textContent = String(value);
    else if (state.notes[index].length) renderNotes(cell, state.notes[index]);
    else cell.replaceChildren();

    cell.dataset.given = String(given);
    cell.dataset.related = String(index !== state.selected && related.has(index));
    cell.dataset.same = String(index !== state.selected && same);
    cell.dataset.conflict = String(conflict);
    cell.dataset.selected = String(index === state.selected);
    cell.setAttribute('aria-selected', String(index === state.selected));
    cell.setAttribute('aria-readonly', String(given));
    cell.setAttribute('aria-label', cellLabel(index, value, given, wrong, state.notes[index]));
    cell.tabIndex = index === state.selected ? 0 : -1;
  });
}

function renderMeta() {
  timerElement.textContent = formatTime(state.elapsedSeconds);
  timerElement.setAttribute('datetime', `PT${state.elapsedSeconds}S`);
  mistakesElement.textContent = String(state.mistakes);
}

function render() {
  renderGrid();
  renderMeta();
  difficultyElement.value = state.difficulty;
  notesButton.setAttribute('aria-pressed', String(state.notesMode));
  undoButton.disabled = history.length === 0;
}

function focusSelected() {
  gridElement.querySelector(`[data-index="${state.selected}"]`)?.focus({ preventScroll: true });
}

function snapshot() {
  history.push({
    values: [...state.values],
    notes: cloneNotes(state.notes),
    mistakes: state.mistakes,
    completed: state.completed,
  });
  if (history.length > MAX_HISTORY) history.shift();
}

function isEditable(index = state.selected) {
  const puzzle = currentPuzzle();
  return !state.completed && puzzle.values[index] === 0;
}

function removePeerNotes(index, digit) {
  for (const peer of peerIndexes(index)) {
    state.notes[peer] = state.notes[peer].filter((note) => note !== digit);
  }
}

function enterNumber(digit) {
  if (!isEditable()) {
    announce('Dieses Feld ist eine feste Vorgabe.');
    return;
  }

  const index = state.selected;
  const puzzle = currentPuzzle();

  if (state.notesMode && state.values[index] === 0) {
    snapshot();
    const notes = state.notes[index];
    state.notes[index] = notes.includes(digit)
      ? notes.filter((note) => note !== digit)
      : [...notes, digit].sort((a, b) => a - b);
    persistState();
    render();
    announce(`Notiz ${digit} ${state.notes[index].includes(digit) ? 'gesetzt' : 'entfernt'}.`);
    return;
  }

  if (state.values[index] === digit) return;

  snapshot();
  state.values[index] = digit;
  state.notes[index] = [];
  removePeerNotes(index, digit);
  if (digit !== puzzle.solvedValues[index]) state.mistakes += 1;
  state.completed = isSolved(state.values, puzzle);
  persistState();
  render();

  if (state.completed) {
    showCompletion();
    return;
  }

  announce(digit === puzzle.solvedValues[index] ? `${digit} eingetragen.` : `${digit} ist an dieser Stelle nicht korrekt.`);
}

function eraseSelected() {
  if (!isEditable()) return;
  const index = state.selected;
  if (!state.values[index] && state.notes[index].length === 0) return;
  snapshot();
  state.values[index] = 0;
  state.notes[index] = [];
  state.completed = false;
  persistState();
  render();
  announce('Feld geleert.');
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  state.values = previous.values;
  state.notes = previous.notes;
  state.mistakes = previous.mistakes;
  state.completed = previous.completed;
  if (!state.completed) hideCompletion();
  persistState();
  render();
  focusSelected();
  announce('Letzte Änderung rückgängig gemacht.');
}

function startNewGame(difficulty = state.difficulty, previousPuzzleId = state.puzzleId) {
  state = freshState(difficulty, previousPuzzleId);
  history = [];
  hideCompletion();
  persistState();
  render();
  focusSelected();
  announce(`Neue ${difficultyElement.options[difficultyElement.selectedIndex]?.text ?? ''}-Aufgabe gestartet.`);
}

function showCompletion() {
  const labels = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };
  appShell.inert = true;
  overlay.hidden = false;
  overlayMessage.textContent = `${labels[state.difficulty]} in ${formatTime(state.elapsedSeconds)} mit ${state.mistakes} ${state.mistakes === 1 ? 'Fehler' : 'Fehlern'} gelöst.`;
  overlayNewGameButton.focus();
  announce('Sudoku gelöst.');
}

function hideCompletion() {
  overlay.hidden = true;
  appShell.inert = false;
}

function selectCell(index, focus = true) {
  if (!Number.isInteger(index) || index < 0 || index >= 81) return;
  state.selected = index;
  persistState();
  render();
  if (focus) focusSelected();
}

function moveSelection(key) {
  const row = Math.floor(state.selected / 9);
  const column = state.selected % 9;
  let nextRow = row;
  let nextColumn = column;
  if (key === 'ArrowUp') nextRow = Math.max(0, row - 1);
  if (key === 'ArrowDown') nextRow = Math.min(8, row + 1);
  if (key === 'ArrowLeft') nextColumn = Math.max(0, column - 1);
  if (key === 'ArrowRight') nextColumn = Math.min(8, column + 1);
  selectCell(nextRow * 9 + nextColumn);
}

function handleCellKeydown(event) {
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    enterNumber(Number(event.key));
    return;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    eraseSelected();
    return;
  }
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    state.notesMode = !state.notesMode;
    persistState();
    render();
    announce(`Notizenmodus ${state.notesMode ? 'aktiv' : 'aus'}.`);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    moveSelection(event.key);
  }
}

gridElement.addEventListener('click', (event) => {
  const cell = event.target.closest('.sudoku-cell');
  if (!cell) return;
  selectCell(Number(cell.dataset.index));
});

gridElement.addEventListener('keydown', (event) => {
  const cell = event.target.closest('.sudoku-cell');
  if (!cell) return;
  state.selected = Number(cell.dataset.index);
  handleCellKeydown(event);
});

numberButtons.forEach((button) => {
  button.addEventListener('click', () => enterNumber(Number(button.dataset.number)));
});

notesButton.addEventListener('click', () => {
  state.notesMode = !state.notesMode;
  persistState();
  render();
  announce(`Notizenmodus ${state.notesMode ? 'aktiv' : 'aus'}.`);
});

eraseButton.addEventListener('click', eraseSelected);
undoButton.addEventListener('click', undo);
newGameButton.addEventListener('click', () => startNewGame());
overlayNewGameButton.addEventListener('click', () => startNewGame());

overlay.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const target = wrappedDialogFocusTarget(overlayActions, document.activeElement, event.shiftKey);
  if (!target) return;
  event.preventDefault();
  target.focus();
});

difficultyElement.addEventListener('change', () => {
  startNewGame(difficultyElement.value, null);
});

function updateConnectionStatus() {
  const online = navigator.onLine;
  connectionElement.textContent = connectionStatus({ online, offlineReady, offlineError });
  connectionElement.dataset.offline = String(!online);
  connectionElement.dataset.offlineReady = String(offlineReady);
  connectionElement.dataset.offlineError = String(offlineError);
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('beforeunload', persistState);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistState();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    offlineReady = Boolean(navigator.serviceWorker.controller);
    if (offlineReady) offlineError = false;
    updateConnectionStatus();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('../sw.js');
      registration.update().catch(() => {});
      await navigator.serviceWorker.ready;
      offlineReady = true;
      offlineError = false;
      updateConnectionStatus();
    } catch (error) {
      offlineReady = false;
      offlineError = true;
      updateConnectionStatus();
      console.warn('Service Worker konnte nicht registriert werden:', error);
    }
  });
}

window.setInterval(() => {
  if (state.completed) return;
  state.elapsedSeconds += 1;
  renderMeta();
  if (state.elapsedSeconds % 10 === 0) persistState();
}, 1000);

updateConnectionStatus();
render();
if (state.completed) showCompletion();
else window.setTimeout(focusSelected, 0);
