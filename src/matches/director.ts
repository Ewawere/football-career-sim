/**
 * Highlight Director — decides which situations become playable moments.
 */

import type { Player } from "../players/player.js";
import type { MatchContext, MomentType } from "./types.js";
import type { TacticalRole } from "./tactics.js";
import { getRoleProfile } from "./tactics.js";
import type { RNG } from "../core/rng.js";

export function directorScore(
  type: MomentType,
  player: Player,
  role: TacticalRole,
  ctx: MatchContext,
  isHome: boolean,
  minute: number,
  momentsSoFar: number
): number {
  if (momentsSoFar >= 6) return 0;
  if (minute < 5) return 0.15;

  const profile = getRoleProfile(role);
  let score = 0.35;

  const typeWeight: Partial<Record<MomentType, number>> = {
    OneVOne: 0.95,
    ShotOpportunity: 0.9,
    Penalty: 1,
    CounterAttack: 0.85,
    ThroughBall: 0.75,
    Header: 0.7,
    Cross: 0.65,
    FreeKick: 0.7,
    Tackle: 0.55,
    Press: 0.5,
    Interception: 0.5,
    DefensiveRecovery: 0.45,
    RiskyPass: 0.4,
    ShortPass: 0.25,
    Save: 0.8,
    ClaimCross: 0.55,
  };
  score = typeWeight[type] ?? 0.4;

  if (["OneVOne", "ShotOpportunity", "CounterAttack"].includes(type)) {
    score *= 0.7 + profile.attackInvolvement * 0.35;
  }
  if (["Tackle", "Press", "Interception", "DefensiveRecovery"].includes(type)) {
    score *= 0.7 + profile.defenseInvolvement * 0.35;
  }

  if (minute >= 75) score *= 1.25;
  if (minute >= 85) score *= 1.15;

  const mom = isHome ? ctx.momentum : -ctx.momentum;
  if (Math.abs(mom) > 25) score *= 1.1;

  score *= Math.max(0.4, 1 - momentsSoFar * 0.12);
  if (player.isUserControlled) score *= 1.15;

  return Math.max(0, Math.min(1, score));
}

export function directorAllows(
  type: MomentType,
  player: Player,
  role: TacticalRole,
  ctx: MatchContext,
  isHome: boolean,
  minute: number,
  momentsSoFar: number,
  rng: RNG
): boolean {
  const score = directorScore(type, player, role, ctx, isHome, minute, momentsSoFar);
  const threshold = 0.42 + rng.float(-0.05, 0.05);
  return score >= threshold;
}

export const CONTROL_LABELS: Record<string, string> = {
  shoot: "🎯 Shoot",
  place: "🎯 Place finish",
  power: "💥 Power shot",
  chip: "🎯 Chip",
  round: "⚡ Round keeper",
  pass: "⚽ Pass",
  safe: "⚽ Safe pass",
  through: "↗ Through ball",
  cross: "↗ Cross",
  attempt: "↗ Attempt pass",
  dribble: "⚡ Dribble",
  drive: "⚡ Drive forward",
  tackle: "🛡 Tackle",
  intercept: "🛡 Intercept",
  press: "🛡 Press",
  recover: "🛡 Recover",
  save: "🧤 Save",
  claim: "🧤 Claim",
  punch: "🧤 Punch",
  wait: "Hold position",
};

export function controlLabel(actionId: string, fallback: string): string {
  return CONTROL_LABELS[actionId] ?? fallback;
}
