/**
 * Cross-league scouting interest → contract offers for the user player.
 * Clubs from every major league can scout and offer a move.
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

function leagueLabelFor(nation: string): string {
  switch (nation) {
    case "England":
      return "Premier League";
    case "Spain":
      return "La Liga";
    case "Germany":
      return "Bundesliga";
    case "Italy":
      return "Serie A";
    case "France":
      return "Ligue 1";
    case "Portugal":
      return "Primeira Liga";
    case "Netherlands":
      return "Eredivisie";
    default:
      return nation || "Europe";
  }
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

/** Call after strong performances / advance day / match finish */
export function generateScoutInterest(world: World, force = false): PlayerTransferOffer[] {
  const pid = world.userPlayerId;
  if (!pid) return [];
  const player = world.players.get(pid);
  if (!player?.currentClubId) return [];

  const existing = bag(world).filter((o) => o.status === "pending");
  if (existing.length >= 5 && !force) return existing;

  const form = player.state.form ?? 50;
  const apps = player.careerAppearances ?? 0;
  const goals = player.careerGoals ?? 0;
  const assists = (player as any).careerAssists ?? 0;
  const trust = player.state.managerTrust ?? 50;
  const ovr = player.ovr ?? 60;

  let chance = 0.18;
  if (form >= 65) chance += 0.12;
  if (form >= 80) chance += 0.1;
  if (goals >= 1) chance += 0.08;
  if (goals >= 3) chance += 0.12;
  if (assists >= 2) chance += 0.06;
  if (apps >= 3) chance += 0.1;
  if (apps >= 8) chance += 0.08;
  if ((player.state as any).openToTransfer) chance += 0.25;
  if (trust < 40) chance += 0.12;
  if (ovr >= 70) chance += 0.08;
  if (force) chance = 1;
  chance = Math.min(chance, 0.92);

  if (!world.rng.chance(chance) && !force) return existing;

  const myClub = world.clubs.get(player.currentClubId)!;
  const value = estimateMarketValue(world, player);
  const currentWage = player.contract?.wage ?? Math.round(ovr * ovr * 6);

  const allOthers = [...world.clubs.values()].filter((c) => c.id !== player.currentClubId);
  const band = allOthers.filter(
    (c) =>
      Math.abs(c.reputation - myClub.reputation) <= 25 ||
      c.reputation >= myClub.reputation - 8
  );
  const pool = band.length ? band : allOthers;

  const byNation = new Map<string, typeof pool>();
  for (const c of pool) {
    const list = byNation.get(c.nation) || [];
    list.push(c);
    byNation.set(c.nation, list);
  }
  const nations = world.rng.shuffle([...byNation.keys()]);

  const picks: typeof pool = [];
  const targetN = force ? Math.min(4, pool.length) : world.rng.int(1, Math.min(3, pool.length));

  for (const nation of nations) {
    if (picks.length >= targetN) break;
    const list = byNation.get(nation)!;
    const sorted = [...list].sort((a, b) => b.reputation - a.reputation);
    const choice = world.rng.pick(sorted.slice(0, Math.min(6, sorted.length)));
    if (!existing.some((o) => o.fromClubId === choice.id) && !picks.some((p) => p.id === choice.id)) {
      picks.push(choice);
    }
  }
  if (picks.length < targetN) {
    const rest = world.rng
      .shuffle([...pool])
      .filter((c) => !picks.some((p) => p.id === c.id) && !existing.some((o) => o.fromClubId === c.id));
    for (const c of rest) {
      if (picks.length >= targetN) break;
      picks.push(c);
    }
  }

  if (!picks.length) return existing;

  for (const club of picks) {
    if (existing.some((o) => o.fromClubId === club.id)) continue;
    const repDelta = club.reputation - myClub.reputation;
    const wageBump = 1.04 + repDelta * 0.005 + world.rng.float(0, 0.1);
    const wage = Math.round(
      Math.max(currentWage * Math.max(0.95, wageBump), currentWage + (repDelta > 0 ? 1500 : 500))
    );
    const years = player.age <= 22 ? 4 : player.age <= 28 ? 3 : 2;
    const fee = Math.round(value * (0.85 + world.rng.float(0, 0.55)));
    const offer: PlayerTransferOffer = {
      id: nextId("pto"),
      fromClubId: club.id,
      fromClubName: club.name,
      fromNation: club.nation,
      leagueLabel: leagueLabelFor(club.nation),
      wageWeekly: wage,
      years,
      transferFee: fee,
      roleNote:
        club.reputation > myClub.reputation + 6
          ? "Bigger stage — may rotate early on."
          : club.reputation < myClub.reputation - 6
            ? "Likely starter and main man."
            : club.nation !== myClub.nation
              ? "Cross-league move — new league, new challenge."
              : "Similar level — fight for your place.",
      status: "pending",
      createdDate: world.calendar.currentDate,
    };
    bag(world).push(offer);
  }

  return snapshotTransferOffers(world);
}

export function acceptTransferOffer(world: World, offerId: string): { ok: boolean; message: string } {
  const offers = bag(world);
  const offer = offers.find((o) => o.id === offerId && o.status === "pending");
  if (!offer) return { ok: false, message: "Offer not found" };

  const pid = world.userPlayerId;
  if (!pid) return { ok: false, message: "No player" };
  const player = world.players.get(pid)!;
  const fromClub = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  const toClub = world.clubs.get(offer.fromClubId);
  if (!toClub) return { ok: false, message: "Club missing" };

  if (fromClub) {
    fromClub.squadPlayerIds = fromClub.squadPlayerIds.filter((id) => id !== pid);
    if (player.contract?.wage) {
      fromClub.finances.currentWageBillWeekly = Math.max(
        0,
        (fromClub.finances.currentWageBillWeekly ?? 0) - player.contract.wage
      );
    }
  }

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

  if ((world as any).contractNegotiation) {
    const neg = (world as any).contractNegotiation;
    neg.open = false;
    neg.status = "idle";
    neg.lastMessage = `Moved to ${toClub.name}.`;
  }

  return { ok: true, message: `Signed for ${toClub.name}` };
}

export function declineTransferOffer(world: World, offerId: string): { ok: boolean } {
  const offer = bag(world).find((o) => o.id === offerId && o.status === "pending");
  if (!offer) return { ok: false };
  offer.status = "declined";
  return { ok: true };
}
