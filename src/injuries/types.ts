/**
 * Injury domain types.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type InjurySeverity = "Minor" | "Moderate" | "Severe";

export type BodyArea =
  | "Head"
  | "Shoulder"
  | "Arm"
  | "Hand"
  | "Ribs"
  | "Back"
  | "Hip"
  | "Groin"
  | "Thigh"
  | "Hamstring"
  | "Knee"
  | "Calf"
  | "Ankle"
  | "Foot"
  | "General";

export type InjuryTypeId =
  | "Knock"
  | "Bruise"
  | "MinorMuscle"
  | "HamstringStrain"
  | "AnkleSprain"
  | "GroinStrain"
  | "CalfStrain"
  | "KneeLigament"
  | "Fracture"
  | "SeriousMuscle"
  | "Concussion";

export interface InjuryDefinition {
  typeId: InjuryTypeId;
  name: string;
  severity: InjurySeverity;
  bodyArea: BodyArea;
  /** Base recovery days (min, max) */
  recoveryDays: [number, number];
  /** Base probability weight when an injury event fires */
  weight: number;
  /** Whether player must leave the match immediately */
  forcesWithdrawal: boolean;
  recurrenceMultiplier: number;
}

export interface Injury {
  id: EntityId;
  playerId: EntityId;
  typeId: InjuryTypeId;
  name: string;
  severity: InjurySeverity;
  bodyArea: BodyArea;
  occurredDate: GameDate;
  occurredMatchId: EntityId | null;
  recoveryDaysTotal: number;
  recoveryDaysRemaining: number;
  active: boolean;
  forcesWithdrawal: boolean;
  /** Date cleared medically (null while active) */
  returnedDate: GameDate | null;
  /**
   * Residual performance penalty 0–1 after return.
   * Decays each day / after minutes played.
   */
  comebackPenalty: number;
  /** Match minutes played since return */
  minutesSinceReturn: number;
}

export const INJURY_DEFINITIONS: InjuryDefinition[] = [
  { typeId: "Knock", name: "Knock", severity: "Minor", bodyArea: "General", recoveryDays: [1, 5], weight: 28, forcesWithdrawal: false, recurrenceMultiplier: 1.1 },
  { typeId: "Bruise", name: "Bruise", severity: "Minor", bodyArea: "General", recoveryDays: [2, 7], weight: 18, forcesWithdrawal: false, recurrenceMultiplier: 1.0 },
  { typeId: "MinorMuscle", name: "Minor muscle strain", severity: "Minor", bodyArea: "Thigh", recoveryDays: [5, 14], weight: 14, forcesWithdrawal: true, recurrenceMultiplier: 1.25 },
  { typeId: "HamstringStrain", name: "Hamstring strain", severity: "Moderate", bodyArea: "Hamstring", recoveryDays: [14, 42], weight: 10, forcesWithdrawal: true, recurrenceMultiplier: 1.5 },
  { typeId: "AnkleSprain", name: "Ankle sprain", severity: "Moderate", bodyArea: "Ankle", recoveryDays: [10, 35], weight: 10, forcesWithdrawal: true, recurrenceMultiplier: 1.35 },
  { typeId: "GroinStrain", name: "Groin strain", severity: "Moderate", bodyArea: "Groin", recoveryDays: [12, 40], weight: 8, forcesWithdrawal: true, recurrenceMultiplier: 1.4 },
  { typeId: "CalfStrain", name: "Calf strain", severity: "Moderate", bodyArea: "Calf", recoveryDays: [10, 25], weight: 8, forcesWithdrawal: true, recurrenceMultiplier: 1.35 },
  { typeId: "KneeLigament", name: "Knee ligament injury", severity: "Severe", bodyArea: "Knee", recoveryDays: [90, 240], weight: 2, forcesWithdrawal: true, recurrenceMultiplier: 1.8 },
  { typeId: "Fracture", name: "Fracture", severity: "Severe", bodyArea: "Foot", recoveryDays: [42, 120], weight: 1.5, forcesWithdrawal: true, recurrenceMultiplier: 1.2 },
  { typeId: "SeriousMuscle", name: "Serious muscle injury", severity: "Severe", bodyArea: "Thigh", recoveryDays: [45, 90], weight: 2.5, forcesWithdrawal: true, recurrenceMultiplier: 1.6 },
  { typeId: "Concussion", name: "Concussion", severity: "Moderate", bodyArea: "Head", recoveryDays: [7, 21], weight: 3, forcesWithdrawal: true, recurrenceMultiplier: 1.7 },
];
