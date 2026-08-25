/**
 * Squad size rules — single source of truth for transfer/loan/FA/youth.
 */

import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";

export const SQUAD_SOFT_CAP = 26;
export const SQUAD_HARD_CAP = 28;
export const SQUAD_EMERGENCY = 32;
export const SQUAD_MIN = 16;

export function activeSquadCount(world: World, club: Club): number {
  return club.squadPlayerIds.filter((id) => {
    const p = world.players.get(id);
    return p && !p.retired && p.currentClubId === club.id;
  }).length;
}

export function canSignPlayer(world: World, club: Club): boolean {
  return activeSquadCount(world, club) < SQUAD_HARD_CAP;
}

export function maxOvrForAge(age: number): number {
  if (age <= 16) return 72;
  if (age === 17) return 76;
  if (age === 18) return 80;
  if (age === 19) return 84;
  if (age === 20) return 87;
  if (age === 21) return 90;
  return 99;
}

export function enforceAgeOvrCap(ovr: number, age: number): number {
  return Math.min(ovr, maxOvrForAge(age));
}

export function pruneOversizedSquad(world: World, club: Club): number {
  const active = club.squadPlayerIds
    .map((id) => world.players.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.retired && p.currentClubId === club.id)
    .sort((a, b) => a.ovr - b.ovr || a.age - b.age);

  const excess = active.length - SQUAD_HARD_CAP;
  if (excess <= 0) return 0;

  let released = 0;
  for (let i = 0; i < excess; i++) {
    const p = active[i]!;
    if (p.isUserControlled) continue;
    club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== p.id);
    if (p.contract) {
      club.finances.currentWageBillWeekly = Math.max(
        0,
        club.finances.currentWageBillWeekly - p.contract.wage
      );
    }
    p.currentClubId = null;
    p.contract = null;
    p.state.morale = Math.max(20, p.state.morale - 15);
    released++;
  }
  return released;
}

export function fillThinSquads(world: World): number {
  let signed = 0;
  const freeAgents = [...world.players.values()].filter(
    (p) => !p.retired && !p.currentClubId && p.age <= 34
  );

  for (const club of world.clubs.values()) {
    let size = activeSquadCount(world, club);
    if (size >= SQUAD_MIN) continue;

    const need = SQUAD_MIN - size;
    const candidates = freeAgents
      .filter((p) => !p.currentClubId)
      .sort((a, b) => b.ovr - a.ovr);

    for (let i = 0; i < need && i < candidates.length; i++) {
      const p = candidates[i]!;
      if (p.currentClubId) continue;
      if (size >= SQUAD_HARD_CAP) break;
      p.currentClubId = club.id;
      if (!club.squadPlayerIds.includes(p.id)) club.squadPlayerIds.push(p.id);
      const years = 2;
      const endYear = parseInt(world.calendar.currentDate.slice(0, 4), 10) + years;
      p.contract = {
        clubId: club.id,
        wage: Math.max(500, Math.round(p.ovr * p.ovr * 4)),
        startDate: world.calendar.currentDate,
        endDate: `${endYear}-06-30`,
        releaseClause: null,
        signedDate: world.calendar.currentDate,
      };
      club.finances.currentWageBillWeekly += p.contract.wage;
      size++;
      signed++;
    }
  }
  return signed;
}

export function pruneAllClubs(world: World): number {
  let total = 0;
  for (const club of world.clubs.values()) {
    total += pruneOversizedSquad(world, club);
  }
  return total;
}
