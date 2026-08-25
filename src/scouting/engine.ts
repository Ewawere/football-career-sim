/**
 * Scouting and youth cycle (simplified).
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import { generateAcademyIntake, getProspects } from "../youth/generation.js";

export interface Scout {
  id: string;
  clubId: string;
  ability: number;
  region: string;
}

export function ensureClubScouts(world: World, club: Club): void {
  if (!(world as any).scouts) (world as any).scouts = new Map();
  const map = (world as any).scouts as Map<string, Scout[]>;
  if (!map.has(club.id)) {
    map.set(club.id, [
      {
        id: nextId("sct"),
        clubId: club.id,
        ability: 40 + club.youthFacilities * 5,
        region: "Domestic",
      },
    ]);
  }
}

export function runYouthCycle(world: World): { intake: number; reports: number; signings: number } {
  let intake = 0;
  let reports = 0;
  let signings = 0;

  for (const club of world.clubs.values()) {
    ensureClubScouts(world, club);
    if (world.rng.chance(0.4)) {
      const batch = generateAcademyIntake(world, club);
      intake += batch.length;
    }
    // Promote high-OVR academy kids to main squad list
    for (const id of [...club.academyPlayerIds]) {
      const p = world.players.get(id);
      if (!p || p.retired) continue;
      if (p.ovr >= 64 && !club.squadPlayerIds.includes(id)) {
        club.squadPlayerIds.push(id);
        signings++;
      }
    }
  }

  // Light scouting of undiscovered pool
  const pool = getProspects(world);
  reports = Math.min(pool.length, 5);

  return { intake, reports, signings };
}

export function scoutProspect(world: World, club: Club, playerId: string): number {
  const p = world.players.get(playerId);
  if (!p) return 0;
  // Knowledge quality 0–100
  return Math.min(100, 40 + club.youthFacilities * 5 + world.rng.int(0, 20));
}
