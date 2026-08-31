/**
 * Injury probability, creation, recovery, comeback dip, and match availability.
 *
 * Players do not return at 100%. Severity drives residual form/sharpness/fitness
 * penalties that decay with time and match minutes. Recurrence risk is elevated
 * during the comeback window.
 */

import { nextId } from "../core/id.js";
import type { EntityId, GameDate } from "../core/types.js";
import { RNG } from "../core/rng.js";
import type { Player } from "../players/player.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import {
  INJURY_DEFINITIONS,
  type Injury,
  type InjuryDefinition,
  type BodyArea,
  type InjurySeverity,
} from "./types.js";

/** Per-minute base chance of an injury event for a player on the pitch (very low). */
const BASE_PER_MINUTE = 0.00012;

export function injuryChanceThisMinute(
  player: Player,
  minute: number,
  matchIntensity: number, // 0.5–1.5
  rng: RNG,
  world?: World
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

  // Elevated risk while still in comeback window
  if (world) {
    const pen = getComebackPenalty(world, player.id);
    if (pen > 0.05) p *= 1 + pen * 1.8;
  }

  return rng.chance(Math.min(0.02, p));
}

function pickDefinition(rng: RNG, player: Player, world: World): InjuryDefinition {
  const recentAreas = new Set<BodyArea>();
  for (const iid of player.injuryIds.slice(-5)) {
    const inj = world.injuries.get(iid);
    if (inj) recentAreas.add(inj.bodyArea);
  }

  const weighted: { def: InjuryDefinition; w: number }[] = INJURY_DEFINITIONS.map((def) => {
    let w = def.weight;
    if (recentAreas.has(def.bodyArea)) w *= def.recurrenceMultiplier;
    if (player.age >= 32 && (def.bodyArea === "Hamstring" || def.bodyArea === "Knee" || def.bodyArea === "Calf")) {
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
  return INJURY_DEFINITIONS[0]!;
}

function initialComebackPenalty(severity: InjurySeverity, daysOut: number): number {
  // Longer absences + severity → bigger rust (feels real after long layoffs)
  const lengthFactor = Math.min(1, daysOut / 75);
  if (severity === "Severe") return Math.min(0.62, 0.32 + lengthFactor * 0.32);
  if (severity === "Moderate") return Math.min(0.44, 0.16 + lengthFactor * 0.26);
  return Math.min(0.22, 0.06 + lengthFactor * 0.14);
}

export function createInjury(
  world: World,
  player: Player,
  matchId: EntityId | null,
  date: GameDate,
  rng: RNG
): Injury {
  const def = pickDefinition(rng, player, world);
  const days = rng.int(def.recoveryDays[0], def.recoveryDays[1]);

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
    returnedDate: null,
    comebackPenalty: 0,
    minutesSinceReturn: 0,
  };

  world.injuries.set(injury.id, injury);
  player.injuryIds.push(injury.id);

  if (def.severity === "Minor") {
    player.state.fitness = Math.max(20, player.state.fitness - rng.int(5, 15));
  } else if (def.severity === "Moderate") {
    player.state.fitness = Math.max(10, player.state.fitness - rng.int(20, 40));
    player.state.morale = Math.max(20, player.state.morale - 8);
  } else {
    player.state.fitness = Math.max(5, player.state.fitness - rng.int(40, 60));
    player.state.morale = Math.max(15, player.state.morale - 15);
  }

  world.events.emit(Events.INJURY_OCCURRED, {
    playerId: player.id,
    injuryId: injury.id,
    severity: injury.severity,
    name: injury.name,
    days,
  });

  return injury;
}

/**
 * Apply medical clearance + residual rust when recoveryDaysRemaining hits 0.
 */
function applyComebackDip(world: World, player: Player, injury: Injury): void {
  const pen = initialComebackPenalty(injury.severity, injury.recoveryDaysTotal);
  injury.comebackPenalty = pen;
  injury.returnedDate = world.calendar.currentDate;
  injury.minutesSinceReturn = 0;

  // Fitness / sharpness / form: not fully restored — scale with severity
  if (injury.severity === "Severe") {
    player.state.fitness = Math.min(68, Math.max(40, player.state.fitness + 15));
    player.state.sharpness = Math.max(20, Math.min(48, player.state.sharpness * 0.38));
    player.state.form = Math.max(18, player.state.form - 16 - pen * 22);
    player.state.morale = Math.min(100, player.state.morale + 2);
  } else if (injury.severity === "Moderate") {
    player.state.fitness = Math.min(78, Math.max(50, player.state.fitness + 18));
    player.state.sharpness = Math.max(30, Math.min(58, player.state.sharpness * 0.52));
    player.state.form = Math.max(22, player.state.form - 10 - pen * 18);
    player.state.morale = Math.min(100, player.state.morale + 4);
  } else {
    player.state.fitness = Math.min(90, player.state.fitness + 18);
    player.state.sharpness = Math.max(48, Math.min(78, player.state.sharpness * 0.8));
    player.state.form = Math.max(28, player.state.form - 5 - pen * 10);
    player.state.morale = Math.min(100, player.state.morale + 4);
  }

  // Soft selection caution flag for AI managers
  (player.state as any).comebackCaution = true;

  world.events.emit(Events.INJURY_OCCURRED, {
    type: "returned",
    playerId: player.id,
    injuryId: injury.id,
    severity: injury.severity,
    name: injury.name,
    comebackPenalty: pen,
  });
}

/** Tick injuries by one day (call from calendar advance). */
export function tickInjuries(world: World): void {
  for (const injury of world.injuries.values()) {
    if (injury.active) {
      injury.recoveryDaysRemaining = Math.max(0, injury.recoveryDaysRemaining - 1);
      if (injury.recoveryDaysRemaining === 0) {
        injury.active = false;
        const player = world.players.get(injury.playerId);
        if (player) applyComebackDip(world, player, injury);
      }
      continue;
    }

    // Residual comeback decay (even without matches — training / time)
    if (injury.comebackPenalty > 0.01) {
      const dailyDecay =
        injury.severity === "Severe"
          ? 0.012
          : injury.severity === "Moderate"
            ? 0.02
            : 0.035;
      injury.comebackPenalty = Math.max(0, injury.comebackPenalty - dailyDecay);

      const player = world.players.get(injury.playerId);
      if (player && injury.comebackPenalty > 0) {
        // Gradual sharpness recovery while penalty remains
        player.state.sharpness = Math.min(95, player.state.sharpness + 0.6);
        player.state.fitness = Math.min(100, player.state.fitness + 0.4);
      }

      if (injury.comebackPenalty <= 0.02 && player) {
        injury.comebackPenalty = 0;
        (player.state as any).comebackCaution = false;
        world.events.emit(Events.INJURY_OCCURRED, {
          type: "comeback_complete",
          playerId: player.id,
          injuryId: injury.id,
        });
      }
    }
  }
}

/** Latest non-active injury still carrying a comeback penalty */
export function getComebackInjury(world: World, playerId: EntityId): Injury | null {
  const player = world.players.get(playerId);
  if (!player) return null;
  let best: Injury | null = null;
  for (const id of player.injuryIds) {
    const inj = world.injuries.get(id);
    if (!inj || inj.active) continue;
    if (inj.comebackPenalty > 0.02) {
      if (!best || inj.comebackPenalty > best.comebackPenalty) best = inj;
    }
  }
  return best;
}

export function getComebackPenalty(world: World, playerId: EntityId): number {
  return getComebackInjury(world, playerId)?.comebackPenalty ?? 0;
}

/**
 * Multiplier applied to effective ability / match rating contribution.
 * First 45–90' after return carry extra rust.
 */
export function comebackPerformanceMultiplier(world: World, playerId: EntityId): number {
  const inj = getComebackInjury(world, playerId);
  if (!inj || inj.comebackPenalty <= 0) return 1;
  const pen = inj.comebackPenalty;
  // Base rust: severe can cut ~30–35% early on
  let mul = Math.max(0.65, 1 - pen * 0.6);
  // Extra first-match rust until they've played meaningful minutes
  if (inj.minutesSinceReturn < 45) {
    mul *= 0.92;
  } else if (inj.minutesSinceReturn < 90) {
    mul *= 0.96;
  }
  return Math.max(0.62, mul);
}

/**
 * Call after a match when the player played minutes — accelerates recovery.
 */
export function registerComebackMinutes(
  world: World,
  playerId: EntityId,
  minutes: number
): void {
  if (minutes <= 0) return;
  const player = world.players.get(playerId);
  if (!player) return;

  for (const id of player.injuryIds) {
    const inj = world.injuries.get(id);
    if (!inj || inj.active || inj.comebackPenalty <= 0) continue;
    inj.minutesSinceReturn += minutes;
    // Every 90' burns ~10–16% of remaining penalty (match minutes > pure rest)
    const burn = (minutes / 90) * (0.1 + inj.comebackPenalty * 0.1);
    inj.comebackPenalty = Math.max(0, inj.comebackPenalty - burn);
    player.state.sharpness = Math.min(100, player.state.sharpness + minutes * 0.1);
    player.state.fitness = Math.min(100, player.state.fitness + minutes * 0.06);
    // Form climbs slowly with real minutes, not rest alone
    player.state.form = Math.min(100, player.state.form + minutes * 0.04);
  }
}

export function getActiveInjury(world: World, playerId: EntityId): Injury | null {
  const player = world.players.get(playerId);
  if (!player) return null;
  for (const id of player.injuryIds) {
    const inj = world.injuries.get(id);
    if (inj && inj.active) return inj;
  }
  return null;
}

export function isAvailableForSelection(world: World, playerId: EntityId): boolean {
  return getActiveInjury(world, playerId) === null;
}

/** Aliases for alternate call-site names */
export const tickInjuryRecovery = tickInjuries;
export const activeInjury = getActiveInjury;
export function isPlayerInjured(world: World, playerId: EntityId): boolean {
  return getActiveInjury(world, playerId) !== null;
}
