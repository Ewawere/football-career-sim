/**
 * Player-facing contract negotiation - demands, club offer, accept/reject.
 */

import type { World } from "../world/world.js";
import { estimateMarketValue, formatMarketValue } from "../contracts/valuation.js";

export interface NegotiationState {
  open: boolean;
  demandedWage: number;
  offeredWage: number;
  demandedYears: number;
  offeredYears: number;
  releaseClause: number | null;
  clubNote: string;
  agentNote: string;
  status: "idle" | "open" | "accepted" | "rejected";
  lastMessage: string;
  agentRounds: number;
  maxAgentRounds: number;
  history: string[];
}

function ensureNeg(world: World): NegotiationState {
  if (!(world as any).contractNegotiation) {
    (world as any).contractNegotiation = {
      open: false,
      demandedWage: 0,
      offeredWage: 0,
      demandedYears: 3,
      offeredYears: 3,
      releaseClause: null,
      clubNote: "",
      agentNote: "",
      status: "idle",
      lastMessage: "",
      agentRounds: 0,
      maxAgentRounds: 3,
      history: [],
    } as NegotiationState;
  }
  const n = (world as any).contractNegotiation as NegotiationState;
  if (n.agentRounds == null) n.agentRounds = 0;
  if (n.maxAgentRounds == null) n.maxAgentRounds = 3;
  if (!n.history) n.history = [];
  return n;
}

function wageRoom(world: World, clubId: string): number {
  const club = world.clubs.get(clubId);
  if (!club) return 0;
  const fin = club.finances;
  return Math.max(0, (fin.wageBudgetWeekly ?? 0) - (fin.currentWageBillWeekly ?? 0));
}

export function openNegotiation(world: World): NegotiationState {
  const pid = world.userPlayerId;
  if (!pid) throw new Error("No player");
  const player = world.players.get(pid);
  if (!player?.currentClubId) throw new Error("No club");
  const club = world.clubs.get(player.currentClubId)!;
  const neg = ensureNeg(world);

  const current = player.contract?.wage ?? Math.round(player.ovr * player.ovr * 6);
  const value = estimateMarketValue(world, player);
  const trust = player.state.managerTrust ?? 50;
  const apps = player.state.appearancesThisSeason ?? 0;
  const form = player.state.form ?? 50;

  let demandMult = 1.12;
  if (form >= 70 && apps >= 8) demandMult += 0.08;
  if (player.potential >= 84 && player.age <= 23) demandMult += 0.1;
  if (trust < 40) demandMult += 0.05;
  const demandedWage = Math.round(current * demandMult / 100) * 100;
  const demandedYears = player.age <= 23 ? 5 : player.age <= 29 ? 4 : player.age <= 32 ? 3 : 2;

  const room = wageRoom(world, club.id);
  let offerMult = 1.04;
  if (trust >= 70) offerMult += 0.04;
  if (apps >= 15) offerMult += 0.03;
  let offeredWage = Math.round(current * offerMult / 100) * 100;
  if (offeredWage - current > room + 25000) {
    offeredWage = current + Math.max(0, Math.floor(room * 0.7));
  }
  if (offeredWage < current) offeredWage = current;

  const offeredYears = player.age <= 24 ? 4 : player.age <= 30 ? 3 : 2;
  const releaseClause =
    player.potential >= 80
      ? Math.round(value * (1.35 + (player.age <= 22 ? 0.25 : 0.1)))
      : player.contract?.releaseClause ?? null;

  neg.open = true;
  neg.status = "open";
  neg.agentRounds = 0;
  neg.maxAgentRounds = 3;
  neg.history = [`Talks opened at ${club.name}.`];
  neg.demandedWage = demandedWage;
  neg.offeredWage = offeredWage;
  neg.demandedYears = demandedYears;
  neg.offeredYears = offeredYears;
  neg.releaseClause = releaseClause;
  neg.clubNote =
    offeredWage >= demandedWage * 0.95
      ? "The club is close to your terms."
      : room < 15000
        ? "Wage budget is tight - board limited the package."
        : "The club values you but will not match the full demand yet.";
  neg.agentNote =
    demandedWage > offeredWage * 1.1
      ? "I'd push once more or look at a loan step-up if minutes dry up."
      : "This is a fair market deal - accepting keeps stability.";
  neg.lastMessage = "Negotiation opened.";
  return { ...neg };
}

