/**
 * Dynamic player transfer valuation.
 */

import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import type { World } from "../world/world.js";
import { dayDiff } from "../core/calendar.js";

export function estimateMarketValue(world: World, player: Player): number {
  if (player.retired) return 0;

  const ovr = player.ovr;
  const pot = player.potential;
  const age = player.age;

  let base = Math.pow(Math.max(40, ovr), 2.15) * 180;

  const room = Math.max(0, pot - ovr);
  if (age <= 23) {
    base *= 1 + room * 0.035 + (23 - age) * 0.04;
  } else if (age <= 27) {
    base *= 1 + room * 0.015;
  }

  if (age <= 18) base *= 0.85;
  else if (age <= 22) base *= 1.15;
  else if (age <= 26) base *= 1.2;
  else if (age <= 29) base *= 1.05;
  else if (age <= 32) base *= 0.75;
  else if (age <= 34) base *= 0.45;
  else base *= 0.25;

  const pos = player.primaryPosition;
  if (["ST", "CF", "CAM", "RW", "LW"].includes(pos)) base *= 1.12;
  else if (["CM", "CDM"].includes(pos)) base *= 1.05;
  else if (pos === "GK") base *= 0.9;

  base *= 0.9 + player.state.form / 500;
  base *= 0.85 + player.reputation / 200;

  const monthsLeft = contractMonthsRemaining(world, player);
  if (monthsLeft <= 6) base *= 0.45;
  else if (monthsLeft <= 12) base *= 0.7;
  else if (monthsLeft <= 24) base *= 0.9;
  else if (monthsLeft >= 48) base *= 1.1;

  const wage = player.contract?.wage ?? 0;
  if (wage > ovr * ovr * 20) base *= 0.95;

  if (player.injuryIds.length >= 3) base *= 0.85;
  else if (player.injuryIds.length >= 1) base *= 0.95;

  if (player.currentClubId) {
    const club = world.clubs.get(player.currentClubId);
    if (club) base *= 0.9 + club.reputation / 500;
  }

  if (player.state.appearancesThisSeason >= 10) {
    const avg = player.state.averageRatingThisSeason;
    base *= 0.92 + avg / 800;
  }

  base = Math.max(50_000, Math.min(200_000_000, base));
  return Math.round(base / 10_000) * 10_000;
}

export function contractMonthsRemaining(world: World, player: Player): number {
  if (!player.contract) return 0;
  const days = dayDiff(world.calendar.currentDate, player.contract.endDate);
  return Math.max(0, Math.round(days / 30));
}

export function yearsRemaining(world: World, player: Player): number {
  return contractMonthsRemaining(world, player) / 12;
}

export function askingPrice(world: World, player: Player, sellingClub: Club): number {
  let value = estimateMarketValue(world, player);
  if (player.ovr >= sellingClub.reputation * 0.95) value *= 1.25;
  if (player.age <= 23 && player.potential >= 82) value *= 1.2;
  if (player.contract?.releaseClause && player.contract.releaseClause > 0) {
    value = Math.min(value * 1.1, player.contract.releaseClause);
  }
  return Math.round(value / 10_000) * 10_000;
}
