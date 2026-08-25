/**
 * Player personality traits — influence decisions, press, transfers, training.
 * Values 0–100.
 */

import type { EntityId } from "../core/types.js";

export interface PersonalityTraits {
  ambition: number;
  loyalty: number;
  ego: number;
  professionalism: number;
  temperament: number;
  mediaComfort: number;
  sportsmanship: number;
  leadership: number;
}

export interface Personality {
  id: EntityId;
  traits: PersonalityTraits;
  archetype: PersonalityArchetype;
}

export type PersonalityArchetype =
  | "Professional"
  | "AmbitiousStar"
  | "ClubMan"
  | "Temperamental"
  | "MediaSavvy"
  | "QuietWorker"
  | "Leader"
  | "VolatileTalent";

export function archetypeFromTraits(t: PersonalityTraits): PersonalityArchetype {
  if (t.ambition >= 75 && t.ego >= 65) return "AmbitiousStar";
  if (t.loyalty >= 75 && t.ambition <= 50) return "ClubMan";
  if (t.temperament <= 35) return "Temperamental";
  if (t.temperament <= 40 && t.ego >= 60) return "VolatileTalent";
  if (t.mediaComfort >= 75) return "MediaSavvy";
  if (t.leadership >= 70) return "Leader";
  if (t.professionalism >= 75 && t.mediaComfort <= 45) return "QuietWorker";
  return "Professional";
}
