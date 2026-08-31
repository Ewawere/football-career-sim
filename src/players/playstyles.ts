/**
 * FC-style PlayStyle unlock system.
 *
 * - Starters get a few PlayStyles from position + attributes + build
 * - Training / attribute growth unlocks more
 * - PlayStyle+ needs elite thresholds + development depth
 * - Compatibility blocks nonsense stacks
 */

import type { Player } from "./player.js";
import type { Position, PhysicalProfile } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";

export type PlayStyleId =
  | "QuickStep"
  | "Rapid"
  | "Technical"
  | "Trickster"
  | "FinesseShot"
  | "PowerShot"
  | "IncisivePass"
  | "PingedPass"
  | "TikiTaka"
  | "WhippedPass"
  | "Anticipate"
  | "Intercept"
  | "Jockey"
  | "Block"
  | "Bruiser"
  | "Aerial"
  | "Acrobatic"
  | "FirstTouch"
  | "PressProven"
  | "Relentless"
  | "Trivela"
  | "LongBallPass"
  | "DeadBall"
  | "FarThrow";

export interface PlayStyleRequirements {
  minOvr?: number;
  attrs?: Partial<Record<string, number>>;
  minHeightCm?: number;
  maxHeightCm?: number;
  minCareerMinutes?: number;
  minAge?: number;
}

export interface CompatibilityRule {
  id: string;
  blocked: (player: Player) => boolean;
  reason: string;
}

export interface PlayStyleDef {
  id: PlayStyleId;
  name: string;
  emoji: string;
  req: PlayStyleRequirements;
  plusReq: PlayStyleRequirements;
  positions: Position[] | "any" | "outfield";
  profiles?: PhysicalProfile[];
  veto?: CompatibilityRule[];
}

export interface PlayerPlayStyleState {
  unlocked: PlayStyleId[];
  plus: PlayStyleId[];
  equipped: PlayStyleId[];
}

