import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUZZLES,
  boxIndexes,
  candidateValues,
  clueCount,
  columnIndexes,
  conflictIndexes,
  isSolved,
  isValidSolvedGrid,
  peerIndexes,
  puzzleIsConsistent,
  puzzlesForDifficulty,
  rowIndexes,
} from './game.js';

function countSolutions(values, limit = 2) {
  const grid = [...values];

  function search() {
    let nextIndex = -1;
    let nextCandidates = null;

    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== 0) continue;
      const candidates = candidateValues(grid, index);
      if (candidates.length === 0) return 0;
      if (!nextCandidates || candidates.length < nextCandidates.length) {
        nextIndex = index;
        nextCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }

    if (nextIndex === -1) return 1;

    let solutions = 0;
    for (const candidate of nextCandidates) {
      grid[nextIndex] = candidate;
      solutions += search();
      grid[nextIndex] = 0;
      if (solutions >= limit) return solutions;
    }
    return solutions;
  }

  return search();
}

test('all bundled puzzles have valid solutions, matching givens and exactly one solution', () => {
  assert.equal(PUZZLES.length, 6);
  for (const puzzle of PUZZLES) {
    assert.equal(isValidSolvedGrid([...puzzle.solvedValues]), true, `${puzzle.id} solution invalid`);
    assert.equal(puzzleIsConsistent(puzzle), true, `${puzzle.id} givens mismatch solution`);
    assert.equal(countSolutions([...puzzle.values]), 1, `${puzzle.id} must have exactly one solution`);
    assert.equal(isSolved([...puzzle.solvedValues], puzzle), true);
  }
});

test('difficulty set provides two progressively sparser puzzles per level', () => {
  assert.equal(puzzlesForDifficulty('easy').length, 2);
  assert.equal(puzzlesForDifficulty('medium').length, 2);
  assert.equal(puzzlesForDifficulty('hard').length, 2);
  assert.deepEqual(PUZZLES.map(clueCount), [42, 42, 34, 34, 28, 28]);
});

test('row, column, box and peer helpers describe the expected Sudoku units', () => {
  assert.deepEqual(rowIndexes(40), [36, 37, 38, 39, 40, 41, 42, 43, 44]);
  assert.deepEqual(columnIndexes(40), [4, 13, 22, 31, 40, 49, 58, 67, 76]);
  assert.deepEqual(boxIndexes(40), [30, 31, 32, 39, 40, 41, 48, 49, 50]);
  assert.equal(peerIndexes(40).length, 20);
  assert.equal(peerIndexes(40).includes(40), false);
});

test('candidateValues excludes digits already used by row, column or box', () => {
  const values = Array(81).fill(0);
  values[36] = 1;
  values[4] = 2;
  values[30] = 3;
  assert.deepEqual(candidateValues(values, 40), [4, 5, 6, 7, 8, 9]);
  values[40] = 4;
  assert.deepEqual(candidateValues(values, 40), []);
});

test('conflictIndexes marks every duplicated nonzero cell inside any unit', () => {
  const values = Array(81).fill(0);
  values[0] = 5;
  values[1] = 5;
  values[9] = 5;
  values[40] = 7;
  assert.deepEqual([...conflictIndexes(values)].sort((a, b) => a - b), [0, 1, 9]);
});

test('isSolved rejects incomplete or altered boards', () => {
  const puzzle = PUZZLES[0];
  const incomplete = [...puzzle.solvedValues];
  incomplete[0] = 0;
  const altered = [...puzzle.solvedValues];
  altered[0] = altered[1];
  assert.equal(isSolved(incomplete, puzzle), false);
  assert.equal(isSolved(altered, puzzle), false);
});
