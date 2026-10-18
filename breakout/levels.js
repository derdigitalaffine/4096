export const LEVELS = Object.freeze([
  Object.freeze({
    id: 'warm-up', title: 'Warm-up',
    rows: Object.freeze(['111111', '11W111']),
  }),
  Object.freeze({
    id: 'gate', title: 'Das Tor',
    rows: Object.freeze(['101101', '11M111', '011110']),
  }),
  Object.freeze({
    id: 'steps', title: 'Treppen',
    rows: Object.freeze(['100001', '110011', '111S11', '011110']),
  }),
  Object.freeze({
    id: 'split', title: 'Geteilt',
    rows: Object.freeze(['111111', 'W0110M', '110011', '011110']),
  }),
  Object.freeze({
    id: 'finale', title: 'Finale',
    rows: Object.freeze(['1W11M1', '111111', '01S110', '111111']),
  }),
]);

export const POWER_UP_TYPES = Object.freeze(['wide', 'slow', 'multiball']);
