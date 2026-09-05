/**
 * Playable highlight session — you choose actions at key moments.
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
import { Events } from "../core/events.js";
import { onMatchFinished } from "../news/engine.js";

export type PlayablePhase = "PreMatch" | "Playing" | "Highlight" | "FullTime";

export interface PlayableMatchSession {
  match: Match;
  phase: PlayablePhase;
  currentMoment: InteractiveMoment | null;
  momentsResolved: number;
  momentsPlanned: number;
  lastOutcome: MomentOutcome | null;
  outcomeLog: { minute: number; type: string; action: string; result: string; success: boolean }[];
}

const sessions = new Map<string, PlayableMatchSession>();

const MOMENT_TYPES: MomentType[] = [
  "ShotOpportunity",
  "OneVOne",
  "ThroughBall",
  "Cross",
];

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
  world.matches.set(match.id, match);

  // Put user on pitch
  const userId = world.userPlayerId;
  if (userId) {
    const user = world.players.get(userId);
    const clubId = user?.currentClubId;
    if (clubId === match.home.clubId && !match.home.startingXI.includes(userId)) {
      if (match.home.startingXI.length >= 11) match.home.startingXI[10] = userId;
      else match.home.startingXI.push(userId);
    }
    if (clubId === match.away.clubId && !match.away.startingXI.includes(userId)) {
      if (match.away.startingXI.length >= 11) match.away.startingXI[10] = userId;
      else match.away.startingXI.push(userId);
    }
  }

  const session: PlayableMatchSession = {
    match,
    phase: "Playing",
    currentMoment: null,
    momentsResolved: 0,
    momentsPlanned: 3, // always 3 decisions per match
    lastOutcome: null,
    outcomeLog: [],
  };
  sessions.set(match.id, session);

  // First decision right away
  offerNextMoment(world, session);
  return session;
}

function offerNextMoment(world: World, session: PlayableMatchSession): InteractiveMoment | null {
  if (session.momentsResolved >= session.momentsPlanned) {
    session.currentMoment = null;
    session.phase = "Playing";
    return null;
  }
  const userId = world.userPlayerId;
  if (!userId) return null;
  const user = world.players.get(userId);
  if (!user) return null;

  const minutes = [22, 51, 74];
  const minute = minutes[session.momentsResolved] ?? 60 + session.momentsResolved * 10;
  const type = MOMENT_TYPES[session.momentsResolved % MOMENT_TYPES.length]!;

  const ctx = {
    ...(session.match.context as any),
    minute,
    homeScore: session.match.homeScore ?? 0,
    awayScore: session.match.awayScore ?? 0,
  };
  const moment = buildMoment(type, user, ctx, true, 1, `mom-${session.momentsResolved}`);
  moment.minute = minute;
  moment.description = `${minute}' — ${describeMoment(type, user.displayName)}`;
  session.currentMoment = moment;
  session.phase = "Highlight";
  return moment;
}

function describeMoment(type: MomentType, name: string): string {
  switch (type) {
    case "ShotOpportunity":
      return `${name} finds space in the box — shot on?`;
    case "OneVOne":
      return `${name} is clean through on goal!`;
    case "ThroughBall":
      return `${name} can split the defence with a pass.`;
    case "Cross":
      return `${name} has the byline — cross or cut inside?`;
    default:
      return `${name} is in a key moment.`;
  }
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
  session.momentsResolved += 1;
  session.outcomeLog.push({
    minute: moment.minute,
    type: moment.type,
    action: actionId,
    result: outcome.description,
    success: outcome.success,
  });

  // Apply to match score lightly when goal
  if (outcome.goalScored || outcome.goal) {
    const onHome = session.match.home.startingXI.includes(userId);
    if (onHome) session.match.homeScore = (session.match.homeScore || 0) + 1;
    else session.match.awayScore = (session.match.awayScore || 0) + 1;
  }

  // Track player stats
  if (!session.match.playerStats.has(userId)) {
    session.match.playerStats.set(userId, {
      playerId: userId,
      minutes: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      shotsOnTarget: 0,
      keyPasses: 0,
      tackles: 0,
      fouls: 0,
      errors: 0,
      yellow: false,
      red: false,
      rating: 60,
    } as any);
  }
  const st = session.match.playerStats.get(userId)!;
  st.goals = (st.goals || 0) + (outcome.stats?.goals || 0);
  st.assists = (st.assists || 0) + (outcome.stats?.assists || 0);
  st.shots = (st.shots || 0) + (outcome.stats?.shots || 0);
  st.keyPasses = (st.keyPasses || 0) + (outcome.stats?.keyPasses || 0);

  session.currentMoment = null;

  // More decisions?
  if (session.momentsResolved < session.momentsPlanned) {
    offerNextMoment(world, session);
  } else {
    session.phase = "Playing";
  }

  return outcome;
}

export function autoCompletePlayable(world: World, session: PlayableMatchSession): void {
  // Auto-resolve any remaining decisions
  while (session.currentMoment && session.momentsResolved < session.momentsPlanned) {
    const user = world.players.get(world.userPlayerId!)!;
    const auto = autoResolveMoment(session.currentMoment, user, world.rng);
    resolveHighlight(world, session, auto.actionId || "shoot");
  }

  try {
    simulateMatch(world, session.match, world.rng);
  } catch (e) {
    console.error("[playable] simulateMatch failed", e);
    session.match.status = "Finished";
  }
  session.phase = "FullTime";
  session.match.status = "Finished";
  session.currentMoment = null;
  world.matches.set(session.match.id, session.match);

  if (world.userPlayerId) {
    let stats = session.match.playerStats?.get(world.userPlayerId);
    const started =
      session.match.home.startingXI.includes(world.userPlayerId) ||
      session.match.away.startingXI.includes(world.userPlayerId);
    if (!stats && started) {
      stats = {
        playerId: world.userPlayerId,
        minutes: 90,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        tackles: 0,
        fouls: 0,
        errors: 0,
        yellow: false,
        red: false,
        rating: 65,
      } as any;
      session.match.playerStats.set(world.userPlayerId, stats);
    }
    if (stats) {
      if (started && (stats.minutes || 0) < 1) stats.minutes = 90;
      try {
        applyCareerConsequences(world, session.match, world.userPlayerId, stats);
      } catch (e) {
        console.error("[playable] consequences", e);
      }
    }
  }

  try {
    world.events.emit(Events.MATCH_FINISHED, {
      matchId: session.match.id,
      homeClubId: session.match.home.clubId,
      awayClubId: session.match.away.clubId,
      homeScore: session.match.homeScore,
      awayScore: session.match.awayScore,
    });
  } catch {}
  try {
    onMatchFinished(world, {
      matchId: session.match.id,
      homeClubId: session.match.home.clubId,
      awayClubId: session.match.away.clubId,
      homeScore: session.match.homeScore,
      awayScore: session.match.awayScore,
    });
  } catch (e) {
    console.error("[playable] news", e);
  }
}

/** Finish remaining sim after player finished all decisions */
export function completeAfterDecisions(world: World, session: PlayableMatchSession): void {
  if (session.phase === "FullTime") return;
  // clear any stray moment
  session.currentMoment = null;
  autoCompletePlayable(world, session);
}

export function playableSnapshot(session: PlayableMatchSession) {
  const m = session.match;
  const moment = session.currentMoment;
  return {
    matchId: m.id,
    phase: session.phase,
    score: `${m.homeScore ?? 0}-${m.awayScore ?? 0}`,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    homeClubId: m.home.clubId,
    awayClubId: m.away.clubId,
    momentsResolved: session.momentsResolved,
    momentsPlanned: session.momentsPlanned,
    lastOutcome: session.lastOutcome
      ? {
          success: session.lastOutcome.success,
          description: session.lastOutcome.description,
          goal: session.lastOutcome.goal || session.lastOutcome.goalScored,
        }
      : null,
    outcomeLog: session.outcomeLog,
    moment: moment
      ? {
          minute: moment.minute,
          type: moment.type,
          description: moment.description,
          contextLine: moment.contextLine,
          actions: (moment.actions || []).map((a) => ({
            id: a.id,
            label: a.label,
          })),
        }
      : null,
  };
}
