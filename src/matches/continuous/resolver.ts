/**
 * Resolve intents (pass, shoot, tackle) into match events + ball state.
 * Uses simple geometry + RNG - not full physics.
 */

import type { ContinuousMatchState, ContinuousPlayer, Vec2, PitchSide } from "./types.js";
import { PITCH } from "./types.js";
import { RNG } from "../../core/rng.js";
import type { World } from "../../world/world.js";

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function goalMouth(side: PitchSide): Vec2 {
  return side === "home"
    ? { x: PITCH.width, y: PITCH.height / 2 }
    : { x: 0, y: PITCH.height / 2 };
}

export function resolveIntents(world: World, state: ContinuousMatchState, rng: RNG): void {
  for (const p of state.players) {
    if (!p.onPitch) continue;
    const intent = (p as any)._intent as string | undefined;
    if (!intent) continue;
    (p as any)._intent = undefined;
    const aim = ((p as any)._aim as Vec2 | undefined) ?? goalMouth(p.side === "home" ? "home" : "away");

    if (intent === "shoot" && p.hasBall) {
      resolveShot(world, state, p, aim, rng);
    } else if ((intent === "pass" || intent === "through" || intent === "cross") && p.hasBall) {
      resolvePass(state, p, intent, aim, rng);
    } else if (intent === "tackle") {
      resolveTackle(state, p, rng);
    }
  }
}

function resolveShot(
  world: World,
  state: ContinuousMatchState,
  p: ContinuousPlayer,
  aim: Vec2,
  rng: RNG
): void {
  const goal = goalMouth(p.side === "home" ? "home" : "away");
  const d = dist(p.position, goal);
  const player = world.players.get(p.id);
  const finishing = player?.attributes.technical.finishing ?? 60;
  const chance = Math.max(0.05, Math.min(0.75, (finishing / 100) * (1 - d / 40)));
  p.hasBall = false;
  state.ball.ownerId = null;

  if (rng.chance(chance) && d < 28) {
    if (p.side === "home") state.homeScore++;
    else state.awayScore++;
    state.events.push({
      minute: state.minute,
      type: "Goal",
      playerId: p.id,
      clubSide: p.side,
      description: `GOAL! (${state.minute}')`,
      meta: { continuous: true },
    });
    state.ball.position = { x: PITCH.width / 2, y: PITCH.height / 2 };
    state.ball.velocity = { x: 0, y: 0 };
  } else {
    state.events.push({
      minute: state.minute,
      type: "Shot",
      playerId: p.id,
      clubSide: p.side,
      description: `Shot off target (${state.minute}')`,
    });
    state.ball.position = { x: goal.x + (p.side === "home" ? -3 : 3), y: goal.y + rng.float(-5, 5) };
    state.ball.velocity = { x: 0, y: 0 };
  }
}

function resolvePass(
  state: ContinuousMatchState,
  p: ContinuousPlayer,
  kind: string,
  aim: Vec2,
  rng: RNG
): void {
  const mates = state.players.filter((x) => x.onPitch && x.side === p.side && x.id !== p.id);
  let best: ContinuousPlayer | null = null;
  let bestD = Infinity;
  for (const m of mates) {
    const d = dist(m.position, aim);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  p.hasBall = false;
  if (best && bestD < 20 && rng.chance(kind === "through" ? 0.7 : 0.85)) {
    best.hasBall = true;
    state.ball.ownerId = best.id;
    state.ball.position = { ...best.position };
    state.possessionSide = p.side;
    state.events.push({
      minute: state.minute,
      type: "Pass",
      playerId: p.id,
      clubSide: p.side,
      description: `Pass completed`,
    });
  } else {
    state.ball.ownerId = null;
    state.ball.position = { x: aim.x + rng.float(-3, 3), y: aim.y + rng.float(-3, 3) };
    state.events.push({
      minute: state.minute,
      type: "Pass",
      playerId: p.id,
      clubSide: p.side,
      description: `Pass incomplete`,
      meta: { failed: true },
    });
  }
}

function resolveTackle(state: ContinuousMatchState, p: ContinuousPlayer, rng: RNG): void {
  const owner = state.players.find((x) => x.id === state.ball.ownerId);
  if (!owner || owner.side === p.side) return;
  if (dist(p.position, owner.position) > 2.8) return;
  if (rng.chance(0.45)) {
    owner.hasBall = false;
    p.hasBall = true;
    state.ball.ownerId = p.id;
    state.possessionSide = p.side;
    state.events.push({
      minute: state.minute,
      type: "Tackle",
      playerId: p.id,
      clubSide: p.side,
      description: `Tackle won`,
    });
  } else if (rng.chance(0.2)) {
    state.events.push({
      minute: state.minute,
      type: "Foul",
      playerId: p.id,
      clubSide: p.side,
      description: `Foul`,
    });
  }
}
