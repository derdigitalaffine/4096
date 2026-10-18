import { LEVELS } from './levels.js';

export const WORLD_WIDTH = 320;
export const WORLD_HEIGHT = 420;
export const PADDLE_Y = 392;
export const PADDLE_HEIGHT = 10;
export const DEFAULT_PADDLE_WIDTH = 76;
export const WIDE_PADDLE_WIDTH = 116;
export const BALL_RADIUS = 5;
export const BRICK_WIDTH = 42;
export const BRICK_HEIGHT = 16;
export const BRICK_GAP = 5;
export const BRICK_TOP = 54;
export const POWER_UP_FALL_SPEED = 2.1;

const powerForToken = Object.freeze({ W: 'wide', S: 'slow', M: 'multiball' });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rectsOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const circleRectOverlap = (ball, rect) => {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
};

export function levelBricks(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) throw new RangeError('Invalid Breakout level.');
  const columns = Math.max(...level.rows.map((row) => row.length));
  const rowWidth = columns * BRICK_WIDTH + (columns - 1) * BRICK_GAP;
  const startX = Math.round((WORLD_WIDTH - rowWidth) / 2);
  const bricks = [];
  level.rows.forEach((row, rowIndex) => {
    [...row.padEnd(columns, '0')].forEach((token, columnIndex) => {
      if (token === '0') return;
      if (token !== '1' && !powerForToken[token]) throw new Error(`Unsupported brick token ${token}.`);
      bricks.push({
        id: `${level.id}-${rowIndex}-${columnIndex}`,
        x: startX + columnIndex * (BRICK_WIDTH + BRICK_GAP),
        y: BRICK_TOP + rowIndex * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        powerUp: powerForToken[token] ?? null,
      });
    });
  });
  return bricks;
}

export function createBall(paddle = { x: (WORLD_WIDTH - DEFAULT_PADDLE_WIDTH) / 2, width: DEFAULT_PADDLE_WIDTH }) {
  return {
    x: paddle.x + paddle.width / 2,
    y: PADDLE_Y - BALL_RADIUS - 3,
    vx: 2.15,
    vy: -3.25,
    radius: BALL_RADIUS,
  };
}

export function createGame({ levelIndex = 0, score = 0, lives = 3 } = {}) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) throw new RangeError('Invalid Breakout level.');
  const paddle = { x: (WORLD_WIDTH - DEFAULT_PADDLE_WIDTH) / 2, y: PADDLE_Y, width: DEFAULT_PADDLE_WIDTH, height: PADDLE_HEIGHT };
  return {
    levelIndex,
    score,
    lives,
    paddle,
    balls: [createBall(paddle)],
    bricks: levelBricks(levelIndex),
    powerUps: [],
    status: 'ready',
  };
}

export function movePaddle(state, direction, distance = 7) {
  if (!['left', 'right'].includes(direction) || !Number.isFinite(distance) || distance <= 0) return state;
  const delta = direction === 'left' ? -distance : distance;
  return setPaddleCenter(state, state.paddle.x + state.paddle.width / 2 + delta);
}

export function setPaddleCenter(state, centerX) {
  if (!Number.isFinite(centerX)) return state;
  const nextX = clamp(centerX - state.paddle.width / 2, 0, WORLD_WIDTH - state.paddle.width);
  if (nextX === state.paddle.x) return state;
  const paddle = { ...state.paddle, x: nextX };
  const balls = state.status === 'ready'
    ? state.balls.map((ball) => ({ ...ball, x: paddle.x + paddle.width / 2 }))
    : state.balls.map((ball) => ({ ...ball }));
  return { ...state, paddle, balls };
}

export function launchBall(state) {
  return state.status === 'ready' ? { ...state, status: 'running' } : state;
}

export function togglePause(state) {
  if (state.status === 'running') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'running' };
  return state;
}

export function applyPowerUp(state, type) {
  if (type === 'wide') {
    const center = state.paddle.x + state.paddle.width / 2;
    const paddle = { ...state.paddle, width: WIDE_PADDLE_WIDTH, x: clamp(center - WIDE_PADDLE_WIDTH / 2, 0, WORLD_WIDTH - WIDE_PADDLE_WIDTH) };
    return { ...state, paddle };
  }
  if (type === 'slow') {
    const balls = state.balls.map((ball) => {
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed <= 2.75) return { ...ball };
      const scale = 2.75 / speed;
      return { ...ball, vx: ball.vx * scale, vy: ball.vy * scale };
    });
    return { ...state, balls };
  }
  if (type === 'multiball') {
    const additions = state.balls.flatMap((ball) => [
      { ...ball, vx: Math.abs(ball.vx) || 2.1, vy: -Math.abs(ball.vy || 3) },
      { ...ball, vx: -(Math.abs(ball.vx) || 2.1), vy: -Math.abs(ball.vy || 3) },
    ]);
    const unique = [...state.balls.map((ball) => ({ ...ball })), ...additions].slice(0, 4);
    return { ...state, balls: unique };
  }
  return state;
}

