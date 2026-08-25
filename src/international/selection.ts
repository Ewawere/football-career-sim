/**
 * National team selection (Senior / U21).
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { isPlayerInjured } from "../injuries/engine.js";
import { getTeam, type NationalTeamLevel } from "./teams.js";

export function selectionScore(
  player: Player,
  level: NationalTeamLevel,
  nationRep: number
): number {
  let score = player.ovr * 1.0;
  score += player.state.form * 0.35;
  score += player.reputation * 0.25;
  score += Math.min(30, player.careerAppearances * 0.15);
  score += player.careerGoals * 0.2;

  const caps = (player as any).internationalCaps ?? 0;
  score += Math.min(25, caps * 1.5);

  if (level === "U21") {
    if (player.age > 21) score -= 40;
    if (player.age <= 19) score += 5;
  } else {
    if (player.age < 19) score -= 15;
    if (player.age >= 28 && player.age <= 32) score += 4;
  }

  score -= Math.max(0, (nationRep - 70) * 0.3);

  if (player.state.matchMinutesThisSeason > 1500) score += 8;
  else if (player.state.matchMinutesThisSeason < 300 && player.age >= 22) score -= 10;

  return score;
}

export function rankCandidates(
  world: World,
  nation: string,
  level: NationalTeamLevel
): Player[] {
  const team = getTeam(world, nation, level);
  if (!team) return [];

  const candidates: Player[] = [];
  for (const p of world.players.values()) {
    if (p.retired) continue;
    if (p.nationality !== nation) continue;
    if (isPlayerInjured(world, p.id)) continue;
    if (level === "U21" && p.age > 21) continue;
    if (level === "Senior" && p.age < 17) continue;
    candidates.push(p);
  }

  candidates.sort(
    (a, b) =>
      selectionScore(b, level, team.reputation) - selectionScore(a, level, team.reputation)
  );
  return candidates;
}

export function selectSquad(
  world: World,
  nation: string,
  level: NationalTeamLevel,
  size = 23
): EntityId[] {
  const ranked = rankCandidates(world, nation, level);
  const picked: EntityId[] = [];
  const byPos: Record<string, number> = {};

  for (const p of ranked) {
    if (picked.length >= size) break;
    const pos = p.primaryPosition;
    const maxPos = pos === "GK" ? 3 : pos === "ST" ? 4 : ["CB", "CM"].includes(pos) ? 5 : 4;
    if ((byPos[pos] ?? 0) >= maxPos) continue;
    picked.push(p.id);
    byPos[pos] = (byPos[pos] ?? 0) + 1;
  }
  return picked;
}

export function runInternationalBreak(world: World): void {
  const nations = new Set([...world.players.values()].map((p) => p.nationality));
  for (const nation of nations) {
    for (const level of ["Senior", "U21"] as NationalTeamLevel[]) {
      const squad = selectSquad(world, nation, level);
      for (const id of squad.slice(0, 11)) {
        const p = world.players.get(id);
        if (!p) continue;
        (p as any).internationalCaps = ((p as any).internationalCaps ?? 0) + 1;
        p.reputation = Math.min(100, p.reputation + (level === "Senior" ? 0.4 : 0.15));
      }
    }
  }
}

export function isUserCalledUp(world: World, level: NationalTeamLevel = "Senior"): boolean {
  if (!world.userPlayerId) return false;
  const user = world.players.get(world.userPlayerId);
  if (!user) return false;
  const squad = selectSquad(world, user.nationality, level);
  return squad.includes(user.id);
}
