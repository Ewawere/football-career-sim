/**
 * Post-match performance → career consequences + season stats.
 */

import type { World } from "../world/world.js";
import type { Match, PlayerMatchStats, CareerMatchEffects } from "./types.js";
import type { EntityId } from "../core/types.js";

export type ManagerReaction =
  | "IncreasedTrust"
  | "Neutral"
  | "Concern"
  | "ReducedTrust";

export function computeRating(stats: PlayerMatchStats, _role?: unknown): number {
  let r = 60;
  r += (stats.goals || 0) * 8;
  r += (stats.assists || 0) * 5;
  r += Math.min(6, (stats.shotsOnTarget || 0) * 1.5);
  r += Math.min(4, stats.keyPasses || 0);
  r += Math.min(4, (stats.tackles || 0) * 0.8);
  r -= (stats.errors || 0) * 3;
  r -= (stats.fouls || 0) * 1.2;
  if (stats.red) r -= 15;
  else if (stats.yellow) r -= 3;
  if ((stats.minutes || 0) < 20) r = Math.min(r, 65);
  if ((stats.minutes || 0) >= 70) r += 2;
  return Math.max(25, Math.min(95, Math.round(r)));
}

export function evaluateManagerReaction(rating: number): ManagerReaction {
  if (rating >= 78) return "IncreasedTrust";
  if (rating >= 60) return "Neutral";
  if (rating >= 50) return "Concern";
  return "ReducedTrust";
}

export function applyCareerConsequences(
  world: World,
  match: Match,
  playerId: string,
  stats: PlayerMatchStats
): CareerMatchEffects {
  const player = world.players.get(playerId as EntityId);
  if (!player) {
    return {
      playerId,
      rating: 50,
      formDelta: 0,
      moraleDelta: 0,
      managerTrustDelta: 0,
      reputationDelta: 0,
      managerReaction: "Neutral",
      notes: ["Player missing"],
    };
  }

  // Ensure minutes if they started
  const started =
    match.home.startingXI.includes(playerId as EntityId) ||
    match.away.startingXI.includes(playerId as EntityId);
  if (started && (stats.minutes || 0) < 1) {
    stats.minutes = 90;
  }

  const rating = stats.rating || computeRating(stats);
  stats.rating = rating;

  // === Season / career totals (this was missing) ===
  if ((stats.minutes || 0) > 0) {
    player.careerAppearances = (player.careerAppearances || 0) + 1;
    player.careerGoals = (player.careerGoals || 0) + (stats.goals || 0);
    player.careerAssists = (player.careerAssists || 0) + (stats.assists || 0);
  }

  const formDelta = (rating - 60) * 0.25;
  player.state.form = Math.max(0, Math.min(100, (player.state.form ?? 50) + formDelta));

  const reaction = evaluateManagerReaction(rating);
  let trustDelta = 0;
  if (reaction === "IncreasedTrust") trustDelta = 5;
  else if (reaction === "Concern") trustDelta = -3;
  else if (reaction === "ReducedTrust") trustDelta = -6;
  player.state.managerTrust = Math.max(
    0,
    Math.min(100, (player.state.managerTrust ?? 50) + trustDelta)
  );

  const repDelta = (stats.goals || 0) > 0 ? 1.5 : rating >= 80 ? 1 : rating < 45 ? -0.5 : 0;
  player.reputation = Math.max(0, Math.min(100, (player.reputation ?? 40) + repDelta));

  const moraleDelta = trustDelta * 0.5 + (rating - 60) * 0.1;
  player.state.morale = Math.max(0, Math.min(100, (player.state.morale ?? 50) + moraleDelta));

  // Fitness cost
  player.state.fitness = Math.max(
    35,
    (player.state.fitness ?? 80) - Math.round((stats.minutes || 0) / 18)
  );

  return {
    playerId,
    rating,
    formDelta,
    moraleDelta,
    managerTrustDelta: trustDelta,
    reputationDelta: repDelta,
    managerReaction: reaction,
    notes: [
      `Rating ${rating}`,
      `Apps ${(player.careerAppearances || 0)} G${player.careerGoals || 0} A${player.careerAssists || 0}`,
      `Form ${Math.round(player.state.form)} Trust ${Math.round(player.state.managerTrust)}`,
      reaction,
    ],
  };
}

/** Engine expects a Map of effects keyed by player id */
export function runPostMatchPipeline(
  world: World,
  match: Match
): Map<EntityId, CareerMatchEffects> {
  const out = new Map<EntityId, CareerMatchEffects>();

  // Always process user if they were involved
  if (world.userPlayerId) {
    let stats = match.playerStats.get(world.userPlayerId);
    const started =
      match.home.startingXI.includes(world.userPlayerId) ||
      match.away.startingXI.includes(world.userPlayerId);
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
        rating: 0,
      } as PlayerMatchStats;
      match.playerStats.set(world.userPlayerId, stats);
    }
    if (stats && (stats.minutes > 0 || started)) {
      if (started && stats.minutes < 1) stats.minutes = 90;
      const effects = applyCareerConsequences(world, match, world.userPlayerId, stats);
      out.set(world.userPlayerId, effects);
    }
  }

  // Light processing for other players with minutes (form only)
  for (const [id, st] of match.playerStats) {
    if (id === world.userPlayerId) continue;
    if ((st.minutes || 0) <= 0) continue;
    const p = world.players.get(id);
    if (!p) continue;
    const rating = st.rating || computeRating(st);
    st.rating = rating;
    p.state.form = Math.max(0, Math.min(100, (p.state.form ?? 50) + (rating - 60) * 0.15));
  }

  return out;
}
