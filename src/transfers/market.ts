/**
 * Need-driven transfer market: targets, willingness, negotiation, completion.
 */

import { nextId } from "../core/id.js";
import type { EntityId, Position } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Club, TransferPhilosophy } from "../clubs/club.js";
import type { Player } from "../players/player.js";
import { analyzeSquadNeeds, type NeedLevel, type SquadNeeds } from "./needs.js";
import { estimateMarketValue, askingPrice, yearsRemaining, wonderkidTier } from "../contracts/valuation.js";
import { Events } from "../core/events.js";
import { canSignPlayer, SQUAD_HARD_CAP, SQUAD_SOFT_CAP, activeSquadCount } from "./squad-rules.js";
import type { TransferRecord } from "../contracts/types.js";
import { getActiveInjury } from "../injuries/engine.js";

export interface TransferTarget {
  buyingClubId: EntityId;
  playerId: EntityId;
  position: Position;
  needLevel: NeedLevel;
  score: number;
  breakdown: Record<string, number>;
  estimatedFee: number;
  estimatedWage: number;
}

export interface TransferOffer {
  id: EntityId;
  buyingClubId: EntityId;
  sellingClubId: EntityId | null;
  playerId: EntityId;
  fee: number;
  wageOffer: number;
  contractYears: number;
  status: "Pending" | "Accepted" | "Rejected" | "Countered" | "Withdrawn";
  counterFee?: number;
}

export interface WillingnessResult {
  interested: boolean;
  score: number;
  reasons: string[];
}

function philosophyFit(
  phil: TransferPhilosophy,
  player: Player,
  fee: number,
  budget: number
): number {
  switch (phil) {
    case "BuyStars":
      return player.ovr >= 78 ? 20 : player.ovr >= 72 ? 8 : -15;
    case "DevelopAndSell":
    case "YouthFocused":
      if (player.age <= 22 && player.potential >= 75) return 22;
      if (player.age <= 24 && player.potential - player.ovr >= 8) return 12;
      return player.age >= 28 ? -10 : 0;
    case "BargainHunt":
      return fee < budget * 0.3 ? 15 : fee < budget * 0.5 ? 5 : -10;
    case "FinanciallyCautious":
      return fee < budget * 0.25 ? 12 : -20;
    case "Balanced":
    default:
      return 5;
  }
}

export function generateTargets(
  world: World,
  club: Club,
  maxTargets = 8
): TransferTarget[] {
  const needs = analyzeSquadNeeds(world, club);
  const urgent = needs.prioritized.filter((p) => p.level !== "None" && p.score >= 18);
  if (urgent.length === 0) return [];

  const targets: TransferTarget[] = [];
  const budget = club.finances.transferBudget;

  for (const need of urgent.slice(0, 5)) {
    for (const player of world.players.values()) {
      if (player.retired) continue;
      if (player.currentClubId === club.id) continue;
      if (getActiveInjury(world, player.id)) continue;
      if (
        player.primaryPosition !== need.position &&
        !player.secondaryPositions.includes(need.position)
      )
        continue;

      if (club.transferPhilosophy === "BuyStars" && player.ovr < 70) continue;
      if (
        (club.transferPhilosophy === "YouthFocused" ||
          club.transferPhilosophy === "DevelopAndSell") &&
        player.age > 26
      )
        continue;

      const value = estimateMarketValue(world, player);
      if (value > budget * 1.15 && yearsRemaining(world, player) > 0.5) continue;

      const score = scoreTarget(world, club, player, need.position, need.level, value);
      if (score.total < 40) continue;

      targets.push({
        buyingClubId: club.id,
        playerId: player.id,
        position: need.position,
        needLevel: need.level,
        score: score.total,
        breakdown: score.parts,
        estimatedFee: value,
        estimatedWage: Math.round(player.ovr * player.ovr * 12),
      });
    }
  }

  targets.sort((a, b) => b.score - a.score);
  const seen = new Set<EntityId>();
  const unique: TransferTarget[] = [];
  for (const t of targets) {
    if (seen.has(t.playerId)) continue;
    seen.add(t.playerId);
    unique.push(t);
    if (unique.length >= maxTargets) break;
  }
  return unique;
}

