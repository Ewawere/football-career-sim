/**
 * Base pitch slots for formations (0–100 coordinates).
 * Home attacks +x; away slots are mirrored.
 */

import type { FormationId, TacticalRole } from "../tactics.js";
import type { Vec2 } from "./types.js";

export interface FormationSlot {
  role: TacticalRole;
  pos: Vec2;
}

const F433: FormationSlot[] = [
  { role: "Goalkeeper", pos: { x: 5, y: 50 } },
  { role: "FullBack", pos: { x: 18, y: 15 } },
  { role: "Stopper", pos: { x: 16, y: 38 } },
  { role: "BallPlayingDefender", pos: { x: 16, y: 62 } },
  { role: "FullBack", pos: { x: 18, y: 85 } },
  { role: "BallWinner", pos: { x: 32, y: 50 } },
  { role: "BoxToBox", pos: { x: 42, y: 35 } },
  { role: "AdvancedPlaymaker", pos: { x: 42, y: 65 } },
  { role: "Winger", pos: { x: 62, y: 18 } },
  { role: "AdvancedForward", pos: { x: 72, y: 50 } },
  { role: "Winger", pos: { x: 62, y: 82 } },
];

const F4231: FormationSlot[] = [
  { role: "Goalkeeper", pos: { x: 5, y: 50 } },
  { role: "FullBack", pos: { x: 18, y: 12 } },
  { role: "Stopper", pos: { x: 16, y: 38 } },
  { role: "Cover", pos: { x: 16, y: 62 } },
  { role: "FullBack", pos: { x: 18, y: 88 } },
  { role: "BallWinner", pos: { x: 30, y: 40 } },
  { role: "DeepLyingPlaymaker", pos: { x: 30, y: 60 } },
  { role: "Winger", pos: { x: 55, y: 15 } },
  { role: "AdvancedPlaymaker", pos: { x: 55, y: 50 } },
  { role: "Winger", pos: { x: 55, y: 85 } },
  { role: "AdvancedForward", pos: { x: 75, y: 50 } },
];

const F442: FormationSlot[] = [
  { role: "Goalkeeper", pos: { x: 5, y: 50 } },
  { role: "FullBack", pos: { x: 18, y: 12 } },
  { role: "Stopper", pos: { x: 16, y: 38 } },
  { role: "Cover", pos: { x: 16, y: 62 } },
  { role: "FullBack", pos: { x: 18, y: 88 } },
  { role: "WideMidfielder", pos: { x: 40, y: 15 } },
  { role: "BallWinner", pos: { x: 38, y: 40 } },
  { role: "BoxToBox", pos: { x: 38, y: 60 } },
  { role: "WideMidfielder", pos: { x: 40, y: 85 } },
  { role: "AdvancedForward", pos: { x: 70, y: 40 } },
  { role: "TargetForward", pos: { x: 70, y: 60 } },
];

const MAP: Partial<Record<FormationId, FormationSlot[]>> = {
  "4-3-3": F433,
  "4-2-3-1": F4231,
  "4-4-2": F442,
};

export function formationSlots(formation: FormationId): FormationSlot[] {
  return MAP[formation] ?? F433;
}

export function mirrorSlot(pos: Vec2): Vec2 {
  return { x: 100 - pos.x, y: pos.y };
}
