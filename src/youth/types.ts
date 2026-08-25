/**
 * Youth academy & prospect types.
 */

import type { EntityId, Position, GameDate } from "../core/types.js";

export type ProspectStatus =
  | "Undiscovered"
  | "Scouted"
  | "InAcademy"
  | "Promoted"
  | "Released"
  | "SignedElsewhere";

export interface YouthProspect {
  id: EntityId;
  playerId: EntityId | null;
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: string;
  dateOfBirth: GameDate;
  age: number;
  primaryPosition: Position;
  truePotential: number;
  trueCurrentAbility: number;
  reportedPotentialMin: number;
  reportedPotentialMax: number;
  reportedCA: number;
  reportConfidence: number;
  status: ProspectStatus;
  academyClubId: EntityId | null;
  scoutedByClubIds: EntityId[];
  personalityId: EntityId | null;
  discoveredDate: GameDate | null;
}

export interface AcademyIntakeReport {
  clubId: EntityId;
  seasonId: string;
  generated: EntityId[];
  promoted: EntityId[];
  released: EntityId[];
}
