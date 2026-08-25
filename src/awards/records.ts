/**
 * Club / league / career records — only written when actually broken.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { RecordEntry } from "./types.js";
import { Events } from "../core/events.js";

export function getRecords(world: World): Map<string, RecordEntry> {
  if (!(world as any).records) (world as any).records = new Map();
  return (world as any).records;
}

function recordKey(scope: string, key: string, clubId?: string | null, competitionId?: string | null): string {
  return `${scope}|${key}|${clubId ?? ""}|${competitionId ?? ""}`;
}

export function tryBreakRecord(
  world: World,
  opts: {
    scope: RecordEntry["scope"];
    key: string;
    label: string;
    playerId: EntityId;
    value: number;
    seasonId?: string | null;
    clubId?: EntityId | null;
    competitionId?: EntityId | null;
  }
): RecordEntry | null {
  const map = getRecords(world);
  const k = recordKey(opts.scope, opts.key, opts.clubId, opts.competitionId);
  const existing = map.get(k);
  if (existing && existing.value >= opts.value) return null;

  const entry: RecordEntry = {
    id: nextId("rec"),
    scope: opts.scope,
    key: opts.key,
    label: opts.label,
    playerId: opts.playerId,
    value: opts.value,
    seasonId: opts.seasonId ?? null,
    clubId: opts.clubId ?? null,
    competitionId: opts.competitionId ?? null,
    date: world.calendar.currentDate,
  };
  map.set(k, entry);

  world.events.emit(Events.NEWS_GENERATED, {
    type: "record_broken",
    recordKey: opts.key,
    playerId: opts.playerId,
    value: opts.value,
    label: opts.label,
  });

  return entry;
}

export function evaluateRecords(world: World, competitionId: EntityId, seasonId: string): RecordEntry[] {
  const broken: RecordEntry[] = [];
  const competition = world.competitions.get(competitionId);
  if (!competition) return broken;

  for (const p of world.players.values()) {
    if (p.retired) continue;
    const goals = p.state.goalsThisSeason ?? 0;
    if (goals >= 15) {
      const r = tryBreakRecord(world, {
        scope: "League",
        key: "most_goals_season",
        label: `Most goals in a ${competition.name} season`,
        playerId: p.id,
        value: goals,
        seasonId,
        competitionId,
      });
      if (r) broken.push(r);
    }
    if (p.careerGoals >= 50) {
      const r = tryBreakRecord(world, {
        scope: "Career",
        key: "career_goals",
        label: "Career goals milestone",
        playerId: p.id,
        value: p.careerGoals,
      });
      if (r) broken.push(r);
    }
  }
  return broken;
}
