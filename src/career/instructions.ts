/**
 * Player instructions & preferred tactical role - mid-week settings that feed selection + match.
 */

import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import type { Position } from "../core/types.js";
import type { TacticalRole } from "../matches/tactics.js";
import { defaultRoleFor, getRoleProfile, type FormationId } from "../matches/tactics.js";

export type MentalityInstruction =
  | "Balanced"
  | "Attacking"
  | "Defensive"
  | "Pressing"
  | "Roam";

export interface PlayerInstructions {
  preferredRole: TacticalRole | null;
  mentality: MentalityInstruction;
  shootMore: boolean;
  stayWide: boolean;
  comeDeep: boolean;
  hardTackle: boolean;
  updatedAt: string;
}

const ROLES_BY_POS: Partial<Record<Position, TacticalRole[]>> = {
  GK: ["Goalkeeper"],
  CB: ["Stopper", "BallPlayingDefender", "Cover"],
  LB: ["FullBack", "WingBack"],
  RB: ["FullBack", "WingBack"],
  LWB: ["WingBack", "FullBack"],
  RWB: ["WingBack", "FullBack"],
  CDM: ["BallWinner", "DeepLyingPlaymaker", "BoxToBox"],
  CM: ["BoxToBox", "DeepLyingPlaymaker", "AdvancedPlaymaker", "BallWinner"],
  CAM: ["AdvancedPlaymaker", "BoxToBox", "InsideForward"],
  LM: ["WideMidfielder", "Winger", "WidePlaymaker"],
  RM: ["WideMidfielder", "Winger", "WidePlaymaker"],
  LW: ["Winger", "InsideForward", "WidePlaymaker"],
  RW: ["Winger", "InsideForward", "WidePlaymaker"],
  ST: ["AdvancedForward", "TargetForward", "PressingForward"],
  CF: ["AdvancedForward", "TargetForward", "PressingForward"],
};

export function getInstructions(player: Player): PlayerInstructions {
  const raw = (player.state as any).instructions as PlayerInstructions | undefined;
  if (raw && raw.mentality) return raw;
  return {
    preferredRole: null,
    mentality: "Balanced",
    shootMore: false,
    stayWide: false,
    comeDeep: false,
    hardTackle: false,
    updatedAt: "",
  };
}

export function rolesForPlayer(player: Player): TacticalRole[] {
  return ROLES_BY_POS[player.primaryPosition] ?? ["BoxToBox"];
}

export function setInstructions(
  world: World,
  patch: Partial<PlayerInstructions> & { preferredRole?: TacticalRole | null }
): PlayerInstructions {
  const pid = world.userPlayerId;
  if (!pid) throw new Error("No player");
  const player = world.players.get(pid);
  if (!player) throw new Error("No player");
  const cur = getInstructions(player);
  const allowed = rolesForPlayer(player);
  let role = patch.preferredRole !== undefined ? patch.preferredRole : cur.preferredRole;
  if (role && !allowed.includes(role)) role = allowed[0] ?? null;

  const next: PlayerInstructions = {
    preferredRole: role,
    mentality: patch.mentality ?? cur.mentality,
    shootMore: patch.shootMore ?? cur.shootMore,
    stayWide: patch.stayWide ?? cur.stayWide,
    comeDeep: patch.comeDeep ?? cur.comeDeep,
    hardTackle: patch.hardTackle ?? cur.hardTackle,
    updatedAt: world.calendar.currentDate,
  };
  (player.state as any).instructions = next;
  player.state.morale = Math.min(100, (player.state.morale ?? 50) + 1);
  return next;
}

export function resolvePlayerRole(player: Player, formation: string): TacticalRole {
  const inst = getInstructions(player);
  if (inst.preferredRole) return inst.preferredRole;
  return defaultRoleFor(player.primaryPosition, formation as FormationId);
}

export function instructionSelectionNudge(player: Player): { delta: number; reasons: string[] } {
  const inst = getInstructions(player);
  const reasons: string[] = [];
  let delta = 0;
  if (inst.preferredRole) {
    delta += 2;
    reasons.push(`Prefers ${inst.preferredRole}`);
  }
  if (inst.mentality === "Pressing") {
    delta += player.state.fitness >= 70 ? 1.5 : -2;
    if (player.state.fitness < 70) reasons.push("Pressing instruction vs low fitness");
  }
  if (inst.mentality === "Attacking" && ["ST", "CF", "CAM", "LW", "RW"].includes(player.primaryPosition)) {
    delta += 1;
  }
  if (inst.hardTackle && player.state.fitness < 55) {
    delta -= 1.5;
    reasons.push("Aggressive instructions while fatigued");
  }
  return { delta, reasons };
}

export function instructionMatchModifiers(player: Player): {
  shotWeightMul: number;
  attackMul: number;
  defenseMul: number;
  energyMul: number;
} {
  const inst = getInstructions(player);
  let shot = 1;
  let attack = 1;
  let defense = 1;
  let energy = 1;
  if (inst.shootMore) shot += 0.12;
  if (inst.mentality === "Attacking") {
    attack += 0.1;
    defense -= 0.06;
    energy += 0.05;
  } else if (inst.mentality === "Defensive") {
    defense += 0.12;
    attack -= 0.08;
  } else if (inst.mentality === "Pressing") {
    energy += 0.15;
    defense += 0.08;
    attack += 0.04;
  } else if (inst.mentality === "Roam") {
    attack += 0.06;
    energy += 0.08;
  }
  if (inst.stayWide) attack += 0.04;
  if (inst.comeDeep) {
    defense += 0.05;
    attack -= 0.03;
  }
  if (inst.hardTackle) {
    defense += 0.08;
    energy += 0.1;
  }
  if (inst.preferredRole) {
    const p = getRoleProfile(inst.preferredRole);
    shot *= 0.92 + p.shotTendency * 0.2;
    attack *= 0.95 + p.attackInvolvement * 0.08;
  }
  return {
    shotWeightMul: shot,
    attackMul: attack,
    defenseMul: defense,
    energyMul: energy,
  };
}

export function snapshotInstructions(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  const inst = getInstructions(player);
  const allowed = rolesForPlayer(player);
  return {
    ...inst,
    allowedRoles: allowed,
    position: player.primaryPosition,
  };
}
