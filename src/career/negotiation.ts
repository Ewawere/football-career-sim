/**
 * Player-facing contract negotiation - demands, club offer, accept/reject/mediate.
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
  if (form >= 75) demandMult += 0.08;
  if (apps >= 15) demandMult += 0.05;
  if (trust >= 70) demandMult += 0.03;
  if (player.age <= 21) demandMult += 0.04;

  neg.demandedWage = Math.round(current * demandMult);
  neg.demandedYears = player.age <= 23 ? 4 : 3;

  const room = wageRoom(world, club.id);
  let offerMult = 1.02;
  if (trust >= 70) offerMult += 0.04;
  if (form >= 70) offerMult += 0.03;
  if (apps < 5) offerMult -= 0.05;

  neg.offeredWage = Math.round(Math.min(current * offerMult + room * 0.02, neg.demandedWage * 0.98));
  if (neg.offeredWage < current) neg.offeredWage = current;
  neg.offeredYears = neg.demandedYears;
  neg.releaseClause = Math.round(value * (player.age <= 23 ? 1.8 : 1.4));

  neg.open = true;
  neg.status = "open";
  neg.agentRounds = 0;
  neg.history = [];
  neg.clubNote = `Board offer reflects wage room and your recent minutes at ${club.name}.`;
  neg.agentNote = "We can accept, counter, mediate, or walk.";
  neg.lastMessage = "Talks opened.";
  neg.history.push(neg.lastMessage);
  return { ...neg };
}

export function respondNegotiation(
  world: World,
  action: "accept" | "reject" | "counter" | "mediate"
): NegotiationState {
  const pid = world.userPlayerId;
  if (!pid) throw new Error("No player");
  const player = world.players.get(pid)!;
  const club = player.currentClubId ? world.clubs.get(player.currentClubId)! : null;
  if (!club) throw new Error("No club");
  const neg = ensureNeg(world);
  if (!neg.open && action !== "accept") {
    // allow accept only if already open; otherwise reopen path
  }
  if (!neg.open) {
    openNegotiation(world);
  }

  if (action === "counter") {
    neg.demandedWage = Math.round(neg.demandedWage * 1.03);
    neg.offeredWage = Math.round(neg.offeredWage * 1.02);
    neg.agentRounds = Math.min(neg.maxAgentRounds, (neg.agentRounds || 0) + 1);
    neg.lastMessage = "You countered. Club edged the offer up slightly.";
    neg.agentNote = `Round ${neg.agentRounds}/${neg.maxAgentRounds}.`;
    neg.history.push(neg.lastMessage);
    return { ...neg };
  }

  if (action === "mediate") {
    if ((neg.agentRounds || 0) >= neg.maxAgentRounds) {
      neg.lastMessage = "Agent has no more leverage this week.";
      neg.history.push(neg.lastMessage);
      return { ...neg };
    }
    neg.agentRounds = (neg.agentRounds || 0) + 1;
    const mid = Math.round((neg.demandedWage + neg.offeredWage) / 2);
    neg.offeredWage = Math.round(neg.offeredWage * 0.4 + mid * 0.6);
    neg.lastMessage = "Agent sat with the board and reopened the numbers.";
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

  // accept
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
