/**
 * Match simulation engine.
 * Integrates: strength, formations/roles, momentum, injuries, subs,
 * interactive moments (auto-resolved unless caller intercepts), performance pipeline.
 */

import { RNG } from "../core/rng.js";
import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import type {
  Match,
  MatchTeamLineup,
  MatchEvent,
  PlayerMatchStats,
  MatchResultSummary,
  MatchContext,
} from "./types.js";
import { pickStartingXI } from "../career/selection.js";
import {
  getFormation,
  defaultRoleFor,
  getRoleProfile,
  type FormationId,
  type TacticalRole,
} from "./tactics.js";
import {
  injuryChanceThisMinute,
  createInjury,
  getActiveInjury,
} from "../injuries/engine.js";
import {
  shouldGenerateMoment,
  buildMoment,
  autoResolveMoment,
  resolveMoment,
  type InteractiveMoment,
} from "./moments.js";
import { computeTeamAI, pickSmartSub } from "./match-ai.js";
import { runPostMatchPipeline, computeRating } from "./performance.js";
import { Events } from "../core/events.js";

function createEmptyStats(playerId: EntityId, role?: TacticalRole): PlayerMatchStats {
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
    rating: 55,
    role,
  };
}

function teamStrength(world: World, lineup: MatchTeamLineup): number {
  let total = 0;
  let count = 0;
  for (const id of lineup.startingXI) {
    const p = world.players.get(id);
    if (!p) continue;
    const formFactor = 0.85 + (p.state.form / 100) * 0.3;
    const fitFactor = 0.9 + (p.state.fitness / 100) * 0.15;
    total += p.ovr * formFactor * fitFactor;
    count++;
  }
  return count ? total / count : 50;
}

function assignRoles(world: World, lineup: MatchTeamLineup, formation: FormationId): void {
  const form = getFormation(formation);
  lineup.roles = new Map();
  lineup.startingXI.forEach((id, i) => {
    const slot = form.slots[i];
    const p = world.players.get(id);
    const role = slot
      ? slot.defaultRole
      : defaultRoleFor(p?.primaryPosition ?? "CM", formation);
    lineup.roles.set(id, role);
  });
}

