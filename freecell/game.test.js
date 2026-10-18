import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS, RANKS, cardColor, cardRank, cardSuit, canMove, createDeck, createGame, createSession,
  isDescendingAlternatingSequence, maxMovableCards, move, playMove, selectedCards, shuffledDeck, undo,
  validateGame, validateSession,
} from './game.js';

test('seeded deals are deterministic, complete and distributed 7/7/7/7/6/6/6/6', () => {
  const one = createGame(12345);
  const two = createGame(12345);
  const other = createGame(12346);
  assert.deepEqual(one, two);
  assert.notDeepEqual(one.cascades, other.cascades);
  assert.deepEqual(one.cascades.map((cascade) => cascade.length), [7, 7, 7, 7, 6, 6, 6, 6]);
  const cards = one.cascades.flat();
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards).size, 52);
  assert.deepEqual(new Set(cards), new Set(createDeck()));
  assert.deepEqual(shuffledDeck(12345), cards.reduce((dealOrder, _, dealIndex) => {
    const row = Math.floor(dealIndex / 8);
    const column = dealIndex % 8;
    if (row < one.cascades[column].length) dealOrder.push(one.cascades[column][row]);
    return dealOrder;
  }, []));
});

test('card helpers expose rank, suit and non-color-only identity', () => {
  assert.equal(cardRank('AH'), 1);
  assert.equal(cardRank('10D'), 10);
  assert.equal(cardRank('KS'), 13);
  assert.equal(cardSuit('QC'), 'C');
  assert.equal(cardColor('9H'), 'red');
  assert.equal(cardColor('9S'), 'black');
});

test('tableau sequences must descend by one and alternate colors', () => {
  assert.equal(isDescendingAlternatingSequence(['8C', '7H', '6S', '5D']), true);
  assert.equal(isDescendingAlternatingSequence(['8C', '7S']), false);
  assert.equal(isDescendingAlternatingSequence(['8C', '6H']), false);
  assert.equal(isDescendingAlternatingSequence([]), false);
});

test('freecell and cascade moves obey occupancy and alternating placement rules', () => {
  const state = {
    seed: 1, status: 'playing', moves: 0,
    cascades: [['8C'], ['9H'], ...Array.from({ length: 6 }, () => [])],
    freecells: ['AS', null, null, null],
    foundations: { C: 13, D: 13, H: 13, S: 12 },
  };
  const toCascade = move(state, { zone: 'cascade', index: 0, cardIndex: 0 }, { zone: 'cascade', index: 1 });
  assert.deepEqual(toCascade.cascades[1], ['9H', '8C']);
  assert.equal(toCascade.moves, 1);
  assert.equal(move(state, { zone: 'freecell', index: 0 }, { zone: 'freecell', index: 0 }), state);
});

test('foundation accepts only the next card of the matching suit and detects victory', () => {
  const state = {
    seed: 7, status: 'playing', moves: 41,
    cascades: Array.from({ length: 8 }, () => []),
    freecells: ['KS', null, null, null],
    foundations: { C: 13, D: 13, H: 13, S: 12 },
  };
  assert.equal(validateGame(state), true);
  assert.equal(canMove(state, { zone: 'freecell', index: 0 }, { zone: 'foundation', suit: 'H' }), false);
  const won = move(state, { zone: 'freecell', index: 0 }, { zone: 'foundation', suit: 'S' });
  assert.equal(won.status, 'won');
  assert.equal(won.foundations.S, 13);
  assert.equal(won.moves, 42);
  assert.equal(validateGame(won), true);
});

test('multi-card supermoves are limited by empty freecells and empty helper cascades', () => {
  const state = {
    seed: 5, status: 'playing', moves: 0,
    cascades: [
      ['8C', '7H', '6S', '5D'], ['9D'], [], [],
      ['AC', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC'],
      ['AD', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD'],
      ['AH', '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH'],
      [],
    ],
    freecells: [null, null, null, null],
    foundations: { C: 0, D: 0, H: 0, S: 13 },
  };
  assert.equal(maxMovableCards({ ...state, cascades: [state.cascades[0], state.cascades[1], [], [], [], [], [], []], freecells: [null, null, null, null] }, 1), 320);
  assert.equal(maxMovableCards({ ...state, cascades: [state.cascades[0], state.cascades[1], [], [], [], [], [], []], freecells: ['AS', '2S', '3S', '4S'] }, 1), 64);
});

test('selection exposes the chosen valid sequence and rejects a broken one', () => {
  const state = createGame(9);
  state.cascades[0] = ['8C', '7H', '6S'];
  assert.deepEqual(selectedCards(state, { zone: 'cascade', index: 0, cardIndex: 0 }), ['8C', '7H', '6S']);
  state.cascades[0] = ['8C', '7S'];
  assert.deepEqual(selectedCards(state, { zone: 'cascade', index: 0, cardIndex: 0 }), []);
});

test('session history supports multiple undo steps and restores exact states', () => {
  const base = createSession(11);
  const card = base.game.cascades[0].at(-1);
  const step1 = playMove(base, { zone: 'cascade', index: 0, cardIndex: base.game.cascades[0].length - 1 }, { zone: 'freecell', index: 0 });
  assert.notEqual(step1, base);
  const source = step1.game.cascades.findIndex((cascade) => cascade.length > 0 && canMove(step1.game, { zone: 'cascade', index: step1.game.cascades.indexOf(cascade), cardIndex: cascade.length - 1 }, { zone: 'freecell', index: 1 }));
  const step2 = playMove(step1, { zone: 'cascade', index: source, cardIndex: step1.game.cascades[source].length - 1 }, { zone: 'freecell', index: 1 });
  assert.equal(step2.history.length, 2);
  assert.deepEqual(undo(step2), { game: step1.game, history: step1.history, winRecorded: false });
  assert.deepEqual(undo(undo(step2)), base);
  assert.equal(validateSession(step2), true);
  assert.equal(step1.game.freecells[0], card);
});

test('validation rejects duplicate or malformed cards', () => {
  const state = createGame(1);
  assert.equal(validateGame(state), true);
  state.cascades[0][0] = state.cascades[1][0];
  assert.equal(validateGame(state), false);
  const malformed = createGame(2);
  malformed.cascades[0][0] = '1X';
  assert.equal(validateGame(malformed), false);
  assert.deepEqual(SUITS.length, 4);
  assert.deepEqual(RANKS.length, 13);
});
