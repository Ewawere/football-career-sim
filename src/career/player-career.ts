/**
 * Player Career Mode: create a user-controlled player and place them
 * into a realistically appropriate club/pathway.
 */

import { RNG } from "../core/rng.js";
import { nextId } from "../core/id.js";
import type {
  EntityId,
  Position,
  PreferredFoot,
  PhysicalProfile,
  GameDate,
} from "../core/types.js";
import type { World } from "../world/world.js";
import { addPlayer } from "../world/world.js";
import type { Player, PlayerContract } from "../players/player.js";
import { assignStartingPlayStyles } from "../players/playstyles.js";
import { createEmptyState, recomputeOVR } from "../players/player.js";
import type { PlayerAttributes } from "../players/attributes.js";
import { calculateOVR } from "../players/attributes.js";
import type { Club } from "../clubs/club.js";
import { createPersonalityFromOptions } from "../personality/generation.js";
import { assignAgent } from "../relationships/agent.js";

export interface PlayerCreationOptions {
  firstName: string;
  lastName: string;
  position: Position;
  preferredFoot: PreferredFoot;
  nationality: string;
  age: number;
  physicalProfile: PhysicalProfile;
  startingAbility?: number;
  potential?: number;
  heightCm?: number;
  preferredClubId?: string;
  playArchetype?: string;
}

export type CareerPathway =
  | "EliteAcademy"
  | "MidAcademy"
  | "LowerLeague"
  | "YouthOnly";

export interface PlacementResult {
  player: Player;
  club: Club | null;
  pathway: CareerPathway;
  role: SelectionRole;
  reason: string;
}

export type SelectionRole =
  | "Academy"
  | "Reserve"
  | "Bench"
  | "Rotation"
  | "Starter"
  | "KeyPlayer"
  | "Injured"
  | "Suspended";

