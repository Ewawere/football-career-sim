/**
 * Player role and match instructions - soft influence on selection + match modifiers.
 */

import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";

export type PlayerRoleId =
  | "Default"
  | "TargetMan"
  | "Poacher"
  | "CompleteForward"
  | "Winger"
  | "InsideForward"
  | "Playmaker"
  | "BoxToBox"
  | "Destroyer"
  | "BallPlayingDefender"
  | "WingBack"
  | "SweeperKeeper";

export type MatchInstructionId =
  | "Balanced"
  | "ShootMore"
  | "PassShort"
  | "GetForward"
  | "HoldPosition"
  | "PressMore"
  | "ConserveEnergy";

export interface RoleDef {
  id: PlayerRoleId;
  label: string;
  positions: string[];
  description: string;
  shotBias: number;
  chanceBias: number;
  staminaDrain: number;
  selectionBonus: number;
}

export interface InstructionDef {
  id: MatchInstructionId;
  label: string;
  description: string;
  shotBias: number;
  staminaDrain: number;
  selectionBonus: number;
}

export const ROLES: RoleDef[] = [
  { id: "Default", label: "Default", positions: ["*"], description: "No special role", shotBias: 0, chanceBias: 0, staminaDrain: 0, selectionBonus: 0 },
  { id: "Poacher", label: "Poacher", positions: ["ST", "CF"], description: "Stay central, attack the box", shotBias: 0.12, chanceBias: 0.06, staminaDrain: 0.02, selectionBonus: 1 },
  { id: "TargetMan", label: "Target forward", positions: ["ST", "CF"], description: "Hold up, win aerials", shotBias: 0.04, chanceBias: 0.08, staminaDrain: 0.04, selectionBonus: 1 },
  { id: "CompleteForward", label: "Complete forward", positions: ["ST", "CF"], description: "Link and finish", shotBias: 0.08, chanceBias: 0.08, staminaDrain: 0.05, selectionBonus: 2 },
  { id: "Winger", label: "Winger", positions: ["LW", "RW", "LM", "RM"], description: "Stay wide, cross", shotBias: 0.02, chanceBias: 0.1, staminaDrain: 0.06, selectionBonus: 1 },
  { id: "InsideForward", label: "Inside forward", positions: ["LW", "RW"], description: "Cut inside, shoot", shotBias: 0.14, chanceBias: 0.04, staminaDrain: 0.05, selectionBonus: 2 },
  { id: "Playmaker", label: "Playmaker", positions: ["CAM", "CM", "LM", "RM"], description: "Dictate tempo", shotBias: -0.04, chanceBias: 0.12, staminaDrain: 0.03, selectionBonus: 2 },
  { id: "BoxToBox", label: "Box-to-box", positions: ["CM", "CDM"], description: "Cover both boxes", shotBias: 0.04, chanceBias: 0.04, staminaDrain: 0.08, selectionBonus: 1 },
  { id: "Destroyer", label: "Destroyer", positions: ["CDM", "CM"], description: "Break up play", shotBias: -0.06, chanceBias: -0.02, staminaDrain: 0.07, selectionBonus: 1 },
  { id: "BallPlayingDefender", label: "Ball-playing defender", positions: ["CB", "CDM"], description: "Build from the back", shotBias: -0.08, chanceBias: 0.06, staminaDrain: 0.02, selectionBonus: 1 },
  { id: "WingBack", label: "Wing-back", positions: ["LB", "RB", "LWB", "RWB"], description: "Attack and defend the flank", shotBias: 0.02, chanceBias: 0.06, staminaDrain: 0.1, selectionBonus: 1 },
  { id: "SweeperKeeper", label: "Sweeper keeper", positions: ["GK"], description: "Sweep behind the line", shotBias: 0, chanceBias: 0.04, staminaDrain: 0.02, selectionBonus: 1 },
];

export const INSTRUCTIONS: InstructionDef[] = [
  { id: "Balanced", label: "Balanced", description: "Default approach", shotBias: 0, staminaDrain: 0, selectionBonus: 0 },
  { id: "ShootMore", label: "Shoot more", description: "Take chances from range", shotBias: 0.1, staminaDrain: 0.02, selectionBonus: 0 },
  { id: "PassShort", label: "Pass short", description: "Keep it simple", shotBias: -0.06, staminaDrain: -0.02, selectionBonus: 0 },
  { id: "GetForward", label: "Get further forward", description: "Join attacks", shotBias: 0.04, staminaDrain: 0.06, selectionBonus: 1 },
  { id: "HoldPosition", label: "Hold position", description: "Stay disciplined", shotBias: -0.04, staminaDrain: -0.04, selectionBonus: 1 },
  { id: "PressMore", label: "Press more", description: "Hunt the ball", shotBias: 0, staminaDrain: 0.08, selectionBonus: 0 },
  { id: "ConserveEnergy", label: "Conserve energy", description: "Manage the load", shotBias: -0.02, staminaDrain: -0.1, selectionBonus: 0 },
];

export interface PlayerRoleState {
  role: PlayerRoleId;
  instruction: MatchInstructionId;
}

function ensure(player: Player): PlayerRoleState {
  const st = (player as any).roleState as PlayerRoleState | undefined;
  if (st?.role) return st;
  const def: PlayerRoleState = { role: "Default", instruction: "Balanced" };
  (player as any).roleState = def;
  return def;
}

export function getPlayerRoleState(player: Player): PlayerRoleState {
  return { ...ensure(player) };
}

export function setPlayerRole(
  world: World,
  role?: PlayerRoleId,
  instruction?: MatchInstructionId
): PlayerRoleState {
  const pid = world.userPlayerId;
  if (!pid) throw new Error("No player");
  const player = world.players.get(pid)!;
  const st = ensure(player);
  if (role) st.role = role;
  if (instruction) st.instruction = instruction;
  (player as any).roleState = st;
  return { ...st };
}

export function rolesForPosition(pos: string): RoleDef[] {
  return ROLES.filter((r) => r.positions.includes("*") || r.positions.includes(pos));
}

export function roleMatchModifiers(player: Player): {
  shotWeightMul: number;
  strengthMul: number;
  staminaMul: number;
  selectionBonus: number;
} {
  const st = ensure(player);
  const role = ROLES.find((r) => r.id === st.role) || ROLES[0]!;
  const ins = INSTRUCTIONS.find((i) => i.id === st.instruction) || INSTRUCTIONS[0]!;
  return {
    shotWeightMul: 1 + role.shotBias + ins.shotBias,
    strengthMul: 1 + role.chanceBias * 0.5,
    staminaMul: 1 + role.staminaDrain + ins.staminaDrain,
    selectionBonus: role.selectionBonus + ins.selectionBonus,
  };
}

export function snapshotRoles(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  const st = getPlayerRoleState(player);
  const available = rolesForPosition(player.primaryPosition);
  return {
    role: st.role,
    instruction: st.instruction,
    roleLabel: ROLES.find((r) => r.id === st.role)?.label ?? st.role,
    instructionLabel: INSTRUCTIONS.find((i) => i.id === st.instruction)?.label ?? st.instruction,
    availableRoles: available.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
    })),
    instructions: INSTRUCTIONS.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
    })),
  };
}
