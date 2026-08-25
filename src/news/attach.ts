/**
 * Wire news + social + fans to the world event bus.
 */

import type { World } from "../world/world.js";
import { attachNewsEngine } from "./engine.js";
import { attachSocialEngine } from "../social/engine.js";
import { attachFanEngine } from "../social/fans.js";

export function attachMediaSystems(world: World): void {
  attachNewsEngine(world);
  attachSocialEngine(world);
  attachFanEngine(world);
}

export function attachNewsListeners(world: World): void {
  attachMediaSystems(world);
}
