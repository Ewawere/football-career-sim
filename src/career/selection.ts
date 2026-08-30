/**
 * Squad selection / position competition engine.
 * Determines who starts, who is on the bench, and the user's depth ranking.
 */

import type { EntityId, Position } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import type { SelectionRole } from "./player-career.js";
import { getActiveInjury } from "../injuries/engine.js";

export interface DepthChartEntry {
  playerId: EntityId;
  rank: number;
  score: number;
  role: SelectionRole;
  reasons: string[];
}

export interface SelectionContext {
  clubId: EntityId;
  position: Position;
  matchImportance?: number;
}

export function selectionScore(
  player: Player,
  targetPosition: Position,
  matchImportance: number = 0.5
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  score += player.ovr * 1.0;
  reasons.push(`OVR ${player.ovr}`);

  if (player.primaryPosition === targetPosition) {
    score += 12;
    reasons.push("Primary position");
  } else if (player.secondaryPositions.includes(targetPosition)) {
    score += 5;
    reasons.push("Secondary position");
  } else {
    score -= 15;
    reasons.push("Out of position");
  }

  const formMod = (player.state.form - 50) * 0.2;
  score += formMod;
  if (Math.abs(formMod) > 2) reasons.push(`Form ${player.state.form.toFixed(0)}`);

  if (player.state.fitness < 50) {
    score -= 25;
    reasons.push("Low fitness");
  } else if (player.state.fitness < 70) {
    score -= 8;
    reasons.push("Reduced fitness");
  } else {
    score += (player.state.fitness - 80) * 0.1;
  }

  score += (player.state.sharpness - 70) * 0.08;
  score += (player.state.morale - 50) * 0.1;

  if (player.state.ratingCount >= 3) {
    const avg = player.state.averageRatingThisSeason;
    score += (avg - 60) * 0.15;
    reasons.push(`Season rating ${(avg / 10).toFixed(1)}`);
  }

  if (matchImportance > 0.7) {
    if (player.age >= 24 && player.age <= 29) score += 3;
    if (player.age <= 18) score -= 4;
  } else {
    if (player.age <= 20) score += 2;
  }

  score += player.reputation * 0.05;

  const trust = player.state.managerTrust ?? 50;
  if (trust < 30) {
    score -= 18;
    reasons.push("Manager distrust");
  } else if (trust < 45) {
    score -= 8;
    reasons.push("Low manager trust");
  } else if (trust >= 75) {
    score += 4;
  }

  if ((player.state as any).transferListed) {
    score -= 12;
    reasons.push("Transfer listed");
  }

  return { score, reasons };
}

export function getDepthChart(
  world: World,
  clubId: EntityId,
  position: Position,
  matchImportance = 0.5
): DepthChartEntry[] {
  const club = world.clubs.get(clubId);
  if (!club) return [];

  const candidates = club.squadPlayerIds
    .map((id) => world.players.get(id)!)
    .filter(
      (p) =>
        p &&
        !p.retired &&
        !getActiveInjury(world, p.id) &&
        (p.primaryPosition === position ||
          p.secondaryPositions.includes(position) ||
          isRelatedPosition(p.primaryPosition, position))
    );

  for (const id of club.academyPlayerIds) {
    const p = world.players.get(id);
    if (p && !p.retired && !candidates.includes(p)) {
      if (p.primaryPosition === position || p.secondaryPositions.includes(position)) {
        candidates.push(p);
      }
    }
  }

  const scored = candidates.map((p) => {
    const { score, reasons } = selectionScore(p, position, matchImportance);
    return { player: p, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, i) => {
    const rank = i + 1;
    let role: SelectionRole = "Bench";
    if (getActiveInjury(world, s.player.id) || s.player.state.fitness < 40) role = "Injured";
    else if (rank === 1) role = s.score > 90 ? "KeyPlayer" : "Starter";
    else if (rank === 2) role = "Rotation";
    else if (rank <= 4) role = "Bench";
    else if (s.player.age <= 19 && club.academyPlayerIds.includes(s.player.id)) role = "Academy";
    else role = "Reserve";

    return {
      playerId: s.player.id,
      rank,
      score: Math.round(s.score * 10) / 10,
      role,
      reasons: s.reasons,
    };
  });
}

function isRelatedPosition(a: Position, b: Position): boolean {
  const groups: Position[][] = [
    ["CB"],
    ["LB", "LWB", "LM", "LW"],
    ["RB", "RWB", "RM", "RW"],
    ["CDM", "CM", "CAM"],
    ["LW", "RW", "LM", "RM", "CAM"],
    ["ST", "CF", "CAM"],
    ["GK"],
  ];
  return groups.some((g) => g.includes(a) && g.includes(b));
}

export function describeUserStanding(world: World): string {
  const userId = world.userPlayerId;
  if (!userId) return "No user player.";

  const player = world.players.get(userId);
  if (!player || !player.currentClubId) return "User player not at a club.";

  const club = world.clubs.get(player.currentClubId)!;
  const chart = getDepthChart(world, club.id, player.primaryPosition);
  const entry = chart.find((e) => e.playerId === userId);

  if (!entry) {
    return `${player.displayName} is at ${club.name} but not in the depth chart for ${player.primaryPosition}.`;
  }

  const ahead = chart.filter((e) => e.rank < entry.rank);
  const namesAhead = ahead
    .map((e) => {
      const p = world.players.get(e.playerId)!;
      return `${p.displayName} (${p.ovr})`;
    })
    .join(", ");

  let text = `${player.displayName} — ${club.name}\n`;
  text += `Position: ${player.primaryPosition} | OVR ${player.ovr} | Form ${player.state.form.toFixed(0)} | Fitness ${player.state.fitness}\n`;
  text += `Depth rank: ${entry.rank}${ordinal(entry.rank)} choice (${entry.role})\n`;
  text += `Selection score: ${entry.score}\n`;
  if (namesAhead) text += `Ahead of you: ${namesAhead}\n`;
  else text += `You are first choice.\n`;
  text += `Factors: ${entry.reasons.join("; ")}`;

  return text;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0]!;
}

export function pickStartingXI(
  world: World,
  clubId: EntityId,
  formation: string = "4-3-3",
  matchImportance = 0.5
): EntityId[] {
  const slots = formationSlots(formation);
  const used = new Set<EntityId>();
  const xi: EntityId[] = [];

  for (const pos of slots) {
    const chart = getDepthChart(world, clubId, pos, matchImportance);
    const pick = chart.find((e) => !used.has(e.playerId) && e.role !== "Injured" && e.role !== "Suspended");
    if (pick) {
      xi.push(pick.playerId);
      used.add(pick.playerId);
    }
  }

  if (xi.length < 11) {
    const club = world.clubs.get(clubId)!;
    const rest = club.squadPlayerIds
      .map((id) => world.players.get(id)!)
      .filter((p) => p && !p.retired && !used.has(p.id))
      .sort((a, b) => b.ovr - a.ovr);
    for (const p of rest) {
      if (xi.length >= 11) break;
      xi.push(p.id);
      used.add(p.id);
    }
  }

  return xi.slice(0, 11);
}

function formationSlots(formation: string): Position[] {
  switch (formation) {
    case "4-3-3":
      return ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW"];
    case "4-2-3-1":
      return ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "ST", "LW"];
    case "4-4-2":
      return ["GK", "RB", "CB", "CB", "LB", "RM", "CM", "CM", "LM", "ST", "ST"];
    case "3-5-2":
      return ["GK", "CB", "CB", "CB", "RWB", "CDM", "CM", "CAM", "LWB", "ST", "ST"];
    default:
      return ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW"];
  }
}
