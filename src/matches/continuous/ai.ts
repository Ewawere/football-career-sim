/**
 * Level-of-detail AI for non-user players.
 * Near ball: detailed decisions. Far: hold shape.
 */

import type { ContinuousMatchState, ContinuousPlayer, Vec2 } from "./types.js";
import { PITCH } from "./types.js";
import type { RNG } from "../../core/rng.js";

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
        if (dBall < 2.2 && rng.chance(0.05)) {
          (p as any)._intent = "tackle";
        }
      } else if (p.target) {
        p.velocity = toward(p.position, p.target, 5);
      }
    }
  } else if (p.target) {
    p.velocity = toward(p.position, p.target, 5);
  }

  p.position = {
    x: Math.max(0.5, Math.min(PITCH.width - 0.5, p.position.x + p.velocity.x * dt)),
    y: Math.max(0.5, Math.min(PITCH.height - 0.5, p.position.y + p.velocity.y * dt)),
  };
  p.stamina = Math.max(0, p.stamina - 0.8 * dt);
}
