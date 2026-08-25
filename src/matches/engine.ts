/**
 * Match simulation engine (simplified but event-producing).
 */

import { nextId } from "../core/id.js";
import type { EntityId, GameDate } from "../core/types.js";
import type { RNG } from "../core/rng.js";
import type { World } from "../world/world.js";
import { pickStartingXI } from "../career/selection.js";
import { applyMatchRating } from "../players/player.js";
import {
  injuryChanceThisMinute,
  createInjury,
  isPlayerInjured,
} from "../injuries/engine.js";
import type {
  Match,
  MatchResultSummary,
  PlayerMatchStats,
  MatchEvent,
  MatchContext,
  CareerMatchEffects,
} from "./types.js";
import { Events } from "../core/events.js";

function emptyStats(playerId: EntityId): PlayerMatchStats {
  return {
    playerId,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyPasses: 0,
    chancesCreated: 0,
    tackles: 0,
    interceptions: 0,
    dribbles: 0,
    fouls: 0,
    errors: 0,
    yellow: false,
    red: false,
    passAttempts: 0,
    passCompleted: 0,
    rating: 60,
  };
}

export function createMatch(
  world: World,
  homeClubId: EntityId,
  awayClubId: EntityId,
  date: GameDate,
  competitionId: EntityId | null = null,
  homeFormation = "4-3-3",
  awayFormation = "4-2-3-1",
  importance = 0.5
): Match {
  const homeXI = pickStartingXI(world, homeClubId, homeFormation, importance);
  const awayXI = pickStartingXI(world, awayClubId, awayFormation, importance);

  const match: Match = {
    id: nextId("mt"),
    competitionId,
    home: {
      clubId: homeClubId,
      startingXI: homeXI,
      bench: [],
      formation: homeFormation,
      roles: new Map(),
    },
    away: {
      clubId: awayClubId,
      startingXI: awayXI,
      bench: [],
      formation: awayFormation,
      roles: new Map(),
    },
    date,
    status: "Scheduled",
    homeScore: 0,
    awayScore: 0,
    events: [],
    playerStats: new Map(),
    momentum: 0,
    possessionHome: 50,
    context: {
      minute: 0,
      homeScore: 0,
      awayScore: 0,
      momentum: 0,
      possessionHome: 50,
      shotsHome: 0,
      shotsAway: 0,
      matchImportance: importance,
      intensity: 0.8 + importance * 0.4,
    },
    interactiveMoments: [],
  };

  for (const id of [...homeXI, ...awayXI]) {
    match.playerStats.set(id, emptyStats(id));
  }

  world.matches.set(match.id, match);
  return match;
}

