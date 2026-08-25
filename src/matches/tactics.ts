/**
 * Tactical roles and formation effects.
 */

import type { Position } from "../core/types.js";

export type FormationId = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2" | "4-1-4-1";

export type TacticalRole =
  | "Goalkeeper"
  | "Stopper"
  | "BallPlayingDefender"
  | "Cover"
  | "FullBack"
  | "WingBack"
  | "BallWinner"
  | "DeepLyingPlaymaker"
  | "BoxToBox"
  | "AdvancedPlaymaker"
  | "WideMidfielder"
  | "Winger"
  | "InsideForward"
  | "WidePlaymaker"
  | "AdvancedForward"
  | "TargetForward"
  | "PressingForward";

export interface RoleProfile {
  role: TacticalRole;
  attackInvolvement: number;
  defenseInvolvement: number;
  passInvolvement: number;
  dribbleTendency: number;
  shotTendency: number;
  crossTendency: number;
  energyDrain: number;
}

function rp(
  role: TacticalRole,
  attack: number,
  defense: number,
  pass: number,
  dribble: number,
  shot: number,
  cross: number,
  energy: number
): RoleProfile {
  return {
    role,
    attackInvolvement: attack,
    defenseInvolvement: defense,
    passInvolvement: pass,
    dribbleTendency: dribble,
    shotTendency: shot,
    crossTendency: cross,
    energyDrain: energy,
  };
}

export const ROLE_PROFILES: Record<TacticalRole, RoleProfile> = {
  Goalkeeper: rp("Goalkeeper", 0.05, 1.4, 0.6, 0.05, 0.01, 0.0, 0.7),
  Stopper: rp("Stopper", 0.15, 1.5, 0.5, 0.1, 0.15, 0.05, 1.1),
  BallPlayingDefender: rp("BallPlayingDefender", 0.25, 1.2, 1.1, 0.2, 0.1, 0.05, 1.0),
  Cover: rp("Cover", 0.1, 1.4, 0.6, 0.1, 0.08, 0.05, 1.0),
  FullBack: rp("FullBack", 0.55, 1.1, 0.8, 0.4, 0.15, 0.7, 1.2),
  WingBack: rp("WingBack", 0.75, 0.95, 0.85, 0.5, 0.2, 0.9, 1.35),
  BallWinner: rp("BallWinner", 0.35, 1.3, 0.7, 0.2, 0.15, 0.1, 1.25),
  DeepLyingPlaymaker: rp("DeepLyingPlaymaker", 0.45, 0.9, 1.4, 0.25, 0.2, 0.15, 1.0),
  BoxToBox: rp("BoxToBox", 0.7, 1.0, 1.0, 0.4, 0.35, 0.2, 1.3),
  AdvancedPlaymaker: rp("AdvancedPlaymaker", 0.9, 0.5, 1.3, 0.55, 0.45, 0.35, 1.1),
  WideMidfielder: rp("WideMidfielder", 0.65, 0.8, 0.9, 0.45, 0.25, 0.75, 1.15),
  Winger: rp("Winger", 0.95, 0.4, 0.75, 0.85, 0.4, 0.95, 1.2),
  InsideForward: rp("InsideForward", 1.0, 0.35, 0.7, 0.8, 0.7, 0.35, 1.15),
  WidePlaymaker: rp("WidePlaymaker", 0.8, 0.45, 1.1, 0.6, 0.35, 0.7, 1.1),
  AdvancedForward: rp("AdvancedForward", 1.1, 0.3, 0.55, 0.55, 1.0, 0.2, 1.15),
  TargetForward: rp("TargetForward", 0.9, 0.35, 0.5, 0.25, 0.85, 0.15, 1.05),
  PressingForward: rp("PressingForward", 0.95, 0.7, 0.55, 0.5, 0.8, 0.2, 1.35),
};

export interface FormationSlot {
  position: Position;
  defaultRole: TacticalRole;
}

export interface FormationDef {
  id: FormationId;
  width: number;
  centralFocus: number;
  defensiveSolidity: number;
  wingBackEmphasis: number;
  slots: FormationSlot[];
}

