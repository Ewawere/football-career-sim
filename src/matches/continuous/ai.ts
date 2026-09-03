/**
 * Level-of-detail AI for non-user players.
 * Near ball: detailed decisions. Far: hold shape.
 */

import type { ContinuousMatchState, ContinuousPlayer, Vec2 } from "./types.js";
import { PITCH } from "./types.js";
import { RNG } from "../../core/rng.js";

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function toward(from: Vec2, to: Vec2, speed: number): Vec2 {
  const d = dist(from, to);
  if (d < 0.01) return { x: 0, y: 0 };
  return { x: ((to.x - from.x) / d) * speed, y: ((to.y - from.y) / d) * speed };
}

const NEAR = 18;
const MID = 35;

export function updateAIPlayer(
  state: ContinuousMatchState,
  p: ContinuousPlayer,
  dt: number,
  rng: RNG
): void {
  if (!p.onPitch || p.isUser) return;

  const ball = state.ball.position;
  const dBall = dist(p.position, ball);
  const attackDir = p.side === "home" ? 1 : -1;

  if (dBall > MID) {
    if (p.target) {
      p.velocity = toward(p.position, p.target, 4 * dt * 20);
    }
    return;
  }

  if (p.hasBall) {
    const goal: Vec2 =
      p.side === "home"
        ? { x: PITCH.width, y: PITCH.height / 2 }
        : { x: 0, y: PITCH.height / 2 };
    const toGoal = dist(p.position, goal);
    if (toGoal < 16 && rng.chance(0.08)) {
      (p as any)._intent = "shoot";
    } else if (rng.chance(0.12)) {
      (p as any)._intent = "pass";
    } else {
      p.velocity = toward(p.position, goal, 7);
      p.target = goal;
    }
    return;
  }

  if (dBall < NEAR) {
    if (state.ball.ownerId === null) {
      p.velocity = toward(p.position, ball, 9);
      p.target = ball;
    } else {
      const owner = state.players.find((x) => x.id === state.ball.ownerId);
      if (owner && owner.side !== p.side) {
        p.velocity = toward(p.position, owner.position, 8);
        p.target = owner.position;
        if (dBall < 2.2 && rng.chance(0.15)) (p as any)._intent = "tackle";
      } else if (owner && owner.side === p.side) {
        const space: Vec2 = {
          x: clamp(p.position.x + attackDir * 8, 2, PITCH.width - 2),
          y: clamp(p.position.y + rng.float(-6, 6), 2, PITCH.height - 2),
        };
        p.velocity = toward(p.position, space, 6);
        p.target = space;
      }
    }
  } else if (p.target) {
    p.velocity = toward(p.position, p.target, 5);
  }
}

export function updateGK(state: ContinuousMatchState, p: ContinuousPlayer, dt: number): void {
  if (!p.onPitch) return;
  const goalX = p.side === "home" ? 2 : PITCH.width - 2;
  const goal: Vec2 = { x: goalX, y: PITCH.height / 2 };
  const ball = state.ball.position;
  if (dist(p.position, ball) < 12 && !state.ball.ownerId) {
    p.velocity = toward(p.position, ball, 7);
  } else {
    const home: Vec2 = {
      x: goal.x,
      y: clamp(ball.y, PITCH.height * 0.25, PITCH.height * 0.75),
    };
    p.velocity = toward(p.position, home, 5);
  }
}