function clamp(n: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function generateAttributesFromAbility(
  rng: RNG,
  pos: Position,
  ca: number
): PlayerAttributes {
  const noise = () => rng.normal(0, 5);
  const tech = {
    finishing: clamp(ca + noise()),
    passing: clamp(ca + noise()),
    crossing: clamp(ca + noise()),
    dribbling: clamp(ca + noise()),
    ballControl: clamp(ca + noise()),
    longShots: clamp(ca + noise()),
    heading: clamp(ca + noise()),
    setPieces: clamp(ca + noise() - 5),
    tackling: clamp(ca + noise()),
    marking: clamp(ca + noise()),
  };
  const phys = {
    pace: clamp(ca + noise()),
    acceleration: clamp(ca + noise()),
    strength: clamp(ca + noise()),
    stamina: clamp(ca + noise()),
    agility: clamp(ca + noise()),
    jumping: clamp(ca + noise()),
    balance: clamp(ca + noise()),
  };
  const ment = {
    vision: clamp(ca + noise()),
    composure: clamp(ca + noise()),
    decisions: clamp(ca + noise()),
    positioning: clamp(ca + noise()),
    reactions: clamp(ca + noise()),
    workRate: clamp(ca + noise()),
    anticipation: clamp(ca + noise()),
    aggression: clamp(ca + noise()),
    leadership: clamp(ca + noise() - 10),
  };

  const boost = (o: Record<string, number>, k: string, a: number) => {
    if (k in o) o[k] = clamp(o[k]! + a);
  };
  if (pos === "ST" || pos === "CF") {
    boost(tech, "finishing", 8);
    boost(ment, "composure", 5);
  } else if (pos === "CAM") {
    boost(tech, "passing", 6);
    boost(ment, "vision", 8);
  } else if (["LW", "RW"].includes(pos)) {
    boost(phys, "pace", 8);
    boost(tech, "dribbling", 6);
  } else if (pos === "CB") {
    boost(tech, "marking", 8);
    boost(tech, "tackling", 6);
    boost(phys, "strength", 5);
  } else if (pos === "GK") {
    boost(ment, "positioning", 10);
    boost(ment, "reactions", 10);
  }

  return { technical: tech, physical: phys, mental: ment };
}

export function defaultStartingAbility(age: number, potential: number, rng: RNG): number {
  const ageBase = 40 + age * 1.2;
  const potBonus = (potential - 70) * 0.25;
  return clamp(ageBase + potBonus + rng.normal(0, 3), 40, 78);
}

export function findEligibleClubs(
  world: World,
  ovr: number,
  potential: number,
  age: number,
  position: Position
): { club: Club; pathway: CareerPathway; role: SelectionRole; score: number }[] {
  const results: { club: Club; pathway: CareerPathway; role: SelectionRole; score: number }[] = [];

  for (const club of world.clubs.values()) {
    const squad = club.squadPlayerIds
      .map((id) => world.players.get(id)!)
      .filter((p) => p && !p.retired);

    const posPlayers = squad.filter(
      (p) => p.primaryPosition === position || p.secondaryPositions.includes(position)
    );
    const posDepth = posPlayers.length;
    const avgPosOVR =
      posDepth > 0
        ? posPlayers.reduce((s, p) => s + p.ovr, 0) / posDepth
        : club.reputation * 0.9;

    if (club.reputation >= 82) {
      if (age <= 19 && potential >= 78) {
        results.push({
          club,
          pathway: "EliteAcademy",
          role: "Academy",
          score: potential * 0.6 + (100 - club.reputation) * 0.2 + world.rng.float(0, 5),
        });
      } else if (age <= 21 && ovr >= avgPosOVR - 5 && potential >= 82) {
        results.push({
          club,
          pathway: "EliteAcademy",
          role: "Reserve",
          score: ovr * 0.4 + potential * 0.4,
        });
      }
      continue;
    }

    if (club.reputation >= 70) {
      if (age <= 20 && potential >= 72) {
        results.push({
          club,
          pathway: "MidAcademy",
          role: ovr >= avgPosOVR - 8 ? "Reserve" : "Academy",
          score: potential * 0.5 + ovr * 0.3 + (75 - Math.abs(club.reputation - 74)),
        });
      }
      if (ovr >= avgPosOVR - 3 && age >= 18) {
        results.push({
          club,
          pathway: "MidAcademy",
          role: ovr >= avgPosOVR ? "Rotation" : "Bench",
          score: ovr * 0.6 + potential * 0.2,
        });
      }
      continue;
    }

    if (ovr >= avgPosOVR - 10) {
      let role: SelectionRole = "Bench";
      if (ovr >= avgPosOVR + 3) role = "Starter";
      else if (ovr >= avgPosOVR - 2) role = "Rotation";
      else if (age <= 19) role = "Reserve";

      results.push({
        club,
        pathway: "LowerLeague",
        role,
        score: ovr * 0.5 + (70 - club.reputation) * 0.3 + (posDepth < 3 ? 10 : 0),
      });
    } else if (age <= 18 && potential >= 65) {
      results.push({
        club,
        pathway: "LowerLeague",
        role: "Academy",
        score: potential * 0.4 + 20,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function createCareerPlayer(
  world: World,
  opts: PlayerCreationOptions
): PlacementResult {
  const rng = world.rng;
  const age = Math.max(15, Math.min(23, opts.age));
  const potential = clamp(opts.potential ?? rng.int(68, 88), 55, 95);
  const ca =
    opts.startingAbility ??
    defaultStartingAbility(age, potential, rng);

  const attrs = generateAttributesFromAbility(rng, opts.position, ca);
  const ovr = calculateOVR(attrs, opts.position);

  const year = 2026 - age;
  const dob: GameDate = `${year}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;

  const player: Player = {
    id: nextId("plr"),
    firstName: opts.firstName,
    lastName: opts.lastName,
    displayName: `${opts.firstName} ${opts.lastName}`,
    nationality: opts.nationality,
    dateOfBirth: dob,
    age,
    heightCm: opts.heightCm ?? (opts.physicalProfile === "Tall" ? 188 : opts.physicalProfile === "Slight" ? 172 : 178),
    preferredFoot: opts.preferredFoot,
    physicalProfile: opts.physicalProfile,
    primaryPosition: opts.position,
    secondaryPositions: [],
    attributes: attrs,
    ovr,
    potential,
    currentClubId: null,
    contract: null,
    state: createEmptyState(),
    reputation: clamp(ovr * 0.5 + age * 0.5, 20, 60),
    isUserControlled: true,
    careerAppearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerTrophies: 0,
    injuryIds: [],
    personalityId: null,
    retired: false,
    retirementDate: null,
  };
  player.potential = Math.max(player.potential, player.ovr);

  const personality = createPersonalityFromOptions(rng, {});
  player.personalityId = personality.id;
  if (!(world as any).personalities) (world as any).personalities = new Map();
  (world as any).personalities.set(personality.id, personality);

  const eligible = findEligibleClubs(world, ovr, potential, age, opts.position);

  if (opts.preferredClubId) {
    const preferred = world.clubs.get(opts.preferredClubId as any);
    if (preferred) {
      const pathway: CareerPathway =
        preferred.reputation >= 82 ? "EliteAcademy" : preferred.reputation >= 70 ? "MidAcademy" : "LowerLeague";
      const role: SelectionRole =
        preferred.reputation >= 82 ? "Academy" : preferred.reputation >= 70 ? (age <= 18 ? "Academy" : "Reserve") : "Rotation";
      player.currentClubId = preferred.id;
      player.contract = makeYouthContract(player, preferred, world.calendar.currentDate);
      if (role === "Academy") {
        preferred.academyPlayerIds.push(player.id);
        if (!preferred.squadPlayerIds.includes(player.id)) preferred.squadPlayerIds.push(player.id);
      } else {
        preferred.squadPlayerIds.push(player.id);
      }
      addPlayer(world, player);
      assignAgent(world, player.id);
      assignStartingPlayStyles(player);
      world.userPlayerId = player.id;
      return {
        player,
        club: preferred,
        pathway,
        role,
        reason: `You chose ${preferred.name}. ${pathway === "EliteAcademy" ? "Elite pathway — earn every minute." : pathway === "MidAcademy" ? "Competitive pathway with a route to the first team." : "A club where young players can play."}`,
      };
    }
  }

  if (eligible.length === 0) {
    const fallback = [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation)[0]!;
    player.currentClubId = fallback.id;
    player.contract = makeYouthContract(player, fallback, world.calendar.currentDate);
    fallback.squadPlayerIds.push(player.id);
    fallback.academyPlayerIds.push(player.id);
    addPlayer(world, player);
    assignAgent(world, player.id);
    assignStartingPlayStyles(player);
    world.userPlayerId = player.id;

    return {
      player,
      club: fallback,
      pathway: "YouthOnly",
      role: "Academy",
      reason: `No strong matches; placed in ${fallback.name} academy as developmental prospect.`,
    };
  }

  const best = eligible[0]!;
  player.currentClubId = best.club.id;
  player.contract = makeYouthContract(player, best.club, world.calendar.currentDate);

  if (best.role === "Academy") {
    best.club.academyPlayerIds.push(player.id);
    if (!best.club.squadPlayerIds.includes(player.id)) {
      best.club.squadPlayerIds.push(player.id);
    }
  } else {
    best.club.squadPlayerIds.push(player.id);
  }

  addPlayer(world, player);
  assignAgent(world, player.id);
  assignStartingPlayStyles(player);
  world.userPlayerId = player.id;

  const reason = buildPlacementReason(player, best.club, best.pathway, best.role);

  return {
    player,
    club: best.club,
    pathway: best.pathway,
    role: best.role,
    reason,
  };
}

function makeYouthContract(player: Player, club: Club, date: GameDate): PlayerContract {
  const years = player.age <= 18 ? 3 : 2;
  const endYear = parseInt(date.slice(0, 4), 10) + years;
  return {
    clubId: club.id,
    wage: Math.max(200, Math.round(player.ovr * 25 + player.age * 30)),
    startDate: date,
    endDate: `${endYear}-06-30`,
    releaseClause: player.potential >= 80 ? Math.round(player.potential * 500_000) : null,
    signedDate: date,
  };
}

function buildPlacementReason(
  player: Player,
  club: Club,
  pathway: CareerPathway,
  role: SelectionRole
): string {
  const parts: string[] = [];
  parts.push(`${player.displayName}, ${player.age}, ${player.primaryPosition}, OVR ${player.ovr} / POT ${player.potential}.`);
  parts.push(`Joined ${club.name} (Rep ${club.reputation}) via ${pathway}.`);
  parts.push(`Initial status: ${role}.`);
  if (role === "Academy" || role === "Reserve") {
    parts.push("Must earn promotion through training, form, and opportunities.");
  }
  return parts.join(" ");
}
