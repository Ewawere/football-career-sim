/**
 * Skill points — accelerate near PlayStyle unlocks without bypassing compatibility.
 */

import type { Player } from "./player.js";
import type { World } from "../world/world.js";
import type { PlayStyleId } from "./playstyles.js";
import {
  checkPlayStyle,
  evaluatePlayStyleUnlocks,
  getPlayStyleDef,
  ensurePlayStyleState,
} from "./playstyles.js";
import { calculateOVR } from "./attributes.js";

const SP_KEY = "skillPoints";

export function getSkillPoints(player: Player): number {
  return Math.max(0, Math.floor((player.state as any)[SP_KEY] ?? 0));
}

export function addSkillPoints(player: Player, n: number): number {
  const cur = getSkillPoints(player);
  const next = cur + Math.max(0, Math.floor(n));
  (player.state as any)[SP_KEY] = next;
  return next;
}

export function grantSkillPointsFromDevelopment(player: Player, growthPoints: number): void {
  if (growthPoints >= 1.5) addSkillPoints(player, 1);
  if (growthPoints >= 3) addSkillPoints(player, 1);
}

export function grantSkillPointsFromMatch(player: Player, rating: number, minutes: number): void {
  if (minutes < 30) return;
  if (rating >= 80) addSkillPoints(player, 1);
  if (rating >= 90) addSkillPoints(player, 1);
}

export function spendSkillPointTowardPlayStyle(
  world: World,
  player: Player,
  playStyleId: PlayStyleId
): { ok: boolean; message: string; unlocked?: string[]; upgraded?: string[] } {
  ensurePlayStyleState(player);
  const pts = getSkillPoints(player);
  if (pts < 1) return { ok: false, message: "No skill points available." };

  const def = getPlayStyleDef(playStyleId);
  if (!def) return { ok: false, message: "Unknown PlayStyle." };

  const check = checkPlayStyle(player, playStyleId);
  if (check.blockedReason) return { ok: false, message: check.blockedReason };

  if (check.canUnlockPlus) {
    const result = evaluatePlayStyleUnlocks(world, player);
    return {
      ok: true,
      message: `${def.name} already meets + requirements.`,
      unlocked: result.unlocked,
      upgraded: result.upgraded,
    };
  }

  const req = check.canUnlockBase ? def.plusReq : def.req;
  const attrs = req.attrs ?? {};
  let targetKey: string | null = null;
  let targetMin = 0;
  let worstGap = 0;
  for (const [k, min] of Object.entries(attrs)) {
    if (min == null) continue;
    const val = attrOf(player, k);
    const gap = min - val;
    if (gap > worstGap) {
      worstGap = gap;
      targetKey = k;
      targetMin = min;
    }
  }

  if (!targetKey) {
    (player.state as any)[SP_KEY] = pts - 1;
    player.attributes.mental.composure = clamp(player.attributes.mental.composure + 1);
    player.ovr = calculateOVR(player.attributes, player.primaryPosition);
    const result = evaluatePlayStyleUnlocks(world, player);
    return {
      ok: true,
      message: `Spent 1 SP on composure (path toward ${def.name}).`,
      unlocked: result.unlocked,
      upgraded: result.upgraded,
    };
  }

  (player.state as any)[SP_KEY] = pts - 1;
  const bump = worstGap >= 8 ? 2 : 1;
  setAttr(player, targetKey, clamp(attrOf(player, targetKey) + bump));
  player.ovr = calculateOVR(player.attributes, player.primaryPosition);

  const result = evaluatePlayStyleUnlocks(world, player);
  const unlockedNow = result.unlocked.includes(playStyleId);
  const plusNow = result.upgraded.includes(playStyleId);

  let message = `Spent 1 SP \u2192 ${targetKey} +${bump} (need ${targetMin} for ${def.name}).`;
  if (plusNow) message = `Unlocked ${def.name}+!`;
  else if (unlockedNow) message = `Unlocked ${def.name}!`;

  return { ok: true, message, unlocked: result.unlocked, upgraded: result.upgraded };
}

function attrOf(player: Player, key: string): number {
  const t = player.attributes.technical as any;
  const p = player.attributes.physical as any;
  const m = player.attributes.mental as any;
  if (key in t) return t[key];
  if (key in p) return p[key];
  if (key in m) return m[key];
  return 0;
}

function setAttr(player: Player, key: string, value: number): void {
  const t = player.attributes.technical as any;
  const p = player.attributes.physical as any;
  const m = player.attributes.mental as any;
  if (key in t) t[key] = value;
  else if (key in p) p[key] = value;
  else if (key in m) m[key] = value;
}

function clamp(n: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
