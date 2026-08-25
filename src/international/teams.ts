/**
 * Create and manage national teams.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { NationalTeam, NationalTeamLevel } from "./types.js";
import { CORE_NATIONS, nationStrength } from "./nations.js";

const COACH_FIRST = ["Carlo", "Luis", "Gareth", "Didier", "Hansi", "Roberto", "Steve", "Fernando"];
const COACH_LAST = ["Silva", "Martinez", "Andersen", "Okeke", "Schmidt", "Rossi", "Clarke", "Dubois"];

export function getNationalTeams(world: World): Map<string, NationalTeam> {
  if (!(world as any).nationalTeams) {
    (world as any).nationalTeams = new Map();
  }
  return (world as any).nationalTeams;
}

export function ensureNationalTeams(world: World): void {
  const map = getNationalTeams(world);
  if (map.size > 0) return;

  for (const nation of CORE_NATIONS) {
    for (const level of ["Senior", "U21"] as NationalTeamLevel[]) {
      const id = nextId("nt");
      const team: NationalTeam = {
        id,
        nation,
        level,
        reputation: level === "Senior" ? nationStrength(nation) : nationStrength(nation) - 12,
        coachName: `${world.rng.pick(COACH_FIRST)} ${world.rng.pick(COACH_LAST)}`,
        squadPlayerIds: [],
        calledUpIds: [],
      };
      map.set(`${nation}:${level}`, team);
    }
  }
}

export function getTeam(world: World, nation: string, level: NationalTeamLevel): NationalTeam | null {
  return getNationalTeams(world).get(`${nation}:${level}`) ?? null;
}
