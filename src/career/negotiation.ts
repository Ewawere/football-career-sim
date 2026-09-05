/**
 * Player-facing contract negotiation - demands, club offer, accept/reject/mediate.
 * Wages only change on explicit Accept — not on every button click.
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
  status: "idle" | "open" | "accepted" | "rejected" | "cooldown";
  lastMessage: string;
  agentRounds: number;
  maxAgentRounds: number;
  history: string[];
  openedAtDate?: string;
  cooldownUntil?: string;
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
  const club = world.clubs.get(clubId as any);
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

  // Already open — do NOT re-roll wages (was inflating every click)
  if (neg.open && neg.status === "open") {
    neg.lastMessage = "Talks already open — accept, mediate, or walk.";
    return { ...neg };
  }

  // Cooldown after signing
  if (neg.cooldownUntil && world.calendar.currentDate < neg.cooldownUntil) {
    neg.lastMessage = `Board won't reopen until ${neg.cooldownUntil}.`;
    neg.status = "cooldown";
    return { ...neg };
  }

  const current = player.contract?.wage ?? Math.round(player.ovr * player.ovr * 6);
  const value = estimateMarketValue(world, player);
  const trust = player.state.managerTrust ?? 50;
  const apps = player.careerAppearances ?? player.state.appearancesThisSeason ?? 0;
  const form = player.state.form ?? 50;

  let demandMult = 1.1;
  if (form >= 75) demandMult += 0.06;
  if (apps >= 15) demandMult += 0.04;
  if (trust >= 70) demandMult += 0.03;
  if (player.age <= 21) demandMult += 0.03;

  neg.demandedWage = Math.round(current * demandMult);
  neg.demandedYears = player.age <= 23 ? 4 : 3;

  const room = wageRoom(world, club.id);
  let offerMult = 1.02;
  if (trust >= 70) offerMult += 0.03;
  if (form >= 70) offerMult += 0.02;
  if (apps < 5) offerMult -= 0.04;

  neg.offeredWage = Math.round(
    Math.min(current * offerMult + room * 0.015, neg.demandedWage * 0.95)
  );
  if (neg.offeredWage < current) neg.offeredWage = current;
  neg.offeredYears = neg.demandedYears;
  neg.releaseClause = Math.round(value * (player.age <= 23 ? 1.8 : 1.4));

  neg.open = true;
  neg.status = "open";
  neg.agentRounds = 0;
  neg.history = [];
  neg.openedAtDate = world.calendar.currentDate;
  neg.clubNote = `Board offer reflects wage room and your minutes at ${club.name}.`;
  neg.agentNote = "Accept, mediate (max 3), or walk. Wages only change if you Accept.";
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

  if (!neg.open || neg.status !== "open") {
    if (action === "accept" || action === "mediate" || action === "counter") {
      neg.lastMessage = "Open talks first.";
      return { ...neg };
    }
  }

  if (action === "counter") {
    if ((neg.agentRounds || 0) >= neg.maxAgentRounds) {
      neg.lastMessage = "No more counters this week.";
      return { ...neg };
    }
    neg.agentRounds = (neg.agentRounds || 0) + 1;
    // Small moves only — never explode wages
    neg.demandedWage = Math.round(neg.demandedWage * 1.02);
    neg.offeredWage = Math.min(
      neg.demandedWage,
      Math.round(neg.offeredWage * 1.015 + 500)
    );
    neg.lastMessage = "You countered. Club edged up slightly.";
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
    neg.offeredWage = Math.min(neg.demandedWage, Math.round(neg.offeredWage * 0.45 + mid * 0.55));
    neg.lastMessage = "Agent sat with the board.";
    neg.agentNote =
      neg.offeredWage >= neg.demandedWage * 0.97
        ? "Close enough — take it."
        : `Round ${neg.agentRounds}/${neg.maxAgentRounds}.`;
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

  // accept — ONLY place wages actually change
  const oldWage = player.contract?.wage ?? 0;
  const years = neg.offeredYears || 3;
  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
  player.contract = {
    clubId: club.id,
    wage: neg.offeredWage,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause: neg.releaseClause,
    signedDate: world.calendar.currentDate,
  };
  club.finances.currentWageBillWeekly =
    (club.finances.currentWageBillWeekly ?? 0) + (neg.offeredWage - oldWage);
  player.state.morale = Math.min(100, (player.state.morale ?? 50) + 12);
  player.state.managerTrust = Math.min(100, (player.state.managerTrust ?? 50) + 5);
  (player.state as any).openToTransfer = false;
  neg.open = false;
  neg.status = "accepted";
  // 30-day cooldown so spam-click can't re-raise forever
  const d = new Date(world.calendar.currentDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 30);
  neg.cooldownUntil = d.toISOString().slice(0, 10);
  neg.lastMessage = `Deal done — €${Math.round(neg.offeredWage / 1000)}k/w until ${endYear}.`;
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
    currentWageWeekly: `€${Math.round(currentWage / 1000)}k/w`,
    endDate: player.contract?.endDate ?? null,
    demandedLabel: `€${Math.round(neg.demandedWage / 1000)}k/w`,
    offeredLabel: `€${Math.round(neg.offeredWage / 1000)}k/w`,
    releaseLabel: neg.releaseClause ? formatMarketValue(neg.releaseClause) : "—",
    round: neg.agentRounds ?? 0,
    maxRounds: neg.maxAgentRounds ?? 3,
    history: neg.history || [],
    marketValueLabel: formatMarketValue(estimateMarketValue(world, player)),
  };
}
