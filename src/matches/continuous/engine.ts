/**
 * Continuous 22-player match engine.
 */

import type { EntityId } from "../../core/types.js";
import type { World } from "../../world/world.js";
import type { Match } from "../types.js";
import type { FormationId } from "../tactics.js";
import { RNG } from "../../core/rng.js";
import { Events } from "../../core/events.js";
import {
  type ContinuousMatchState,
  type ContinuousPlayer,
  type UserCommand,
  PITCH,
} from "./types.js";
import { formationSlots, slotToWorld } from "./formations-pitch.js";
import { updateAIPlayer, updateGK } from "./ai.js";
import { applyUserCommand } from "./controller.js";
import { resolveIntents } from "./resolver.js";

const sessions = new Map<string, ContinuousMatchState>();

export function getContinuous(id: string): ContinuousMatchState | null {
  return sessions.get(id) ?? null;
}

export function startContinuousMatch(
  world: World,
  match: Match,
  userPlayerId?: EntityId | null
): ContinuousMatchState {
  const userId = userPlayerId ?? world.userPlayerId;
  const players: ContinuousPlayer[] = [];

  const buildSide = (
    side: "home" | "away",
    ids: EntityId[],
    formation: FormationId
  ) => {
    const slots = formationSlots(formation);
    for (let i = 0; i < Math.min(11, ids.length); i++) {
      const id = ids[i]!;
      const slot = slots[i] ?? slots[slots.length - 1]!;
      const pos = slotToWorld(slot.rx, slot.ry, side);
      const pl = world.players.get(id);
      players.push({
        id,
        side,
        role: slot.role,
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        facing: side === "home" ? 0 : Math.PI,
        stamina: pl?.state.fitness ?? 80,
        onPitch: true,
        isUser: id === userId,
        target: { ...pos },
        hasBall: false,
      });
    }
  };

  if (userId) {
    const player = world.players.get(userId);
    if (player) {
      const inHome =
        player.currentClubId === match.home.clubId ||
        (world.clubs.get(match.home.clubId)?.squadPlayerIds.includes(userId) ?? false);
      const inAway =
        player.currentClubId === match.away.clubId ||
        (world.clubs.get(match.away.clubId)?.squadPlayerIds.includes(userId) ?? false);
      const side = inHome ? match.home : inAway ? match.away : null;
      if (side && !side.startingXI.includes(userId)) {
        if (side.startingXI.length >= 11) {
          side.startingXI[side.startingXI.length - 2] = userId;
        } else {
          side.startingXI.push(userId);
        }
        side.substitutes = side.substitutes.filter((id) => id !== userId);
      }
    }
  }

  buildSide("home", match.home.startingXI, match.home.formation as FormationId);
  buildSide("away", match.away.startingXI, match.away.formation as FormationId);

  const state: ContinuousMatchState = {
    matchId: match.id,
    minute: 0,
    second: 0,
    homeScore: 0,
    awayScore: 0,
    phase: "FirstHalf",
    players,
    ball: {
      position: { x: PITCH.width / 2, y: PITCH.height / 2 },
      velocity: { x: 0, y: 0 },
      ownerId: null,
      height: 0,
    },
    possessionSide: null,
    homeFormation: match.home.formation as FormationId,
    awayFormation: match.away.formation as FormationId,
    events: [{ minute: 0, type: "KickOff", description: "Kick-off" }],
    userPlayerId: userId,
    tick: 0,
  };

  const homeMid =
    players.find((p) => p.side === "home" && String(p.role).includes("Playmaker")) ??
    players.find((p) => p.side === "home" && !String(p.role).includes("Goalkeeper"));
  if (homeMid) {
    homeMid.hasBall = true;
    state.ball.ownerId = homeMid.id;
    state.ball.position = { ...homeMid.position };
    state.possessionSide = "home";
  }

  sessions.set(match.id, state);
  return state;
}

