/**
 * Transfer market: generate AI targets from squad needs.
 */

import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import { analyzeSquadNeeds } from "./needs.js";
import { estimateMarketValue, askingPrice } from "../contracts/valuation.js";

export interface TransferTarget {
  playerId: string;
  score: number;
  reason: string;
  estimatedFee: number;
}

export function generateTargets(world: World, club: Club, limit = 12): TransferTarget[] {
  const needs = analyzeSquadNeeds(world, club);
  const targets: TransferTarget[] = [];

  for (const need of needs.prioritized.slice(0, 5)) {
    for (const p of world.players.values()) {
      if (p.retired || p.isUserControlled) continue;
      if (p.currentClubId === club.id) continue;
      if (p.primaryPosition !== need.position && !p.secondaryPositions.includes(need.position))
        continue;
      if (p.ovr < club.reputation * 0.65) continue;
      if (p.ovr > club.reputation + 10) continue;

      let score = need.score + (p.ovr - 60) * 0.5;
      if (p.age <= 23 && p.potential >= 80) score += 12;
      if (p.age >= 32) score -= 10;
      if (!p.currentClubId) score += 8; // free agent preference

      const selling = p.currentClubId ? world.clubs.get(p.currentClubId) : null;
      const fee = selling ? askingPrice(world, p, selling) : estimateMarketValue(world, p) * 0.1;
      if (fee > club.finances.transferBudget * 1.2) continue;

      targets.push({
        playerId: p.id,
        score,
        reason: need.reason,
        estimatedFee: fee,
      });
    }
  }

  targets.sort((a, b) => b.score - a.score);
  // unique players
  const seen = new Set<string>();
  const unique: TransferTarget[] = [];
  for (const t of targets) {
    if (seen.has(t.playerId)) continue;
    seen.add(t.playerId);
    unique.push(t);
    if (unique.length >= limit) break;
  }
  return unique;
}