export function respondNegotiation(
  world: World,
  action: "accept" | "reject" | "counter" | "mediate"
): NegotiationState {
  const pid = world.userPlayerId;
  if (!pid) throw new Error("No player");
  const player = world.players.get(pid)!;
  const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  if (!club) throw new Error("No club");
  const neg = ensureNeg(world);
  if (!neg.open && action !== "accept") {
    openNegotiation(world);
  }

  if (action === "counter") {
    if (neg.agentRounds >= neg.maxAgentRounds) {
      neg.lastMessage = "Talks stalled - final offer stands. Accept or walk.";
      neg.clubNote = "Board: no more rounds this window.";
      neg.agentNote = "I can't extract more without you threatening a transfer request.";
      neg.history.push("Hard deadlock");
      return { ...neg };
    }
    neg.agentRounds += 1;
    const room = wageRoom(world, club.id);
    const agentPull = 0.35 + neg.agentRounds * 0.08;
    const mid = Math.round((neg.demandedWage * (1 - agentPull * 0.25) + neg.offeredWage * (1 + agentPull * 0.35)) / 2 / 100) * 100;
    const next = Math.min(neg.demandedWage, Math.max(neg.offeredWage, mid));
    neg.demandedWage = Math.round((neg.demandedWage * 0.97 + next * 0.03) / 100) * 100;
    if (next - (player.contract?.wage ?? neg.offeredWage) > room + 40000) {
      neg.lastMessage = `Round ${neg.agentRounds}: board blocked a higher wage.`;
      neg.clubNote = "Finances capped the package.";
      neg.agentNote = "I'll keep pressure on, but the budget is real.";
      neg.history.push(`R${neg.agentRounds}: board block`);
    } else {
      neg.offeredWage = next;
      if (neg.agentRounds >= 2) {
        neg.offeredYears = Math.max(neg.offeredYears, Math.min(neg.demandedYears, neg.offeredYears + 1));
      }
      neg.lastMessage = `Round ${neg.agentRounds}: club improved after agent mediation.`;
      neg.clubNote = "Revised package after agent talks.";
      neg.agentNote =
        neg.offeredWage >= neg.demandedWage * 0.96
          ? "This is as good as it gets - I'd sign."
          : "Still a gap. One more push if you want, or take stability.";
      neg.history.push(`R${neg.agentRounds}: offer EUR ${Math.round(next / 1000)}k/w`);
    }
    return { ...neg };
  }

  if (action === "mediate") {
    if (neg.agentRounds >= neg.maxAgentRounds) {
      neg.lastMessage = "Agent has no more leverage this window.";
      neg.agentNote = "We've pushed as far as the board will listen for now.";
      neg.history.push(neg.lastMessage);
      return { ...neg };
    }
    neg.agentRounds += 1;
    const room = wageRoom(world, club.id);
    const trust = player.state.managerTrust ?? 50;
    const form = player.state.form ?? 50;
    let bump = Math.round(neg.offeredWage * (0.03 + neg.agentRounds * 0.015) / 100) * 100;
    if (trust >= 70) bump = Math.round(bump * 1.25);
    if (form >= 70) bump = Math.round(bump * 1.15);
    const next = Math.min(neg.demandedWage, neg.offeredWage + bump);
    if (next - (player.contract?.wage ?? 0) > room + 55000) {
      neg.lastMessage = `Agent mediation #${neg.agentRounds}: board cited finances - small gesture only.`;
      neg.offeredWage = Math.min(neg.demandedWage, neg.offeredWage + Math.max(500, Math.floor(bump * 0.35)));
    } else {
      neg.offeredWage = next;
      if (neg.agentRounds >= 2 && neg.offeredYears < neg.demandedYears) {
        neg.offeredYears += 1;
      }
      neg.lastMessage = `Agent mediation #${neg.agentRounds}: club moved to EUR ${Math.round(neg.offeredWage / 1000)}k/w.`;
    }
    neg.clubNote = "Agent sat with the board and reopened the numbers.";
    neg.agentNote =
      neg.offeredWage >= neg.demandedWage * 0.97
        ? "Close enough - I'd take this."
        : `Round ${neg.agentRounds}/${neg.maxAgentRounds}. We can try again or accept.`;
    neg.history.push(neg.lastMessage);
    return { ...neg };
  }

  if (action === "reject") {
    neg.open = false;
    neg.status = "rejected";
    neg.lastMessage = "You walked away from talks.";
    neg.history.push(neg.lastMessage);
    player.state.morale = Math.max(20, (player.state.morale ?? 50) - 4);
    if (neg.offeredWage < neg.demandedWage * 0.85) {
      (player.state as any).openToTransfer = true;
    }
    return { ...neg };
  }

  const oldWage = player.contract?.wage ?? 0;
  const years = neg.offeredYears;
  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
  player.contract = {
    clubId: club.id,
    wage: neg.offeredWage,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause: neg.releaseClause,
    signedDate: world.calendar.currentDate,
  };
  club.finances.currentWageBillWeekly += neg.offeredWage - oldWage;
  player.state.morale = Math.min(100, (player.state.morale ?? 50) + 12);
  player.state.managerTrust = Math.min(100, (player.state.managerTrust ?? 50) + 5);
  (player.state as any).openToTransfer = false;
  neg.open = false;
  neg.status = "accepted";
  neg.lastMessage = `Deal done - EUR ${Math.round(neg.offeredWage / 1000)}k/w until ${endYear}.`;
  neg.history.push(neg.lastMessage);
  return { ...neg };
}

export function snapshotNegotiation(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  const neg = ensureNeg(world);
  const currentWage = player.contract?.wage ?? 0;
  return {
    ...neg,
    currentWage,
    currentWageLabel: formatMarketValue(currentWage),
    currentWageWeekly: `EUR ${Math.round(currentWage / 1000)}k/w`,
    endDate: player.contract?.endDate ?? null,
    demandedLabel: `EUR ${Math.round(neg.demandedWage / 1000)}k/w`,
    offeredLabel: `EUR ${Math.round(neg.offeredWage / 1000)}k/w`,
    releaseLabel: neg.releaseClause ? formatMarketValue(neg.releaseClause) : "-",
    round: neg.agentRounds ?? 0,
    maxRounds: neg.maxAgentRounds ?? 3,
    history: neg.history || [],
    marketValueLabel: formatMarketValue(estimateMarketValue(world, player)),
  };
}
