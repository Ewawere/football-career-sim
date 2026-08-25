/**
 * Wire news generation to the world event bus.
 */

import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import { processWorldEvent } from "./engine.js";

export function attachNewsListeners(world: World): void {
  const names = Object.values(Events);
  for (const name of names) {
    world.events.on(name, (payload) => {
      try {
        processWorldEvent(world, name, payload);
      } catch {
        /* never break sim for news */
      }
    });
  }
}