export const FORMATIONS: Record<FormationId, FormationDef> = {
  "4-3-3": {
    id: "4-3-3",
    width: 1.1,
    centralFocus: 1.0,
    defensiveSolidity: 1.0,
    wingBackEmphasis: 0.7,
    slots: [
      { position: "GK", defaultRole: "Goalkeeper" },
      { position: "RB", defaultRole: "FullBack" },
      { position: "CB", defaultRole: "Stopper" },
      { position: "CB", defaultRole: "Cover" },
      { position: "LB", defaultRole: "FullBack" },
      { position: "CM", defaultRole: "BallWinner" },
      { position: "CM", defaultRole: "BoxToBox" },
      { position: "CM", defaultRole: "AdvancedPlaymaker" },
      { position: "RW", defaultRole: "Winger" },
      { position: "ST", defaultRole: "AdvancedForward" },
      { position: "LW", defaultRole: "Winger" },
    ],
  },
  "4-2-3-1": {
    id: "4-2-3-1",
    width: 1.05,
    centralFocus: 1.1,
    defensiveSolidity: 1.1,
    wingBackEmphasis: 0.65,
    slots: [
      { position: "GK", defaultRole: "Goalkeeper" },
      { position: "RB", defaultRole: "FullBack" },
      { position: "CB", defaultRole: "Stopper" },
      { position: "CB", defaultRole: "Cover" },
      { position: "LB", defaultRole: "FullBack" },
      { position: "CDM", defaultRole: "BallWinner" },
      { position: "CDM", defaultRole: "DeepLyingPlaymaker" },
      { position: "CAM", defaultRole: "AdvancedPlaymaker" },
      { position: "RW", defaultRole: "InsideForward" },
      { position: "ST", defaultRole: "AdvancedForward" },
      { position: "LW", defaultRole: "InsideForward" },
    ],
  },
  "4-4-2": {
    id: "4-4-2",
    width: 1.1,
    centralFocus: 0.85,
    defensiveSolidity: 1.05,
    wingBackEmphasis: 0.6,
    slots: [
      { position: "GK", defaultRole: "Goalkeeper" },
      { position: "RB", defaultRole: "FullBack" },
      { position: "CB", defaultRole: "Stopper" },
      { position: "CB", defaultRole: "Cover" },
      { position: "LB", defaultRole: "FullBack" },
      { position: "RM", defaultRole: "WideMidfielder" },
      { position: "CM", defaultRole: "BoxToBox" },
      { position: "CM", defaultRole: "BallWinner" },
      { position: "LM", defaultRole: "WideMidfielder" },
      { position: "ST", defaultRole: "AdvancedForward" },
      { position: "ST", defaultRole: "TargetForward" },
    ],
  },
  "3-5-2": {
    id: "3-5-2",
    width: 1.0,
    centralFocus: 1.1,
    defensiveSolidity: 1.15,
    wingBackEmphasis: 1.4,
    slots: [
      { position: "GK", defaultRole: "Goalkeeper" },
      { position: "CB", defaultRole: "Stopper" },
      { position: "CB", defaultRole: "Cover" },
      { position: "CB", defaultRole: "BallPlayingDefender" },
      { position: "RWB", defaultRole: "WingBack" },
      { position: "CDM", defaultRole: "BallWinner" },
      { position: "CM", defaultRole: "BoxToBox" },
      { position: "CAM", defaultRole: "AdvancedPlaymaker" },
      { position: "LWB", defaultRole: "WingBack" },
      { position: "ST", defaultRole: "AdvancedForward" },
      { position: "ST", defaultRole: "PressingForward" },
    ],
  },
  "4-1-4-1": {
    id: "4-1-4-1",
    width: 1.15,
    centralFocus: 1.0,
    defensiveSolidity: 1.2,
    wingBackEmphasis: 0.8,
    slots: [
      { position: "GK", defaultRole: "Goalkeeper" },
      { position: "RB", defaultRole: "FullBack" },
      { position: "CB", defaultRole: "Stopper" },
      { position: "CB", defaultRole: "Cover" },
      { position: "LB", defaultRole: "FullBack" },
      { position: "CDM", defaultRole: "BallWinner" },
      { position: "RM", defaultRole: "WideMidfielder" },
      { position: "CM", defaultRole: "BoxToBox" },
      { position: "CM", defaultRole: "DeepLyingPlaymaker" },
      { position: "LM", defaultRole: "WideMidfielder" },
      { position: "ST", defaultRole: "PressingForward" },
    ],
  },
};

export function defaultRoleFor(position: Position, formation: FormationId): TacticalRole {
  const form = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const slot = form.slots.find((s) => s.position === position);
  if (slot) return slot.defaultRole;
  if (position === "GK") return "Goalkeeper";
  if (position === "CB") return "Stopper";
  if (["LB", "RB"].includes(position)) return "FullBack";
  if (["LWB", "RWB"].includes(position)) return "WingBack";
  if (position === "CDM") return "BallWinner";
  if (position === "CM") return "BoxToBox";
  if (position === "CAM") return "AdvancedPlaymaker";
  if (["LM", "RM"].includes(position)) return "WideMidfielder";
  if (["LW", "RW"].includes(position)) return "Winger";
  if (["ST", "CF"].includes(position)) return "AdvancedForward";
  return "BoxToBox";
}

export function getRoleProfile(role: TacticalRole): RoleProfile {
  return ROLE_PROFILES[role] ?? ROLE_PROFILES.BoxToBox;
}

export function getFormation(id: string): FormationDef {
  return FORMATIONS[id as FormationId] ?? FORMATIONS["4-3-3"];
}
