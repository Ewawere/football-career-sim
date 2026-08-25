/**
 * Core primitive types used across the entire simulation.
 */

export type EntityId = string;
export type GameDate = string;
export type SeasonId = string;

export type Position =
  | "GK" | "CB" | "LB" | "RB" | "LWB" | "RWB"
  | "CDM" | "CM" | "CAM" | "LM" | "RM"
  | "LW" | "RW" | "CF" | "ST";

export const ALL_POSITIONS: readonly Position[] = [
  "GK", "CB", "LB", "RB", "LWB", "RWB",
  "CDM", "CM", "CAM", "LM", "RM",
  "LW", "RW", "CF", "ST",
] as const;

export type PreferredFoot = "Left" | "Right" | "Both";
export type PhysicalProfile = "Slight" | "Average" | "Athletic" | "Powerful" | "Tall";
export type CompetitionScope = "Domestic" | "Continental" | "International" | "Youth";
export type MatchResult = "W" | "D" | "L";
export type AttributeValue = number;
export type OVR = number;
export type Potential = number;
export type Form = number;
export type Morale = number;
export type Fitness = number;
export type Reputation = number;
export type Money = number;
export type Seed = number;
