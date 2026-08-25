/**
 * Injury probability, creation, recovery, and match availability.
 */

import { nextId } from "../core/id.js";
import type { EntityId, GameDate } from "../core/types.js";
import type { RNG } from "../core/rng.js";
import type { Player } from "../players/player.js";
import type { World } from "../world/world.js";
import {
  INJURY_DEFINITIONS,
  type Injury,
  type InjuryDefinition,
  type BodyArea,
} from "./types.js";

const BASE_PER_MINUTE = 0.00012;

export function injuryChanceThisMinute(
  player: Player,
  minute: number,
  matchIntensity: number,
  rng: RNG
): boolean {
  let p = BASE_PER_MINUTE;

  if (player.state.fitness < 50) p *= 2.2;
  else if (player.state.fitness < 70) p *= 1.4;

  p *= 1 + player.state.fatigue / 120;

  if (player.age >= 33) p *= 1.5;
  else if (player.age >= 30) p *= 1.25;
  else if (player.age <= 18) p *= 1.15;

  const resilience =
    (player.attributes.physical.strength + player.attributes.physical.stamina) / 2;
  p *= 1.4 - resilience / 150;

  const historyCount = player.injuryIds.length;
  if (historyCount >= 3) p *= 1.4;
  else if (historyCount >= 1) p *= 1.15;

  p *= matchIntensity;
  if (minute >= 75) p *= 1.3;
  else if (minute >= 60) p *= 1.1;

  return rng.chance(Math.min(0.02, p));
}

function pickDefinition(rng: RNG, player: Player, world: World): InjuryDefinition {
  const recentAreas = new Set<BodyArea>();
  for (const iid of player.injuryIds.slice(-5)) {
    const inj = world.injuries.get(iid);
    if (inj) recentAreas.add(inj.bodyArea);
  }

  const weighted = INJURY_DEFINITIONS.map((def) => {
    let w = def.weight;
    if (recentAreas.has(def.bodyArea)) w *= def.recurrenceMultiplier;
    if (
      player.age >= 32 &&
      (def.bodyArea === "Hamstring" || def.bodyArea === "Knee" || def.bodyArea === "Calf")
    ) {
      w *= 1.4;
    }
    return { def, w };
  });

  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = rng.next() * total;
  for (const item of weighted) {
    r -= item.w;
    if (r <= 0) return item.def;
  }
  return weighted[weighted.length - 1]!.def;
}

export function createInjury(
  world: World,
  player: Player,
  date: GameDate,
  matchId: EntityId | null,
  rng: RNG
): Injury {
  const def = pickDefinition(rng, player, world);
  const [minD, maxD] = def.recoveryDays;
  const days = rng.int(minD, maxD);
  const injury: Injury = {
    id: nextId("inj"),
    playerId: player.id,
    typeId: def.typeId,
    name: def.name,
    severity: def.severity,
    bodyArea: def.bodyArea,
    occurredDate: date,
    occurredMatchId: matchId,
    recoveryDaysTotal: days,
    recoveryDaysRemaining: days,
    active: true,
    forcesWithdrawal: def.forcesWithdrawal,
  };
  world.injuries.set(injury.id, injury);
  player.injuryIds.push(injury.id);
  player.state.fitness = Math.min(player.state.fitness, def.severity === "Severe" ? 20 : 55);
  return injury;
}

export function tickInjuryRecovery(world: World): void {
  for (const injury of world.injuries.values()) {
    if (!injury.active) continue;
    injury.recoveryDaysRemaining -= 1;
    if (injury.recoveryDaysRemaining <= 0) {
      injury.active = false;
      injury.recoveryDaysRemaining = 0;
      const player = world.players.get(injury.playerId);
      if (player) {
        player.state.fitness = Math.min(100, player.state.fitness + 15);
      }
    }
  }
}

export function isPlayerInjured(world: World, playerId: EntityId): boolean {
  return [...world.injuries.values()].some(
    (i) => i.playerId === playerId && i.active
  );
}

export function activeInjury(world: World, playerId: EntityId): Injury | null {
  return (
    [...world.injuries.values()].find((i) => i.playerId === playerId && i.active) ?? null
  );
}
