/**
 * Public entry for continuous match engine.
 * api.ts imports ../matches/continuous.js — this file is that module.
 * Implementation lives in ./continuous/engine.ts
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { ContinuousMatchState } from "./continuous/types.js";
import {
  getContinuous as getContinuousById,
  startContinuousMatch as startContinuousEngine,
  tickContinuous as tickContinuousEngine,
  simUntil as simUntilEngine,
  startSecondHalf as startSecondHalfEngine,
  continuousSnapshot as continuousSnapshotEngine,
} from "./continuous/engine.js";

/** Active continuous match id for session helpers */
let currentMatchId: string | null = null;

/**
 * Start continuous match from a fixture/match id (api-friendly).
 */
export function startContinuousMatch(world: World, matchId: string): ContinuousMatchState {
  const match = world.matches.get(matchId as EntityId);
  if (!match) throw new Error(`Match not found: ${matchId}`);
  const state = startContinuousEngine(world, match, world.userPlayerId);
  currentMatchId = state.matchId;
  return state;
}

/** Current continuous session (no id required). */
export function getContinuous(): ContinuousMatchState | null {
  if (!currentMatchId) return null;
  return getContinuousById(currentMatchId);
}

export function tickContinuous(
  world: World,
  stateOrId: ContinuousMatchState | string,
  dt = 0.25
): ContinuousMatchState {
  const id = typeof stateOrId === "string" ? stateOrId : stateOrId.matchId;
  return tickContinuousEngine(world, id, dt);
}

export function simUntil(
  world: World,
  stateOrId: ContinuousMatchState | string,
  targetMinute: number
): ContinuousMatchState {
  const id = typeof stateOrId === "string" ? stateOrId : stateOrId.matchId;
  return simUntilEngine(world, id, targetMinute);
}

export function startSecondHalf(stateOrId: ContinuousMatchState | string): void {
  const id = typeof stateOrId === "string" ? stateOrId : stateOrId.matchId;
  startSecondHalfEngine(id);
}

export function continuousSnapshot(state: ContinuousMatchState) {
  return continuousSnapshotEngine(state);
}

export { getContinuousById };