function scoreTarget(
  world: World,
  club: Club,
  player: Player,
  position: Position,
  needLevel: NeedLevel,
  fee: number
): { total: number; parts: Record<string, number> } {
  const parts: Record<string, number> = {};
  parts.position =
    player.primaryPosition === position ? 30 : player.secondaryPositions.includes(position) ? 18 : 0;
  const expected = club.reputation * 0.92;
  const ovrDiff = player.ovr - expected;
  parts.ovr = Math.max(-15, Math.min(25, 10 + ovrDiff));
  parts.potential =
    player.age <= 23
      ? Math.min(22, (player.potential - 70) * 1.2)
      : Math.min(10, (player.potential - player.ovr) * 0.8);
  parts.form = (player.state.form - 50) * 0.15;
  parts.reputation = player.reputation * 0.08;
  const budget = club.finances.transferBudget;
  if (fee <= 0) parts.financial = 15;
  else if (fee <= budget * 0.4) parts.financial = 12;
  else if (fee <= budget * 0.8) parts.financial = 6;
  else if (fee <= budget) parts.financial = 2;
  else parts.financial = -20;
  const years = yearsRemaining(world, player);
  if (years <= 0.5) parts.contract = 15;
  else if (years <= 1) parts.contract = 8;
  else if (years >= 4) parts.contract = -5;
  else parts.contract = 0;
  parts.philosophy = philosophyFit(club.transferPhilosophy, player, fee, budget);
  parts.need =
    needLevel === "Critical" ? 15 : needLevel === "High" ? 10 : needLevel === "Medium" ? 5 : 0;
  if (player.age >= 33) parts.age = -12;
  else if (player.age <= 21) parts.age = 5;
  else parts.age = 0;
  if ((player.state as any).transferListed) parts.listed = 12;
  if (player.state.managerTrust < 30) parts.trust = 6;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total: Math.round(total), parts };
}

export function playerWillingness(
  world: World,
  player: Player,
  buyingClub: Club,
  wageOffer: number,
  expectedRole: "Starter" | "Rotation" | "Backup" | "Prospect"
): WillingnessResult {
  const reasons: string[] = [];
  let score = 50;
  const currentClub = player.currentClubId
    ? world.clubs.get(player.currentClubId)
    : null;
  if (currentClub) {
    const repDiff = buyingClub.reputation - currentClub.reputation;
    score += repDiff * 0.6;
    if (repDiff > 8) reasons.push("bigger club");
    if (repDiff < -10) {
      score -= 5;
      reasons.push("step down");
    }
  } else {
    score += 15;
    reasons.push("free agent");
  }
  if (expectedRole === "Starter") {
    score += 20;
    reasons.push("expected starter");
  } else if (expectedRole === "Rotation") {
    score += 8;
    reasons.push("rotation role");
  } else if (expectedRole === "Prospect") {
    score += player.age <= 20 ? 5 : -10;
  } else {
    score -= 5;
  }
  const currentWage = player.contract?.wage ?? 0;
  if (wageOffer > currentWage * 1.3) {
    score += 15;
    reasons.push("big wage rise");
  } else if (wageOffer > currentWage * 1.1) {
    score += 8;
    reasons.push("wage rise");
  } else if (wageOffer < currentWage * 0.9) {
    score -= 12;
    reasons.push("wage cut");
  }
  if (player.age <= 22 && currentClub && currentClub.reputation >= 80) {
    if (player.state.appearancesThisSeason < 8 && player.state.matchMinutesThisSeason < 400) {
      score += 18;
      reasons.push("seeking minutes");
    }
  }
  if (currentClub && player.age >= 28 && player.careerAppearances > 100) {
    score -= 8;
    reasons.push("settled");
  }
  if (player.state.managerTrust >= 70) {
    score -= 5;
    reasons.push("happy with manager");
  } else if (player.state.managerTrust <= 35) {
    score += 10;
    reasons.push("poor manager relationship");
  }
  if ((player.state as any).transferListed) {
    score += 12;
    reasons.push("wants exit");
  }
  score = Math.max(0, Math.min(100, score));
  return { interested: score >= 48, score, reasons };
}

