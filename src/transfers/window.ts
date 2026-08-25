/**
 * Transfer window orchestration.
 */

import type { World } from "../world/world.js";
import { processContractExpiries, processFreeAgentSignings } from "../contracts/lifecycle.js";
import { pruneAllClubs, fillThinSquads, activeSquadCount, SQUAD_HARD_CAP } from "./squad-rules.js";
import { analyzeSquadNeeds } from "./needs.js";
import { askingPrice } from "../contracts/valuation.js";
import { processLoanWindow, processLoanReturns } from "./loans.js";
import { Events } from "../core/events.js";

export interface WindowReport {
  transfers: {
    playerId: string;
    fromClubId: string | null;
    toClubId: string;
    fee: number;
  }[];
  loans: {
    playerId: string;
    parentClubId: string;
    loanClubId: string;
    playingTimeExpectation: string;
  }[];
  freeAgents: number;
  expired: number;
  loanReturns: number;
}

export function runTransferWindow(world: World): WindowReport {
  const report: WindowReport = {
    transfers: [],
    loans: [],
    freeAgents: 0,
    expired: 0,
    loanReturns: 0,
  };

  report.loanReturns = processLoanReturns(world);
  report.expired = processContractExpiries(world);
  report.freeAgents = processFreeAgentSignings(world);

  const loanDeals = processLoanWindow(world);
  for (const d of loanDeals) {
    report.loans.push({
      playerId: d.playerId,
      parentClubId: d.parentClubId,
      loanClubId: d.loanClubId,
      playingTimeExpectation: d.playingTimeExpectation,
    });
  }

  for (const buying of world.clubs.values()) {
    if (activeSquadCount(world, buying) >= SQUAD_HARD_CAP) continue;
    const needs = analyzeSquadNeeds(world, buying);
    const top = needs.prioritized.slice(0, 2);
    for (const need of top) {
      if (need.score < 35) continue;
      if (world.rng.chance(0.55)) continue;

      const candidates = [...world.players.values()]
        .filter(
          (p) =>
            !p.retired &&
            p.currentClubId &&
            p.currentClubId !== buying.id &&
            !p.isUserControlled &&
            p.primaryPosition === need.position &&
            p.ovr >= buying.reputation * 0.7 &&
            p.ovr <= buying.reputation + 8
        )
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, 5);

      const target = candidates[0];
      if (!target || !target.currentClubId) continue;
      const selling = world.clubs.get(target.currentClubId);
      if (!selling) continue;

      const fee = askingPrice(world, target, selling);
      if (buying.finances.transferBudget < fee * 0.9) continue;
      if (selling.reputation > buying.reputation + 15 && target.age <= 24) continue;

      selling.squadPlayerIds = selling.squadPlayerIds.filter((id) => id !== target.id);
      if (target.contract) {
        selling.finances.currentWageBillWeekly = Math.max(
          0,
          selling.finances.currentWageBillWeekly - target.contract.wage
        );
      }
      selling.finances.balance += fee;
      selling.finances.transferBudget += Math.round(fee * 0.3);

      buying.finances.transferBudget -= fee;
      buying.finances.balance -= fee;
      buying.squadPlayerIds.push(target.id);
      target.currentClubId = buying.id;
      const years = target.age <= 28 ? 4 : 2;
      const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
      const wage = Math.round(target.ovr * target.ovr * 10);
      target.contract = {
        clubId: buying.id,
        wage,
        startDate: world.calendar.currentDate,
        endDate: `${endYear}-06-30`,
        releaseClause: Math.round(fee * 1.6),
        signedDate: world.calendar.currentDate,
      };
      buying.finances.currentWageBillWeekly += wage;

      report.transfers.push({
        playerId: target.id,
        fromClubId: selling.id,
        toClubId: buying.id,
        fee,
      });

      world.events.emit(Events.TRANSFER_COMPLETED, {
        playerId: target.id,
        fromClubId: selling.id,
        toClubId: buying.id,
        fee,
      });
      break;
    }
  }

  pruneAllClubs(world);
  fillThinSquads(world);
  return report;
}

export function formatWindowReport(world: World, report: WindowReport): string {
  let out = `Transfer window: ${report.transfers.length} transfers, ${report.loans.length} loans, ${report.freeAgents} FA, ${report.expired} expired, ${report.loanReturns} returns\n`;
  for (const t of report.transfers.slice(0, 20)) {
    const p = world.players.get(t.playerId);
    const to = world.clubs.get(t.toClubId)?.shortName ?? "?";
    const from = t.fromClubId ? world.clubs.get(t.fromClubId)?.shortName ?? "?" : "FA";
    out += `  ${p?.displayName ?? t.playerId}  ${from} → ${to}  €${(t.fee / 1e6).toFixed(2)}m\n`;
  }
  for (const l of report.loans.slice(0, 10)) {
    const p = world.players.get(l.playerId);
    const parent = world.clubs.get(l.parentClubId)?.shortName ?? "?";
    const dest = world.clubs.get(l.loanClubId)?.shortName ?? "?";
    out += `  LOAN ${p?.displayName ?? l.playerId}  ${parent} → ${dest} (${l.playingTimeExpectation})\n`;
  }
  return out;
}

export function validateSquads(world: World): string[] {
  const errors: string[] = [];
  for (const club of world.clubs.values()) {
    const active = club.squadPlayerIds.filter((id) => {
      const p = world.players.get(id);
      return p && !p.retired && p.currentClubId === club.id;
    });
    if (active.length > 28) errors.push(`${club.name}: squad too large (${active.length})`);
    if (active.length < 11) errors.push(`${club.name}: squad too small (${active.length})`);
  }
  return errors;
}
