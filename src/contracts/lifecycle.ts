/**
 * Contract expiry, renewals, pressure, free agents.
 *
 * Pressure builds in the final year; clubs offer; players may refuse
 * for wage, ambition, playing time, or age reasons. Refusals feed
 * narrative (contract_standoff) and transfer openness.
 */

import type { World } from "../world/world.js";
import { canSignPlayer, activeSquadCount, SQUAD_HARD_CAP } from "../transfers/squad-rules.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import { yearsRemaining, estimateMarketValue } from "./valuation.js";
import { Events } from "../core/events.js";
import { analyzeSquadNeeds } from "../transfers/needs.js";

export type RenewalRefusalReason =
  | "wage"
  | "ambition"
  | "playing_time"
  | "age"
  | "club_finances"
  | "form";

export interface ContractPressureReport {
  pressureApplied: number;
  offers: number;
  renewed: string[];
  refused: { name: string; reason: RenewalRefusalReason }[];
  expired: string[];
}

export function processContractExpiries(world: World): {
  expired: string[];
  renewed: string[];
  refused: { name: string; reason: RenewalRefusalReason }[];
} {
  const expired: string[] = [];
  const renewed: string[] = [];
  const refused: { name: string; reason: RenewalRefusalReason }[] = [];
  const today = world.calendar.currentDate;

  for (const player of world.players.values()) {
    if (player.retired || !player.contract) continue;

    const years = yearsRemaining(world, player);

    if (years <= 1.05 && years > 0) {
      applyContractPressure(world, player, years);

      if (years <= 0.55) {
        const club = player.currentClubId
          ? world.clubs.get(player.currentClubId)
          : null;
        if (club && shouldAttemptRenewal(world, player, club)) {
          const result = attemptRenewal(world, player, club);
          if (result.ok) {
            renewed.push(player.displayName);
            world.events.emit(Events.CONTRACT_RENEWED, {
              playerId: player.id,
              clubId: club.id,
              wage: player.contract?.wage,
              years: result.years,
            });
            continue;
          }
          if (result.reason) {
            refused.push({ name: player.displayName, reason: result.reason });
            world.events.emit(Events.CONTRACT_REFUSED, {
              playerId: player.id,
              clubId: club.id,
              reason: result.reason,
              demandedWage: result.demandedWage,
              offeredWage: result.offeredWage,
            });
          }
        }
      }
    }

    if (player.contract.endDate <= today || years <= 0) {
      const club = player.currentClubId
        ? world.clubs.get(player.currentClubId)
        : null;
      if (club) {
        club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== player.id);
        club.academyPlayerIds = club.academyPlayerIds.filter(
          (id) => id !== player.id
        );
        club.finances.currentWageBillWeekly = Math.max(
          0,
          club.finances.currentWageBillWeekly - (player.contract.wage ?? 0)
        );
      }
      player.currentClubId = null;
      player.contract = null;
      expired.push(player.displayName);
      world.events.emit(Events.CONTRACT_EXPIRED, { playerId: player.id });
    }
  }

  return { expired, renewed, refused };
}

export function processContractPressureTick(world: World): ContractPressureReport {
  let pressureApplied = 0;
  let offers = 0;
  const renewed: string[] = [];
  const refused: { name: string; reason: RenewalRefusalReason }[] = [];
  const expired: string[] = [];

  for (const player of world.players.values()) {
    if (player.retired || !player.contract) continue;
    const years = yearsRemaining(world, player);
    if (years > 1.05 || years <= 0) continue;

    applyContractPressure(world, player, years);
    pressureApplied++;

    if (years > 0.55 && years <= 1.05 && world.rng.chance(0.08)) {
      const club = player.currentClubId
        ? world.clubs.get(player.currentClubId)
        : null;
      if (club && shouldAttemptRenewal(world, player, club)) {
        offers++;
        world.events.emit(Events.CONTRACT_OFFER, {
          playerId: player.id,
          clubId: club.id,
          yearsLeft: years,
        });
        const result = attemptRenewal(world, player, club);
        if (result.ok) {
          renewed.push(player.displayName);
          world.events.emit(Events.CONTRACT_RENEWED, {
            playerId: player.id,
            clubId: club.id,
            wage: player.contract?.wage,
            years: result.years,
          });
        } else if (result.reason) {
          refused.push({ name: player.displayName, reason: result.reason });
          world.events.emit(Events.CONTRACT_REFUSED, {
            playerId: player.id,
            clubId: club.id,
            reason: result.reason,
            demandedWage: result.demandedWage,
            offeredWage: result.offeredWage,
          });
        }
      }
    }
  }

  return { pressureApplied, offers, renewed, refused, expired };
}

function applyContractPressure(world: World, player: Player, years: number): void {
  if (years <= 0.5) {
    player.state.morale = Math.max(20, player.state.morale - 1.2);
  } else if (years <= 1.0) {
    player.state.morale = Math.max(25, player.state.morale - 0.4);
  }

  const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  if (!club) return;

  const ambitious =
    player.potential >= 82 &&
    player.age <= 26 &&
    club.reputation < player.potential - 5;
  const unhappy = player.state.morale < 45 || (player.state.managerTrust ?? 50) < 40;

  if ((ambitious || unhappy) && years <= 0.75) {
    (player.state as any).openToTransfer = true;
  }

  if (
    (player.isUserControlled || player.reputation >= 60 || player.potential >= 84) &&
    world.rng.chance(0.15)
  ) {
    world.events.emit(Events.CONTRACT_PRESSURE, {
      playerId: player.id,
      clubId: club.id,
      yearsLeft: years,
      ambitious,
      unhappy,
    });
  }
}

