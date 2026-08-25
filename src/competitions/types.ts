/**
 * Competition domain types.
 * Designed so League, Cup, Continental, International all share a common shape.
 */

import type { EntityId, GameDate, SeasonId } from "../core/types.js";

export type CompetitionType =
  | "League"
  | "DomesticCup"
  | "SuperCup"
  | "Continental"
  | "International"
  | "Youth";

export type CompetitionStage =
  | "Group"
  | "RoundOf32"
  | "RoundOf16"
  | "QuarterFinal"
  | "SemiFinal"
  | "Final"
  | "LeaguePhase"
  | "Playoff";

export interface Competition {
  id: EntityId;
  name: string;
  shortName: string;
  type: CompetitionType;
  nation: string | null;
  seasonId: SeasonId;
  clubIds: EntityId[];
  matchdayCount: number;
  currentMatchday: number;
  finished: boolean;
}

export interface Fixture {
  id: EntityId;
  competitionId: EntityId;
  matchday: number;
  homeClubId: EntityId;
  awayClubId: EntityId;
  date: GameDate;
  matchId: EntityId | null;
  played: boolean;
}

export interface LeagueTableRow {
  clubId: EntityId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string[];
  position: number;
}

export interface SeasonState {
  seasonId: SeasonId;
  phase: "PreSeason" | "InSeason" | "PostSeason" | "OffSeason";
  leagueIds: EntityId[];
  cupIds: EntityId[];
  activeMatchday: number;
  totalMatchdays: number;
}
