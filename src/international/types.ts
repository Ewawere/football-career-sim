/**
 * International football types.
 */

import type { EntityId, GameDate, Position } from "../core/types.js";

export type NationalTeamLevel = "Senior" | "U21" | "U19";

export interface NationalTeam {
  id: EntityId;
  nation: string;
  level: NationalTeamLevel;
  reputation: number;
  coachName: string;
  squadPlayerIds: EntityId[];
  calledUpIds: EntityId[];
}

export interface InternationalCallUp {
  id: EntityId;
  playerId: EntityId;
  nationalTeamId: EntityId;
  nation: string;
  level: NationalTeamLevel;
  windowStart: GameDate;
  windowEnd: GameDate;
  status: "Called" | "Accepted" | "Withdrawn" | "Injured" | "Declined";
  capsGained: number;
  goalsGained: number;
}

export interface InternationalMatchResult {
  id: EntityId;
  homeNation: string;
  awayNation: string;
  homeScore: number;
  awayScore: number;
  date: GameDate;
  competition: "Friendly" | "Qualifier" | "Tournament";
  playerStats: Map<EntityId, { minutes: number; goals: number; rating: number }>;
}

export interface NationStrength {
  nation: string;
  strength: number;
}