export const PLAYSTYLE_DEFS: PlayStyleDef[] = [
  {
    id: "QuickStep",
    name: "Quick Step",
    emoji: "\u26A1",
    positions: ["RW", "LW", "RM", "LM", "ST", "CF", "CAM", "RB", "LB"],
    req: { attrs: { acceleration: 78, pace: 74 } },
    plusReq: { attrs: { acceleration: 90, pace: 88 }, minOvr: 82, minCareerMinutes: 2500 },
  },
  {
    id: "Rapid",
    name: "Rapid",
    emoji: "\uD83C\uDFC3",
    positions: ["RW", "LW", "RM", "LM", "ST", "RB", "LB"],
    req: { attrs: { pace: 82, acceleration: 78 } },
    plusReq: { attrs: { pace: 92, acceleration: 88 }, minOvr: 84, minCareerMinutes: 3000 },
  },
  {
    id: "Technical",
    name: "Technical",
    emoji: "\uD83C\uDFA8",
    positions: "outfield",
    req: { attrs: { dribbling: 76, ballControl: 74, agility: 70 } },
    plusReq: { attrs: { dribbling: 88, ballControl: 86, agility: 82 }, minOvr: 82, minCareerMinutes: 2800 },
  },
  {
    id: "Trickster",
    name: "Trickster",
    emoji: "\u2728",
    positions: ["RW", "LW", "CAM", "ST", "CF"],
    req: { attrs: { dribbling: 80, agility: 78, balance: 72 } },
    plusReq: { attrs: { dribbling: 90, agility: 88 }, minOvr: 84, minCareerMinutes: 3200 },
  },
  {
    id: "FinesseShot",
    name: "Finesse Shot",
    emoji: "\uD83C\uDFAF",
    positions: ["ST", "CF", "CAM", "RW", "LW", "RM", "LM"],
    req: { attrs: { finishing: 78, longShots: 72, composure: 70 } },
    plusReq: { attrs: { finishing: 88, longShots: 84, composure: 82 }, minOvr: 83, minCareerMinutes: 3000 },
  },
  {
    id: "PowerShot",
    name: "Power Shot",
    emoji: "\uD83D\uDCA5",
    positions: ["ST", "CF", "CAM", "CM", "RW", "LW"],
    req: { attrs: { longShots: 78, finishing: 70, strength: 68 } },
    plusReq: { attrs: { longShots: 88, strength: 78 }, minOvr: 82, minCareerMinutes: 2800 },
  },
  {
    id: "IncisivePass",
    name: "Incisive Pass",
    emoji: "\uD83E\uDE84",
    positions: ["CAM", "CM", "CDM", "RW", "LW", "ST", "CF"],
    req: { attrs: { passing: 80, vision: 76 } },
    plusReq: { attrs: { passing: 90, vision: 88 }, minOvr: 84, minCareerMinutes: 3200 },
  },
  {
    id: "PingedPass",
    name: "Pinged Pass",
    emoji: "\uD83D\uDCE1",
    positions: ["CM", "CDM", "CB", "CAM", "RB", "LB"],
    req: { attrs: { passing: 78, vision: 72 } },
    plusReq: { attrs: { passing: 88, vision: 84 }, minOvr: 82, minCareerMinutes: 2800 },
  },
  {
    id: "TikiTaka",
    name: "Tiki Taka",
    emoji: "\uD83D\uDD04",
    positions: ["CM", "CAM", "CDM"],
    req: { attrs: { passing: 82, ballControl: 80, vision: 78 } },
    plusReq: { attrs: { passing: 90, ballControl: 88, vision: 88 }, minOvr: 85, minCareerMinutes: 3500 },
  },
  {
    id: "WhippedPass",
    name: "Whipped Pass",
    emoji: "\uD83C\uDF00",
    positions: ["RB", "LB", "RWB", "LWB", "RM", "LM", "RW", "LW"],
    req: { attrs: { crossing: 78, passing: 72 } },
    plusReq: { attrs: { crossing: 88, passing: 80 }, minOvr: 80, minCareerMinutes: 2500 },
  },
  {
    id: "Anticipate",
    name: "Anticipate",
    emoji: "\uD83E\uDDE0",
    positions: ["CB", "CDM", "CM", "RB", "LB"],
    req: { attrs: { anticipation: 78, positioning: 76, tackling: 72 } },
    plusReq: { attrs: { anticipation: 88, positioning: 86 }, minOvr: 82, minCareerMinutes: 3000 },
  },
  {
    id: "Intercept",
    name: "Intercept",
    emoji: "\u270B",
    positions: ["CB", "CDM", "CM", "RB", "LB"],
    req: { attrs: { positioning: 76, anticipation: 74, reactions: 72 } },
    plusReq: { attrs: { positioning: 88, anticipation: 86 }, minOvr: 82, minCareerMinutes: 2800 },
  },
  {
    id: "Jockey",
    name: "Jockey",
    emoji: "\uD83D\uDEE1",
    positions: ["RB", "LB", "CB", "CDM", "RWB", "LWB"],
    req: { attrs: { agility: 74, tackling: 74, balance: 70 } },
    plusReq: { attrs: { agility: 86, tackling: 86 }, minOvr: 80, minCareerMinutes: 2600 },
  },
  {
    id: "Block",
    name: "Block",
    emoji: "\uD83E\uDDF1",
    positions: ["CB", "CDM", "RB", "LB"],
    req: { attrs: { positioning: 74, strength: 72, tackling: 70 } },
    plusReq: { attrs: { positioning: 86, strength: 84 }, minOvr: 80, minCareerMinutes: 2600 },
  },
  {
    id: "Bruiser",
    name: "Bruiser",
    emoji: "\uD83D\uDCAA",
    positions: ["CB", "CDM", "ST", "CM"],
    profiles: ["Powerful", "Athletic", "Tall"],
    req: { attrs: { strength: 82, aggression: 74 }, minHeightCm: 178 },
    plusReq: { attrs: { strength: 90, aggression: 82 }, minOvr: 82, minCareerMinutes: 3000 },
    veto: [
      {
        id: "too_slight",
        reason: "Physical profile too slight for Bruiser",
        blocked: (p) => p.physicalProfile === "Slight" || p.heightCm < 175,
      },
    ],
  },
  {
    id: "Aerial",
    name: "Aerial",
    emoji: "\uD83E\uDD85",
    positions: ["CB", "ST", "CF", "CDM"],
    profiles: ["Tall", "Powerful", "Athletic", "Average"],
    req: { attrs: { jumping: 78, heading: 76 }, minHeightCm: 180 },
    plusReq: { attrs: { jumping: 88, heading: 86 }, minOvr: 82, minHeightCm: 185, minCareerMinutes: 2800 },
    veto: [
      {
        id: "too_short",
        reason: "Too short for Aerial dominance",
        blocked: (p) => p.heightCm < 178,
      },
      {
        id: "slight_build",
        reason: "Slight build cannot unlock Aerial+",
        blocked: (p) => p.physicalProfile === "Slight",
      },
    ],
  },
  {
    id: "Acrobatic",
    name: "Acrobatic",
    emoji: "\uD83E\uDD38",
    positions: ["ST", "CF", "CAM", "RW", "LW"],
    req: { attrs: { agility: 80, finishing: 72, balance: 74 } },
    plusReq: { attrs: { agility: 90, finishing: 84 }, minOvr: 83, minCareerMinutes: 3000 },
  },
  {
    id: "FirstTouch",
    name: "First Touch",
    emoji: "\uD83E\uDD7E",
    positions: "outfield",
    req: { attrs: { ballControl: 80, composure: 74 } },
    plusReq: { attrs: { ballControl: 90, composure: 86 }, minOvr: 82, minCareerMinutes: 2600 },
  },
  {
    id: "PressProven",
    name: "Press Proven",
    emoji: "\uD83D\uDD12",
    positions: "outfield",
    req: { attrs: { composure: 78, ballControl: 76, strength: 68 } },
    plusReq: { attrs: { composure: 88, ballControl: 86 }, minOvr: 83, minCareerMinutes: 3000 },
  },
  {
    id: "Relentless",
    name: "Relentless",
    emoji: "\uD83D\uDD25",
    positions: "outfield",
    req: { attrs: { stamina: 82, workRate: 78 } },
    plusReq: { attrs: { stamina: 92, workRate: 88 }, minOvr: 80, minCareerMinutes: 4000 },
  },
  {
    id: "Trivela",
    name: "Trivela",
    emoji: "\uD83C\uDF00",
    positions: ["RW", "LW", "CAM", "CM", "ST"],
    req: { attrs: { finishing: 74, longShots: 74, ballControl: 76 } },
    plusReq: { attrs: { finishing: 86, longShots: 86 }, minOvr: 84, minCareerMinutes: 3200 },
  },
  {
    id: "LongBallPass",
    name: "Long Ball Pass",
    emoji: "\uD83D\uDE80",
    positions: ["CB", "CDM", "CM", "GK"],
    req: { attrs: { passing: 76, vision: 74 } },
    plusReq: { attrs: { passing: 88, vision: 84 }, minOvr: 80, minCareerMinutes: 2800 },
  },
  {
    id: "DeadBall",
    name: "Dead Ball",
    emoji: "\uD83D\uDCD0",
    positions: "outfield",
    req: { attrs: { setPieces: 78, longShots: 70 } },
    plusReq: { attrs: { setPieces: 90, longShots: 82 }, minOvr: 80, minCareerMinutes: 2500 },
  },
  {
    id: "FarThrow",
    name: "Far Throw",
    emoji: "\uD83C\uDFCB",
    positions: ["RB", "LB", "RWB", "LWB", "CB"],
    req: { attrs: { strength: 78 }, minHeightCm: 178 },
    plusReq: { attrs: { strength: 88 }, minOvr: 75, minCareerMinutes: 2000 },
  },
];

