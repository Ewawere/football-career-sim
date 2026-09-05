/**
 * Cross-league scouting interest → contract offers for the user player.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { estimateMarketValue, formatMarketValue } from "../contracts/valuation.js";

export interface PlayerTransferOffer {
  id: string;
  fromClubId: EntityId;
  fromClubName: string;
  fromNation: string;
  leagueLabel: string;
  wageWeekly: number;
  years: number;
  transferFee: number;
  roleNote: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdDate: string;
}

function bag(world: World): PlayerTransferOffer[] {
  if (!(world as any).playerTransferOffers) (world as any).playerTransferOffers = [];
  return (world as any).playerTransferOffers as PlayerTransferOffer[];
}

export function snapshotTransferOffers(world: World) {
  return bag(world)
    .filter((o) => o.status === "pending")
    .map((o) => ({
      ...o,
      wageLabel: `€${Math.round(o.wageWeekly / 1000)}k/w`,
      feeLabel: formatMarketValue(o.transferFee),
    }));
}

/** Call after strong performances / advance day */
export function generateScoutInterest(world: World, force = false): PlayerTransferOffer[] {
  const pid = world.userPlayerId;
  if (!pid) return [];
  const player = world.players.get(pid);
  if (!player?.currentClubId) return [];

  const existing = bag(world).filter((o) => o.status === "pending");
  if (existing.length >= 4 && !force) return existing;

  const form = player.state.form ?? 50;
  const apps = player.careerAppearances ?? 0;
  const goals = player.careerGoals ?? 0;
  const trust = player.state.managerTrust ?? 50;
  const ovr = player.ovr ?? 60;

  // Chance to be scouted
  let chance = 0.08;
  if (form >= 70) chance += 0.1;
  if (goals >= 3) chance += 0.12;
  if (apps >= 5) chance += 0.08;
  if ((player.state as any).openToTransfer) chance += 0.2;
  if (trust < 40) chance += 0.1;
  if (force) chance = 1;

  if (!world.rng.chance(chance) && !force) return existing;

  const myClub = world.clubs.get(player.currentClubId)!;
  const value = estimateMarketValue(world, player);
  const currentWage = player.contract?.wage ?? Math.round(ovr * ovr * 6);

  const candidates = [...world.clubs.values()]
    .filter((c) => c.id !== player.currentClubId)
    .filter((c) => Math.abs(c.reputation - myClub.reputation) <= 18 || c.reputation > myClub.reputation - 5)
    .sort((a, b) => b.reputation - a.reputation);

  if (!candidates.length) return existing;

  const n = force ? Math.min(3, candidates.length) : world.rng.int(1, Math.min(2, candidates.length));
  const picks = world.rng.shuffle([...candidates]).slice(0, n);
  const created: PlayerTransferOffer[] = [];

  for (const club of picks) {
    if (existing.some((o) => o.fromClubId === club.id)) continue;
    const wageBump = 1.05 + (club.reputation - myClub.reputation) * 0.004 + world.rng.float(0, 0.12);
    const wage = Math.round(Math.max(currentWage * wageBump, currentWage + 2000));
    const years = player.age <= 22 ? 4 : 3;
    const fee = Math.round(value * (0.9 + world.rng.float(0, 0.5)));
    const offer: PlayerTransferOffer = {
      id: nextId("pto"),
      fromClubId: club.id,
      fromClubName: club.name,
      fromNation: club.nation,
      leagueLabel: club.nation === "England"
        ? "Premier League"
        : club.nation === "Spain"
          ? "La Liga"
          : club.nation === "Germany"
            ? "Bundesliga"
            : club.nation === "Italy"
              ? "Serie A"
              : club.nation === "France"
                ? "Ligue 1"
                : club.nation,
      wageWeekly: wage,
      years,
      transferFee: fee,
      roleNote:
        club.reputation > myClub.reputation + 5
          ? "Bigger stage — rotation risk early on."
          : club.reputation < myClub.reputation - 5
            ? "Likely starter and focal point."
            : "Similar level — fight for your place.",
      status: "pending",
      createdDate: world.calendar.currentDate,
    };
    bag(world).push(offer);
    created.push(offer);
  }

  return snapshotTransferOffers(world);
}

export function acceptTransferOffer(world: World, offerId: string): { ok: boolean; message: string } {
  const offers = bag(world);
  const offer = offers.find((o) => o.id === offerId && o.status === "pending");
  if (!offer) return { ok: false, message: "Offer gone" };
  const pid = world.userPlayerId;
  if (!pid) return { ok: false, message: "No player" };
  const player = world.players.get(pid)!;
  const fromClub = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  const toClub = world.clubs.get(offer.fromClubId);
  if (!toClub) return { ok: false, message: "Club missing" };

  // Leave old squad
  if (fromClub) {
    fromClub.squadPlayerIds = fromClub.squadPlayerIds.filter((id) => id !== pid);
    if (player.contract?.wage) {
      fromClub.finances.currentWageBillWeekly = Math.max(
        0,
        (fromClub.finances.currentWageBillWeekly ?? 0) - player.contract.wage
      );
    }
  }

  // Join new
  player.currentClubId = toClub.id;
  if (!toClub.squadPlayerIds.includes(pid)) toClub.squadPlayerIds.push(pid);
  const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + offer.years;
  player.contract = {
    clubId: toClub.id,
    wage: offer.wageWeekly,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause: Math.round(offer.transferFee * 1.6),
    signedDate: world.calendar.currentDate,
  };
  toClub.finances.currentWageBillWeekly =
    (toClub.finances.currentWageBillWeekly ?? 0) + offer.wageWeekly;
  player.state.morale = Math.min(100, (player.state.morale ?? 50) + 15);
  player.state.managerTrust = 55;
  (player.state as any).openToTransfer = false;

  offer.status = "accepted";
  for (const o of offers) {
    if (o.status === "pending") o.status = "expired";
  }

  // News-ish note on world
  if (!(world as any).newsFeed) (world as any).newsFeed = [];
  (world as any).newsFeed.push({
    id: nextId("nws"),
    timestamp: world.calendar.currentDate,
    category: "Transfer",
    importance: "Major",
    headline: `${player.displayName} joins ${toClub.name}`,
    body: `${player.displayName} has completed a move from ${fromClub?.name ?? "his club"} to ${toClub.name} (${offer.leagueLabel}) on €${Math.round(offer.wageWeekly / 1000)}k/w.`,
    sourceId: "gfn",
    relatedPlayerIds: [pid],
    relatedClubIds: [toClub.id, ...(fromClub ? [fromClub.id] : [])],
    relatedCompetitionId: null,
    sourceEventId: `pto:${offer.id}`,
    sentiment: "Positive",
    tags: ["transfer", "player-move"],
    storyKey: `pto:${offer.id}`,
  });

  return { ok: true, message: `Signed for ${toClub.name}` };
}

export function declineTransferOffer(world: World, offerId: string): { ok: boolean } {
  const offer = bag(world).find((o) => o.id === offerId && o.status === "pending");
  if (!offer) return { ok: false };
  offer.status = "declined";
  return { ok: true };
}
