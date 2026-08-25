/**
 * Club entity and basic AI strategy flags.
 */

import type {
  EntityId,
  Reputation,
  Money,
  GameDate,
} from "../core/types.js";

export type TransferPhilosophy =
  | "DevelopAndSell"
  | "BuyStars"
  | "Balanced"
  | "YouthFocused"
  | "BargainHunt"
  | "FinanciallyCautious";

export type TacticalIdentity =
  | "Possession"
  | "CounterAttack"
  | "HighPress"
  | "Direct"
  | "Balanced"
  | "Defensive";

export interface ClubFinances {
  transferBudget: Money;
  wageBudgetWeekly: Money;
  currentWageBillWeekly: Money;
  balance: Money;
  revenueSeason: Money;
  expensesSeason: Money;
}

export interface ClubObjectives {
  leaguePositionMin: number;
  europeanQualification: boolean;
  cupRun: boolean;
  developYouth: boolean;
  financialFairPlay: boolean;
}

export interface Club {
  id: EntityId;
  name: string;
  shortName: string;
  nation: string;
  city: string;
  reputation: Reputation;
  leagueId: EntityId | null;
  stadiumName: string;
  stadiumCapacity: number;
  finances: ClubFinances;
  transferPhilosophy: TransferPhilosophy;
  tacticalIdentity: TacticalIdentity;
  youthFocus: number;
  riskTolerance: number;
  managerId: EntityId | null;
  squadPlayerIds: EntityId[];
  academyPlayerIds: EntityId[];
  objectives: ClubObjectives;
  trainingFacilities: number;
  youthFacilities: number;
  foundedYear: number;
}

export function createDefaultFinances(reputation: number): ClubFinances {
  const scale = Math.pow(reputation / 50, 1.8);
  return {
    transferBudget: Math.round(8_000_000 * scale),
    wageBudgetWeekly: Math.round(2_500_000 * scale),
    currentWageBillWeekly: 0,
    balance: Math.round(40_000_000 * scale),
    revenueSeason: 0,
    expensesSeason: 0,
  };
}

export function createDefaultObjectives(reputation: number): ClubObjectives {
  if (reputation >= 85) {
    return { leaguePositionMin: 1, europeanQualification: true, cupRun: true, developYouth: false, financialFairPlay: true };
  }
  if (reputation >= 70) {
    return { leaguePositionMin: 4, europeanQualification: true, cupRun: true, developYouth: true, financialFairPlay: true };
  }
  if (reputation >= 55) {
    return { leaguePositionMin: 10, europeanQualification: false, cupRun: false, developYouth: true, financialFairPlay: true };
  }
  return { leaguePositionMin: 17, europeanQualification: false, cupRun: false, developYouth: true, financialFairPlay: true };
}
