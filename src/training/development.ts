/**
 * Training sessions and seasonal development.
 */

import type { Player } from "../players/player.js";
import type { World } from "../world/world.js";
import { recomputeOVR } from "../players/player.js";
import { enforceAgeOvrCap } from "../transfers/squad-rules.js";

export type TrainingFocus =
  | "Attacking"
  | "Defending"
  | "Physical"
  | "Technical"
  | "Mentality"
  | "Goalkeeping";

function clamp(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

export function applyTrainingSession(
  player: Player,
  focus: TrainingFocus,
  intensity: number,
  world: World
): void {
  const points = (intensity / 100) * (0.4 + world.rng.float(0, 0.3));
  const attrs = player.attributes;

  const bump = (obj: Record<string, number>, key: string, w: number) => {
    const softCap = player.potential + world.rng.int(-2, 2);
    if ((obj[key] ?? 50) >= softCap) return;
    obj[key] = clamp((obj[key] ?? 50) + points * w);
  };

  if (focus === "Attacking") {
    bump(attrs.technical as any, "finishing", 1.2);
    bump(attrs.technical as any, "longShots", 0.9);
    bump(attrs.mental as any, "composure", 0.7);
  } else if (focus === "Defending") {
    bump(attrs.technical as any, "tackling", 1.2);
    bump(attrs.technical as any, "marking", 1.1);
    bump(attrs.mental as any, "positioning", 0.9);
  } else if (focus === "Physical") {
    bump(attrs.physical as any, "pace", 0.8);
    bump(attrs.physical as any, "stamina", 1.1);
    bump(attrs.physical as any, "strength", 0.9);
  } else if (focus === "Technical") {
    bump(attrs.technical as any, "passing", 1.1);
    bump(attrs.technical as any, "dribbling", 1.0);
    bump(attrs.technical as any, "ballControl", 1.0);
  } else if (focus === "Mentality") {
    bump(attrs.mental as any, "decisions", 1.0);
    bump(attrs.mental as any, "vision", 0.9);
    bump(attrs.mental as any, "workRate", 0.8);
  } else {
    bump(attrs.mental as any, "positioning", 1.0);
    bump(attrs.mental as any, "reactions", 1.0);
  }

  player.state.sharpness = Math.min(100, player.state.sharpness + intensity * 0.15);
  player.state.fitness = Math.max(40, player.state.fitness - intensity * 0.08);
  player.state.fatigue = Math.min(100, player.state.fatigue + intensity * 0.05);
  recomputeOVR(player);
  player.ovr = enforceAgeOvrCap(player.ovr, player.age);
}

export function developAllPlayers(world: World): void {
  for (const p of world.players.values()) {
    if (p.retired) continue;
    // Minutes-based growth
    const mins = p.state.matchMinutesThisSeason;
    const ageFactor =
      p.age <= 21 ? 1.2 : p.age <= 24 ? 1.0 : p.age <= 28 ? 0.5 : p.age <= 32 ? 0.15 : -0.3;
    if (ageFactor < 0 && mins < 500) {
      // Decline path for older low-minute players
      p.ovr = Math.max(40, p.ovr - world.rng.int(0, 2));
      continue;
    }
    if (mins >= 900 && ageFactor > 0) {
      applyTrainingSession(p, "Technical", 40, world);
    } else if (mins >= 400 && ageFactor > 0) {
      applyTrainingSession(p, "Physical", 30, world);
    }
    // Natural recovery
    p.state.fitness = Math.min(100, p.state.fitness + 15);
    p.state.fatigue = Math.max(0, p.state.fatigue - 25);
  }
}