const DEF_BY_ID = new Map(PLAYSTYLE_DEFS.map((d) => [d.id, d]));

export function getPlayStyleDef(id: PlayStyleId) {
  return DEF_BY_ID.get(id);
}

export function emptyPlayStyleState(): PlayerPlayStyleState {
  return { unlocked: [], plus: [], equipped: [] };
}

function attrValue(player: Player, key: string): number {
  const t = player.attributes.technical as any;
  const p = player.attributes.physical as any;
  const m = player.attributes.mental as any;
  if (key in t) return t[key];
  if (key in p) return p[key];
  if (key in m) return m[key];
  return 0;
}

function meetsReq(player: Player, req: PlayStyleRequirements): boolean {
  if (req.minOvr != null && player.ovr < req.minOvr) return false;
  if (req.minHeightCm != null && player.heightCm < req.minHeightCm) return false;
  if (req.maxHeightCm != null && player.heightCm > req.maxHeightCm) return false;
  if (req.minAge != null && player.age < req.minAge) return false;
  if (req.minCareerMinutes != null) {
    const approx = player.careerAppearances * 75 + player.state.matchMinutesThisSeason;
    if (approx < req.minCareerMinutes) return false;
  }
  if (req.attrs) {
    for (const [k, min] of Object.entries(req.attrs)) {
      if (min == null) continue;
      if (attrValue(player, k) < min) return false;
    }
  }
  return true;
}