function emptyTeamStats(): import("./types.js").TeamMatchStats {
  return {
    possession: 50,
    xG: 0,
    shots: 0,
    shotsOnTarget: 0,
    touchesInBox: 0,
    bigChances: 0,
    bigChancesMissed: 0,
    accuratePasses: 0,
    passAccuracy: 0,
    fouls: 0,
    offsides: 0,
    corners: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function finalizeTeamStats(match: Match, isHome: boolean): import("./types.js").TeamMatchStats {
  const ids = isHome
    ? [...match.home.startingXI, ...match.home.substitutes]
    : [...match.away.startingXI, ...match.away.substitutes];
  let shots = 0, sot = 0, fouls = 0, yellow = 0, red = 0;
  let passAtt = 0, passComp = 0, keyPasses = 0, chances = 0, goals = 0;
  for (const id of ids) {
    const st = match.playerStats.get(id);
    if (!st) continue;
    shots += st.shots;
    sot += st.shotsOnTarget;
    fouls += st.fouls;
    if (st.yellow) yellow += 1;
    if (st.red) red += 1;
    passAtt += st.passAttempts;
    passComp += st.passCompleted;
    keyPasses += st.keyPasses;
    chances += st.chancesCreated;
    goals += st.goals;
  }
  if (isHome && match.context.shotsHome > shots) shots = match.context.shotsHome;
  if (!isHome && match.context.shotsAway > shots) shots = match.context.shotsAway;

  const possession = isHome ? match.possessionHome : 100 - match.possessionHome;
  const bigChances = Math.max(goals, Math.round(sot * 0.45 + chances * 0.15));
  const bigMissed = Math.max(0, bigChances - goals);
  const xG = Math.round((sot * 0.28 + bigChances * 0.22 + goals * 0.15) * 100) / 100;
  const touchesInBox = Math.round(sot * 2.2 + shots * 0.8 + keyPasses * 0.5);
  const passAccuracy = passAtt > 0 ? Math.round((passComp / passAtt) * 100) : 80 + Math.round(possession * 0.1);
  const accuratePasses = passComp > 20 ? passComp : Math.round(possession * 4.5 + passComp);

  return {
    possession,
    xG: Math.max(0.05, xG),
    shots: Math.max(shots, sot),
    shotsOnTarget: sot,
    touchesInBox: Math.max(touchesInBox, sot + 2),
    bigChances,
    bigChancesMissed: bigMissed,
    accuratePasses,
    passAccuracy: Math.min(97, Math.max(55, passAccuracy)),
    fouls,
    offsides: Math.max(0, Math.round(shots * 0.12)),
    corners: Math.max(0, Math.round(shots * 0.28 + (possession - 40) * 0.08)),
    yellowCards: yellow,
    redCards: red,
  };
}

export function createMatch(
  world: World,
  homeClubId: EntityId,
  awayClubId: EntityId,
  date: string,
  competitionId: EntityId | null = null,
  formationHome: FormationId = "4-3-3",
  formationAway: FormationId = "4-3-3",
  matchImportance = 0.5
): Match {
  const pickXI = (clubId: EntityId, formation: FormationId): MatchTeamLineup => {
    const club = world.clubs.get(clubId)!;
    const starters = pickStartingXI(world, clubId, formation, matchImportance).filter(
      (id) => !getActiveInjury(world, id)
    );
    const used = new Set(starters);
    if (starters.length < 11) {
      for (const id of club.squadPlayerIds) {
        if (starters.length >= 11) break;
        if (used.has(id)) continue;
        if (getActiveInjury(world, id)) continue;
        const p = world.players.get(id);
        if (p && !p.retired) {
          starters.push(id);
          used.add(id);
        }
      }
    }

    const poolIds = [...new Set([...club.squadPlayerIds, ...club.academyPlayerIds])];
    const remaining = poolIds
      .map((id) => world.players.get(id)!)
      .filter((p) => p && !p.retired && !used.has(p.id) && !getActiveInjury(world, p.id));

    const formDef = getFormation(formation);
    const starterPositions = new Set(
      starters.map((id) => world.players.get(id)?.primaryPosition)
    );

    remaining.sort((a, b) => {
      let scoreA = a.ovr;
      let scoreB = b.ovr;
      if (starterPositions.has(a.primaryPosition)) scoreA += 8;
      if (starterPositions.has(b.primaryPosition)) scoreB += 8;
      if (a.age <= 20 && a.potential >= 78) scoreA += 22;
      if (b.age <= 20 && b.potential >= 78) scoreB += 22;
      if (a.isUserControlled) scoreA += 30;
      if (b.isUserControlled) scoreB += 30;
      return scoreB - scoreA;
    });

    let subs = remaining.slice(0, 7).map((p) => p.id);
    const user = remaining.find((p) => p.isUserControlled);
    if (user && !subs.includes(user.id) && !used.has(user.id)) {
      subs = [user.id, ...subs.filter((id) => id !== user.id)].slice(0, 7);
    }

    const lineup: MatchTeamLineup = {
      clubId,
      startingXI: starters.slice(0, 11),
      substitutes: subs,
      formation,
      roles: new Map(),
    };
    assignRoles(world, lineup, formation);
    return lineup;
  };

  const home = pickXI(homeClubId, formationHome);
  const away = pickXI(awayClubId, formationAway);

  return {
    id: nextId("mtc"),
    competitionId,
    home,
    away,
    date,
    status: "Scheduled",
    homeScore: 0,
    awayScore: 0,
    events: [],
    playerStats: new Map(),
    momentum: 0,
    possessionHome: 50,
    homeStats: emptyTeamStats(),
    awayStats: emptyTeamStats(),
    context: {
      minute: 0,
      homeScore: 0,
      awayScore: 0,
      momentum: 0,
      possessionHome: 50,
      shotsHome: 0,
      shotsAway: 0,
      matchImportance,
      intensity: 0.9 + matchImportance * 0.4,
    },
    interactiveMoments: [],
  };
}

function applyStatDelta(stats: PlayerMatchStats, delta: Partial<PlayerMatchStats>): void {
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v === "number" && k in stats) {
      (stats as any)[k] = ((stats as any)[k] ?? 0) + v;
    }
  }
}

