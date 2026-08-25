/**
 * PlayerMatchController — direct input for the career player only.
 */

import type { ContinuousMatchState, ContinuousPlayer, UserCommand, Vec2 } from "./types.js";
import { PITCH } from "./types.js";
import { RNG } from "../../core/rng.js";

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPos(p: Vec2): Vec2 {
  return {
    x: Math.max(0.5, Math.min(PITCH.width - 0.5, p.x)),
    y: Math.max(0.5, Math.min(PITCH.height - 0.5, p.y)),
  };
}

export function applyUserCommand(
  state: ContinuousMatchState,
  cmd: UserCommand,
  dt: number,
  rng: RNG
): void {
  const user = state.players.find((p) => p.isUser && p.onPitch);
  if (!user) return;

  const baseSpeed = 8;
  const sprintMul = 1.45;

  switch (cmd.type) {
    case "Move": {
      const speed = baseSpeed * (user.stamina > 15 ? 1 : 0.6);
      user.velocity = {
        x: cmd.dir.x * speed,
        y: cmd.dir.y * speed,
      };
      if (cmd.dir.x !== 0 || cmd.dir.y !== 0) {
        user.facing = Math.atan2(cmd.dir.y, cmd.dir.x);
      }
      break;
    }
    case "Sprint": {
      if (cmd.active && user.stamina > 5) {
        user.velocity.x *= sprintMul;
        user.velocity.y *= sprintMul;
        user.stamina = Math.max(0, user.stamina - 12 * dt);
      }
      break;
    }
    case "Pass":
    case "ThroughBall":
    case "Cross": {
      if (!user.hasBall) break;
      (user as any)._intent =
        cmd.type === "ThroughBall" ? "through" : cmd.type === "Cross" ? "cross" : "pass";
      (user as any)._aim = cmd.aim;
      break;
    }
    case "Shoot": {
      if (!user.hasBall) break;
      (user as any)._intent = "shoot";
      (user as any)._aim = cmd.aim;
      break;
    }
    case "Tackle": {
      if (user.hasBall) break;
      if (dist(user.position, state.ball.position) < 2.5) {
        (user as any)._intent = "tackle";
      }
      break;
    }
    case "Idle":
    default:
      user.velocity = { x: user.velocity.x * 0.85, y: user.velocity.y * 0.85 };
      break;
  }

  user.position = clampPos({
    x: user.position.x + user.velocity.x * dt,
    y: user.position.y + user.velocity.y * dt,
  });

  if (user.hasBall) {
    state.ball.position = {
      x: user.position.x + Math.cos(user.facing) * 0.8,
      y: user.position.y + Math.sin(user.facing) * 0.8,
    };
    state.ball.ownerId = user.id;
  }

  void rng;
}
