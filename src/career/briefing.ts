/**
 * Pre/post match briefing packs (FM-style).
 */

import type { World } from "../world/world.js";
import { getNextUserFixture } from "../ui/api.js";

export function getPreMatchBriefing(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player?.currentClubId) return null;
  const club = world.clubs.get(player.currentClubId);
  if (!club) return null;

  const form = Math.round(player.state.form ?? 50);
  const fitness = Math.round(player.state.fitness ?? 80);
  const trust = Math.round(player.state.managerTrust ?? 50);

  const tips: string[] = [];
  if (fitness < 70) tips.push("Medical staff: manage minutes - fitness is below ideal.");
  if (form >= 75) tips.push("You are in strong form - expect a starting role if available.");
  if (form <= 40) tips.push("Cold form may limit your place in the XI.");
  if (trust < 40) tips.push("Manager trust is low - respond with performances, not headlines.");
  if (!tips.length) tips.push("Standard matchday prep. Stay sharp in the warm-up.");

  return {
    club: club.name,
    player: player.displayName,
    form,
    fitness,
    trust,
    tips,
    focus: fitness < 70 ? "Recovery" : form >= 70 ? "Attacking intensity" : "Tactical discipline",
  };
}

export function getPostMatchPack(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  return {
    player: player.displayName,
    apps: player.state.appearancesThisSeason ?? 0,
    goals: player.state.goalsThisSeason ?? 0,
    assists: player.state.assistsThisSeason ?? 0,
    form: Math.round(player.state.form ?? 50),
    fitness: Math.round(player.state.fitness ?? 80),
    note:
      (player.state.averageRatingThisSeason ?? 0) >= 75
        ? "Strong recent ratings - keep the standards high."
        : "Work the next training block and push for consistency.",
  };
}
