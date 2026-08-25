/**
 * Squad need analysis for AI transfers.
 */

import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import type { Position } from "../core/types.js";
import { ALL_POSITIONS } from "../core/types.js";

export interface PositionNeed {
  position: Position;
  score: number;
  count: number;
  avgOvr: number;
  reason: string;
}

export interface SquadNeeds {
  clubId: string;
  prioritized: PositionNeed[];
  surplus: PositionNeed[];
}

export function analyzeSquadNeeds(world: World, club: Club): SquadNeeds {
  const byPos = new Map<Position, { count: number; ovrSum: number }>();
  for (const pos of ALL_POSITIONS) {
    byPos.set(pos, { count: 0, ovrSum: 0 });
  }
  for (const id of club.squadPlayerIds) {
    const p = world.players.get(id);
    if (!p || p.retired) continue;
    const slot = byPos.get(p.primaryPosition)!;
    slot.count += 1;
    slot.ovrSum += p.ovr;
  }

  const targets: Partial<Record<Position, number>> = {
    GK: 2,
    CB: 4,
    LB: 2,
    RB: 2,
    CDM: 2,
    CM: 3,
    CAM: 2,
    LW: 2,
    RW: 2,
    ST: 2,
  };

  const prioritized: PositionNeed[] = [];
  const surplus: PositionNeed[] = [];

  for (const pos of ALL_POSITIONS) {
    const slot = byPos.get(pos)!;
    const target = targets[pos] ?? 1;
    const avg = slot.count ? slot.ovrSum / slot.count : 0;
    let score = 0;
    let reason = "balanced";
    if (slot.count < target) {
      score = (target - slot.count) * 35 + Math.max(0, 70 - avg);
      reason = `need ${target - slot.count} more ${pos}`;
    } else if (slot.count > target + 1) {
      score = -((slot.count - target) * 20);
      reason = `surplus ${pos}`;
      surplus.push({ position: pos, score: -score, count: slot.count, avgOvr: avg, reason });
    } else if (avg > 0 && avg < club.reputation * 0.85) {
      score = 25;
      reason = `quality upgrade at ${pos}`;
    }
    if (score > 0) prioritized.push({ position: pos, score, count: slot.count, avgOvr: avg, reason });
  }

  prioritized.sort((a, b) => b.score - a.score);
  return { clubId: club.id, prioritized, surplus };
}
