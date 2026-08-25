/**
 * Relationship graph between player and managers / teammates / media.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";

export type RelationKind = "Manager" | "Teammate" | "Agent" | "Journalist" | "Board";

export interface Relationship {
  fromId: EntityId;
  toId: EntityId;
  kind: RelationKind;
  score: number; // -100..100
}

function relKey(from: EntityId, to: EntityId, kind: RelationKind): string {
  return `${from}|${to}|${kind}`;
}

function relMap(world: World): Map<string, Relationship> {
  if (!(world as any).relationships) (world as any).relationships = new Map();
  return (world as any).relationships;
}

export function getRelationship(
  world: World,
  fromId: EntityId,
  toId: EntityId,
  kind: RelationKind
): Relationship {
  const map = relMap(world);
  const k = relKey(fromId, toId, kind);
  let r = map.get(k);
  if (!r) {
    r = { fromId, toId, kind, score: 0 };
    map.set(k, r);
  }
  return r;
}

export function adjustRelationship(
  world: World,
  fromId: EntityId,
  toId: EntityId,
  kind: RelationKind,
  delta: number
): Relationship {
  const r = getRelationship(world, fromId, toId, kind);
  r.score = Math.max(-100, Math.min(100, r.score + delta));
  return r;
}

export function getPersonality(world: World, playerId: EntityId): any | null {
  const p = world.players.get(playerId);
  if (!p?.personalityId) return null;
  return (world as any).personalities?.get(p.personalityId) ?? null;
}

export function attachRelationshipHooks(world: World): void {
  world.events.on(Events.MATCH_COMPLETED, (payload: any) => {
    const userId = world.userPlayerId;
    if (!userId) return;
    const user = world.players.get(userId);
    if (!user || !user.currentClubId) return;
    if (payload.homeClubId !== user.currentClubId && payload.awayClubId !== user.currentClubId)
      return;

    const trust = user.state.managerTrust;
    const managerId = world.clubs.get(user.currentClubId)?.managerId;
    if (!managerId) return;
    const delta = trust >= 70 ? 2 : trust <= 35 ? -2 : 0;
    if (delta) adjustRelationship(world, userId, managerId, "Manager", delta);
  });

  world.events.on(Events.TRANSFER_COMPLETED, (payload: any) => {
    if (!payload.playerId) return;
    // Neutral reset with new club manager later
    const p = world.players.get(payload.playerId);
    if (p) p.state.managerTrust = 50;
  });
}
