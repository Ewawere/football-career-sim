/**
 * Core Player entity.
 * Pure data + derived helpers. No UI.
 */

import type {
  EntityId,
  Position,
  PreferredFoot,
  PhysicalProfile,
  OVR,
  Potential,
  Form,
  Morale,
  Fitness,
  Reputation,
  GameDate,
} from "../core/types.js";
import type { PlayerAttributes } from "./attributes.js";
import { calculateOVR } from "./attributes.js";

export interface PlayerContract {
  clubId: EntityId | null;
  wage: number;
  startDate: GameDate;
  endDate: GameDate;
  releaseClause: number | null;
  signedDate: GameDate;
}

export interface PlayerState {
  form: Form;
  morale: Morale;
  fitness: Fitness;
  sharpness: number;
  fatigue: number;
  matchMinutesThisSeason: number;
  appearancesThisSeason: number;
  goalsThisSeason: number;
  assistsThisSeason: number;
  cleanSheetsThisSeason: number;
  yellowCardsThisSeason: number;
  redCardsThisSeason: number;
  averageRatingThisSeason: number;
  ratingCount: number;
  managerTrust: number;
}

export interface Player {
  id: EntityId;
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: string;
  dateOfBirth: GameDate;
  age: number;
  heightCm: number;
  preferredFoot: PreferredFoot;
  physicalProfile: PhysicalProfile;
  primaryPosition: Position;
  secondaryPositions: Position[];
  attributes: PlayerAttributes;
  ovr: OVR;
  potential: Potential;
  currentClubId: EntityId | null;
  contract: PlayerContract | null;
  state: PlayerState;
  reputation: Reputation;
  isUserControlled: boolean;
  careerAppearances: number;
  careerGoals: number;
  careerAssists: number;
  careerTrophies: number;
  injuryIds: EntityId[];
  personalityId: EntityId | null;
  retired: boolean;
  retirementDate: GameDate | null;
}

export function fullName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function recomputeOVR(p: Player): void {
  p.ovr = calculateOVR(p.attributes, p.primaryPosition);
}

export function createEmptyState(): PlayerState {
  return {
    form: 50,
    morale: 60,
    fitness: 100,
    sharpness: 70,
    fatigue: 0,
    matchMinutesThisSeason: 0,
    appearancesThisSeason: 0,
    goalsThisSeason: 0,
    assistsThisSeason: 0,
    cleanSheetsThisSeason: 0,
    yellowCardsThisSeason: 0,
    redCardsThisSeason: 0,
    averageRatingThisSeason: 0,
    ratingCount: 0,
    managerTrust: 50,
  };
}

export function applyMatchRating(
  p: Player,
  rating: number,
  minutes: number,
  goals = 0,
  assists = 0,
  cleanSheet = false
): void {
  p.state.appearancesThisSeason += 1;
  p.state.matchMinutesThisSeason += minutes;
  p.state.goalsThisSeason += goals;
  p.state.assistsThisSeason += assists;
  if (cleanSheet && minutes >= 60) p.state.cleanSheetsThisSeason += 1;
  p.careerAppearances += 1;
  p.careerGoals += goals;
  p.careerAssists += assists;

  const n = p.state.ratingCount;
  p.state.averageRatingThisSeason =
    n === 0 ? rating : (p.state.averageRatingThisSeason * n + rating) / (n + 1);
  p.state.ratingCount = n + 1;

  const formDelta = (rating - 50) * 0.15;
  p.state.form = Math.max(0, Math.min(100, p.state.form + formDelta));
}
