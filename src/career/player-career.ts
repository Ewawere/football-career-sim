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

/** How the player likes to play in their position — shapes attributes */
export type PlayArchetype =
  | "poacher"
  | "target"
  | "complete_forward"
  | "winger"
  | "inside_forward"
  | "playmaker"
  | "box_to_box"
  | "destroyer"
  | "deep_lying"
  | "ball_playing_cb"
  | "stopper"
  | "fullback"
  | "wingback"
  | "sweeper_keeper"
  | "shot_stopper"
  | "balanced";

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
  clubId?: EntityId | string;
  /** Secondary positions the player can cover */
  secondaryPositions?: Position[];
  /** Playing style in the main role */
  playArchetype?: PlayArchetype;
  heightCm?: number;
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

function heightForProfile(profile: PhysicalProfile, explicit?: number): number {
  if (explicit && explicit >= 160 && explicit <= 210) return explicit;
  switch (profile) {
    case "Slight":
      return 172;
    case "Tall":
      return 192;
    case "Powerful":
      return 186;
    case "Athletic":
      return 180;
    default:
      return 178;
  }
}

function applyPositionBias(attrs: ReturnType<typeof createBaseAttributes>, pos: Position) {
  const t = attrs.technical;
  const p = attrs.physical;
  const m = attrs.mental;
  if (["ST", "CF"].includes(pos)) {
    t.finishing = Math.min(99, t.finishing + 8);
    t.heading = Math.min(99, t.heading + 4);
    p.pace = Math.min(99, p.pace + 3);
  } else if (["RW", "LW", "RM", "LM"].includes(pos)) {
    p.pace = Math.min(99, p.pace + 8);
    t.dribbling = Math.min(99, t.dribbling + 6);
    t.crossing = Math.min(99, t.crossing + 5);
  } else if (["CAM", "AM"].includes(pos)) {
    t.passing = Math.min(99, t.passing + 7);
    t.dribbling = Math.min(99, t.dribbling + 5);
    m.vision = Math.min(99, (m as any).vision ?? 50 + 6);
  } else if (["CM", "CDM"].includes(pos)) {
    t.passing = Math.min(99, t.passing + 5);
    t.tackling = Math.min(99, t.tackling + (pos === "CDM" ? 7 : 3));
    m.positioning = Math.min(99, (m as any).positioning ?? 50 + 4);
  } else if (["CB"].includes(pos)) {
    t.tackling = Math.min(99, t.tackling + 8);
    t.heading = Math.min(99, t.heading + 6);
    p.strength = Math.min(99, p.strength + 5);
  } else if (["LB", "RB", "LWB", "RWB"].includes(pos)) {
    p.stamina = Math.min(99, p.stamina + 6);
    t.crossing = Math.min(99, t.crossing + 5);
    t.tackling = Math.min(99, t.tackling + 4);
  } else if (pos === "GK") {
    // GK attrs live in technical/mental depending on schema — boost generically
    t.handling = Math.min(99, ((t as any).handling ?? 50) + 10);
    t.reflexes = Math.min(99, ((t as any).reflexes ?? 50) + 8);
  }
}

function applyArchetype(
  attrs: ReturnType<typeof createBaseAttributes>,
  arch: PlayArchetype
) {
  const t = attrs.technical as any;
  const p = attrs.physical as any;
  const m = attrs.mental as any;
  const bump = (obj: any, key: string, n: number) => {
    if (obj[key] == null) obj[key] = 50;
    obj[key] = Math.min(99, obj[key] + n);
  };

  switch (arch) {
    case "poacher":
      bump(t, "finishing", 10);
      bump(t, "positioning", 6);
      bump(p, "pace", 4);
      break;
    case "target":
      bump(t, "heading", 10);
      bump(p, "strength", 8);
      bump(t, "finishing", 4);
      break;
    case "complete_forward":
      bump(t, "finishing", 6);
      bump(t, "passing", 4);
      bump(t, "dribbling", 4);
      bump(p, "pace", 3);
      break;
    case "winger":
      bump(p, "pace", 10);
      bump(t, "crossing", 8);
      bump(t, "dribbling", 6);
      break;
    case "inside_forward":
      bump(t, "finishing", 7);
      bump(t, "dribbling", 7);
      bump(p, "pace", 5);
      break;
    case "playmaker":
      bump(t, "passing", 10);
      bump(m, "vision", 8);
      bump(t, "dribbling", 4);
      break;
    case "box_to_box":
      bump(p, "stamina", 10);
      bump(t, "passing", 4);
      bump(t, "tackling", 4);
      bump(p, "pace", 3);
      break;
    case "destroyer":
      bump(t, "tackling", 10);
      bump(p, "strength", 6);
      bump(m, "aggression", 6);
      break;
    case "deep_lying":
      bump(t, "passing", 9);
      bump(m, "vision", 7);
      bump(t, "tackling", 3);
      break;
    case "ball_playing_cb":
      bump(t, "passing", 8);
      bump(t, "tackling", 5);
      bump(m, "composure", 5);
      break;
    case "stopper":
      bump(t, "tackling", 9);
      bump(t, "heading", 7);
      bump(p, "strength", 6);
      break;
    case "fullback":
      bump(t, "tackling", 6);
      bump(t, "crossing", 5);
      bump(p, "stamina", 5);
      break;
    case "wingback":
      bump(p, "stamina", 9);
      bump(t, "crossing", 7);
      bump(p, "pace", 5);
      break;
    case "sweeper_keeper":
      bump(t, "kicking", 8);
      bump(t, "handling", 5);
      bump(m, "vision", 4);
      break;
    case "shot_stopper":
      bump(t, "reflexes", 10);
      bump(t, "handling", 8);
      break;
    default:
      bump(t, "passing", 2);
      bump(p, "stamina", 2);
  }
}

