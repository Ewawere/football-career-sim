/**
 * Apply user commands to the continuous match player.
 */

import type { ContinuousMatchState, UserCommand, Vec2 } from "./types.js";
import { PITCH } from "./types.js";
import type { RNG } from "../../core/rng.js";

function clampPos(p: Vec2): Vec2 {
  return {
    x: Math.max(0.5, Math.min(PITCH.width - 0.5, p.x)),
    y: Math.max(0.5, Math.min(PITCH.height - 0.5, p.y)),
  };
}

function len(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y) || 1;
}

export function applyUserCommand(
  state: ContinuousMatchState,
  cmd: UserCommand,
  dt: number,
  rng: RNG
): void {
  const user = state.players.find((p) => p.isUser && p.onPitch);
  if (!user) return;

  const baseSpeed = 7 + (user.stamina / 100) * 2;
  let sprint = false;

  switch (cmd.type) {
    case "Move": {
      const d = len(cmd.dir);
      user.velocity = {
        x: (cmd.dir.x / d) * baseSpeed,
        y: (cmd.dir.y / d) * baseSpeed,
      };
      user.facing = Math.atan2(cmd.dir.y, cmd.dir.x);
      break;
    }
    case "Sprint":
      sprint = cmd.active;
      if (sprint) {
        user.velocity = {
          x: user.velocity.x * 1.35,
          y: user.velocity.y * 1.35,
        };
        user.stamina = Math.max(0, user.stamina - 8 * dt);
      }
      break;
    case "Pass":
    case "ThroughBall":
    case "Cross":
      if (user.hasBall) {
        state.ball.ownerId = null;
        user.hasBall = false;
        state.ball.velocity = {
          x: (cmd.aim.x - user.position.x) * 0.8,
          y: (cmd.aim.y - user.position.y) * 0.8,
        };
        state.ball.position = { ...user.position };
        (user as any)._intent = cmd.type === "ThroughBall" ? "through" : "pass";
      }
      break;
    case "Shoot":
      if (user.hasBall) {
        state.ball.ownerId = null;
        user.hasBall = false;
        state.ball.velocity = {
          x: (cmd.aim.x - user.position.x) * 1.2,
          y: (cmd.aim.y - user.position.y) * 1.2,
        };
        (user as any)._intent = "shoot";
      }
      break;
    case "Tackle":
      (user as any)._intent = "tackle";
      break;
    case "Idle":
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
