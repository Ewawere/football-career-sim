/**
 * Interactive match moments for player career.
 * Compatible with engine.ts call signatures.
 */

import type { Player } from "../players/player.js";
import type { RNG } from "../core/rng.js";
import type { MatchContext, MomentType } from "./types.js";

export interface MomentAction {
  id: string;
  label: string;
  attributes: string[];
  difficulty: number;
  risk: number;
}

export interface InteractiveMoment {
  id?: string;
  minute: number;
  type: MomentType;
  contextLine: string;
  description: string;
  actions: MomentAction[];
  playerId: string;
}

export interface MomentOutcome {
  success: boolean;
  description: string;
  goal: boolean;
  goalScored: boolean;
  assist: boolean;
  ratingDelta: number;
  momentumDelta: number;
  stats: {
    goals: number;
    assists: number;
    shots: number;
    keyPasses: number;
    tackles: number;
  };
}

function actionsFor(type: MomentType): MomentAction[] {
  switch (type) {
    case "OneVOne":
      return [
        { id: "shoot", label: "Shoot", attributes: ["finishing", "composure"], difficulty: 0.45, risk: 0.3 },
        { id: "chip", label: "Chip the keeper", attributes: ["finishing", "composure"], difficulty: 0.55, risk: 0.4 },
        { id: "round", label: "Round the keeper", attributes: ["dribbling"], difficulty: 0.5, risk: 0.45 },
        { id: "pass", label: "Square pass", attributes: ["passing", "vision"], difficulty: 0.35, risk: 0.2 },
      ];
    case "ShotOpportunity":
      return [
        { id: "shoot", label: "Shoot", attributes: ["finishing", "composure"], difficulty: 0.4, risk: 0.25 },
        { id: "place", label: "Place into corner", attributes: ["finishing", "composure"], difficulty: 0.5, risk: 0.3 },
        { id: "pass", label: "Lay off", attributes: ["passing"], difficulty: 0.3, risk: 0.15 },
      ];
    case "ThroughBall":
      return [
        { id: "through", label: "Play through ball", attributes: ["passing", "vision"], difficulty: 0.45, risk: 0.35 },
        { id: "safe", label: "Safe short pass", attributes: ["passing"], difficulty: 0.2, risk: 0.1 },
        { id: "dribble", label: "Carry forward", attributes: ["dribbling", "pace"], difficulty: 0.4, risk: 0.3 },
      ];
    case "Cross":
      return [
        { id: "cross", label: "Whip in a cross", attributes: ["crossing"], difficulty: 0.4, risk: 0.3 },
        { id: "shoot", label: "Cut inside and shoot", attributes: ["finishing", "dribbling"], difficulty: 0.5, risk: 0.35 },
      ];
    case "Tackle":
    case "Press":
    case "Interception":
      return [
        { id: "tackle", label: "Go in for the tackle", attributes: ["tackling", "aggression"], difficulty: 0.4, risk: 0.35 },
        { id: "jockey", label: "Jockey and contain", attributes: ["positioning", "anticipation"], difficulty: 0.3, risk: 0.15 },
      ];
    default:
      return [
        { id: "shoot", label: "Shoot", attributes: ["finishing"], difficulty: 0.45, risk: 0.3 },
        { id: "pass", label: "Pass", attributes: ["passing"], difficulty: 0.3, risk: 0.15 },
      ];
  }
}

function attrValue(player: Player, key: string): number {
  const a = player.attributes as any;
  if (!a) return 50;
  for (const group of ["technical", "physical", "mental"]) {
    if (a[group] && typeof a[group][key] === "number") return a[group][key];
  }
  if (typeof a[key] === "number") return a[key];
  return 50;
}

function asRng(x: any): RNG | null {
  if (x && typeof x.chance === "function" && typeof x.next === "function") return x as RNG;
  return null;
}

/**
 * Engine calls: (player, role, context, isHome, mins, userMoments, rng) → MomentType | null
 * Simple calls: (player, minute, momentsSoFar, rng) → boolean-compatible via type|null
 */
