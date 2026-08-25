/**
 * Injury definitions and instance types.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type InjurySeverity = "Minor" | "Moderate" | "Severe";
export type BodyArea =
  | "Ankle"
  | "Knee"
  | "Hamstring"
  | "Groin"
  | "Calf"
  | "Thigh"
  | "Shoulder"
  | "Head"
  | "Back"
  | "Foot"
  | "Hip"
  | "Other";

export interface InjuryDefinition {
  typeId: string;
  name: string;
  severity: InjurySeverity;
  bodyArea: BodyArea;
  recoveryDays: [number, number];
  weight: number;
  recurrenceMultiplier: number;
  forcesWithdrawal: boolean;
}

export interface Injury {
  id: EntityId;
  playerId: EntityId;
  typeId: string;
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
  { typeId: "knock", name: "Knock", severity: "Minor", bodyArea: "Other", recoveryDays: [1, 5], weight: 28, recurrenceMultiplier: 1.0, forcesWithdrawal: false },
  { typeId: "bruise", name: "Bruise", severity: "Minor", bodyArea: "Thigh", recoveryDays: [2, 7], weight: 18, recurrenceMultiplier: 1.0, forcesWithdrawal: false },
  { typeId: "minor_muscle", name: "Minor muscle issue", severity: "Minor", bodyArea: "Hamstring", recoveryDays: [5, 12], weight: 14, recurrenceMultiplier: 1.2, forcesWithdrawal: true },
  { typeId: "ankle_sprain", name: "Ankle sprain", severity: "Moderate", bodyArea: "Ankle", recoveryDays: [14, 35], weight: 10, recurrenceMultiplier: 1.3, forcesWithdrawal: true },
  { typeId: "hamstring", name: "Hamstring strain", severity: "Moderate", bodyArea: "Hamstring", recoveryDays: [18, 45], weight: 9, recurrenceMultiplier: 1.5, forcesWithdrawal: true },
  { typeId: "groin", name: "Groin strain", severity: "Moderate", bodyArea: "Groin", recoveryDays: [14, 40], weight: 8, recurrenceMultiplier: 1.4, forcesWithdrawal: true },
  { typeId: "calf", name: "Calf strain", severity: "Moderate", bodyArea: "Calf", recoveryDays: [12, 30], weight: 7, recurrenceMultiplier: 1.3, forcesWithdrawal: true },
  { typeId: "acl", name: "ACL injury", severity: "Severe", bodyArea: "Knee", recoveryDays: [180, 300], weight: 1.5, recurrenceMultiplier: 1.8, forcesWithdrawal: true },
  { typeId: "fracture", name: "Fracture", severity: "Severe", bodyArea: "Foot", recoveryDays: [60, 120], weight: 2, recurrenceMultiplier: 1.2, forcesWithdrawal: true },
  { typeId: "serious_muscle", name: "Serious muscle tear", severity: "Severe", bodyArea: "Thigh", recoveryDays: [50, 90], weight: 2.5, recurrenceMultiplier: 1.6, forcesWithdrawal: true },
];
