/**
 * Manager tactical control — formation & identity applied to club.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { TacticalIdentity } from "../clubs/club.js";
import { getManager } from "./generation.js";

export const FORMATIONS = [
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-4-2",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
] as const;

export type FormationId = (typeof FORMATIONS)[number];

export function setManagerTactics(
  world: World,
  managerId: EntityId,
  opts: {
    formation?: string;
    identity?: TacticalIdentity;
  }
): boolean {
  const manager = getManager(world, managerId);
  if (!manager?.currentClubId) return false;
  const club = world.clubs.get(manager.currentClubId);
  if (!club) return false;

  if (opts.formation) {
    manager.preferredFormation = opts.formation;
    (club as any).formation = opts.formation;
  }
  if (opts.identity) {
    manager.preferredIdentity = opts.identity;
    club.tacticalIdentity = opts.identity;
  }
  return true;
}

export function managerMatchMentality(
  world: World,
  clubId: EntityId
): { attackBias: number; defendBias: number } {
  const club = world.clubs.get(clubId);
  if (!club?.managerId) return { attackBias: 0, defendBias: 0 };
  const m = getManager(world, club.managerId);
  if (!m) return { attackBias: 0, defendBias: 0 };

  return {
    attackBias: (m.attributes.attacking - 50) / 100,
    defendBias: (m.attributes.defending - 50) / 100,
  };
}
