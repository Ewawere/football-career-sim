/**
 * Depth chart and selection scoring for squad competition.
 */

import type { EntityId, Position } from "../core/types.js";
import type { World } from "../world/world.js";
import { isPlayerInjured } from "../injuries/engine.js";

export type SelectionRole = "Starter" | "Rotation" | "Bench" | "Reserve" | "Injured" | "Suspended";

export interface DepthEntry {
  playerId: EntityId;
  rank: number;
  score: number;
  role: SelectionRole;
  reasons: string[];
}

export function selectionScore(
  world: World,
  playerId: EntityId,
  position: Position,
  matchImportance = 0.5
): { score: number; reasons: string[] } {
  const p = world.players.get(playerId);
  if (!p || p.retired) return { score: -999, reasons: ["unavailable"] };

  const reasons: string[] = [];
  let score = p.ovr * 1.0;
  reasons.push(`OVR ${p.ovr}`);

  if (p.primaryPosition === position) {
    score += 12;
    reasons.push("natural position");
  } else if (p.secondaryPositions.includes(position)) {
    score += 5;
    reasons.push("secondary position");
  } else {
    score -= 25;
    reasons.push("out of position");
  }

  score += (p.state.form - 50) * 0.25;
  score += (p.state.fitness - 70) * 0.2;
  score += (p.state.managerTrust - 50) * 0.15;
  score += (p.state.morale - 50) * 0.08;

  if (isPlayerInjured(world, playerId)) {
    score -= 100;
    reasons.push("injured");
  }

  if (matchImportance > 0.7 && p.age <= 19 && p.state.appearancesThisSeason < 5) {
    score -= 5;
    reasons.push("big match caution for youth");
  }

  return { score, reasons };
}

export function getDepthChart(
  world: World,
  clubId: EntityId,
  position: Position,
  matchImportance = 0.5
): DepthEntry[] {
  const club = world.clubs.get(clubId);
  if (!club) return [];

  const entries: DepthEntry[] = [];
  for (const id of club.squadPlayerIds) {
    const p = world.players.get(id);
    if (!p || p.retired) continue;
    if (
      p.primaryPosition !== position &&
      !p.secondaryPositions.includes(position) &&
      position !== "CM"
    ) {
      continue;
    }
    const { score, reasons } = selectionScore(world, id, position, matchImportance);
    let role: SelectionRole = "Reserve";
    if (isPlayerInjured(world, id)) role = "Injured";
    entries.push({ playerId: id, rank: 0, score, role, reasons });
  }

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => {
    e.rank = i + 1;
    if (e.role === "Injured") return;
    if (i === 0) e.role = "Starter";
    else if (i <= 2) e.role = "Rotation";
    else if (i <= 4) e.role = "Bench";
    else e.role = "Reserve";
  });
  return entries;
}

export function describeUserStanding(world: World): string {
  const userId = world.userPlayerId;
  if (!userId) return "No user player.";
  const player = world.players.get(userId);
  if (!player || !player.currentClubId) return "User not at a club.";
  const club = world.clubs.get(player.currentClubId)!;
  const chart = getDepthChart(world, club.id, player.primaryPosition);
  const entry = chart.find((e) => e.playerId === userId);
  if (!entry) return `${player.displayName} not in depth chart.`;

  const ahead = chart.filter((e) => e.rank < entry.rank);
  const namesAhead = ahead
    .map((e) => {
      const p = world.players.get(e.playerId)!;
      return `${p.displayName} (${p.ovr})`;
    })
    .join(", ");

  let text = `${player.displayName} — ${club.name}\n`;
  text += `Position: ${player.primaryPosition} | OVR ${player.ovr} | Form ${player.state.form.toFixed(0)} | Fitness ${player.state.fitness}\n`;
  text += `Depth rank: ${entry.rank} (${entry.role})\n`;
  text += `Selection score: ${entry.score.toFixed(1)}\n`;
  if (namesAhead) text += `Ahead of you: ${namesAhead}\n`;
  else text += `You are first choice.\n`;
  text += `Factors: ${entry.reasons.join("; ")}`;
  return text;
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
    const pick = chart.find(
      (e) => !used.has(e.playerId) && e.role !== "Injured" && e.role !== "Suspended"
    );
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