export function sellerWillingness(
  world: World,
  player: Player,
  sellingClub: Club,
  offerFee: number
): WillingnessResult {
  const reasons: string[] = [];
  let score = 40;
  const value = estimateMarketValue(world, player);
  const ask = askingPrice(world, player, sellingClub);

  if (offerFee >= ask * 1.1) {
    score += 35;
    reasons.push("above asking");
  } else if (offerFee >= ask) {
    score += 25;
    reasons.push("meets asking");
  } else if (offerFee >= value) {
    score += 12;
    reasons.push("fair value");
  } else if (offerFee >= value * 0.75) {
    score += 0;
    reasons.push("below value");
  } else {
    score -= 20;
    reasons.push("lowball");
  }

  if (player.ovr >= sellingClub.reputation * 0.98) {
    score -= 22;
    reasons.push("key player");
  }

  if ((player.state as any).transferListed) {
    score += 28;
    reasons.push("transfer listed");
  }
  if ((player.state as any).loanListed) {
    score += 12;
    reasons.push("loan listed");
  }
  if (player.state.managerTrust < 30) {
    score += 10;
    reasons.push("manager wants rid");
  }
  if (player.state.form < 40 && player.state.ratingCount >= 5) {
    score += 8;
    reasons.push("poor form");
  }

  const tier = wonderkidTier(player);
  const isSuperKid = tier === "super";
  const isEliteKid = tier === "elite";
  const isFranchise =
    player.age <= 23 &&
    player.potential >= 88 &&
    player.ovr >= sellingClub.reputation - 5;
  const listed = !!(player.state as any).transferListed;

  if (isSuperKid && !listed) {
    score -= 38;
    reasons.push("untouchable wonderkid");
    if (offerFee < ask * 1.25) {
      score -= 25;
      reasons.push("insult to ask — not for sale");
    } else if (offerFee >= ask * 1.75) {
      score += 30;
      reasons.push("record-breaking bid");
    } else if (offerFee >= ask * 1.5) {
      score += 18;
      reasons.push("massive overpay");
    } else if (offerFee >= ask * 1.35) {
      score += 8;
      reasons.push("big premium still short");
    }
  } else if ((isEliteKid || isFranchise) && !listed) {
    score -= 28;
    reasons.push("prize asset — not cheap");
    if (offerFee < ask * 1.1) {
      score -= 15;
      reasons.push("club will not sell cheap");
    } else if (offerFee >= ask * 1.55) {
      score += 24;
      reasons.push("huge premium for asset");
    } else if (offerFee >= ask * 1.3) {
      score += 14;
      reasons.push("serious money");
    } else if (offerFee >= ask * 1.15) {
      score += 6;
      reasons.push("premium offer");
    }
  } else if (tier === "prospect" && !listed) {
    score -= 12;
    reasons.push("youth prospect held");
    if (offerFee >= ask * 1.25) {
      score += 12;
      reasons.push("good money for prospect");
    }
  }

  if (sellingClub.reputation >= 85 && (isEliteKid || isSuperKid || isFranchise) && !listed) {
    score -= 16;
    reasons.push("elite club keeps talent");
  }

  if (
    sellingClub.transferPhilosophy === "DevelopAndSell" ||
    sellingClub.transferPhilosophy === "BargainHunt"
  ) {
    if (isSuperKid && !listed) {
      score += 6;
      reasons.push("academy club — still wants huge fee");
    } else {
      score += 15;
      reasons.push("selling club");
    }
  } else if (
    sellingClub.transferPhilosophy === "WinNow" ||
    sellingClub.transferPhilosophy === "YouthProject"
  ) {
    if (isEliteKid || isSuperKid) {
      score -= 12;
      reasons.push("club project player");
    }
  }

  if (sellingClub.finances.balance < 5_000_000) {
    score += 10;
    reasons.push("needs funds");
  } else if (sellingClub.finances.balance < 0) {
    score += 18;
    reasons.push("financial crisis");
  }

  if (yearsRemaining(world, player) <= 1) {
    score += 20;
    reasons.push("expiring contract");
  } else if (yearsRemaining(world, player) >= 3 && (isEliteKid || isSuperKid)) {
    score -= 10;
    reasons.push("long contract protection");
  }

  score = Math.max(0, Math.min(100, score));
  let threshold = 55;
  if (isSuperKid && !listed) threshold = 72;
  else if ((isEliteKid || isFranchise) && !listed) threshold = 65;
  return { interested: score >= threshold, score, reasons };
}

