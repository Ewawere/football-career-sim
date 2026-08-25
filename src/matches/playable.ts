/**
 * Playable highlight session — hybrid sim + interactive moments.
 */

import type { World } from "../world/world.js";
import type { Match } from "./types.js";
import { createMatch, simulateMatch } from "./engine.js";
import {
  buildMoment,
  resolveMoment,
  autoResolveMoment,
  type InteractiveMoment,
  type MomentOutcome,
} from "./moments.js";
import type { MomentType } from "./types.js";
import { applyCareerConsequences } from "./performance.js";

export type PlayablePhase = "PreMatch" | "Playing" | "Highlight" | "FullTime";

export interface PlayableMatchSession {
  match: Match;
  phase: PlayablePhase;
  currentMoment: InteractiveMoment | null;
  momentsResolved: number;
  lastOutcome: MomentOutcome | null;
}

const sessions = new Map<string, PlayableMatchSession>();

export function getPlayableSession(matchId: string): PlayableMatchSession | undefined {
  return sessions.get(matchId);
}

export function startPlayableMatch(
  world: World,
  homeClubId: string,
  awayClubId: string,
  date: string,
  competitionId: string | null = null
): PlayableMatchSession {
  const match = createMatch(world, homeClubId, awayClubId, date, competitionId);
  const session: PlayableMatchSession = {
    match,
    phase: "PreMatch",
    currentMoment: null,
    momentsResolved: 0,
    lastOutcome: null,
  };
  sessions.set(match.id, session);
  return session;
}

export function kickOffPlayable(session: PlayableMatchSession): void {
  session.phase = "Playing";
  session.match.status = "InProgress";
}

export function playUntilHighlight(
  world: World,
  session: PlayableMatchSession
): InteractiveMoment | null {
  const userId = world.userPlayerId;
  if (!userId || session.phase === "FullTime") return null;
  const user = world.players.get(userId);
  if (!user) return null;

  const onPitch =
    session.match.home.startingXI.includes(userId) ||
    session.match.away.startingXI.includes(userId);
  if (!onPitch) return null;

  // Offer up to a few highlights mid-sim
  if (session.momentsResolved >= 3) return null;
  if (!world.rng.chance(0.35)) return null;

  const types: MomentType[] = [
    "ShotOpportunity",
    "OneVOne",
    "ThroughBall",
    "Cross",
    "CounterAttack",
  ];
  const type = world.rng.pick(types);
  const minute = 15 + session.momentsResolved * 20 + world.rng.int(0, 10);
  const moment = buildMoment(type, user, minute, session.match.context);
  session.currentMoment = moment;
  session.phase = "Highlight";
  return moment;
}

export function resolveHighlight(
  world: World,
  session: PlayableMatchSession,
  actionId: string
): MomentOutcome {
  const moment = session.currentMoment;
  const userId = world.userPlayerId!;
  const user = world.players.get(userId)!;
  if (!moment) {
    return { success: false, description: "No active moment", goal: false, assist: false, ratingDelta: 0 };
  }

  const outcome = resolveMoment(moment, actionId, user, world.rng);
  session.lastOutcome = outcome;
  session.momentsResolved += 1;
  session.currentMoment = null;
  session.phase = "Playing";

  const stats = session.match.playerStats.get(userId);
  if (stats) {
    if (outcome.goal) {
      stats.goals += 1;
      const isHome = session.match.home.startingXI.includes(userId);
      if (isHome) session.match.homeScore += 1;
      else session.match.awayScore += 1;
    }
    if (outcome.assist) stats.assists += 1;
    stats.rating = Math.max(40, Math.min(95, stats.rating + outcome.ratingDelta));
  }

  session.match.interactiveMoments.push({
    minute: moment.minute,
    momentType: moment.type,
    description: moment.description,
    chosenActionId: actionId,
    outcome: outcome.description,
    success: outcome.success,
  });

  return outcome;
}

export function autoCompletePlayable(world: World, session: PlayableMatchSession): void {
  while (session.currentMoment) {
    const user = world.players.get(world.userPlayerId!)!;
    autoResolveMoment(session.currentMoment, user, world.rng);
    session.currentMoment = null;
    session.momentsResolved += 1;
  }
  // Finish rest of match via sim
  simulateMatch(world, session.match, world.rng);
  session.phase = "FullTime";
  if (world.userPlayerId && session.match.playerStats.has(world.userPlayerId)) {
    applyCareerConsequences(
      world,
      session.match,
      world.userPlayerId,
      session.match.playerStats.get(world.userPlayerId)!
    );
  }
}

export function playableSnapshot(session: PlayableMatchSession) {
  return {
    matchId: session.match.id,
    phase: session.phase,
    score: `${session.match.homeScore}–${session.match.awayScore}`,
    moment: session.currentMoment,
    lastOutcome: session.lastOutcome,
    momentsResolved: session.momentsResolved,
  };
}
