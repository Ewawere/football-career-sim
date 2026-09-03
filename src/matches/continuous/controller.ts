/**
 * Apply user command to the career player on the continuous pitch.
 */

import type { ContinuousMatchState, ContinuousPlayer, UserCommand, Vec2 } from "./types.js";
import { PITCH } from "./types.js";

const SPRINT_MUL = 1.55;
const BASE_SPEED = 7.2; // m/s scale per tick unit

function clampPitch(p: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(PITCH.width, p.x)),
    y: Math.max(0, Math.min(PITCH.height, p.y)),
  };
}

function len(v: Vec2): number {
  return Math.hypot(v.x, v.y) || 1;
}

function norm(v: Vec2): Vec2 {
  const l = len(v);
  return { x: v.x / l, y: v.y / l };
}

export function applyUserCommand(
  state: ContinuousMatchState,
  cmd: UserCommand,
  dt: number
): void {
  const user = state.players.find((p) => p.isUser && p.onPitch);
  if (!user) return;

  if (cmd.type === "Idle") {
    user.velocity = { x: 0, y: 0 };
    user.target = null;
    return;
  }

  if (cmd.type === "Move" || cmd.type === "Sprint") {
    const sprint = cmd.type === "Sprint" ? cmd.active : false;
    if (cmd.type === "Move") {
      const d = norm(cmd.dir);
      const speed = BASE_SPEED * (sprint ? SPRINT_MUL : 1) * (user.stamina / 100);
      user.velocity = { x: d.x * speed, y: d.y * speed };
      user.facing = Math.atan2(d.y, d.x);
      user.position = clampPitch({
        x: user.position.x + user.velocity.x * dt,
        y: user.position.y + user.velocity.y * dt,
      });
      if (sprint) user.stamina = Math.max(0, user.stamina - 8 * dt);
      else user.stamina = Math.min(100, user.stamina + 1.5 * dt);
    }
    return;
  }

  if (cmd.type === "Pass" || cmd.type === "ThroughBall" || cmd.type === "Shoot" || cmd.type === "Cross") {
    if (!user.hasBall) return;
    user.target = cmd.aim;
    state.ball.ownerId = null;
    user.hasBall = false;
    const aim = norm({
      x: cmd.aim.x - user.position.x,
      y: cmd.aim.y - user.position.y,
    });
    const power =
      cmd.type === "Shoot" ? 22 : cmd.type === "Cross" ? 18 : cmd.type === "ThroughBall" ? 16 : 14;
    state.ball.velocity = { x: aim.x * power, y: aim.y * power };
    state.ball.height = cmd.type === "Cross" || cmd.type === "Shoot" ? 0.4 : 0.05;
    state.events.push({
      minute: state.minute,
      type: cmd.type === "Shoot" ? "Shot" : "Pass",
      playerId: user.id,
      clubSide: user.side,
      description: `${cmd.type} from user`,
    });
    return;
  }

  if (cmd.type === "Tackle") {
    state.events.push({
      minute: state.minute,
      type: "Tackle",
      playerId: user.id,
      clubSide: user.side,
      description: "User attempts tackle",
    });
  }
}
