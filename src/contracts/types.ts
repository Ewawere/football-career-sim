/**
 * Contract, loan, and transfer record types.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type SquadRole =
  | "KeyPlayer"
  | "Starter"
  | "Rotation"
  | "Squad"
  | "Prospect"
  | "Backup";

export type ContractStatus =
  | "Active"
  | "Expiring"
  | "Negotiating"
  | "Renewed"
  | "Terminated"
  | "Expired"
  | "TransferListed";

export interface Contract {
  clubId: EntityId;
  wage: number;
  startDate: GameDate;
  endDate: GameDate;
  releaseClause: number | null;
  signedDate: GameDate;
}

export interface LoanState {
  parentClubId: EntityId;
  destinationClubId: EntityId;
  endDate: GameDate;
  isLoan: boolean;
  loanEndDate: GameDate | null;
  wageSplitParent: number;
  signedDate: GameDate;
}

export interface LoanRecord {
  id: EntityId;
  playerId: EntityId;
  parentClubId: EntityId;
  loanClubId: EntityId;
  startDate: GameDate;
  endDate: GameDate;
  wageSplitParent: number;
  optionalBuyClause: number | null;
  playingTimeExpectation: "Starter" | "Rotation" | "Development";
  active: boolean;
}

export interface TransferRecord {
  id: EntityId;
  playerId: EntityId;
  fromClubId: EntityId | null;
  toClubId: EntityId;
  fee: number;
  date: GameDate;
  type: "Permanent" | "Loan" | "Free" | "Release";
  wageWeekly: number;
  contractYears: number;
}
