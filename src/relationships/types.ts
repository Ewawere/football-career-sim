/**
 * Relationship graph — player to manager, teammates, agent, media.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type RelationTargetType =
  | "Manager"
  | "Teammate"
  | "Agent"
  | "Media"
  | "Board"
  | "Coach";

export interface Relationship {
  id: EntityId;
  fromPlayerId: EntityId;
  targetType: RelationTargetType;
  targetId: EntityId | string;
  score: number;
  lastUpdated: GameDate;
  history: RelationEvent[];
}

export interface RelationEvent {
  date: GameDate;
  delta: number;
  reason: string;
  sourceEventId?: string;
}

export interface AgentProfile {
  id: EntityId;
  name: string;
  aggressiveness: number;
  loyaltyBias: number;
  clientPlayerIds: EntityId[];
}
