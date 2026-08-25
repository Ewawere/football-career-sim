/**
 * Interactive match moments for player career.
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
  assist: boolean;
  ratingDelta: number;
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
        { id: "jockey", label: "Jockey and contain", attributes: ["positioning", "decisions"], difficulty: 0.3, risk: 0.15 },
      ];
    default:
      return [
        { id: "pass", label: "Pass", attributes: ["passing"], difficulty: 0.3, risk: 0.15 },
        { id: "dribble", label: "Dribble", attributes: ["dribbling"], difficulty: 0.4, risk: 0.25 },
      ];
  }
}

function attrValue(player: Player, key: string): number {
  const t = (player.attributes.technical as any)[key];
  const p = (player.attributes.physical as any)[key];
  const m = (player.attributes.mental as any)[key];
  return t ?? p ?? m ?? 50;
}

export function buildMoment(
  type: MomentType,
  player: Player,
  minute: number,
  ctx: MatchContext
): InteractiveMoment {
  return {
    minute,
    type,
    contextLine: `${minute}' — ${ctx.homeScore}–${ctx.awayScore}`,
    description: `${player.displayName} is involved in a ${type} situation.`,
    actions: actionsFor(type),
    playerId: player.id,
  };
}

export function resolveMoment(
  moment: InteractiveMoment,
  actionId: string,
  player: Player,
  rng: RNG
): MomentOutcome {
  const action = moment.actions.find((a) => a.id === actionId) ?? moment.actions[0]!;
  const skill =
    action.attributes.reduce((s, k) => s + attrValue(player, k), 0) /
    Math.max(1, action.attributes.length);
  const chance = Math.max(0.08, Math.min(0.92, skill / 100 - action.difficulty * 0.35 + 0.25));
  const success = rng.chance(chance);

  const isShot = ["shoot", "place", "chip", "power", "header"].includes(action.id);
  const goal = success && isShot && rng.chance(0.55 + skill / 400);

  return {
    success,
    description: success
      ? goal
        ? `${player.displayName} scores!`
        : `${player.displayName} executes the ${action.label.toLowerCase()} successfully.`
      : `${player.displayName} fails to complete the ${action.label.toLowerCase()}.`,
    goal,
    assist: success && action.id === "cross" && rng.chance(0.35),
    ratingDelta: goal ? 8 : success ? 3 : -2,
  };
}

export function autoResolveMoment(moment: InteractiveMoment, player: Player, rng: RNG): MomentOutcome {
  const preferred =
    moment.actions.find((a) => a.id === "shoot" || a.id === "place") ?? moment.actions[0]!;
  return resolveMoment(moment, preferred.id, player, rng);
}

export function shouldGenerateMoment(
  player: Player,
  minute: number,
  momentsSoFar: number,
  rng: RNG
): boolean {
  if (momentsSoFar >= 5) return false;
  if (minute < 8) return false;
  const base = player.isUserControlled ? 0.08 : 0.03;
  return rng.chance(base);
}
