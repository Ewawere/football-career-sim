/**
 * Contract expiry, renewal, free agents.
 */

import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import { dayDiff } from "../core/calendar.js";
import { estimateMarketValue } from "./valuation.js";
import { canSignPlayer, activeSquadCount, SQUAD_HARD_CAP } from "../transfers/squad-rules.js";
import { analyzeSquadNeeds } from "../transfers/needs.js";

export function contractMonthsLeft(world: World, player: Player): number {
  if (!player.contract) return 0;
  return Math.max(0, Math.round(dayDiff(world.calendar.currentDate, player.contract.endDate) / 30));
}

export function processContractExpiries(world: World): number {
  let expired = 0;
  for (const player of world.players.values()) {
    if (!player.contract || player.retired) continue;
    if (dayDiff(world.calendar.currentDate, player.contract.endDate) > 0) continue;
    const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
    if (club) {
      club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== player.id);
      club.finances.currentWageBillWeekly = Math.max(
        0,
        club.finances.currentWageBillWeekly - player.contract.wage
      );
    }
    player.currentClubId = null;
    player.contract = null;
    player.state.morale = Math.max(20, player.state.morale - 10);
    expired++;
  }
  return expired;
}

export function tryRenewContract(world: World, player: Player, club: Club): boolean {
  if (!player.contract || player.currentClubId !== club.id) return false;
  const demand = Math.round((player.contract.wage || 1000) * 1.15);
  if (club.finances.currentWageBillWeekly + (demand - player.contract.wage) > club.finances.wageBudgetWeekly * 1.15) {
    return false;
  }
  const years = player.age <= 28 ? 3 : 2;
  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
  const oldWage = player.contract.wage;
  player.contract = {
    clubId: club.id,
    wage: demand,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause:
      player.potential >= 80
        ? Math.round(estimateMarketValue(world, player) * 1.5)
        : player.contract.releaseClause ?? null,
    signedDate: world.calendar.currentDate,
  };
  club.finances.currentWageBillWeekly += demand - oldWage;
  player.state.morale = Math.min(100, player.state.morale + 8);
  return true;
}

export function getFreeAgents(world: World): Player[] {
  return [...world.players.values()].filter((p) => !p.retired && !p.currentClubId && p.age <= 38);
}

export function processFreeAgentSignings(world: World): number {
  const free = getFreeAgents(world);
  if (!free.length) return 0;
  let signed = 0;
  for (const club of world.clubs.values()) {
    if (!canSignPlayer(world, club) || activeSquadCount(world, club) >= SQUAD_HARD_CAP) continue;
    const needs = analyzeSquadNeeds(world, club);
    const urgent = needs.prioritized.filter((n) => n.score >= 30);
    if (!urgent.length) continue;
    let clubSignings = 0;
    for (const need of urgent) {
      if (clubSignings >= 2) break;
      const candidates = free
        .filter(
          (p) =>
            !p.currentClubId &&
            (p.primaryPosition === need.position || p.secondaryPositions.includes(need.position)) &&
            p.ovr >= club.reputation * 0.65
        )
        .sort((a, b) => b.ovr - a.ovr);
      const pick = candidates[0];
      if (!pick) continue;
      const wage = Math.round(pick.ovr * pick.ovr * 8);
      if (club.finances.currentWageBillWeekly + wage > club.finances.wageBudgetWeekly * 1.1) continue;
      const years = pick.age <= 28 ? 2 : 1;
      const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
      pick.currentClubId = club.id;
      pick.contract = {
        clubId: club.id,
        wage,
        startDate: world.calendar.currentDate,
        endDate: `${endYear}-06-30`,
        releaseClause: null,
        signedDate: world.calendar.currentDate,
      };
      club.squadPlayerIds.push(pick.id);
      club.finances.currentWageBillWeekly += wage;
      signed++;
      clubSignings++;
    }
  }
  return signed;
}
