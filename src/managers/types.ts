/**
 * Manager career types.
 */

import type { EntityId, GameDate } from "../core/types.js";
import type { TacticalIdentity, TransferPhilosophy } from "../clubs/club.js";

export type ManagerStatus =
  | "Employed"
  | "Unemployed"
  | "Retired"
  | "OnGardenLeave";

export interface ManagerAttributes {
  attacking: number;
  defending: number;
  manManagement: number;
  tacticalKnowledge: number;
  youthDevelopment: number;
  negotiation: number;
  discipline: number;
  mediaHandling: number;
}

export interface Manager {
  id: EntityId;
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: string;
  age: number;
  reputation: number;
  attributes: ManagerAttributes;
  preferredFormation: string;
  preferredIdentity: TacticalIdentity;
  preferredPhilosophy: TransferPhilosophy;
  status: ManagerStatus;
  currentClubId: EntityId | null;
  contractEnd: GameDate | null;
  wageWeekly: number;
  careerWins: number;
  careerDraws: number;
  careerLosses: number;
  trophies: number;
  isUserControlled: boolean;
  boardConfidence: number;
  jobHistory: ManagerJobRecord[];
}

export interface ManagerJobRecord {
  clubId: EntityId;
  clubName: string;
  startDate: GameDate;
  endDate: GameDate | null;
  reason: "Resigned" | "Sacked" | "ContractEnded" | "Active" | null;
  matches: number;
  wins: number;
  trophies: number;
}

export interface BoardExpectation {
  leaguePositionMin: number;
  cupProgress: boolean;
  financialFairPlay: boolean;
  style: "Results" | "Youth" | "Entertainment" | "Balanced";
}

export interface JobOffer {
  id: EntityId;
  clubId: EntityId;
  clubName: string;
  reputation: number;
  wageWeekly: number;
  contractYears: number;
  expectations: BoardExpectation;
  status: "Open" | "Accepted" | "Declined" | "Expired";
}

export interface ManagerSeasonSummary {
  seasonId: string;
  clubId: EntityId;
  position: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  boardConfidenceEnd: number;
  sacked: boolean;
}
