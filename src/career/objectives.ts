/**
 * Season objectives — hybrid FM structure + FC progression clarity.
 * Generated once per season for the user player; progress is derived from live stats.
 */

import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { addSkillPoints } from "../players/skill-points.js";

export type ObjectiveKind =
  | "appearances"
  | "goals"
  | "assists"
  | "avgRating"
  | "trust"
  | "playStyle";

export interface SeasonObjective {
  id: string;
  kind: ObjectiveKind;
  label: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  rewardSp: number;
  completed: boolean;
  claimed: boolean;
}

interface SeasonObjectivesState {
  season: string;
  playerId: string;
  objectives: SeasonObjective[];
}

function ensureState(world: World): SeasonObjectivesState | null {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const season = world.calendar.currentSeason;
  let st = (world as any).seasonObjectives as SeasonObjectivesState | undefined;
  if (!st || st.season !== season || st.playerId !== pid) {
    const player = world.players.get(pid);
    if (!player) return null;
    st = {
      season,
      playerId: pid,
      objectives: generateObjectives(player),
    };
    (world as any).seasonObjectives = st;
  }
  return st;
}

function generateObjectives(player: Player): SeasonObjective[] {
  const ovr = player.ovr;
  const pos = player.primaryPosition;
  const isAttack =
    pos === "ST" || pos === "CF" || pos === "LW" || pos === "RW" || pos === "CAM";
  const isMid = pos === "CM" || pos === "CDM" || pos === "LM" || pos === "RM";

  const appsTarget = ovr >= 78 ? 28 : ovr >= 70 ? 20 : 12;
  const goalsTarget = isAttack ? (ovr >= 75 ? 12 : 6) : isMid ? 4 : 2;
  const assistsTarget = isAttack || isMid ? (ovr >= 75 ? 8 : 4) : 2;
  const ratingTarget = ovr >= 78 ? 7.0 : 6.5;
  const trustTarget = 70;

  const list: SeasonObjective[] = [
    {
      id: "apps",
      kind: "appearances",
      label: "Get minutes",
      description: `Make ${appsTarget} league/senior appearances this season`,
      target: appsTarget,
      current: 0,
      unit: "apps",
      rewardSp: 2,
      completed: false,
      claimed: false,
    },
    {
      id: "goals",
      kind: "goals",
      label: "Find the net",
      description: `Score ${goalsTarget} goals this season`,
      target: goalsTarget,
      current: 0,
      unit: "goals",
      rewardSp: 2,
      completed: false,
      claimed: false,
    },
    {
      id: "assists",
      kind: "assists",
      label: "Create",
      description: `Record ${assistsTarget} assists this season`,
      target: assistsTarget,
      current: 0,
      unit: "assists",
      rewardSp: 1,
      completed: false,
      claimed: false,
    },
    {
      id: "rating",
      kind: "avgRating",
      label: "Consistency",
      description: `Hold a season average rating of ${ratingTarget.toFixed(1)}+ (min 5 apps)`,
      target: ratingTarget,
      current: 0,
      unit: "avg",
      rewardSp: 2,
      completed: false,
      claimed: false,
    },
    {
      id: "trust",
      kind: "trust",
      label: "Manager's trust",
      description: `Reach ${trustTarget} manager trust`,
      target: trustTarget,
      current: 0,
      unit: "%",
      rewardSp: 1,
      completed: false,
      claimed: false,
    },
  ];
  return list;
}

function avgRating(player: Player): number {
  const apps = player.state.appearancesThisSeason || 0;
  if (apps < 1) return 0;
  const form = player.state.form ?? 50;
  return Math.round((5.5 + form / 40) * 10) / 10;
}

export function refreshObjectives(world: World): SeasonObjective[] {
  const st = ensureState(world);
  if (!st) return [];
  const player = world.players.get(st.playerId);
  if (!player) return st.objectives;

  for (const o of st.objectives) {
    if (o.claimed) continue;
    if (o.kind === "appearances") o.current = player.state.appearancesThisSeason ?? 0;
    else if (o.kind === "goals") o.current = player.state.goalsThisSeason ?? 0;
    else if (o.kind === "assists") o.current = player.state.assistsThisSeason ?? 0;
    else if (o.kind === "avgRating") o.current = avgRating(player);
    else if (o.kind === "trust") o.current = Math.round(player.state.managerTrust ?? 50);
    o.completed = o.current >= o.target;
  }
  return st.objectives;
}

export function claimObjective(world: World, objectiveId: string): { ok: boolean; sp?: number; message: string } {
  const st = ensureState(world);
  if (!st) return { ok: false, message: "No objectives" };
  refreshObjectives(world);
  const o = st.objectives.find((x) => x.id === objectiveId);
  if (!o) return { ok: false, message: "Unknown objective" };
  if (!o.completed) return { ok: false, message: "Not completed yet" };
  if (o.claimed) return { ok: false, message: "Already claimed" };
  const player = world.players.get(st.playerId);
  if (!player) return { ok: false, message: "No player" };
  o.claimed = true;
  addSkillPoints(player, o.rewardSp);
  return { ok: true, sp: o.rewardSp, message: `Claimed +${o.rewardSp} SP` };
}

export function snapshotObjectives(world: World) {
  const list = refreshObjectives(world);
  const done = list.filter((o) => o.completed).length;
  const claimed = list.filter((o) => o.claimed).length;
  return {
    season: (world as any).seasonObjectives?.season ?? world.calendar.currentSeason,
    progress: list.length ? Math.round((done / list.length) * 100) : 0,
    completed: done,
    claimed,
    total: list.length,
    objectives: list.map((o) => ({
      ...o,
      pct: Math.min(100, Math.round((o.current / Math.max(0.01, o.target)) * 100)),
    })),
  };
}