function positionAllowed(def: PlayStyleDef, player: Player): boolean {
  if (def.positions === "any") return true;
  if (def.positions === "outfield") return player.primaryPosition !== "GK";
  const pos = player.primaryPosition;
  const sec = player.secondaryPositions;
  return def.positions.includes(pos) || sec.some((s) => def.positions.includes(s));
}

function profileAllowed(def: PlayStyleDef, player: Player): boolean {
  if (!def.profiles || def.profiles.length === 0) return true;
  return def.profiles.includes(player.physicalProfile);
}

export interface UnlockCheck {
  id: PlayStyleId;
  canUnlockBase: boolean;
  canUnlockPlus: boolean;
  blockedReason?: string;
  missingForBase: string[];
  missingForPlus: string[];
}

function missingList(player: Player, req: PlayStyleRequirements): string[] {
  const miss: string[] = [];
  if (req.minOvr != null && player.ovr < req.minOvr) miss.push(`OVR ${req.minOvr}+`);
  if (req.minHeightCm != null && player.heightCm < req.minHeightCm) miss.push(`Height ${req.minHeightCm}+`);
  if (req.attrs) {
    for (const [k, min] of Object.entries(req.attrs)) {
      if (min != null && attrValue(player, k) < min) miss.push(`${k} ${min}+`);
    }
  }
  if (req.minCareerMinutes != null) {
    const approx = player.careerAppearances * 75 + player.state.matchMinutesThisSeason;
    if (approx < req.minCareerMinutes) miss.push(`Career minutes ~${req.minCareerMinutes}`);
  }
  return miss;
}

export function checkPlayStyle(player: Player, id: PlayStyleId): UnlockCheck {
  const def = DEF_BY_ID.get(id);
  if (!def) {
    return { id, canUnlockBase: false, canUnlockPlus: false, blockedReason: "Unknown style", missingForBase: [], missingForPlus: [] };
  }
  if (!positionAllowed(def, player)) {
    return { id, canUnlockBase: false, canUnlockPlus: false, blockedReason: "Incompatible position", missingForBase: ["position"], missingForPlus: ["position"] };
  }
  if (!profileAllowed(def, player)) {
    return { id, canUnlockBase: false, canUnlockPlus: false, blockedReason: "Physical profile mismatch", missingForBase: ["physical profile"], missingForPlus: ["physical profile"] };
  }
  for (const v of def.veto ?? []) {
    if (v.blocked(player)) {
      return { id, canUnlockBase: false, canUnlockPlus: false, blockedReason: v.reason, missingForBase: [v.reason], missingForPlus: [v.reason] };
    }
  }
  const canBase = meetsReq(player, def.req);
  const canPlus = canBase && meetsReq(player, def.plusReq);
  return {
    id,
    canUnlockBase: canBase,
    canUnlockPlus: canPlus,
    missingForBase: canBase ? [] : missingList(player, def.req),
    missingForPlus: canPlus ? [] : missingList(player, def.plusReq),
  };
}

export function equipSlotCap(ovr: number): number {
  if (ovr >= 90) return 7;
  if (ovr >= 85) return 6;
  if (ovr >= 80) return 5;
  if (ovr >= 75) return 4;
  if (ovr >= 70) return 3;
  if (ovr >= 65) return 2;
  return 1;
}

export function assignStartingPlayStyles(player: Player): PlayerPlayStyleState {
  const state = emptyPlayStyleState();
  const eligible = PLAYSTYLE_DEFS.map((d) => ({ d, check: checkPlayStyle(player, d.id) })).filter((x) => x.check.canUnlockBase);
  eligible.sort((a, b) => scoreAffinity(player, b.d) - scoreAffinity(player, a.d));
  const cap = Math.max(1, Math.min(equipSlotCap(player.ovr), 3));
  for (const { d } of eligible) {
    if (state.unlocked.length >= cap) break;
    state.unlocked.push(d.id);
    state.equipped.push(d.id);
  }
  if (state.unlocked.length === 0) {
    const soft = PLAYSTYLE_DEFS.find((d) => positionAllowed(d, player) && profileAllowed(d, player));
    if (soft && meetsReq(player, softenReq(soft.req, 0.92))) {
      state.unlocked.push(soft.id);
      state.equipped.push(soft.id);
    }
  }
  ensurePlayStyleState(player, state);
  return state;
}