export function shouldGenerateMoment(
  player: Player,
  roleOrMinute: any,
  contextOrMoments?: any,
  isHomeOrRng?: any,
  mins?: any,
  userMoments?: any,
  rngArg?: any
): MomentType | null {
  let rng = asRng(rngArg) || asRng(isHomeOrRng) || asRng(contextOrMoments) || asRng(userMoments);
  let minute = 45;
  let soFar = 0;

  if (asRng(rngArg)) {
    minute = typeof mins === "number" ? mins : 45;
    soFar = typeof userMoments === "number" ? userMoments : 0;
  } else if (asRng(isHomeOrRng)) {
    minute = typeof roleOrMinute === "number" ? roleOrMinute : 45;
    soFar = typeof contextOrMoments === "number" ? contextOrMoments : 0;
  }

  if (!rng) return null;
  if (soFar >= 5) return null;
  if (minute < 8) return null;

  const base = player.isUserControlled ? 0.14 : 0.04;
  if (!rng.chance(base)) return null;

  const types: MomentType[] = ["ShotOpportunity", "OneVOne", "ThroughBall", "Cross"];
  return rng.pick(types);
}

/**
 * Engine: buildMoment(type, player, context, isHome, difficultyMod, id)
 * Simple: buildMoment(type, player, minute, ctx)
 */
export function buildMoment(
  type: MomentType,
  player: Player,
  contextOrMinute: any,
  isHomeOrCtx?: any,
  _difficulty?: any,
  id?: string
): InteractiveMoment {
  let minute = 45;
  let scoreline = "0–0";

  if (typeof contextOrMinute === "number") {
    minute = contextOrMinute;
    const ctx = isHomeOrCtx as MatchContext | undefined;
    if (ctx) scoreline = `${(ctx as any).homeScore ?? 0}–${(ctx as any).awayScore ?? 0}`;
  } else if (contextOrMinute && typeof contextOrMinute === "object") {
    const ctx = contextOrMinute as MatchContext;
    minute = (ctx as any).minute ?? 45;
    scoreline = `${(ctx as any).homeScore ?? 0}–${(ctx as any).awayScore ?? 0}`;
  }

  return {
    id,
    minute,
    type,
    contextLine: `${minute}' — ${scoreline}`,
    description: `${player.displayName} is involved in a ${type} situation.`,
    actions: actionsFor(type),
    playerId: player.id,
  };
}

/**
 * Engine: resolveMoment(moment, actionId, player, context, rng)
 * Simple: resolveMoment(moment, actionId, player, rng)
 */
export function resolveMoment(
  moment: InteractiveMoment,
  actionId: string,
  player: Player,
  contextOrRng?: any,
  rngMaybe?: any
): MomentOutcome {
  const rng = asRng(rngMaybe) || asRng(contextOrRng);
  if (!rng) {
    return {
      success: false,
      description: "Action could not be resolved.",
      goal: false,
      goalScored: false,
      assist: false,
      ratingDelta: 0,
      momentumDelta: 0,
      stats: { goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0 },
    };
  }

  const action = moment.actions.find((a) => a.id === actionId) ?? moment.actions[0]!;
  const skill =
    action.attributes.reduce((s, k) => s + attrValue(player, k), 0) /
    Math.max(1, action.attributes.length);
  const chance = Math.max(0.08, Math.min(0.92, skill / 100 - action.difficulty * 0.35 + 0.25));
  const success = rng.chance(chance);

  const isShot = ["shoot", "place", "chip", "power", "header", "round"].includes(action.id);
  const goal = success && isShot && rng.chance(0.55 + skill / 400);
  const assist = success && action.id === "cross" && rng.chance(0.35);

  return {
    success,
    description: success
      ? goal
        ? `${player.displayName} scores!`
        : `${player.displayName} executes the ${action.label.toLowerCase()} successfully.`
      : `${player.displayName} fails to complete the ${action.label.toLowerCase()}.`,
    goal,
    goalScored: goal,
    assist,
    ratingDelta: goal ? 8 : success ? 3 : -2,
    momentumDelta: goal ? 12 : success ? 3 : -2,
    stats: {
      goals: goal ? 1 : 0,
      assists: assist ? 1 : 0,
      shots: isShot ? 1 : 0,
      keyPasses: assist || action.id === "through" ? 1 : 0,
      tackles: action.id === "tackle" && success ? 1 : 0,
    },
  };
}

/**
 * Engine expects { actionId, outcome }; playable may use outcome only.
 */
export function autoResolveMoment(
  moment: InteractiveMoment,
  player: Player,
  contextOrRng?: any,
  rngMaybe?: any
): { actionId: string; outcome: MomentOutcome } & MomentOutcome {
  const preferred =
    moment.actions.find((a) => a.id === "shoot" || a.id === "place") ?? moment.actions[0]!;
  const outcome = resolveMoment(moment, preferred.id, player, contextOrRng, rngMaybe);
  return Object.assign(outcome, { actionId: preferred.id, outcome });
}