export function simulateMatch(
  world: World,
  match: Match,
  rng: RNG,
  _handler?: (moment: unknown) => string
): MatchResultSummary {
  match.status = "InProgress";
  const home = world.clubs.get(match.home.clubId)!;
  const away = world.clubs.get(match.away.clubId)!;

  const homeStr =
    match.home.startingXI.reduce((s, id) => s + (world.players.get(id)?.ovr ?? 60), 0) /
    Math.max(1, match.home.startingXI.length);
  const awayStr =
    match.away.startingXI.reduce((s, id) => s + (world.players.get(id)?.ovr ?? 60), 0) /
    Math.max(1, match.away.startingXI.length);

  for (let minute = 1; minute <= 90; minute++) {
    match.context.minute = minute;
    match.context.intensity = 0.85 + (minute > 75 ? 0.2 : 0);

    // Injuries
    for (const id of [...match.home.startingXI, ...match.away.startingXI]) {
      const p = world.players.get(id);
      if (!p || isPlayerInjured(world, id)) continue;
      if (injuryChanceThisMinute(p, minute, match.context.intensity, rng)) {
        const inj = createInjury(world, p, match.date, match.id, rng);
        match.events.push({
          minute,
          type: "Injury",
          playerId: id,
          clubId: p.currentClubId!,
          description: `${p.displayName} injured (${inj.name})`,
        });
      }
    }

    // Chance of goal-ish event
    const homeChance = 0.018 * (homeStr / Math.max(50, awayStr));
    const awayChance = 0.018 * (awayStr / Math.max(50, homeStr));

    if (rng.chance(homeChance)) {
      match.context.shotsHome += 1;
      if (rng.chance(0.32 + homeStr / 400)) {
        const scorer = rng.pick(match.home.startingXI.filter((id) => !isPlayerInjured(world, id)));
        if (scorer) {
          match.homeScore += 1;
          match.context.homeScore = match.homeScore;
          const st = match.playerStats.get(scorer)!;
          st.goals += 1;
          st.shots += 1;
          st.shotsOnTarget += 1;
          match.events.push({
            minute,
            type: "Goal",
            playerId: scorer,
            clubId: home.id,
            description: `${world.players.get(scorer)!.displayName} scores for ${home.name}`,
          });
          match.momentum = Math.min(100, match.momentum + 15);
          world.events.emit(Events.GOAL_SCORED, { matchId: match.id, playerId: scorer, clubId: home.id, minute });
        }
      }
    }

    if (rng.chance(awayChance)) {
      match.context.shotsAway += 1;
      if (rng.chance(0.32 + awayStr / 400)) {
        const scorer = rng.pick(match.away.startingXI.filter((id) => !isPlayerInjured(world, id)));
        if (scorer) {
          match.awayScore += 1;
          match.context.awayScore = match.awayScore;
          const st = match.playerStats.get(scorer)!;
          st.goals += 1;
          st.shots += 1;
          st.shotsOnTarget += 1;
          match.events.push({
            minute,
            type: "Goal",
            playerId: scorer,
            clubId: away.id,
            description: `${world.players.get(scorer)!.displayName} scores for ${away.name}`,
          });
          match.momentum = Math.max(-100, match.momentum - 15);
          world.events.emit(Events.GOAL_SCORED, { matchId: match.id, playerId: scorer, clubId: away.id, minute });
        }
      }
    }
  }

  // Minutes + ratings
  for (const id of [...match.home.startingXI, ...match.away.startingXI]) {
    const st = match.playerStats.get(id);
    const p = world.players.get(id);
    if (!st || !p) continue;
    st.minutes = isPlayerInjured(world, id) ? rng.int(20, 70) : 90;
    st.rating = Math.min(
      95,
      Math.max(40, 60 + st.goals * 8 + st.assists * 5 + rng.int(-6, 6))
    );
    applyMatchRating(p, st.rating, st.minutes, st.goals, st.assists);
    p.state.fitness = Math.max(40, p.state.fitness - rng.int(4, 12));
    p.state.fatigue = Math.min(100, p.state.fatigue + rng.int(5, 15));
  }

  match.status = "Finished";
  world.events.emit(Events.MATCH_COMPLETED, {
    matchId: match.id,
    homeClubId: match.home.clubId,
    awayClubId: match.away.clubId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  });

  let careerEffects: CareerMatchEffects | undefined;
  if (world.userPlayerId && match.playerStats.has(world.userPlayerId)) {
    const st = match.playerStats.get(world.userPlayerId)!;
    const user = world.players.get(world.userPlayerId)!;
    const formDelta = (st.rating - 60) * 0.2;
    user.state.form = Math.max(0, Math.min(100, user.state.form + formDelta));
    const trustDelta = st.rating >= 75 ? 4 : st.rating >= 65 ? 1 : st.rating < 50 ? -4 : 0;
    user.state.managerTrust = Math.max(0, Math.min(100, user.state.managerTrust + trustDelta));
    careerEffects = {
      playerId: user.id,
      rating: st.rating,
      formDelta,
      moraleDelta: trustDelta,
      managerTrustDelta: trustDelta,
      reputationDelta: st.goals > 0 ? 1 : 0,
      managerReaction:
        trustDelta > 2 ? "IncreasedTrust" : trustDelta < -2 ? "ReducedTrust" : "Neutral",
      notes: [
        `Rating ${st.rating.toFixed(0)}`,
        st.goals ? `${st.goals} goal(s)` : "No goals",
        `Trust ${user.state.managerTrust.toFixed(0)}`,
      ],
    };
  }

  return {
    matchId: match.id,
    homeClubId: match.home.clubId,
    awayClubId: match.away.clubId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    events: match.events,
    ratings: new Map([...match.playerStats].map(([id, s]) => [id, s.rating])),
    careerEffects,
  };
}

export function formatMatchReport(world: World, match: Match): string {
  const home = world.clubs.get(match.home.clubId)?.name ?? "Home";
  const away = world.clubs.get(match.away.clubId)?.name ?? "Away";
  let out = `${home} ${match.homeScore}–${match.awayScore} ${away}\n`;
  for (const e of match.events.filter((x) => x.type === "Goal" || x.type === "Injury")) {
    out += `  ${e.minute}' ${e.description}\n`;
  }
  return out;
}