function bounceOffPaddle(ball, paddle) {
  const relative = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
  let vx = ball.vx + relative * 1.45;
  if (Math.abs(vx) < 0.75) vx = relative < 0 ? -0.75 : 0.75;
  vx = clamp(vx, -4.6, 4.6);
  return { ...ball, y: paddle.y - ball.radius - 0.1, vx, vy: -Math.abs(ball.vy) };
}

function bounceOffBrick(ball, previous, brick) {
  const fromAbove = previous.y + previous.radius <= brick.y;
  const fromBelow = previous.y - previous.radius >= brick.y + brick.height;
  if (fromAbove || fromBelow) return { ...ball, vy: -ball.vy };
  return { ...ball, vx: -ball.vx };
}

function advanceBall(ball, state, delta) {
  const previous = { ...ball };
  let next = { ...ball, x: ball.x + ball.vx * delta, y: ball.y + ball.vy * delta };

  if (next.x - next.radius < 0) {
    next.x = next.radius;
    next.vx = Math.abs(next.vx);
  } else if (next.x + next.radius > WORLD_WIDTH) {
    next.x = WORLD_WIDTH - next.radius;
    next.vx = -Math.abs(next.vx);
  }
  if (next.y - next.radius < 0) {
    next.y = next.radius;
    next.vy = Math.abs(next.vy);
  }

  if (next.vy > 0 && circleRectOverlap(next, state.paddle)) next = bounceOffPaddle(next, state.paddle);

  const brick = state.bricks.find((candidate) => circleRectOverlap(next, candidate));
  return { ball: brick ? bounceOffBrick(next, previous, brick) : next, hitBrickId: brick?.id ?? null };
}

function collectPowerUps(state, delta) {
  let nextState = state;
  const remaining = [];
  for (const powerUp of state.powerUps) {
    const moved = { ...powerUp, y: powerUp.y + POWER_UP_FALL_SPEED * delta };
    if (rectsOverlap({ x: moved.x - 7, y: moved.y - 7, width: 14, height: 14 }, nextState.paddle)) {
      nextState = applyPowerUp(nextState, moved.type);
    } else if (moved.y < WORLD_HEIGHT + 12) {
      remaining.push(moved);
    }
  }
  return { ...nextState, powerUps: remaining };
}

export function stepGame(state, delta = 1) {
  if (state.status !== 'running' || !Number.isFinite(delta) || delta <= 0) return state;
  const boundedDelta = Math.min(delta, 1.5);
  const collisions = state.balls.map((ball) => advanceBall(ball, state, boundedDelta));
  const hitIds = new Set(collisions.map(({ hitBrickId }) => hitBrickId).filter(Boolean));
  let score = state.score;
  const powerUps = [...state.powerUps];
  const bricks = state.bricks.filter((brick) => {
    if (!hitIds.has(brick.id)) return true;
    score += 100;
    if (brick.powerUp) powerUps.push({ id: `${brick.id}-${score}`, type: brick.powerUp, x: brick.x + brick.width / 2, y: brick.y + brick.height / 2 });
    return false;
  });
  let balls = collisions.map(({ ball }) => ball).filter((ball) => ball.y - ball.radius <= WORLD_HEIGHT);
  let next = { ...state, score, bricks, balls, powerUps };

  if (bricks.length === 0) {
    return { ...next, powerUps: [], status: state.levelIndex === LEVELS.length - 1 ? 'won' : 'level-cleared' };
  }

  next = collectPowerUps(next, boundedDelta);
  balls = next.balls;
  if (balls.length > 0) return next;

  const lives = next.lives - 1;
  if (lives <= 0) return { ...next, lives: 0, status: 'gameover', powerUps: [] };
  const paddle = { ...next.paddle, width: DEFAULT_PADDLE_WIDTH, x: clamp(next.paddle.x + next.paddle.width / 2 - DEFAULT_PADDLE_WIDTH / 2, 0, WORLD_WIDTH - DEFAULT_PADDLE_WIDTH) };
  return { ...next, lives, paddle, balls: [createBall(paddle)], powerUps: [], status: 'ready' };
}

export function advanceLevel(state) {
  if (state.status !== 'level-cleared' || state.levelIndex + 1 >= LEVELS.length) return state;
  return createGame({ levelIndex: state.levelIndex + 1, score: state.score, lives: state.lives });
}

export function restartRun() {
  return createGame();
}

export function validateLevels(levels = LEVELS) {
  const ids = new Set();
  for (const level of levels) {
    if (!level.id || ids.has(level.id)) throw new Error('Breakout level ids must be unique.');
    ids.add(level.id);
    if (!Array.isArray(level.rows) || level.rows.length < 2) throw new Error(`${level.id} needs multiple rows.`);
    const brickCount = levelBricks(levels.indexOf(level)).length;
    if (brickCount < 8) throw new Error(`${level.id} needs at least eight bricks.`);
  }
  return true;
}