function softenReq(req: PlayStyleRequirements, factor: number): PlayStyleRequirements {
  const attrs: PlayStyleRequirements["attrs"] = {};
  if (req.attrs) {
    for (const [k, v] of Object.entries(req.attrs)) {
      if (v != null) (attrs as any)[k] = Math.floor(v * factor);
    }
  }
  return { ...req, minOvr: req.minOvr != null ? Math.floor(req.minOvr * factor) : undefined, attrs };
}

function scoreAffinity(player: Player, def: PlayStyleDef): number {
  let s = 0;
  if (Array.isArray(def.positions) && def.positions.includes(player.primaryPosition)) s += 5;
  if (def.req.attrs) {
    for (const [k, min] of Object.entries(def.req.attrs)) {
      if (min == null) continue;
      s += Math.max(0, attrValue(player, k) - min) * 0.1;
    }
  }
  return s;
}

export function ensurePlayStyleState(player: Player, state?: PlayerPlayStyleState): PlayerPlayStyleState {
  const existing = (player as any).playStyles as PlayerPlayStyleState | undefined;
  if (state) {
    (player as any).playStyles = state;
    return state;
  }
  if (existing) return existing;
  const empty = emptyPlayStyleState();
  (player as any).playStyles = empty;
  return empty;
}

export function getPlayerPlayStyles(player: Player): PlayerPlayStyleState {
  return ensurePlayStyleState(player);
}

export function evaluatePlayStyleUnlocks(world: World, player: Player): { unlocked: PlayStyleId[]; upgraded: PlayStyleId[] } {
  const state = ensurePlayStyleState(player);
  const unlocked: PlayStyleId[] = [];
  const upgraded: PlayStyleId[] = [];
  for (const def of PLAYSTYLE_DEFS) {
    const check = checkPlayStyle(player, def.id);
    if (check.blockedReason) continue;
    if (check.canUnlockBase && !state.unlocked.includes(def.id)) {
      state.unlocked.push(def.id);
      unlocked.push(def.id);
      if (state.equipped.length < equipSlotCap(player.ovr)) state.equipped.push(def.id);
      world.events.emit(Events.PLAYER_DEVELOPED, {
        type: "playstyle_unlock",
        playerId: player.id,
        playStyleId: def.id,
        tier: "Base",
        name: def.name,
      });
    }
    if (check.canUnlockPlus && state.unlocked.includes(def.id) && !state.plus.includes(def.id)) {
      state.plus.push(def.id);
      upgraded.push(def.id);
      world.events.emit(Events.PLAYER_DEVELOPED, {
        type: "playstyle_unlock",
        playerId: player.id,
        playStyleId: def.id,
        tier: "Plus",
        name: def.name + "+",
      });
    }
  }
  const cap = equipSlotCap(player.ovr);
  if (state.equipped.length > cap) state.equipped = state.equipped.slice(0, cap);
  return { unlocked, upgraded };
}

export function equipPlayStyle(player: Player, id: PlayStyleId): boolean {
  const state = ensurePlayStyleState(player);
  if (!state.unlocked.includes(id)) return false;
  if (state.equipped.includes(id)) return true;
  if (state.equipped.length >= equipSlotCap(player.ovr)) return false;
  state.equipped.push(id);
  return true;
}

export function unequipPlayStyle(player: Player, id: PlayStyleId): void {
  const state = ensurePlayStyleState(player);
  state.equipped = state.equipped.filter((x) => x !== id);
}

export function describePlayStyles(player: Player): string {
  const state = getPlayerPlayStyles(player);
  if (!state.unlocked.length) return "No PlayStyles unlocked yet.";
  const lines = state.unlocked.map((id) => {
    const def = DEF_BY_ID.get(id)!;
    const plus = state.plus.includes(id) ? "+" : "";
    const eq = state.equipped.includes(id) ? " \u25CF" : "";
    return `${def.emoji} ${def.name}${plus}${eq}`;
  });
  return `PlayStyles (${state.equipped.length}/${equipSlotCap(player.ovr)} equipped):\n` + lines.join("\n");
}

export function nearUnlocks(player: Player, limit = 5): UnlockCheck[] {
  return PLAYSTYLE_DEFS.map((d) => checkPlayStyle(player, d.id))
    .filter((c) => !c.canUnlockBase && !c.blockedReason && c.missingForBase.length <= 3)
    .sort((a, b) => a.missingForBase.length - b.missingForBase.length)
    .slice(0, limit);
}
