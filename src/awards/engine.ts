/**
 * Season awards (Golden Boot, Player of the Season, etc.).
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import type { AwardResult } from "./types.js";

function awardsList(world: World): AwardResult[] {
  if (!(world as any).awards) (world as any).awards = [];
  return (world as any).awards;
}

export function computeSeasonAwards(world: World, competitionId: EntityId): AwardResult[] {
  const out: AwardResult[] = [];
  const seasonId = world.calendar.currentSeason;
  const competition = world.competitions.get(competitionId);
  if (!competition) return out;

  // Golden Boot — most goals among players who appeared for clubs in this league
  const clubSet = new Set(competition.clubIds);
  let topScorer: { id: EntityId; goals: number } | null = null;
  let topRating: { id: EntityId; rating: number; apps: number } | null = null;
  let topYoung: { id: EntityId; goals: number } | null = null;

  for (const p of world.players.values()) {
    if (p.retired || !p.currentClubId || !clubSet.has(p.currentClubId)) continue;
    const g = p.state.goalsThisSeason ?? 0;
    const apps = p.state.appearancesThisSeason ?? 0;
    if (g > (topScorer?.goals ?? -1)) topScorer = { id: p.id, goals: g };
    if (apps >= 10) {
      const r = p.state.averageRatingThisSeason ?? 0;
      if (r > (topRating?.rating ?? -1)) topRating = { id: p.id, rating: r, apps };
    }
    if (p.age <= 21 && g > (topYoung?.goals ?? -1)) topYoung = { id: p.id, goals: g };
  }

  if (topScorer && topScorer.goals > 0) {
    const award: AwardResult = {
      id: nextId("awd"),
      type: "GoldenBoot",
      seasonId,
      competitionId,
      playerId: topScorer.id,
      value: topScorer.goals,
      label: `Golden Boot — ${topScorer.goals} goals`,
    };
    out.push(award);
    awardsList(world).push(award);
  }

  if (topRating) {
    const award: AwardResult = {
      id: nextId("awd"),
      type: "PlayerOfTheSeason",
      seasonId,
      competitionId,
      playerId: topRating.id,
      value: topRating.rating,
      label: "Player of the Season",
    };
    out.push(award);
    awardsList(world).push(award);
  }

  if (topYoung && topYoung.goals > 0) {
    const award: AwardResult = {
      id: nextId("awd"),
      type: "YoungPlayer",
      seasonId,
      competitionId,
      playerId: topYoung.id,
      value: topYoung.goals,
      label: "Young Player of the Season",
    };
    out.push(award);
    awardsList(world).push(award);
  }

  for (const a of out) {
    world.events.emit(Events.NEWS_GENERATED, {
      type: "award",
      awardType: a.type,
      playerId: a.playerId,
      label: a.label,
    });
    const p = world.players.get(a.playerId);
    if (p) {
      p.reputation = Math.min(100, p.reputation + 3);
      p.careerTrophies += a.type === "GoldenBoot" ? 0 : 0;
    }
  }

  return out;
}

export function computeMonthlyAwards(_world: World, _competitionId: EntityId): AwardResult[] {
  return [];
}

export function computeInternationalAwards(_world: World): AwardResult[] {
  return [];
}
