/**
 * Loan system — parent retains ownership; return at end of loan.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import { activeSquadCount, SQUAD_HARD_CAP, canSignPlayer } from "./squad-rules.js";
import { Events } from "../core/events.js";

export interface LoanDeal {
  id: EntityId;
  playerId: EntityId;
  parentClubId: EntityId;
  loanClubId: EntityId;
  startDate: string;
  endDate: string;
  wageSplitParent: number; // 0–1 share paid by parent
  playingTimeExpectation: "Starter" | "Rotation" | "Development";
  active: boolean;
}

function loanMap(world: World): Map<string, LoanDeal> {
  if (!(world as any).loans) (world as any).loans = new Map();
  return (world as any).loans;
}

export function getActiveLoan(world: World, playerId: EntityId): LoanDeal | null {
  for (const l of loanMap(world).values()) {
    if (l.playerId === playerId && l.active) return l;
  }
  return null;
}

export function shouldConsiderLoan(world: World, player: Player, club: Club): boolean {
  if (player.isUserControlled) return false;
  if (player.age > 23) return false;
  if (player.ovr >= club.reputation - 2) return false; // first team quality
  if (player.state.appearancesThisSeason >= 15) return false;
  return player.age <= 21 || player.state.appearancesThisSeason < 5;
}

export function completeLoan(
  world: World,
  player: Player,
  parent: Club,
  destination: Club,
  expectation: LoanDeal["playingTimeExpectation"] = "Development"
): LoanDeal | null {
  if (!canSignPlayer(world, destination)) return null;
  if (activeSquadCount(world, destination) >= SQUAD_HARD_CAP) return null;
  if (player.currentClubId !== parent.id) return null;

  // Move current club to loan club; parent keeps squad list entry for ownership
  player.currentClubId = destination.id;
  if (!destination.squadPlayerIds.includes(player.id)) {
    destination.squadPlayerIds.push(player.id);
  }
  const wage = player.contract?.wage ?? 1000;
  const parentShare = 0.5;
  destination.finances.currentWageBillWeekly += Math.round(wage * (1 - parentShare));

  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + 1;
  const deal: LoanDeal = {
    id: nextId("loan"),
    playerId: player.id,
    parentClubId: parent.id,
    loanClubId: destination.id,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    wageSplitParent: parentShare,
    playingTimeExpectation: expectation,
    active: true,
  };
  loanMap(world).set(deal.id, deal);

  world.events.emit(Events.LOAN_COMPLETED, {
    playerId: player.id,
    parentClubId: parent.id,
    loanClubId: destination.id,
  });
  return deal;
}

export function processLoanReturns(world: World): number {
  let returned = 0;
  for (const deal of loanMap(world).values()) {
    if (!deal.active) continue;
    if (world.calendar.currentDate < deal.endDate) continue;

    const player = world.players.get(deal.playerId);
    const parent = world.clubs.get(deal.parentClubId);
    const loanClub = world.clubs.get(deal.loanClubId);
    if (!player || !parent) {
      deal.active = false;
      continue;
    }

    if (loanClub) {
      loanClub.squadPlayerIds = loanClub.squadPlayerIds.filter((id) => id !== player.id);
      const wage = player.contract?.wage ?? 0;
      loanClub.finances.currentWageBillWeekly = Math.max(
        0,
        loanClub.finances.currentWageBillWeekly - Math.round(wage * (1 - deal.wageSplitParent))
      );
    }

    player.currentClubId = parent.id;
    if (!parent.squadPlayerIds.includes(player.id)) parent.squadPlayerIds.push(player.id);
    deal.active = false;
    returned++;
  }
  return returned;
}

export function processLoanWindow(world: World): LoanDeal[] {
  const deals: LoanDeal[] = [];
  for (const parent of world.clubs.values()) {
    let loansOut = 0;
    for (const id of [...parent.squadPlayerIds]) {
      if (loansOut >= 2) break;
      const p = world.players.get(id);
      if (!p || p.retired) continue;
      if (getActiveLoan(world, p.id)) continue;
      if (!shouldConsiderLoan(world, p, parent)) continue;
      if (!world.rng.chance(0.35)) continue;

      // Find smaller club that needs the position
      const destinations = [...world.clubs.values()]
        .filter(
          (c) =>
            c.id !== parent.id &&
            c.reputation < parent.reputation - 5 &&
            activeSquadCount(world, c) < SQUAD_HARD_CAP - 1
        )
        .sort((a, b) => b.reputation - a.reputation);

      const dest = destinations.find(() => true);
      if (!dest) continue;
      const deal = completeLoan(world, p, parent, dest, p.ovr >= dest.reputation ? "Rotation" : "Development");
      if (deal) {
        deals.push(deal);
        loansOut++;
      }
    }
  }
  return deals;
}