export function simulateMatch(
  world: World,
  match: Match,
  rng: RNG,
  momentHandler?: (moment: InteractiveMoment) => string
): MatchResultSummary {
  match.status = "InProgress";

  const homeStr = teamStrength(world, match.home);
  const awayStr = teamStrength(world, match.away);
  const formHome = getFormation(match.home.formation as FormationId);
  const formAway = getFormation(match.away.formation as FormationId);

  for (const id of match.home.startingXI) {
    match.playerStats.set(id, createEmptyStats(id, match.home.roles.get(id)));
  }
  for (const id of match.away.startingXI) {
    match.playerStats.set(id, createEmptyStats(id, match.away.roles.get(id)));
  }

  const homeOn = new Set(match.home.startingXI);
  const awayOn = new Set(match.away.startingXI);
  const homeBench = [...match.home.substitutes];
  const awayBench = [...match.away.substitutes];
  const homeSubCount = { n: 0 };
  const awaySubCount = { n: 0 };
  const maxSubs = 5;

  const userId = world.userPlayerId;
  let userMoments = 0;

  const homeAdv = 1.08;
  const widthFactor = (formHome.width + formAway.width) / 2;
  const homeShare =
    (homeStr * homeAdv) / (homeStr * homeAdv + awayStr + 1e-6);
  const baseXG = 1.2 * (0.9 + widthFactor * 0.1);
  let homeXG = baseXG * (0.55 + homeShare * 0.95) * rng.float(0.8, 1.2);
  let awayXG = baseXG * (0.55 + (1 - homeShare) * 0.95) * rng.float(0.8, 1.2);

  homeXG *= 0.95 + formHome.centralFocus * 0.05;
  awayXG *= 0.95 + formAway.centralFocus * 0.05;

  const sampleGoals = (xg: number): number => {
    let g = 0;
    const trials = 14;
    const p = xg / trials;
    for (let i = 0; i < trials; i++) if (rng.chance(p)) g++;
    return g;
  };

  let homeGoalsLeft = sampleGoals(homeXG);
  let awayGoalsLeft = sampleGoals(awayXG);

  const goalMinutesHome: number[] = [];
  const goalMinutesAway: number[] = [];
  for (let i = 0; i < homeGoalsLeft; i++) goalMinutesHome.push(rng.int(1, 90));
  for (let i = 0; i < awayGoalsLeft; i++) goalMinutesAway.push(rng.int(1, 90));
  goalMinutesHome.sort((a, b) => a - b);
  goalMinutesAway.sort((a, b) => a - b);

  const pickScorer = (onPitch: Set<EntityId>, isHome: boolean): Player | null => {
    const lineup = isHome ? match.home : match.away;
    const players = [...onPitch]
      .map((id) => world.players.get(id)!)
      .filter(Boolean);
    if (!players.length) return null;
    const weights = players.map((p) => {
      const role = lineup.roles.get(p.id) ?? defaultRoleFor(p.primaryPosition, lineup.formation as FormationId);
      const profile = getRoleProfile(role);
      let w = p.attributes.technical.finishing * profile.shotTendency;
      return Math.max(1, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < players.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return players[i]!;
    }
    return players[0]!;
  };

  const registerGoal = (minute: number, isHome: boolean) => {
    const onPitch = isHome ? homeOn : awayOn;
    const scorer = pickScorer(onPitch, isHome);
    if (!scorer) return;
    const lineup = isHome ? match.home : match.away;
    if (!match.playerStats.has(scorer.id)) {
      match.playerStats.set(scorer.id, createEmptyStats(scorer.id, lineup.roles.get(scorer.id)));
    }
    const stats = match.playerStats.get(scorer.id)!;
    stats.goals += 1;
    stats.shots += 1;
    stats.shotsOnTarget += 1;

    let assister: Player | null = null;
    if (rng.chance(0.7)) {
      const others = [...onPitch]
        .map((id) => world.players.get(id)!)
        .filter((p) => p && p.id !== scorer.id);
      if (others.length) {
        assister = rng.pick(others);
        if (!match.playerStats.has(assister.id)) {
          match.playerStats.set(assister.id, createEmptyStats(assister.id, lineup.roles.get(assister.id)));
        }
        const aStats = match.playerStats.get(assister.id)!;
        aStats.assists += 1;
        aStats.keyPasses += 1;
        aStats.chancesCreated += 1;
      }
    }

    if (isHome) {
      match.homeScore += 1;
      match.context.shotsHome += 1;
      match.context.momentum = Math.min(100, match.context.momentum + 15);
    } else {
      match.awayScore += 1;
      match.context.shotsAway += 1;
      match.context.momentum = Math.max(-100, match.context.momentum - 15);
    }
    match.context.homeScore = match.homeScore;
    match.context.awayScore = match.awayScore;
    match.momentum = match.context.momentum;

    match.events.push({
      minute,
      type: "Goal",
      playerId: scorer.id,
      secondaryPlayerId: assister?.id,
      clubId: lineup.clubId,
      description: assister
        ? `GOAL! ${scorer.displayName} (${minute}') assisted by ${assister.displayName}`
        : `GOAL! ${scorer.displayName} (${minute}')`,
    });
  };

  const trySub = (
    isHome: boolean,
    offId: EntityId,
    minute: number,
    reason: string
  ): EntityId | null => {
    const bench = isHome ? homeBench : awayBench;
    const subCount = isHome ? homeSubCount : awaySubCount;
    const onPitch = isHome ? homeOn : awayOn;
    const lineup = isHome ? match.home : match.away;
    if (subCount.n >= maxSubs || bench.length === 0) return null;

    const offPlayer = world.players.get(offId);
    bench.sort((a, b) => {
      const pa = world.players.get(a)!;
      const pb = world.players.get(b)!;
      let sa = pa.ovr;
      let sb = pb.ovr;
      if (offPlayer && pa.primaryPosition === offPlayer.primaryPosition) sa += 15;
      if (offPlayer && pb.primaryPosition === offPlayer.primaryPosition) sb += 15;
      if (pa.isUserControlled) sa += 20;
      if (pb.isUserControlled) sb += 20;
      return sb - sa;
    });

    const onId = bench.shift()!;
    onPitch.delete(offId);
    onPitch.add(onId);
    subCount.n += 1;

    const onPlayer = world.players.get(onId)!;
    const role = defaultRoleFor(onPlayer.primaryPosition, lineup.formation as FormationId);
    lineup.roles.set(onId, role);
    if (!match.playerStats.has(onId)) {
      match.playerStats.set(onId, createEmptyStats(onId, role));
    }

    match.events.push({
      minute,
      type: "Sub",
      playerId: onId,
      secondaryPlayerId: offId,
      clubId: lineup.clubId,
      description: `SUB (${reason}): ${onPlayer.displayName} on for ${offPlayer?.displayName ?? "player"}`,
    });
    world.events.emit(Events.SUBSTITUTION, { matchId: match.id, onId, offId, minute });
    return onId;
  };

  let hi = 0;
  let ai = 0;
  for (let minute = 1; minute <= 90; minute++) {
    match.context.minute = minute;

    while (hi < goalMinutesHome.length && goalMinutesHome[hi] === minute) {
      registerGoal(minute, true);
      hi++;
    }
    while (ai < goalMinutesAway.length && goalMinutesAway[ai] === minute) {
      registerGoal(minute, false);
      ai++;
    }

    const posPull = (match.context.possessionHome - 50) * 0.02;
    match.context.momentum = Math.max(
      -100,
      Math.min(100, match.context.momentum * 0.98 + posPull + rng.float(-0.5, 0.5))
    );
    match.momentum = match.context.momentum;

    for (const [isHome, onPitch] of [
      [true, homeOn] as const,
      [false, awayOn] as const,
    ]) {
      for (const pid of [...onPitch]) {
        const player = world.players.get(pid);
        if (!player) continue;
        const stats = match.playerStats.get(pid);
        if (stats) stats.minutes += 1;

        if (injuryChanceThisMinute(player, minute, match.context.intensity, rng)) {
          const injury = createInjury(world, player, match.id, match.date, rng);
          match.events.push({
            minute,
            type: "Injury",
            playerId: pid,
            clubId: isHome ? match.home.clubId : match.away.clubId,
            description: `INJURY: ${player.displayName} — ${injury.name} (${injury.severity})`,
            meta: { injuryId: injury.id, severity: injury.severity },
          });
          world.events.emit(Events.INJURY_OCCURRED, {
            playerId: pid,
            injuryId: injury.id,
            minute,
          });

          if (injury.forcesWithdrawal) {
            onPitch.delete(pid);
            trySub(isHome, pid, minute, "injury");
          }
          continue;
        }

        if (userId && pid === userId) {
          const lineup = isHome ? match.home : match.away;
          const role =
            lineup.roles.get(pid) ??
            defaultRoleFor(player.primaryPosition, lineup.formation as FormationId);
          const mins = stats?.minutes ?? minute;
          const type = shouldGenerateMoment(
            player,
            role,
            match.context,
            isHome,
            mins,
            userMoments,
            rng
          );
          if (type) {
            const oppStr = isHome ? awayStr : homeStr;
            const difficultyMod = 0.85 + (oppStr - 70) / 100;
            const moment = buildMoment(
              type,
              player,
              match.context,
              isHome,
              Math.max(0.7, Math.min(1.4, difficultyMod)),
              nextId("mom")
            );
            userMoments++;

            let actionId: string;
            let outcome;
            if (momentHandler) {
              actionId = momentHandler(moment);
              outcome = resolveMoment(moment, actionId, player, match.context, rng);
            } else {
              const auto = autoResolveMoment(moment, player, match.context, rng);
              actionId = auto.actionId;
              outcome = auto.outcome;
            }

            if (!match.playerStats.has(pid)) {
              match.playerStats.set(pid, createEmptyStats(pid, role));
            }
            const st = match.playerStats.get(pid)!;
            applyStatDelta(st, outcome.stats);

            if (outcome.goalScored) {
              if (isHome) {
                match.homeScore += 1;
                match.context.momentum = Math.min(100, match.context.momentum + outcome.momentumDelta);
              } else {
                match.awayScore += 1;
                match.context.momentum = Math.max(-100, match.context.momentum - Math.abs(outcome.momentumDelta));
              }
              match.context.homeScore = match.homeScore;
              match.context.awayScore = match.awayScore;
            } else {
              const md = isHome ? outcome.momentumDelta : -outcome.momentumDelta;
              match.context.momentum = Math.max(-100, Math.min(100, match.context.momentum + md));
            }
            match.momentum = match.context.momentum;

            match.events.push({
              minute,
              type: "Moment",
              playerId: pid,
              clubId: lineup.clubId,
              description: `${moment.type}: ${outcome.description}`,
              meta: { momentType: moment.type, actionId, success: outcome.success },
            });

            match.interactiveMoments.push({
              minute,
              momentType: moment.type,
              description: moment.description,
              chosenActionId: actionId,
              outcome: outcome.description,
              success: outcome.success,
            });

            if (outcome.goalScored && outcome.stats.goals) {
              match.events.push({
                minute,
                type: "Goal",
                playerId: pid,
                clubId: lineup.clubId,
                description: `GOAL! ${player.displayName} (${minute}') [moment]`,
              });
            }
          }
        }
      }
    }

    if (minute === 60 || minute === 70 || minute === 80) {
      const homeAI = computeTeamAI(world, match, true);
      const awayAI = computeTeamAI(world, match, false);
      (match.context as any).homeAI = homeAI;
      (match.context as any).awayAI = awayAI;

      if (minute === 80) {
        if (homeAI.gameState === "Losing" && rng.chance(0.22 * homeAI.attackBias)) {
          goalMinutesHome.push(rng.int(81, 90));
        }
        if (awayAI.gameState === "Losing" && rng.chance(0.22 * awayAI.attackBias)) {
          goalMinutesAway.push(rng.int(81, 90));
        }
      }

      for (const [isHome, ai] of [
        [true, homeAI] as const,
        [false, awayAI] as const,
      ]) {
        if ((isHome ? homeSubCount : awaySubCount).n >= maxSubs) continue;
        const pick = pickSmartSub(world, match, isHome, ai);
        if (pick && rng.chance(ai.gameState === "Losing" ? 0.75 : 0.55)) {
          trySub(isHome, pick.offId, minute, "tactical");
        }
      }
    }
  }

  match.possessionHome = Math.round(
    48 + (homeStr - awayStr) * 0.35 + match.context.momentum * 0.08 + rng.int(-5, 5)
  );
  match.possessionHome = Math.max(28, Math.min(72, match.possessionHome));
  match.context.possessionHome = match.possessionHome;

  for (const pid of [...homeOn, ...awayOn]) {
    if (rng.chance(0.06)) {
      const p = world.players.get(pid)!;
      const st = match.playerStats.get(pid);
      if (st) {
        st.yellow = true;
        st.fouls += 1;
      }
      match.events.push({
        minute: rng.int(15, 88),
        type: "Yellow",
        playerId: pid,
        clubId: p.currentClubId ?? match.home.clubId,
        description: `Yellow card — ${p.displayName}`,
      });
    }
  }

  match.events.sort((a, b) => a.minute - b.minute);
  match.homeStats = finalizeTeamStats(match, true);
  match.awayStats = finalizeTeamStats(match, false);
  match.status = "Finished";

  const careerMap = runPostMatchPipeline(world, match);
  const ratings = new Map<EntityId, number>();
  for (const [id, st] of match.playerStats) {
    if (!st.rating || st.rating === 55) {
      st.rating = computeRating(st, st.role);
    }
    ratings.set(id, st.rating);
  }

  const userEffects = userId ? careerMap.get(userId) : undefined;

  return {
    matchId: match.id,
    homeClubId: match.home.clubId,
    awayClubId: match.away.clubId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    events: match.events,
    ratings,
    careerEffects: userEffects,
  };
}

export function formatMatchReport(world: World, match: Match): string {
  const home = world.clubs.get(match.home.clubId)!;
  const away = world.clubs.get(match.away.clubId)!;
  let report = `${home.name} ${match.homeScore}–${match.awayScore} ${away.name}\n`;
  report += `Possession: ${match.possessionHome}% – ${100 - match.possessionHome}%\n`;
  report += `Momentum final: ${match.momentum > 0 ? "Home" : match.momentum < 0 ? "Away" : "Even"} (${match.momentum})\n`;
  if (match.events.length) {
    report += "Events:\n";
    for (const e of match.events.slice(0, 20)) {
      report += `  ${e.minute}' ${e.description}\n`;
    }
    if (match.events.length > 20) report += `  ... +${match.events.length - 20} more\n`;
  }
  if (match.interactiveMoments.length) {
    report += "Interactive moments:\n";
    for (const m of match.interactiveMoments) {
      report += `  ${m.minute}' [${m.momentType}] ${m.outcome} (${m.success ? "OK" : "FAIL"})\n`;
    }
  }
  const sorted = [...match.playerStats.entries()].sort((a, b) => b[1].rating - a[1].rating);
  report += "Top ratings:\n";
  for (const [id, s] of sorted.slice(0, 5)) {
    const p = world.players.get(id)!;
    report += `  ${p.displayName}: ${(s.rating / 10).toFixed(1)}  G${s.goals} A${s.assists} M${s.minutes}\n`;
  }
  return report;
}
