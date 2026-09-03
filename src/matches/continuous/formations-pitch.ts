/**
 * Map formation slots to pitch coordinates (attacking left to right for home).
 */

import type { FormationId, TacticalRole } from "../tactics.js";
import type { Vec2, PitchSide } from "./types.js";
import { PITCH } from "./types.js";
import { getFormation } from "../tactics.js";

/** Slot index -> relative (0-1 along attack axis, 0-1 width) */
export function formationSlots(formation: FormationId): { rx: number; ry: number; role: TacticalRole }[] {
  const map: Record<FormationId, { rx: number; ry: number; role: TacticalRole }[]> = {
    "4-3-3": [
      { rx: 0.08, ry: 0.5, role: "Goalkeeper" },
      { rx: 0.22, ry: 0.15, role: "FullBack" },
      { rx: 0.2, ry: 0.38, role: "Stopper" },
      { rx: 0.2, ry: 0.62, role: "BallPlayingDefender" },
      { rx: 0.22, ry: 0.85, role: "FullBack" },
      { rx: 0.4, ry: 0.3, role: "BoxToBox" },
      { rx: 0.38, ry: 0.5, role: "BallWinner" },
      { rx: 0.4, ry: 0.7, role: "AdvancedPlaymaker" },
      { rx: 0.7, ry: 0.15, role: "Winger" },
      { rx: 0.78, ry: 0.5, role: "AdvancedForward" },
      { rx: 0.7, ry: 0.85, role: "InsideForward" },
    ],
    "4-2-3-1": [
      { rx: 0.08, ry: 0.5, role: "Goalkeeper" },
      { rx: 0.22, ry: 0.12, role: "FullBack" },
      { rx: 0.2, ry: 0.38, role: "Stopper" },
      { rx: 0.2, ry: 0.62, role: "Cover" },
      { rx: 0.22, ry: 0.88, role: "FullBack" },
      { rx: 0.38, ry: 0.35, role: "BallWinner" },
      { rx: 0.38, ry: 0.65, role: "DeepLyingPlaymaker" },
      { rx: 0.58, ry: 0.15, role: "Winger" },
      { rx: 0.55, ry: 0.5, role: "AdvancedPlaymaker" },
      { rx: 0.58, ry: 0.85, role: "InsideForward" },
      { rx: 0.8, ry: 0.5, role: "AdvancedForward" },
    ],
    "4-4-2": [
      { rx: 0.08, ry: 0.5, role: "Goalkeeper" },
      { rx: 0.22, ry: 0.12, role: "FullBack" },
      { rx: 0.2, ry: 0.38, role: "Stopper" },
      { rx: 0.2, ry: 0.62, role: "Cover" },
      { rx: 0.22, ry: 0.88, role: "FullBack" },
      { rx: 0.45, ry: 0.12, role: "WideMidfielder" },
      { rx: 0.42, ry: 0.38, role: "BoxToBox" },
      { rx: 0.42, ry: 0.62, role: "BallWinner" },
      { rx: 0.45, ry: 0.88, role: "WideMidfielder" },
      { rx: 0.72, ry: 0.4, role: "AdvancedForward" },
      { rx: 0.72, ry: 0.6, role: "TargetForward" },
    ],
    "3-5-2": [
      { rx: 0.08, ry: 0.5, role: "Goalkeeper" },
      { rx: 0.22, ry: 0.28, role: "Stopper" },
      { rx: 0.2, ry: 0.5, role: "Cover" },
      { rx: 0.22, ry: 0.72, role: "BallPlayingDefender" },
      { rx: 0.4, ry: 0.1, role: "WingBack" },
      { rx: 0.4, ry: 0.35, role: "BoxToBox" },
      { rx: 0.38, ry: 0.5, role: "DeepLyingPlaymaker" },
      { rx: 0.4, ry: 0.65, role: "AdvancedPlaymaker" },
      { rx: 0.4, ry: 0.9, role: "WingBack" },
      { rx: 0.72, ry: 0.4, role: "AdvancedForward" },
      { rx: 0.72, ry: 0.6, role: "PressingForward" },
    ],
    "4-1-4-1": [
      { rx: 0.08, ry: 0.5, role: "Goalkeeper" },
      { rx: 0.22, ry: 0.12, role: "FullBack" },
      { rx: 0.2, ry: 0.38, role: "Stopper" },
      { rx: 0.2, ry: 0.62, role: "Cover" },
      { rx: 0.22, ry: 0.88, role: "FullBack" },
      { rx: 0.35, ry: 0.5, role: "BallWinner" },
      { rx: 0.5, ry: 0.12, role: "Winger" },
      { rx: 0.48, ry: 0.38, role: "BoxToBox" },
      { rx: 0.48, ry: 0.62, role: "AdvancedPlaymaker" },
      { rx: 0.5, ry: 0.88, role: "WideMidfielder" },
      { rx: 0.78, ry: 0.5, role: "AdvancedForward" },
    ],
  };
  return map[formation] ?? map["4-3-3"]!;
}

export function slotToWorld(rx: number, ry: number, side: PitchSide): Vec2 {
  if (side === "home") {
    return { x: rx * PITCH.width, y: ry * PITCH.height };
  }
  return { x: (1 - rx) * PITCH.width, y: (1 - ry) * PITCH.height };
}

export function defaultTargets(formation: FormationId, side: PitchSide): Vec2[] {
  return formationSlots(formation).map((s) => slotToWorld(s.rx, s.ry, side));
}

export function getFormationRoles(formation: FormationId): TacticalRole[] {
  return formationSlots(formation).map((s) => s.role);
}

void getFormation;
