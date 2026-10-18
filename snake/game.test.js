import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, COMBO_WINDOW, MODES, createGame, positionKey, setDirection, setPaused, spawnPickup, stepGame, tickMsForState } from './game.js';

test('all three Snake modes expose distinct rule profiles', () => {
  const classic = createGame('classic', () => 0);
  const speed = createGame('speed', () => 0);
  const maze = createGame('maze', () => 0);
  assert.equal(classic.mode, 'classic');
  assert.equal(speed.mode, 'speed');
  assert.equal(maze.mode, 'maze');
  assert.equal(classic.walls.length, 0);
  assert.equal(speed.walls.length, 0);
  assert.ok(maze.walls.length > 20);
  assert.ok(tickMsForState(speed) < tickMsForState(classic));
  assert.ok(tickMsForState(speed) < tickMsForState(maze));
});

test('direction changes reject an immediate reverse but accept a perpendicular turn', () => {
  const game = createGame('classic', () => 0);
  assert.equal(setDirection(game, 'left'), game);
  const up = setDirection(game, 'up');
  assert.equal(up.nextDirection, 'up');
  const moved = stepGame(up, () => 0);
  assert.deepEqual(moved.snake[0], { x: 8, y: 8 });
  assert.equal(moved.direction, 'up');
});

test('ordinary steps move the head and keep the snake length stable', () => {
  const game = createGame('classic', () => 0.9);
  const moved = stepGame(game, () => 0.9);
  assert.deepEqual(moved.snake[0], { x: 9, y: 9 });
  assert.equal(moved.snake.length, 3);
  assert.equal(moved.score, 0);
});

test('eating grows the snake and combo scoring rewards quick consecutive pickups', () => {
  let game = createGame('classic', () => 0.5);
  game = { ...game, pickup: { x: 9, y: 9 } };
  game = stepGame(game, () => 0.5);
  assert.equal(game.snake.length, 4);
  assert.equal(game.score, 10);
  assert.equal(game.combo, 1);
  assert.equal(game.pickups, 1);

  game = { ...game, pickup: { x: 10, y: 9 }, stepsSincePickup: Math.min(COMBO_WINDOW, game.stepsSincePickup) };
  game = stepGame(game, () => 0.5);
  assert.equal(game.snake.length, 5);
  assert.equal(game.score, 30);
  assert.equal(game.combo, 2);
  assert.equal(game.pickups, 2);
});

test('combo expires after the configured number of non-pickup steps', () => {
  let game = createGame('classic', () => 0.9);
  game = { ...game, combo: 3, stepsSincePickup: COMBO_WINDOW };
  game = stepGame(game, () => 0.9);
  assert.equal(game.combo, 0);
});

test('boundary, maze wall and body collisions end the round deterministically', () => {
  const boundary = {
    ...createGame('classic', () => 0),
    snake: [{ x: BOARD_SIZE - 1, y: 5 }, { x: BOARD_SIZE - 2, y: 5 }, { x: BOARD_SIZE - 3, y: 5 }],
    pickup: { x: 0, y: 0 },
  };
  assert.equal(stepGame(boundary, () => 0).over, true);

  const maze = createGame('maze', () => 0.9);
  const wall = maze.walls[0];
  const intoWall = {
    ...maze,
    snake: [{ x: wall.x - 1, y: wall.y }, { x: wall.x - 2, y: wall.y }, { x: wall.x - 2, y: wall.y + 1 }],
    direction: 'right',
    nextDirection: 'right',
    pickup: { x: 17, y: 17 },
  };
  assert.equal(stepGame(intoWall, () => 0).over, true);

  const body = {
    ...createGame('classic', () => 0),
    snake: [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }],
    direction: 'left',
    nextDirection: 'left',
    pickup: { x: 17, y: 17 },
  };
  assert.equal(stepGame(body, () => 0).over, true);
});

test('moving into the current tail cell is legal when the tail leaves this tick', () => {
  const game = {
    ...createGame('classic', () => 0),
    snake: [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }],
    direction: 'left',
    nextDirection: 'left',
    pickup: { x: 17, y: 17 },
  };
  const moved = stepGame(game, () => 0);
  assert.equal(moved.over, false);
  assert.deepEqual(moved.snake[0], { x: 4, y: 5 });
});

test('pickup placement is deterministic and never overlaps snake or maze walls', () => {
  const maze = createGame('maze', () => 0);
  const first = spawnPickup(maze.snake, maze.walls, () => 0.123);
  const second = spawnPickup(maze.snake, maze.walls, () => 0.123);
  assert.deepEqual(first, second);
  const blocked = new Set([...maze.snake, ...maze.walls].map(positionKey));
  assert.equal(blocked.has(positionKey(first)), false);
});

test('pause freezes pure game progression and Speed accelerates after pickups', () => {
  let speed = createGame('speed', () => 0.9);
  const initialTick = tickMsForState(speed);
  speed = { ...speed, pickups: 12 };
  assert.ok(tickMsForState(speed) < initialTick);

  const paused = setPaused(speed, true);
  assert.equal(paused.paused, true);
  assert.equal(stepGame(paused, () => 0.2), paused);
});

test('declared mode metadata stays internally consistent', () => {
  assert.deepEqual(Object.keys(MODES), ['classic', 'speed', 'maze']);
  for (const mode of Object.values(MODES)) {
    assert.ok(mode.tickMs >= 50);
    for (const wall of mode.walls) {
      assert.ok(wall.x >= 0 && wall.x < BOARD_SIZE);
      assert.ok(wall.y >= 0 && wall.y < BOARD_SIZE);
    }
  }
});
