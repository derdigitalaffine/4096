export const SUITS = Object.freeze(['C', 'D', 'H', 'S']);
export const SUIT_NAMES = Object.freeze({ C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik' });
export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const MAX_HISTORY = 200;

const RED_SUITS = new Set(['D', 'H']);

function createSeededRandom(seed) {
  let value = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function cardSuit(card) {
  return typeof card === 'string' ? card.slice(-1) : '';
}

export function cardRank(card) {
  const suit = cardSuit(card);
  if (!SUITS.includes(suit)) return 0;
  const rank = card.slice(0, -1);
  return RANKS.indexOf(rank) + 1;
}

export function cardColor(card) {
  const suit = cardSuit(card);
  if (!SUITS.includes(suit)) return null;
  return RED_SUITS.has(suit) ? 'red' : 'black';
}

export function isCard(card) {
  return cardRank(card) > 0;
}

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}`));
}

export function shuffledDeck(seed = 1) {
  const deck = createDeck();
  const random = createSeededRandom(seed);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function createGame(seed = 1) {
  const normalizedSeed = Number(seed) >>> 0;
  const cascades = Array.from({ length: 8 }, () => []);
  for (const [index, card] of shuffledDeck(normalizedSeed).entries()) cascades[index % 8].push(card);
  return {
    seed: normalizedSeed,
    status: 'playing',
    moves: 0,
    cascades,
    freecells: Array(4).fill(null),
    foundations: Object.fromEntries(SUITS.map((suit) => [suit, 0])),
  };
}

export function isDescendingAlternatingSequence(cards) {
  if (!Array.isArray(cards) || cards.length === 0 || cards.some((card) => !isCard(card))) return false;
  for (let index = 0; index < cards.length - 1; index += 1) {
    if (cardRank(cards[index]) !== cardRank(cards[index + 1]) + 1) return false;
    if (cardColor(cards[index]) === cardColor(cards[index + 1])) return false;
  }
  return true;
}

export function canPlaceOnCascade(card, cascade) {
  if (!isCard(card) || !Array.isArray(cascade)) return false;
  if (cascade.length === 0) return true;
  const top = cascade.at(-1);
  return cardRank(top) === cardRank(card) + 1 && cardColor(top) !== cardColor(card);
}

export function maxMovableCards(state, targetCascadeIndex) {
  if (!Number.isInteger(targetCascadeIndex) || targetCascadeIndex < 0 || targetCascadeIndex >= 8) return 0;
  const emptyFreecells = state.freecells.filter((card) => card === null).length;
  let emptyCascades = state.cascades.filter((cascade) => cascade.length === 0).length;
  if (state.cascades[targetCascadeIndex].length === 0) emptyCascades -= 1;
  return (emptyFreecells + 1) * (2 ** Math.max(0, emptyCascades));
}

function sourceCards(state, source) {
  if (!source || typeof source !== 'object') return null;
  if (source.zone === 'freecell') {
    const index = source.index;
    if (!Number.isInteger(index) || index < 0 || index >= state.freecells.length) return null;
    const card = state.freecells[index];
    return card ? [card] : null;
  }
  if (source.zone === 'cascade') {
    const index = source.index;
    const cardIndex = source.cardIndex;
    if (!Number.isInteger(index) || index < 0 || index >= state.cascades.length) return null;
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= state.cascades[index].length) return null;
    const cards = state.cascades[index].slice(cardIndex);
    return isDescendingAlternatingSequence(cards) ? cards : null;
  }
  return null;
}

export function selectedCards(state, source) {
  return sourceCards(state, source) ?? [];
}

function removeSource(state, source, count) {
  const next = {
    ...state,
    cascades: state.cascades.map((cascade) => [...cascade]),
    freecells: [...state.freecells],
    foundations: { ...state.foundations },
  };
  if (source.zone === 'freecell') next.freecells[source.index] = null;
  else next.cascades[source.index].splice(next.cascades[source.index].length - count, count);
  return next;
}

export function isWon(state) {
  return SUITS.every((suit) => state.foundations[suit] === 13);
}

function attemptMove(state, source, target) {
  if (state.status === 'won' || !target || typeof target !== 'object') return state;
  const cards = sourceCards(state, source);
  if (!cards) return state;

  if (target.zone === 'freecell') {
    if (cards.length !== 1 || !Number.isInteger(target.index) || target.index < 0 || target.index >= 4) return state;
    if (state.freecells[target.index] !== null || (source.zone === 'freecell' && source.index === target.index)) return state;
    const next = removeSource(state, source, 1);
    next.freecells[target.index] = cards[0];
    next.moves += 1;
    return next;
  }

  if (target.zone === 'foundation') {
    if (cards.length !== 1 || !SUITS.includes(target.suit)) return state;
    const card = cards[0];
    if (cardSuit(card) !== target.suit || cardRank(card) !== state.foundations[target.suit] + 1) return state;
    const next = removeSource(state, source, 1);
    next.foundations[target.suit] += 1;
    next.moves += 1;
    if (isWon(next)) next.status = 'won';
    return next;
  }

  if (target.zone === 'cascade') {
    if (!Number.isInteger(target.index) || target.index < 0 || target.index >= 8) return state;
    if (source.zone === 'cascade' && source.index === target.index) return state;
    if (!canPlaceOnCascade(cards[0], state.cascades[target.index])) return state;
    if (cards.length > maxMovableCards(state, target.index)) return state;
    const next = removeSource(state, source, cards.length);
    next.cascades[target.index].push(...cards);
    next.moves += 1;
    return next;
  }

  return state;
}

export function move(state, source, target) {
  return attemptMove(state, source, target);
}

export function canMove(state, source, target) {
  return attemptMove(state, source, target) !== state;
}

export function createSession(seed = 1) {
  return { game: createGame(seed), history: [], winRecorded: false };
}

export function playMove(session, source, target) {
  const game = move(session.game, source, target);
  if (game === session.game) return session;
  const history = [...session.history, session.game].slice(-MAX_HISTORY);
  return { game, history, winRecorded: session.winRecorded };
}

export function undo(session) {
  if (!session.history.length) return session;
  return {
    game: session.history.at(-1),
    history: session.history.slice(0, -1),
    winRecorded: session.winRecorded,
  };
}

export function validateGame(state) {
  if (!state || typeof state !== 'object') return false;
  if (!Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff) return false;
  if (!['playing', 'won'].includes(state.status)) return false;
  if (!Number.isInteger(state.moves) || state.moves < 0) return false;
  if (!Array.isArray(state.cascades) || state.cascades.length !== 8 || state.cascades.some((cascade) => !Array.isArray(cascade))) return false;
  if (!Array.isArray(state.freecells) || state.freecells.length !== 4) return false;
  if (!state.foundations || typeof state.foundations !== 'object' || Array.isArray(state.foundations)) return false;
  for (const suit of SUITS) {
    if (!Number.isInteger(state.foundations[suit]) || state.foundations[suit] < 0 || state.foundations[suit] > 13) return false;
  }

  const cards = [];
  for (const cascade of state.cascades) {
    for (const card of cascade) {
      if (!isCard(card)) return false;
      cards.push(card);
    }
  }
  for (const card of state.freecells) {
    if (card === null) continue;
    if (!isCard(card)) return false;
    cards.push(card);
  }
  for (const suit of SUITS) {
    for (let rank = 1; rank <= state.foundations[suit]; rank += 1) cards.push(`${RANKS[rank - 1]}${suit}`);
  }
  if (cards.length !== 52 || new Set(cards).size !== 52) return false;
  if ((state.status === 'won') !== isWon(state)) return false;
  return true;
}

export function validateSession(session) {
  if (!session || typeof session !== 'object' || typeof session.winRecorded !== 'boolean') return false;
  if (!validateGame(session.game) || !Array.isArray(session.history) || session.history.length > MAX_HISTORY) return false;
  return session.history.every(validateGame);
}
