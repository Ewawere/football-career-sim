/**
 * Youth prospects and academy intake.
 */

import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import { generatePlayer } from "../players/generation.js";
import type { Player } from "../players/player.js";

export function getProspects(world: World): Player[] {
  if (!(world as any).undiscovered) (world as any).undiscovered = [];
  return (world as any).undiscovered;
}

export function seedUndiscoveredPool(world: World, count = 30): void {
  const pool = getProspects(world);
  for (let i = 0; i < count; i++) {
    const p = generatePlayer(world.rng, {
      age: world.rng.int(15, 18),
      potentialTarget: world.rng.int(68, 90),
      currentAbilityTarget: world.rng.int(48, 62),
    });
    p.currentClubId = null;
    pool.push(p);
    world.players.set(p.id, p);
  }
}

export function enrollInAcademy(world: World, club: Club, player: Player): void {
  player.currentClubId = club.id;
  if (!club.academyPlayerIds.includes(player.id)) club.academyPlayerIds.push(player.id);
  if (!club.squadPlayerIds.includes(player.id) && player.ovr >= 60) {
    club.squadPlayerIds.push(player.id);
  }
}

export function generateAcademyIntake(world: World, club: Club): Player[] {
  const intake: Player[] = [];
  const n = 2 + Math.floor(club.youthFacilities / 3);
  for (let i = 0; i < n; i++) {
    const pot = Math.min(92, 60 + club.youthFacilities * 3 + world.rng.int(0, 12));
    const p = generatePlayer(world.rng, {
      age: world.rng.int(16, 18),
      potentialTarget: pot,
      currentAbilityTarget: Math.min(pot - 10, 55 + club.youthFacilities * 2),
      clubId: club.id,
    });
    enrollInAcademy(world, club, p);
    world.players.set(p.id, p);
    intake.push(p);
  }
  return intake;
}

export function generateProspect(world: World, age = 17): Player {
  return generatePlayer(world.rng, {
    age,
    potentialTarget: world.rng.int(70, 88),
    currentAbilityTarget: world.rng.int(50, 64),
  });
}
