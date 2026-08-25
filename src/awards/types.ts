/**
 * Awards, records, legacy, retirement types.
 */

import type { EntityId, GameDate, Position } from "../core/types.js";

export type AwardType =
  | "GoldenBoot"
  | "Playmaker"
  | "PlayerOfTheSeason"
  | "YoungPlayerOfTheSeason"
  | "GoalkeeperOfTheSeason"
  | "CleanSheetLeader"
  | "TeamOfTheSeason"
  | "PlayerOfTheMonth"
  | "ManagerOfTheMonth"
  | "ManagerOfTheSeason"
  | "InternationalPlayerOfTheYear"
  | "GoalOfTheSeason"
  | "FairPlay";

export interface Award {
  id: EntityId;
  type: AwardType;
  seasonId: string;
  competitionId: EntityId | null;
  playerId: EntityId | null;
  managerId: EntityId | null;
  clubId: EntityId | null;
  value: number;
  date: GameDate;
  month: number | null;
  position: Position | null;
}

export type RecordScope = "Club" | "League" | "Career" | "International";

export interface RecordEntry {
  id: EntityId;
  scope: RecordScope;
  key: string;
  label: string;
  playerId: EntityId;
  value: number;
  seasonId: string | null;
  clubId: EntityId | null;
  competitionId: EntityId | null;
  date: GameDate;
}

export interface LegacyProfile {
  playerId: EntityId;
  score: number;
  trophies: number;
  awards: number;
  peakOvr: number;
  careerGoals: number;
  careerAppearances: number;
  internationalCaps: number;
  clubsRepresented: number;
  yearsActive: number;
  summary: string;
}

export interface RetirementEvent {
  playerId: EntityId;
  date: GameDate;
  age: number;
  lastClubId: EntityId | null;
  legacy: LegacyProfile;
}
