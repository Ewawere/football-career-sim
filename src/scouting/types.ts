/**
 * Scouting types.
 */

import type { EntityId, GameDate, Position } from "../core/types.js";

export type ScoutAssignmentFocus =
  | "Youth"
  | "FirstTeam"
  | "FreeAgents"
  | "Opposition"
  | "Any";

export interface Scout {
  id: EntityId;
  name: string;
  clubId: EntityId;
  ability: number;
  judgement: number;
  knowledge: number;
  region: string;
  focus: ScoutAssignmentFocus;
  busyUntil: GameDate | null;
}

export interface ScoutReport {
  id: EntityId;
  scoutId: EntityId;
  clubId: EntityId;
  prospectId: EntityId | null;
  playerId: EntityId | null;
  date: GameDate;
  position: Position | null;
  estimatedCA: number;
  estimatedPotMin: number;
  estimatedPotMax: number;
  confidence: number;
  notes: string;
  recommended: boolean;
}

export interface ScoutingNetwork {
  clubId: EntityId;
  scoutIds: EntityId[];
  knowledgeByRegion: Record<string, number>;
}
