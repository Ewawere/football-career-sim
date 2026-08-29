/**
 * Match domain types.
 */

import type { EntityId, GameDate, Position } from "../core/types.js";
import type { FormationId, TacticalRole } from "./tactics.js";

export type MatchStatus = "Scheduled" | "InProgress" | "Finished" | "Cancelled";

export type MatchEventType =
  | "Goal"
  | "Assist"
  | "Yellow"
  | "Red"
  | "Injury"
  | "Sub"
  | "PenaltyMiss"
  | "PenaltyGoal"
  | "OwnGoal"
  | "Chance"
  | "Save";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  playerId?: EntityId;
  assistId?: EntityId;
  clubId?: EntityId;
  description: string;
}

export interface MatchTeamLineup {
  clubId: EntityId;
  startingXI: EntityId[];
  substitutes: EntityId[];
  formation: FormationId;
  roles: Map<EntityId, TacticalRole>;
}

export interface PlayerMatchStats {
  playerId: EntityId;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  chancesCreated: number;
  tackles: number;
  interceptions: number;
  dribbles: number;
  fouls: number;
  errors: number;
  yellow: boolean;
  red: boolean;
  passAttempts: number;
  passCompleted: number;
  rating: number;
  role?: TacticalRole;
}

export interface TeamMatchStats {
  possession: number;
  xG: number;
  shots: number;
  shotsOnTarget: number;
  touchesInBox: number;
  bigChances: number;
  bigChancesMissed: number;
  accuratePasses: number;
  passAccuracy: number;
  fouls: number;
  offsides: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

export interface MatchContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  momentum: number;
  possessionHome: number;
  shotsHome: number;
  shotsAway: number;
  matchImportance: number;
  intensity: number;
}

export interface Match {
  id: EntityId;
  competitionId: EntityId | null;
  home: MatchTeamLineup;
  away: MatchTeamLineup;
  date: GameDate;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  playerStats: Map<EntityId, PlayerMatchStats>;
  momentum: number;
  possessionHome: number;
  context: MatchContext;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  interactiveMoments: InteractiveMomentRecord[];
}

export interface MatchResultSummary {
  matchId: EntityId;
  homeClubId: EntityId;
  awayClubId: EntityId;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  ratings: Map<EntityId, number>;
  careerEffects?: CareerMatchEffects;
}

export interface CareerMatchEffects {
  playerId: EntityId;
  rating: number;
  formDelta: number;
  moraleDelta: number;
  managerTrustDelta: number;
  reputationDelta: number;
  managerReaction: "IncreasedTrust" | "Neutral" | "Concern" | "ReducedTrust";
  notes: string[];
}

export interface InteractiveMomentRecord {
  minute: number;
  momentType: string;
  description: string;
  chosenActionId: string;
  outcome: string;
}
