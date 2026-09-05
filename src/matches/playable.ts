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
  const match = createMatch(world, homeClubId as any, awayClubId as any, date, competitionId as any);
  // Store on world so stats views can find it
  world.matches.set(match.id, match);
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

  if (session.momentsResolved >= 3) return null;
  if (!world.rng.chance(0.35)) return null;

  const types: MomentType[] = ["ShotOpportunity", "OneVOne", "ThroughBall", "Cross"];
  const type = world.rng.pick(types);
  const moment = buildMoment(type, user, session.match.context ?? { homeScore: 0, awayScore: 0 }, true);
  session.currentMoment = moment;
  session.phase = "Highlight";
  return moment;
}

export function resolveHighlight(
  world: World,
  session: PlayableMatchSession,
  actionId: string
): MomentOutcome {
  const userId = world.userPlayerId!;
  const user = world.players.get(userId)!;
  const moment = session.currentMoment;
  if (!moment) {
    return {
      success: false,
      description: "No moment",
      goal: false,
      goalScored: false,
      assist: false,
      ratingDelta: 0,
      momentumDelta: 0,
      stats: { goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0 },
    };
  }

  const outcome = resolveMoment(moment, actionId, user, session.match.context, world.rng);
  session.lastOutcome = outcome;
  session.currentMoment = null;
  session.momentsResolved += 1;
  session.phase = "Playing";

  if (!(session.match as any).interactiveMoments) (session.match as any).interactiveMoments = [];
  (session.match as any).interactiveMoments.push({
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
    const auto = autoResolveMoment(session.currentMoment, user, world.rng);
    session.lastOutcome = auto.outcome ?? auto;
    session.currentMoment = null;
    session.momentsResolved += 1;
  }
  try {
    simulateMatch(world, session.match, world.rng);
  } catch (e) {
    console.error("[playable] simulateMatch failed", e);
    // Soft finish so UI is not stuck
    session.match.status = "Finished";
    if (session.match.homeScore == null) (session.match as any).homeScore = 0;
    if (session.match.awayScore == null) (session.match as any).awayScore = 0;
  }
  session.phase = "FullTime";
  session.match.status = "Finished";
  world.matches.set(session.match.id, session.match);

  if (world.userPlayerId && session.match.playerStats?.has(world.userPlayerId)) {
    try {
      applyCareerConsequences(
        world,
        session.match,
        world.userPlayerId,
        session.match.playerStats.get(world.userPlayerId)!
      );
    } catch (e) {
      console.error("[playable] consequences", e);
    }
  }
}

export function playableSnapshot(session: PlayableMatchSession) {
  return {
    matchId: session.match.id,
    phase: session.phase,
    score: `${session.match.homeScore}–${session.match.awayScore}`,
    homeClubId: session.match.home.clubId,
    awayClubId: session.match.away.clubId,
    moment: session.currentMoment,
    lastOutcome: session.lastOutcome,
    momentsResolved: session.momentsResolved,
  };
}