function defaultSecondaries(pos: Position): Position[] {
  const map: Partial<Record<Position, Position[]>> = {
    ST: ["CF", "RW"],
    CF: ["ST", "CAM"],
    RW: ["RM", "ST"],
    LW: ["LM", "ST"],
    RM: ["RW", "CM"],
    LM: ["LW", "CM"],
    CAM: ["CM", "RW"],
    CM: ["CDM", "CAM"],
    CDM: ["CM", "CB"],
    CB: ["CDM"],
    LB: ["LWB", "LM"],
    RB: ["RWB", "RM"],
    LWB: ["LB", "LM"],
    RWB: ["RB", "RM"],
    GK: [],
  };
  return (map[pos] || []).slice(0, 2);
}

function defaultArchetype(pos: Position): PlayArchetype {
  if (pos === "ST" || pos === "CF") return "complete_forward";
  if (pos === "RW" || pos === "LW") return "winger";
  if (pos === "CAM") return "playmaker";
  if (pos === "CM") return "box_to_box";
  if (pos === "CDM") return "destroyer";
  if (pos === "CB") return "stopper";
  if (pos === "LB" || pos === "RB") return "fullback";
  if (pos === "LWB" || pos === "RWB") return "wingback";
  if (pos === "GK") return "shot_stopper";
  return "balanced";
}

export function createCareerPlayer(world: World, opts: CareerCreateOptions): CareerPlacement {
  const age = opts.age ?? 17;
  const potential = opts.potential ?? 82;
  let ca = opts.startingAbility ?? Math.min(potential - 12, enforceAgeOvrCap(62, age));
  ca = enforceAgeOvrCap(ca, age);

  const profile = opts.physicalProfile ?? "Athletic";
  const arch = opts.playArchetype ?? defaultArchetype(opts.position);
  const secondaries =
    opts.secondaryPositions?.length ? opts.secondaryPositions : defaultSecondaries(opts.position);

  const attributes = createBaseAttributes(ca);
  applyPositionBias(attributes, opts.position);
  applyArchetype(attributes, arch);

  // Weak foot soft signal via preferred foot (both = more balanced tech)
  if (opts.preferredFoot === "Both") {
    attributes.technical.dribbling = Math.min(99, attributes.technical.dribbling + 2);
    attributes.technical.passing = Math.min(99, attributes.technical.passing + 2);
  }

  let ovr = enforceAgeOvrCap(calculateOVR(attributes, opts.position), age);

  const personality = generatePersonality(world.rng, age);
  const year = 2026 - age;
  const heightCm = heightForProfile(profile, opts.heightCm);

  const player: Player = {
    id: nextId("pl"),
    firstName: opts.firstName,
    lastName: opts.lastName,
    displayName: `${opts.firstName} ${opts.lastName}`,
    nationality: opts.nationality ?? "England",
    dateOfBirth: `${year}-03-15`,
    age,
    heightCm,
    preferredFoot: opts.preferredFoot ?? "Right",
    physicalProfile: profile,
    primaryPosition: opts.position,
    secondaryPositions: secondaries,
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

  // Store archetype for UI / roles
  (player as any).playArchetype = arch;

  if (!(world as any).personalities) (world as any).personalities = new Map();
  (world as any).personalities.set(personality.id, personality);

  const clubs = [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation);
  let club: Club | null = null;

  if (opts.clubId) {
    club = world.clubs.get(opts.clubId as EntityId) ?? null;
  }
  if (!club) {
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
    ? `Signed for ${club.name} as a ${arch.replace(/_/g, " ")} ${opts.position} — ${ovr} OVR / ${potential} POT.`
    : `Created ${player.displayName} as free agent.`;

  return { player, club, reason };
}

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
