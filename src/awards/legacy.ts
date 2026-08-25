/**
 * Legacy score and retirement processing.
 */

import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { Events } from "../core/events.js";

export function computeLegacy(player: Player): number {
  let score = 0;
  score += player.careerAppearances * 0.15;
  score += player.careerGoals * 1.2;
  score += player.careerAssists * 0.8;
  score += player.careerTrophies * 25;
  score += player.reputation * 0.5;
  score += Math.max(0, player.ovr - 70) * 2;
  if (player.careerAppearances >= 400) score += 40;
  if (player.careerGoals >= 150) score += 50;
  return Math.round(score);
}

export function processRetirements(world: World): Player[] {
  const retired: Player[] = [];
  for (const p of world.players.values()) {
    if (p.retired) continue;
    let chance = 0;
    if (p.age >= 38) chance = 0.55;
    else if (p.age >= 36) chance = 0.3;
    else if (p.age >= 34 && p.state.appearancesThisSeason < 10) chance = 0.15;
    else if (p.age >= 33 && p.ovr < 68) chance = 0.12;
    if (p.isUserControlled) chance = 0; // user decides later

    if (world.rng.chance(chance)) {
      p.retired = true;
      p.retirementDate = world.calendar.currentDate;
      const legacy = computeLegacy(p);
      if (p.currentClubId) {
        const club = world.clubs.get(p.currentClubId);
        if (club) {
          club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== p.id);
          if (p.contract) {
            club.finances.currentWageBillWeekly = Math.max(
              0,
              club.finances.currentWageBillWeekly - p.contract.wage
            );
          }
        }
        p.currentClubId = null;
        p.contract = null;
      }
      world.events.emit(Events.NEWS_GENERATED, {
        type: "retirement",
        playerId: p.id,
        legacy,
      });
      retired.push(p);
    }
  }
  return retired;
}
