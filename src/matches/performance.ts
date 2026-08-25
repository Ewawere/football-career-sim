/**
 * Post-match performance → career consequences.
 */

import type { World } from "../world/world.js";
import type { Match, PlayerMatchStats, CareerMatchEffects } from "./types.js";

export type ManagerReaction =
  | "IncreasedTrust"
  | "Neutral"
  | "Concern"
  | "ReducedTrust";

export function computeRating(stats: PlayerMatchStats): number {
  let r = 60;
  r += stats.goals * 8;
  r += stats.assists * 5;
  r += Math.min(6, stats.shotsOnTarget * 1.5);
  r += Math.min(4, stats.keyPasses);
  r += Math.min(4, stats.tackles * 0.8);
  r -= stats.errors * 3;
  r -= stats.fouls * 1.2;
  if (stats.red) r -= 15;
  else if (stats.yellow) r -= 3;
  if (stats.minutes < 20) r = Math.min(r, 65);
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
  const player = world.players.get(playerId)!;
  const rating = stats.rating || computeRating(stats);
  stats.rating = rating;

  const formDelta = (rating - 60) * 0.25;
  player.state.form = Math.max(0, Math.min(100, player.state.form + formDelta));

  const reaction = evaluateManagerReaction(rating);
  let trustDelta = 0;
  if (reaction === "IncreasedTrust") trustDelta = 5;
  else if (reaction === "Concern") trustDelta = -3;
  else if (reaction === "ReducedTrust") trustDelta = -6;
  player.state.managerTrust = Math.max(0, Math.min(100, player.state.managerTrust + trustDelta));

  const repDelta = stats.goals > 0 ? 1.5 : rating >= 80 ? 1 : rating < 45 ? -0.5 : 0;
  player.reputation = Math.max(0, Math.min(100, player.reputation + repDelta));

  const moraleDelta = trustDelta * 0.5 + (rating - 60) * 0.1;
  player.state.morale = Math.max(0, Math.min(100, player.state.morale + moraleDelta));

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
      `Form ${player.state.form.toFixed(0)}`,
      `Trust ${player.state.managerTrust.toFixed(0)}`,
      reaction,
    ],
  };
}

export function runPostMatchPipeline(world: World, match: Match): CareerMatchEffects | null {
  if (!world.userPlayerId) return null;
  const stats = match.playerStats.get(world.userPlayerId);
  if (!stats || stats.minutes <= 0) return null;
  return applyCareerConsequences(world, match, world.userPlayerId, stats);
}
