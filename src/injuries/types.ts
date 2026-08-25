/**
 * Injury type definitions.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type InjurySeverity = "Minor" | "Moderate" | "Severe";
export type BodyArea =
  | "General"
  | "Thigh"
  | "Hamstring"
  | "Ankle"
  | "Groin"
  | "Calf"
  | "Knee"
  | "Foot"
  | "Head";

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
  recoveryDays: [number, number];
  weight: number;
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
}

export const INJURY_DEFINITIONS: InjuryDefinition[] = [
  { typeId: "Knock", name: "Knock", severity: "Minor", bodyArea: "General", recoveryDays: [1, 5], weight: 28, forcesWithdrawal: false, recurrenceMultiplier: 1.1 },
  { typeId: "Bruise", name: "Bruise", severity: "Minor", bodyArea: "General", recoveryDays: [2, 7], weight: 18, forcesWithdrawal: false, recurrenceMultiplier: 1.0 },
  { typeId: "MinorMuscle", name: "Minor muscle issue", severity: "Minor", bodyArea: "Thigh", recoveryDays: [3, 10], weight: 16, forcesWithdrawal: true, recurrenceMultiplier: 1.2 },
  { typeId: "HamstringStrain", name: "Hamstring strain", severity: "Moderate", bodyArea: "Hamstring", recoveryDays: [14, 35], weight: 10, forcesWithdrawal: true, recurrenceMultiplier: 1.5 },
  { typeId: "AnkleSprain", name: "Ankle sprain", severity: "Moderate", bodyArea: "Ankle", recoveryDays: [10, 28], weight: 10, forcesWithdrawal: true, recurrenceMultiplier: 1.4 },
  { typeId: "GroinStrain", name: "Groin strain", severity: "Moderate", bodyArea: "Groin", recoveryDays: [12, 30], weight: 8, forcesWithdrawal: true, recurrenceMultiplier: 1.3 },
  { typeId: "CalfStrain", name: "Calf strain", severity: "Moderate", bodyArea: "Calf", recoveryDays: [10, 25], weight: 8, forcesWithdrawal: true, recurrenceMultiplier: 1.35 },
  { typeId: "KneeLigament", name: "Knee ligament injury", severity: "Severe", bodyArea: "Knee", recoveryDays: [90, 240], weight: 2, forcesWithdrawal: true, recurrenceMultiplier: 1.8 },
  { typeId: "Fracture", name: "Fracture", severity: "Severe", bodyArea: "Foot", recoveryDays: [42, 120], weight: 1.5, forcesWithdrawal: true, recurrenceMultiplier: 1.2 },
  { typeId: "SeriousMuscle", name: "Serious muscle injury", severity: "Severe", bodyArea: "Thigh", recoveryDays: [45, 90], weight: 2.5, forcesWithdrawal: true, recurrenceMultiplier: 1.6 },
  { typeId: "Concussion", name: "Concussion", severity: "Moderate", bodyArea: "Head", recoveryDays: [7, 21], weight: 3, forcesWithdrawal: true, recurrenceMultiplier: 1.7 },
];
