import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './levels.js';
import {
  BALL_RADIUS, BRICK_WIDTH, DEFAULT_PADDLE_WIDTH, WORLD_HEIGHT, WORLD_WIDTH,
  advanceLevel, applyPowerUp, createGame, launchBall, levelBricks, movePaddle, setPaddleCenter, stepGame, togglePause, validateLevels,
} from './game.js';

test('five handcrafted short levels validate with distinct layouts', () => {
  assert.equal(LEVELS.length, 5);
  assert.equal(validateLevels(), true);
  const signatures = new Set(LEVELS.map((_, index) => levelBricks(index).map((brick) => `${brick.x},${brick.y},${brick.powerUp}`).join('|')));
  assert.equal(signatures.size, LEVELS.length);
});

test('paddle movement clamps to the world and carries a ready ball', () => {
  let state = createGame();
  state = setPaddleCenter(state, -999);
  assert.equal(state.paddle.x, 0);
  assert.equal(state.balls[0].x, state.paddle.width / 2);
  state = movePaddle(state, 'right', 999);
  assert.equal(state.paddle.x, WORLD_WIDTH - state.paddle.width);
  assert.equal(state.balls[0].x, state.paddle.x + state.paddle.width / 2);
});

test('left, right and ceiling collisions reflect the ball deterministically', () => {
  let state = { ...launchBall(createGame()), balls: [{ x: BALL_RADIUS + 0.2, y: 180, vx: -3, vy: -2, radius: BALL_RADIUS }] };
  state = stepGame(state);
  assert.ok(state.balls[0].vx > 0);
  state = { ...state, balls: [{ x: WORLD_WIDTH - BALL_RADIUS - 0.2, y: 180, vx: 3, vy: -2, radius: BALL_RADIUS }] };
  state = stepGame(state);
  assert.ok(state.balls[0].vx < 0);
  state = { ...state, balls: [{ x: 160, y: BALL_RADIUS + 0.2, vx: 2, vy: -3, radius: BALL_RADIUS }] };
  state = stepGame(state);
  assert.ok(state.balls[0].vy > 0);
});

test('paddle collision sends a descending ball upward and changes angle by hit position', () => {
  const base = launchBall(createGame());
  const ball = { x: base.paddle.x + base.paddle.width - 8, y: base.paddle.y - BALL_RADIUS - 0.2, vx: 0.8, vy: 3.5, radius: BALL_RADIUS };
  const state = stepGame({ ...base, balls: [ball] });
  assert.ok(state.balls[0].vy < 0);
  assert.ok(state.balls[0].vx > ball.vx);
});

test('brick collision removes exactly one brick, reflects and scores', () => {
  const base = launchBall(createGame());
  const brick = base.bricks[0];
  const ball = { x: brick.x + brick.width / 2, y: brick.y - BALL_RADIUS - 0.1, vx: 0.8, vy: 3, radius: BALL_RADIUS };
  const state = stepGame({ ...base, balls: [ball] });
  assert.equal(state.bricks.length, base.bricks.length - 1);
  assert.equal(state.score, 100);
  assert.ok(state.balls[0].vy < 0);
});

test('missing the paddle costs a life and resets a ready ball; the last life ends the run', () => {
  const falling = { x: 10, y: WORLD_HEIGHT + BALL_RADIUS + 1, vx: 0, vy: 3, radius: BALL_RADIUS };
  let state = stepGame({ ...launchBall(createGame()), balls: [falling] });
  assert.equal(state.lives, 2);
  assert.equal(state.status, 'ready');
  assert.equal(state.paddle.width, DEFAULT_PADDLE_WIDTH);
  state = stepGame({ ...launchBall({ ...state, lives: 1 }), balls: [falling] });
  assert.equal(state.lives, 0);
  assert.equal(state.status, 'gameover');
});

test('wide, slow and multiball power-ups have bounded deterministic effects', () => {
  const base = launchBall(createGame());
  const wide = applyPowerUp(base, 'wide');
  assert.ok(wide.paddle.width > base.paddle.width);
  assert.ok(wide.paddle.x >= 0 && wide.paddle.x + wide.paddle.width <= WORLD_WIDTH);
  const fast = { ...base, balls: [{ ...base.balls[0], vx: 4, vy: -4 }] };
  const slow = applyPowerUp(fast, 'slow');
  assert.ok(Math.hypot(slow.balls[0].vx, slow.balls[0].vy) <= 2.751);
  const multi = applyPowerUp(base, 'multiball');
  assert.ok(multi.balls.length >= 3 && multi.balls.length <= 4);
  assert.ok(multi.balls.some((ball) => ball.vx < 0));
  assert.ok(multi.balls.some((ball) => ball.vx > 0));
});

test('destroying a marked brick spawns its falling power-up', () => {
  const base = launchBall(createGame());
  const brick = base.bricks.find((candidate) => candidate.powerUp);
  assert.ok(brick);
  const ball = { x: brick.x + BRICK_WIDTH / 2, y: brick.y - BALL_RADIUS - 0.1, vx: 0.7, vy: 3, radius: BALL_RADIUS };
  const blocker = { ...base.bricks.find((candidate) => candidate.id !== brick.id), x: 0, y: 200 };
  const state = stepGame({ ...base, bricks: [brick, blocker], balls: [ball] });
  assert.equal(state.powerUps.length, 1);
  assert.equal(state.powerUps[0].type, brick.powerUp);
});

test('last brick completes a level and advanceLevel preserves score and lives', () => {
  const base = launchBall(createGame());
  const brick = { ...base.bricks[0], powerUp: null };
  const ball = { x: brick.x + brick.width / 2, y: brick.y - BALL_RADIUS - 0.1, vx: 1, vy: 3, radius: BALL_RADIUS };
  const cleared = stepGame({ ...base, score: 400, lives: 2, bricks: [brick], balls: [ball] });
  assert.equal(cleared.status, 'level-cleared');
  assert.equal(cleared.score, 500);
  const next = advanceLevel(cleared);
  assert.equal(next.levelIndex, 1);
  assert.equal(next.score, 500);
  assert.equal(next.lives, 2);
  assert.equal(next.status, 'ready');
});

test('final level completion wins and pause freezes physics', () => {
  const final = launchBall(createGame({ levelIndex: LEVELS.length - 1, score: 800 }));
  const brick = { ...final.bricks[0], powerUp: null };
  const ball = { x: brick.x + brick.width / 2, y: brick.y - BALL_RADIUS - 0.1, vx: 1, vy: 3, radius: BALL_RADIUS };
  const won = stepGame({ ...final, bricks: [brick], balls: [ball] });
  assert.equal(won.status, 'won');
  const paused = togglePause({ ...launchBall(createGame()), balls: [{ x: 160, y: 200, vx: 2, vy: -2, radius: BALL_RADIUS }] });
  assert.equal(paused.status, 'paused');
  assert.equal(stepGame(paused), paused);
});