function shouldAttemptRenewal(world: World, player: Player, club: Club): boolean {
  if (player.age >= 35) return world.rng.chance(0.15);
  if (player.age >= 33) return world.rng.chance(0.35);
  if (player.ovr >= club.reputation * 0.88) return true;
  if (player.age <= 24 && player.potential >= 78) return true;
  if (player.state.appearancesThisSeason >= 20) return true;
  if (player.isUserControlled) return true;
  return world.rng.chance(0.22);
}

function attemptRenewal(
  world: World,
  player: Player,
  club: Club
): {
  ok: boolean;
  reason?: RenewalRefusalReason;
  years?: number;
  demandedWage?: number;
  offeredWage?: number;
} {
  const oldWage = player.contract?.wage ?? 1000;
  const form = player.state.form;
  const trust = player.state.managerTrust ?? 50;
  const apps = player.state.appearancesThisSeason;

  let demandMul = 1.08 + world.rng.float(0, 0.22);
  if (form >= 75) demandMul += 0.08;
  if (player.potential >= 85 && player.age <= 23) demandMul += 0.12;
  if (apps >= 25) demandMul += 0.06;
  if (player.ovr >= club.reputation + 5) demandMul += 0.1;

  const demandedWage = Math.round(oldWage * demandMul);

  const wageRoom =
    club.finances.wageBudgetWeekly - club.finances.currentWageBillWeekly;
  let offeredWage = demandedWage;

  const valueToClub =
    player.ovr >= club.reputation * 0.92 ||
    (player.age <= 23 && player.potential >= 80) ||
    apps >= 28;

  if (!valueToClub) {
    offeredWage = Math.round(oldWage * (1.02 + world.rng.float(0, 0.12)));
  }

  const raise = offeredWage - oldWage;
  if (raise > wageRoom + 30_000) {
    offeredWage = oldWage + Math.max(0, Math.floor(wageRoom * 0.6));
    if (offeredWage < oldWage) offeredWage = oldWage;
  }

  world.events.emit(Events.CONTRACT_OFFER, {
    playerId: player.id,
    clubId: club.id,
    demandedWage,
    offeredWage,
  });

  if (player.age >= 34 && offeredWage < demandedWage * 0.9) {
    return { ok: false, reason: "age", demandedWage, offeredWage };
  }

  if (apps < 8 && player.age >= 22 && player.ovr >= club.reputation * 0.8) {
    if (world.rng.chance(0.55)) {
      return { ok: false, reason: "playing_time", demandedWage, offeredWage };
    }
  }

  if (
    player.potential >= 84 &&
    player.age <= 25 &&
    club.reputation < 72 &&
    player.ovr >= 72
  ) {
    if (offeredWage < demandedWage * 0.95 || world.rng.chance(0.4)) {
      (player.state as any).openToTransfer = true;
      return { ok: false, reason: "ambition", demandedWage, offeredWage };
    }
  }

  if (offeredWage < demandedWage * 0.82) {
    return { ok: false, reason: "wage", demandedWage, offeredWage };
  }

  if (form <= 35 && trust < 40 && world.rng.chance(0.45)) {
    return { ok: false, reason: "form", demandedWage, offeredWage };
  }

  if (
    raise > wageRoom + 50_000 &&
    player.ovr < club.reputation * 0.9 &&
    !(player.age <= 22 && player.potential >= 82)
  ) {
    return { ok: false, reason: "club_finances", demandedWage, offeredWage };
  }

  if (offeredWage < demandedWage * 0.92 && !valueToClub) {
    if (!world.rng.chance(0.55)) {
      return { ok: false, reason: "wage", demandedWage, offeredWage };
    }
  }

  const years = player.age <= 23 ? 4 : player.age <= 29 ? 3 : player.age <= 32 ? 2 : 1;
  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;

  player.contract = {
    clubId: club.id,
    wage: offeredWage,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause:
      player.potential >= 80
        ? Math.round(estimateMarketValue(world, player) * (1.4 + world.rng.float(0, 0.4)))
        : player.contract?.releaseClause ?? null,
    signedDate: world.calendar.currentDate,
  };

  club.finances.currentWageBillWeekly += offeredWage - oldWage;
  player.state.morale = Math.min(100, player.state.morale + 10);
  player.state.managerTrust = Math.min(100, (player.state.managerTrust ?? 50) + 6);
  (player.state as any).openToTransfer = false;

  return { ok: true, years, demandedWage, offeredWage };
}

export function getFreeAgents(world: World): Player[] {
  return [...world.players.values()].filter(
    (p) => !p.retired && !p.currentClubId && p.age <= 38
  );
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
            (p.primaryPosition === need.position ||
              p.secondaryPositions.includes(need.position)) &&
            p.ovr >= club.reputation * 0.65
        )
        .sort((a, b) => b.ovr - a.ovr);

      const pick = candidates[0];
      if (!pick) continue;

      const wage = Math.round(pick.ovr * pick.ovr * 8);
      if (club.finances.currentWageBillWeekly + wage > club.finances.wageBudgetWeekly * 1.1)
        continue;

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
