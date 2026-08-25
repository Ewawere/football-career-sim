/**
 * Generate personality profiles (seeded).
 */

import { nextId } from "../core/id.js";
import { RNG } from "../core/rng.js";
import type { Personality, PersonalityTraits } from "./types.js";
import { archetypeFromTraits } from "./types.js";

function clamp(n: number): number {
  return Math.max(5, Math.min(95, Math.round(n)));
}

export function generatePersonality(rng: RNG, age = 20): Personality {
  const ageAmb = age <= 21 ? 8 : age >= 30 ? -5 : 0;
  const ageLoy = age >= 28 ? 8 : 0;

  const traits: PersonalityTraits = {
    ambition: clamp(rng.normal(55 + ageAmb, 18)),
    loyalty: clamp(rng.normal(50 + ageLoy, 16)),
    ego: clamp(rng.normal(45, 18)),
    professionalism: clamp(rng.normal(60, 15)),
    temperament: clamp(rng.normal(55, 18)),
    mediaComfort: clamp(rng.normal(50, 20)),
    sportsmanship: clamp(rng.normal(55, 15)),
    leadership: clamp(rng.normal(40 + (age >= 26 ? 10 : 0), 18)),
  };

  if (traits.loyalty > 70 && traits.ambition > 80) {
    traits.ambition = clamp(traits.ambition - rng.int(5, 15));
  }

  return {
    id: nextId("per"),
    traits,
    archetype: archetypeFromTraits(traits),
  };
}

export function createPersonalityFromOptions(
  rng: RNG,
  bias: Partial<PersonalityTraits> = {}
): Personality {
  const base = generatePersonality(rng, 18);
  for (const [k, v] of Object.entries(bias)) {
    if (typeof v === "number" && k in base.traits) {
      (base.traits as any)[k] = Math.max(5, Math.min(95, v));
    }
  }
  base.archetype = archetypeFromTraits(base.traits);
  return base;
}
