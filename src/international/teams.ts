/**
 * National team registry.
 */

import type { World } from "../world/world.js";

export type NationalTeamLevel = "Senior" | "U21";

export interface NationalTeam {
  nation: string;
  level: NationalTeamLevel;
  reputation: number;
  squadIds: string[];
}

const DEFAULT_NATIONS: { nation: string; rep: number }[] = [
  { nation: "England", rep: 86 },
  { nation: "Spain", rep: 88 },
  { nation: "France", rep: 90 },
  { nation: "Germany", rep: 87 },
  { nation: "Brazil", rep: 91 },
  { nation: "Portugal", rep: 84 },
  { nation: "Netherlands", rep: 83 },
  { nation: "Nigeria", rep: 72 },
  { nation: "Italy", rep: 85 },
  { nation: "Argentina", rep: 89 },
];

function teamKey(nation: string, level: NationalTeamLevel): string {
  return `${nation}|${level}`;
}

export function ensureNationalTeams(world: World): void {
  if (!(world as any).nationalTeams) (world as any).nationalTeams = new Map();
  const map = (world as any).nationalTeams as Map<string, NationalTeam>;
  for (const n of DEFAULT_NATIONS) {
    for (const level of ["Senior", "U21"] as NationalTeamLevel[]) {
      const k = teamKey(n.nation, level);
      if (!map.has(k)) {
        map.set(k, {
          nation: n.nation,
          level,
          reputation: level === "U21" ? n.rep - 12 : n.rep,
          squadIds: [],
        });
      }
    }
  }
}

export function getTeam(
  world: World,
  nation: string,
  level: NationalTeamLevel
): NationalTeam | null {
  ensureNationalTeams(world);
  return (world as any).nationalTeams.get(teamKey(nation, level)) ?? null;
}
