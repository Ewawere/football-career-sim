/**
 * Player Career Mode: create and place a user player realistically.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { Position, PreferredFoot, PhysicalProfile, EntityId } from "../core/types.js";
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
  /** If set, place at this club instead of auto mid-table */
  clubId?: EntityId | string;
}

export interface CareerPlacement {
  player: Player;
  club: Club | null;
  reason: string;
}

export function listStarterClubs(world: World): Array<{
  id: string;
  name: string;
  nation: string;
  reputation: number;
  city: string;
}> {
  return [...world.clubs.values()]
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => ({
      id: c.id,
      name: c.name,
      nation: c.nation,
      reputation: c.reputation,
      city: c.city,
    }));
}

export function createCareerPlayer(world: World, opts: CareerCreateOptions): CareerPlacement {
  const age = opts.age ?? 17;
  const potential = opts.potential ?? 82;
  let ca = opts.startingAbility ?? Math.min(potential - 12, enforceAgeOvrCap(62, age));
  ca = enforceAgeOvrCap(ca, age);

  const attributes = createBaseAttributes(ca);
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

  const clubs = [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation);
  let club: Club | null = null;

  if (opts.clubId) {
    club = world.clubs.get(opts.clubId as EntityId) ?? null;
  }
  if (!club) {
    // Prefer mid-table for a realistic youth breakthrough story
    const mid = clubs.filter((c) => c.reputation >= 55 && c.reputation <= 78);
    club = mid[Math.floor(mid.length / 2)] ?? clubs[Math.floor(clubs.length / 2)] ?? null;
  }

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
    ? `Signed for ${club.name} (${club.nation}, rep ${club.reputation}) as a prospect — ${ovr} OVR / ${potential} POT.`
    : `Created ${player.displayName} as free agent.`;

  return { player, club, reason };
}

/** Move user to another club before they've played (starter switch). */
export function reassignStarterClub(world: World, clubId: string): CareerPlacement | null {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  const newClub = world.clubs.get(clubId as EntityId);
  if (!player || !newClub) return null;
  if (player.careerAppearances > 0) return null;

  const oldId = player.currentClubId;
  if (oldId) {
    const old = world.clubs.get(oldId);
    if (old) {
      old.squadPlayerIds = old.squadPlayerIds.filter((id) => id !== pid);
      if (player.contract) {
        old.finances.currentWageBillWeekly = Math.max(
          0,
          old.finances.currentWageBillWeekly - (player.contract.wage ?? 0)
        );
      }
    }
  }

  player.currentClubId = newClub.id;
  const wage = player.contract?.wage ?? Math.max(500, Math.round(player.ovr * player.ovr * 3));
  player.contract = {
    clubId: newClub.id,
    wage,
    startDate: world.calendar.currentDate,
    endDate: `${parseInt(world.calendar.currentDate.slice(0, 4), 10) + 3}-06-30`,
    releaseClause: player.contract?.releaseClause ?? null,
    signedDate: world.calendar.currentDate,
  };
  if (!newClub.squadPlayerIds.includes(pid)) newClub.squadPlayerIds.push(pid);
  newClub.finances.currentWageBillWeekly += wage;

  return {
    player,
    club: newClub,
    reason: `Moved to ${newClub.name} before the season started.`,
  };
}

function estimateSimpleValue(ovr: number, pot: number, age: number): number {
  let v = Math.pow(ovr, 2) * 200;
  if (age <= 21) v *= 1 + (pot - ovr) * 0.03;
  return Math.round(v / 10000) * 10000;
}
