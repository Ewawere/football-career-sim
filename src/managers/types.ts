/**
 * Manager entity types.
 */

import type { EntityId, GameDate } from "../core/types.js";
import type { TacticalIdentity, TransferPhilosophy } from "../clubs/club.js";

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

export type ManagerStatus = "Employed" | "Unemployed" | "Retired";

export interface ManagerJobRecord {
  clubId: EntityId;
  clubName: string;
  startDate: GameDate;
  endDate: GameDate | null;
  reason: string;
  matches: number;
  wins: number;
  trophies: number;
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
