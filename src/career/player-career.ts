/**
 * Player Career Mode: create and place a user player realistically.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { Position, PreferredFoot, PhysicalProfile } from "../core/types.js";
import { createEmptyState, type Player } from "../players/player.js";
import { calculateOVR, createBaseAttributes } from "../players/attributes.js";
import { enforceAgeOvrCap } from "../transfers/squad-rules.js";
import { generatePersonality } from "../personality/generation.js";
import type { Club } from "../clubs/club.js";

export interface CareerCreateOptions {
  firstName: string;
  lastName: string;
  position: Position;
  preferredFoot?: PreferredFoot;
  nationality?: string;
  age?: number;
  physicalProfile?: PhysicalProfile;
  potential?: number;
  startingAbility?: number;
}

export interface CareerPlacement {
  player: Player;
  club: Club | null;
  reason: string;
}

export function createCareerPlayer(world: World, opts: CareerCreateOptions): CareerPlacement {
  const age = opts.age ?? 17;
  const potential = opts.potential ?? 82;
  let ca = opts.startingAbility ?? Math.min(potential - 12, enforceAgeOvrCap(62, age));
  ca = enforceAgeOvrCap(ca, age);

  const attributes = createBaseAttributes(ca);
  // Bias for position
  if (["ST", "CF", "RW", "LW"].includes(opts.position)) {
    attributes.technical.finishing = Math.min(99, attributes.technical.finishing + 8);
    attributes.physical.pace = Math.min(99, attributes.physical.pace + 6);
  }
  let ovr = enforceAgeOvrCap(calculateOVR(attributes, opts.position), age);

  const personality = generatePersonality(world.rng, age);
  const year = 2026 - age;

  const player: Player = {
    id: nextId("pl"),
    firstName: opts.firstName,
    lastName: opts.lastName,
    displayName: `${opts.firstName} ${opts.lastName}`,
    nationality: opts.nationality ?? "England",
    dateOfBirth: `${year}-03-15`,
    age,
    heightCm: 178,
    preferredFoot: opts.preferredFoot ?? "Right",
    physicalProfile: opts.physicalProfile ?? "Athletic",
    primaryPosition: opts.position,
    secondaryPositions: [],
    attributes,
    ovr,
    potential,
    currentClubId: null,
    contract: null,
    state: createEmptyState(),
    reputation: Math.round(ovr * 0.5),
    isUserControlled: true,
    careerAppearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerTrophies: 0,
    injuryIds: [],
    personalityId: personality.id,
    retired: false,
    retirementDate: null,
  };

  if (!(world as any).personalities) (world as any).personalities = new Map();
  (world as any).personalities.set(personality.id, personality);

  // Place at a mid-table club where youth can break through
  const clubs = [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation);
  const mid = clubs.filter((c) => c.reputation >= 55 && c.reputation <= 75);
  const club = mid[Math.floor(mid.length / 2)] ?? clubs[Math.floor(clubs.length / 2)] ?? null;

  if (club) {
    player.currentClubId = club.id;
    player.contract = {
      clubId: club.id,
      wage: Math.max(500, Math.round(ovr * ovr * 3)),
      startDate: world.calendar.currentDate,
      endDate: `${parseInt(world.calendar.currentDate.slice(0, 4), 10) + 3}-06-30`,
      releaseClause: Math.round(estimateSimpleValue(ovr, potential, age)),
      signedDate: world.calendar.currentDate,
    };
    club.squadPlayerIds.push(player.id);
    club.finances.currentWageBillWeekly += player.contract.wage;
  }

  world.players.set(player.id, player);
  world.userPlayerId = player.id;

  const reason = club
    ? `Placed ${player.displayName} (${ovr} OVR / ${potential} POT) at ${club.name} (rep ${club.reputation}) as a prospect.`
    : `Created ${player.displayName} as free agent.`;

  return { player, club, reason };
}

function estimateSimpleValue(ovr: number, pot: number, age: number): number {
  let v = Math.pow(ovr, 2) * 200;
  if (age <= 21) v *= 1 + (pot - ovr) * 0.03;
  return Math.round(v / 10000) * 10000;
}
