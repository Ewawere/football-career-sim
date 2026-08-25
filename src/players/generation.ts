/**
 * Generate players and squads.
 */

import { nextId } from "../core/id.js";
import type { RNG } from "../core/rng.js";
import type { EntityId, Position, GameDate, PreferredFoot, PhysicalProfile } from "../core/types.js";
import { createEmptyState, type Player } from "./player.js";
import {
  calculateOVR,
  createBaseAttributes,
  type PlayerAttributes,
} from "./attributes.js";
import { enforceAgeOvrCap, maxOvrForAge } from "../transfers/squad-rules.js";
import { generatePersonality } from "../personality/generation.js";

const FIRST_NAMES = [
  "James", "Oliver", "Jack", "Harry", "Leo", "Noah", "Lucas", "Ethan", "Mason", "Logan",
  "Liam", "Alex", "Marcus", "Jordan", "Ryan", "Kyle", "Tyler", "Dylan", "Connor", "Ben",
];
const LAST_NAMES = [
  "Smith", "Jones", "Williams", "Brown", "Taylor", "Wilson", "Moore", "Anderson", "Thomas", "Jackson",
  "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Lewis", "Lee",
];

const POSITIONS: Position[] = [
  "GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST",
];

function clamp(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

function attrsAround(base: number, rng: RNG, spread = 8): PlayerAttributes {
  const a = createBaseAttributes(base);
  const jitter = (v: number) => clamp(v + rng.int(-spread, spread));
  for (const k of Object.keys(a.technical) as (keyof typeof a.technical)[]) {
    a.technical[k] = jitter(a.technical[k]);
  }
  for (const k of Object.keys(a.physical) as (keyof typeof a.physical)[]) {
    a.physical[k] = jitter(a.physical[k]);
  }
  for (const k of Object.keys(a.mental) as (keyof typeof a.mental)[]) {
    a.mental[k] = jitter(a.mental[k]);
  }
  return a;
}

export function generatePlayer(
  rng: RNG,
  opts: {
    age?: number;
    primaryPosition?: Position;
    clubId?: EntityId | null;
    potentialTarget?: number;
    currentAbilityTarget?: number;
  } = {}
): Player {
  const age = opts.age ?? rng.int(17, 32);
  const primary = opts.primaryPosition ?? rng.pick(POSITIONS);
  let potential = opts.potentialTarget ?? clamp(rng.normal(age <= 21 ? 74 : 68, 9));
  potential = Math.min(potential, age >= 30 ? 78 : 94);
  let ca = opts.currentAbilityTarget ?? clamp(potential - rng.int(0, Math.max(4, 30 - age)));
  ca = enforceAgeOvrCap(ca, age);

  const attributes = attrsAround(ca, rng);
  let ovr = enforceAgeOvrCap(calculateOVR(attributes, primary), age);

  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);
  const year = 2026 - age;
  const dob: GameDate = `${year}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;

  const personality = generatePersonality(rng, age);

  const player: Player = {
    id: nextId("pl"),
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    nationality: rng.pick(["England", "Spain", "France", "Germany", "Brazil", "Nigeria", "Portugal"]),
    dateOfBirth: dob,
    age,
    heightCm: 170 + rng.int(0, 25),
    preferredFoot: rng.pick(["Right", "Left", "Right", "Right", "Both"] as PreferredFoot[]),
    physicalProfile: rng.pick(["Slight", "Average", "Athletic", "Powerful", "Tall"] as PhysicalProfile[]),
    primaryPosition: primary,
    secondaryPositions: [],
    attributes,
    ovr,
    potential,
    currentClubId: opts.clubId ?? null,
    contract: null,
    state: createEmptyState(),
    reputation: Math.round(ovr * 0.7),
    isUserControlled: false,
    careerAppearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerTrophies: 0,
    injuryIds: [],
    personalityId: personality.id,
    retired: false,
    retirementDate: null,
  };
  (player as any)._pendingPersonality = personality;
  return player;
}

export function generateSquad(
  rng: RNG,
  clubId: EntityId,
  targetOVR: number,
  size = 24
): Player[] {
  const squad: Player[] = [];
  const need: Position[] = [
    "GK", "GK",
    "CB", "CB", "CB", "CB",
    "LB", "LB", "RB", "RB",
    "CDM", "CM", "CM", "CM", "CAM",
    "LW", "RW", "LW",
    "ST", "ST", "ST",
    "CM", "CB", "RB",
  ];
  for (let i = 0; i < size; i++) {
    const pos = need[i] ?? rng.pick(POSITIONS);
    const age = i < 3 ? rng.int(28, 33) : i > 18 ? rng.int(17, 21) : rng.int(20, 29);
    const ca = clamp(targetOVR + rng.int(-8, 6));
    squad.push(
      generatePlayer(rng, {
        age,
        primaryPosition: pos,
        clubId,
        currentAbilityTarget: ca,
        potentialTarget: clamp(ca + rng.int(2, 12)),
      })
    );
  }
  return squad;
}