export function tickContinuous(
  world: World,
  matchId: string,
  dt: number,
  cmd: UserCommand = { type: "Idle" },
  rng?: RNG
): ContinuousMatchState {
  const state = sessions.get(matchId);
  if (!state || state.phase === "FullTime" || state.phase === "HalfTime") {
    if (!state) throw new Error("No continuous match");
    return state;
  }

  const r = rng ?? world.rng;
  state.tick++;

  const matchSeconds = dt * 4;
  state.second += matchSeconds;
  while (state.second >= 60) {
    state.second -= 60;
    state.minute++;
  }

  applyUserCommand(state, cmd, dt);

  for (const p of state.players) {
    if (!p.onPitch) continue;
    if (p.isUser) continue;
    if (p.role === "Goalkeeper") updateGK(state, p, dt);
    else updateAIPlayer(state, p, dt, r);

    p.position.x = Math.max(0.5, Math.min(PITCH.width - 0.5, p.position.x + p.velocity.x * dt));
    p.position.y = Math.max(0.5, Math.min(PITCH.height - 0.5, p.position.y + p.velocity.y * dt));
    p.stamina = Math.max(0, p.stamina - 0.8 * dt);
  }

  const owner = state.players.find((p) => p.id === state.ball.ownerId);
  if (owner) {
    state.ball.position = {
      x: owner.position.x + Math.cos(owner.facing) * 0.7,
      y: owner.position.y + Math.sin(owner.facing) * 0.7,
    };
  } else if (state.ball.velocity.x || state.ball.velocity.y) {
    state.ball.position.x += state.ball.velocity.x * dt;
    state.ball.position.y += state.ball.velocity.y * dt;
    state.ball.velocity.x *= 0.92;
    state.ball.velocity.y *= 0.92;
  }

  if (!state.ball.ownerId) {
    let closest: ContinuousPlayer | null = null;
    let cd = 2.0;
    for (const p of state.players) {
      if (!p.onPitch) continue;
      const d = Math.hypot(p.position.x - state.ball.position.x, p.position.y - state.ball.position.y);
      if (d < cd) {
        cd = d;
        closest = p;
      }
    }
    if (closest) {
      closest.hasBall = true;
      state.ball.ownerId = closest.id;
      state.possessionSide = closest.side;
      for (const o of state.players) if (o.id !== closest.id) o.hasBall = false;
    }
  }

  resolveIntents(world, state, r);

  if (state.phase === "FirstHalf" && state.minute >= 45) {
    state.phase = "HalfTime";
  }
  if (state.phase === "SecondHalf" && state.minute >= 90) {
    state.phase = "FullTime";
    bridgeToCareer(world, state);
  }

  return state;
}

export function startSecondHalf(matchId: string): void {
  const state = sessions.get(matchId);
  if (!state) return;
  state.phase = "SecondHalf";
  state.minute = 45;
  state.second = 0;
  state.ball.position = { x: PITCH.width / 2, y: PITCH.height / 2 };
  state.ball.ownerId = null;
  for (const p of state.players) p.hasBall = false;
}

export function simUntil(
  world: World,
  matchId: string,
  targetMinute: number,
  rng?: RNG
): ContinuousMatchState {
  const state = sessions.get(matchId);
  if (!state) throw new Error("No match");
  let guard = 0;
  while (
    state.minute < targetMinute &&
    state.phase !== "FullTime" &&
    state.phase !== "HalfTime" &&
    guard < 5000
  ) {
    tickContinuous(world, matchId, 0.25, { type: "Idle" }, rng);
    guard++;
  }
  return state;
}

function bridgeToCareer(world: World, state: ContinuousMatchState): void {
  for (const e of state.events) {
    if (e.type === "Goal" && e.playerId) {
      world.events.emit(Events.GOAL_SCORED, {
        playerId: e.playerId,
        matchId: state.matchId,
        minute: e.minute,
        source: "continuous",
      });
    }
  }
  world.events.emit(Events.MATCH_FINISHED, {
    matchId: state.matchId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    source: "continuous",
  });
}

export function continuousSnapshot(state: ContinuousMatchState) {
  return {
    matchId: state.matchId,
    minute: state.minute,
    second: Math.floor(state.second),
    scoreline: `${state.homeScore}-${state.awayScore}`,
    phase: state.phase,
    ball: state.ball.position,
    players: state.players.map((p) => ({
      id: p.id,
      side: p.side,
      x: p.position.x,
      y: p.position.y,
      isUser: p.isUser,
      hasBall: p.hasBall,
      role: p.role,
    })),
    lastEvents: state.events.slice(-6),
    userHasBall: state.players.some((p) => p.isUser && p.hasBall),
  };
}