export function makeOffer(
  world: World,
  target: TransferTarget,
  feeMultiplier = 0.9
): TransferOffer {
  const player = world.players.get(target.playerId)!;
  return {
    id: nextId("off"),
    buyingClubId: target.buyingClubId,
    sellingClubId: player.currentClubId,
    playerId: target.playerId,
    fee: Math.round((target.estimatedFee * feeMultiplier) / 10_000) * 10_000,
    wageOffer: target.estimatedWage,
    contractYears: player.age <= 23 ? 4 : player.age <= 28 ? 3 : 2,
    status: "Pending",
  };
}

export function negotiate(
  world: World,
  offer: TransferOffer
): TransferOffer {
  const player = world.players.get(offer.playerId)!;
  const buyer = world.clubs.get(offer.buyingClubId)!;
  const seller = offer.sellingClubId
    ? world.clubs.get(offer.sellingClubId)
    : null;

  if (offer.fee > buyer.finances.transferBudget) {
    offer.status = "Rejected";
    world.events.emit(Events.TRANSFER_OFFER, {
      type: "rejected_budget",
      offerId: offer.id,
      playerId: offer.playerId,
    });
    return offer;
  }

  if (seller) {
    const sell = sellerWillingness(world, player, seller, offer.fee);
    if (!sell.interested) {
      const ask = askingPrice(world, player, seller);
      const tier = wonderkidTier(player);
      const listed = !!(player.state as any).transferListed;
      const counterFloor =
        tier === "super" && !listed
          ? ask * 0.95
          : tier === "elite" && !listed
            ? ask * 0.88
            : ask * 0.7;
      if (offer.fee >= counterFloor) {
        offer.status = "Countered";
        offer.counterFee =
          tier === "super" && !listed
            ? Math.round((ask * 1.05) / 10_000) * 10_000
            : ask;
        return offer;
      }
      offer.status = "Rejected";
      world.events.emit(Events.TRANSFER_OFFER, {
        type: "rejected_seller",
        offerId: offer.id,
        reasons: sell.reasons,
        playerId: offer.playerId,
        buyerId: offer.buyingClubId,
        sellerId: seller.id,
        fee: offer.fee,
        asking: ask,
        value: estimateMarketValue(world, player),
        score: sell.score,
        wonderkid: tier,
      });
      return offer;
    }
  }

  const will = playerWillingness(
    world,
    player,
    buyer,
    offer.wageOffer,
    offer.wageOffer > (player.contract?.wage ?? 0) * 1.1 ? "Starter" : "Rotation"
  );
  if (!will.interested) {
    offer.status = "Rejected";
    world.events.emit(Events.TRANSFER_OFFER, {
      type: "rejected_player",
      offerId: offer.id,
      reasons: will.reasons,
    });
    return offer;
  }

  offer.status = "Accepted";
  return offer;
}

export function completeTransfer(
  world: World,
  offer: TransferOffer
): TransferRecord | null {
  if (offer.status !== "Accepted") return null;

  const player = world.players.get(offer.playerId)!;
  const buyer = world.clubs.get(offer.buyingClubId)!;
  const seller = offer.sellingClubId
    ? world.clubs.get(offer.sellingClubId)
    : null;

  if (offer.fee > buyer.finances.transferBudget) return null;
  if (!canSignPlayer(world, buyer)) return null;

  if (seller) {
    seller.squadPlayerIds = seller.squadPlayerIds.filter((id) => id !== player.id);
    seller.academyPlayerIds = seller.academyPlayerIds.filter((id) => id !== player.id);
    seller.finances.balance += offer.fee;
    seller.finances.transferBudget += Math.round(offer.fee * 0.3);
    seller.finances.currentWageBillWeekly = Math.max(
      0,
      seller.finances.currentWageBillWeekly - (player.contract?.wage ?? 0)
    );
  }

  if (!buyer.squadPlayerIds.includes(player.id)) {
    buyer.squadPlayerIds.push(player.id);
  }
  buyer.finances.transferBudget -= offer.fee;
  buyer.finances.balance -= offer.fee;

  const endYear =
    parseInt(world.calendar.currentDate.slice(0, 4), 10) + offer.contractYears;
  player.currentClubId = buyer.id;
  player.contract = {
    clubId: buyer.id,
    wage: offer.wageOffer,
    startDate: world.calendar.currentDate,
    endDate: `${endYear}-06-30`,
    releaseClause:
      player.potential >= 82 ? Math.round(offer.fee * 1.8) : null,
    signedDate: world.calendar.currentDate,
  };
  buyer.finances.currentWageBillWeekly += offer.wageOffer;

  player.state.managerTrust = 55;
  player.state.morale = Math.min(100, player.state.morale + 10);
  (player.state as any).transferListed = false;
  (player.state as any).loanListed = false;
  if (seller && buyer.reputation > (seller.reputation ?? 0)) {
    player.reputation = Math.min(100, player.reputation + 3);
  }

  const record: TransferRecord = {
    id: nextId("trf"),
    playerId: player.id,
    fromClubId: seller?.id ?? null,
    toClubId: buyer.id,
    fee: offer.fee,
    date: world.calendar.currentDate,
    type: seller ? "Permanent" : "Free",
    wageWeekly: offer.wageOffer,
    contractYears: offer.contractYears,
  };

  if (!(world as any).transferHistory) (world as any).transferHistory = [];
  (world as any).transferHistory.push(record);

  world.events.emit(Events.TRANSFER_COMPLETED, {
    record,
    playerName: player.displayName,
    buyer: buyer.name,
    seller: seller?.name ?? "Free Agent",
    fee: offer.fee,
  });

  return record;
}

export function processClubWindow(
  world: World,
  club: Club,
  maxDeals = 2,
  movedThisWindow: Set<string> = new Set()
): TransferRecord[] {
  const completed: TransferRecord[] = [];
  if (activeSquadCount(world, club) >= SQUAD_SOFT_CAP) return completed;

  const targets = generateTargets(world, club, 10);
  let deals = 0;

  for (const target of targets) {
    if (deals >= maxDeals) break;
    if (club.finances.transferBudget < 100_000 && target.estimatedFee > 0) break;
    if (movedThisWindow.has(target.playerId)) continue;

    const p = world.players.get(target.playerId)!;
    if (p.currentClubId === club.id) continue;

    let offer = makeOffer(world, target, 0.85 + world.rng.float(0, 0.25));
    offer = negotiate(world, offer);

    if (offer.status === "Countered" && offer.counterFee) {
      if (offer.counterFee <= club.finances.transferBudget * 1.05) {
        offer.fee = offer.counterFee;
        offer.status = "Accepted";
        const will = playerWillingness(world, p, club, offer.wageOffer, "Rotation");
        if (!will.interested) offer.status = "Rejected";
      } else {
        offer.status = "Rejected";
      }
    }

    if (offer.status === "Accepted") {
      const rec = completeTransfer(world, offer);
      if (rec) {
        completed.push(rec);
        movedThisWindow.add(target.playerId);
        deals++;
      }
    }
  }

  return completed;
}
