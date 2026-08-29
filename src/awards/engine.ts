/**
 * Expanded awards — season, monthly, team of the season, manager awards.
 * All driven by real stats / results.
 */

import { nextId } from "../core/id.js";
import type { EntityId, Position } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Award, AwardType } from "./types.js";
import { Events } from "../core/events.js";

export function getAwards(world: World): Award[] {
  return ((world as any).awards as Award[]) ?? [];
}

function storeAward(world: World, award: Award): void {
  if (!(world as any).awards) (world as any).awards = [];
  (world as any).awards.push(award);
}

function makeAward(
  world: World,
  type: AwardType,
  seasonId: string,
  competitionId: EntityId | null,
  opts: {
    playerId?: EntityId | null;
    managerId?: EntityId | null;
    clubId?: EntityId | null;
    value?: number;
    month?: number | null;
    position?: Position | null;
  } = {}
): Award {
  return {
    id: nextId("awd"),
    type,
    seasonId,
    competitionId,
    playerId: opts.playerId ?? null,
    managerId: opts.managerId ?? null,
    clubId: opts.clubId ?? null,
    value: opts.value ?? 0,
    date: world.calendar.currentDate,
    month: opts.month ?? null,
    position: opts.position ?? null,
  };
}

function emitAwardNews(world: World, a: Award): void {
  if (a.playerId) {
    const player = world.players.get(a.playerId);
    if (player) {
      const bump =
        a.type === "PlayerOfTheSeason"
          ? 5
          : a.type === "GoldenBoot" || a.type === "TeamOfTheSeason"
            ? 4
            : a.type === "PlayerOfTheMonth"
              ? 2
              : 3;
      player.reputation = Math.min(100, player.reputation + bump);
    }
  }
  world.events.emit(Events.NEWS_GENERATED, {
    type: "award",
    awardType: a.type,
    playerId: a.playerId,
    managerId: a.managerId,
    clubId: a.clubId,
    seasonId: a.seasonId,
    value: a.value,
    month: a.month,
    position: a.position,
  });
}

type PlayerRow = {
  playerId: EntityId;
  goals: number;
  assists: number;
  apps: number;
  cleanSheets: number;
  ovr: number;
  age: number;
  form: number;
  avgRating: number;
  clubId: EntityId | null;
  position: Position;
  isGk: boolean;
};

function collectRows(world: World, clubIds: Set<EntityId>): PlayerRow[] {
  const rows: PlayerRow[] = [];
  for (const p of world.players.values()) {
    if (p.retired) continue;
    if (!p.currentClubId || !clubIds.has(p.currentClubId)) continue;
    const goals = p.state.goalsThisSeason ?? 0;
    const assists = p.state.assistsThisSeason ?? 0;
    const apps = p.state.appearancesThisSeason ?? 0;
    const cleanSheets = (p.state as any).cleanSheetsThisSeason ?? 0;
    if (apps === 0 && goals === 0 && assists === 0) continue;
    rows.push({
      playerId: p.id,
      goals,
      assists,
      apps,
      cleanSheets,
      ovr: p.ovr,
      age: p.age,
      form: p.state.form,
      avgRating: p.state.averageRatingThisSeason || p.state.form,
      clubId: p.currentClubId,
      position: p.primaryPosition,
      isGk: p.primaryPosition === "GK",
    });
  }
  return rows;
}

export function computeSeasonAwards(
  world: World,
  competitionId: EntityId,
  seasonId: string
): Award[] {
  const awards: Award[] = [];
  const competition = world.competitions.get(competitionId);
  if (!competition) return awards;

  const clubIds = new Set(competition.clubIds);
  const rows = collectRows(world, clubIds);
  if (!rows.length) return awards;

  const potyScore = (r: PlayerRow) =>
    r.goals * 3 + r.assists * 2 + r.apps * 0.4 + r.form * 0.25 + r.ovr * 0.35 + r.avgRating * 0.3;

  const byGoals = [...rows].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  if (byGoals[0] && byGoals[0].goals > 0) {
    awards.push(
      makeAward(world, "GoldenBoot", seasonId, competitionId, {
        playerId: byGoals[0]!.playerId,
        clubId: byGoals[0]!.clubId,
        value: byGoals[0]!.goals,
      })
    );
  }

  const byAssists = [...rows].sort((a, b) => b.assists - a.assists || b.goals - a.goals);
  if (byAssists[0] && byAssists[0].assists > 0) {
    awards.push(
      makeAward(world, "Playmaker", seasonId, competitionId, {
        playerId: byAssists[0]!.playerId,
        clubId: byAssists[0]!.clubId,
        value: byAssists[0]!.assists,
      })
    );
  }

  const poty = [...rows].filter((r) => r.apps >= 10).sort((a, b) => potyScore(b) - potyScore(a));
  if (poty[0]) {
    awards.push(
      makeAward(world, "PlayerOfTheSeason", seasonId, competitionId, {
        playerId: poty[0]!.playerId,
        clubId: poty[0]!.clubId,
        value: Math.round(potyScore(poty[0]!)),
      })
    );
  }

  const young = [...rows]
    .filter((r) => r.age <= 23 && r.apps >= 8)
    .sort((a, b) => potyScore(b) - potyScore(a));
  if (young[0]) {
    awards.push(
      makeAward(world, "YoungPlayerOfTheSeason", seasonId, competitionId, {
        playerId: young[0]!.playerId,
        clubId: young[0]!.clubId,
        value: Math.round(potyScore(young[0]!)),
      })
    );
  }

  const gks = [...rows]
    .filter((r) => r.isGk && r.apps >= 10)
    .sort((a, b) => b.cleanSheets * 3 + b.form + b.ovr * 0.4 - (a.cleanSheets * 3 + a.form + a.ovr * 0.4));
  if (gks[0]) {
    awards.push(
      makeAward(world, "GoalkeeperOfTheSeason", seasonId, competitionId, {
        playerId: gks[0]!.playerId,
        clubId: gks[0]!.clubId,
        value: gks[0]!.cleanSheets || gks[0]!.apps,
      })
    );
  }

  const byCs = [...rows]
    .filter((r) => r.cleanSheets > 0)
    .sort((a, b) => b.cleanSheets - a.cleanSheets || b.apps - a.apps);
  if (byCs[0] && byCs[0].cleanSheets >= 5) {
    awards.push(
      makeAward(world, "CleanSheetLeader", seasonId, competitionId, {
        playerId: byCs[0]!.playerId,
        clubId: byCs[0]!.clubId,
        value: byCs[0]!.cleanSheets,
      })
    );
  }

  const totsSlots: { pos: Position; filter: (r: PlayerRow) => boolean; count: number }[] = [
    { pos: "GK", filter: (r) => r.isGk, count: 1 },
    { pos: "CB", filter: (r) => r.position === "CB", count: 2 },
    { pos: "LB", filter: (r) => r.position === "LB" || r.position === "LWB", count: 1 },
    { pos: "RB", filter: (r) => r.position === "RB" || r.position === "RWB", count: 1 },
    { pos: "CM", filter: (r) => ["CDM", "CM", "CAM"].includes(r.position), count: 3 },
    { pos: "LW", filter: (r) => r.position === "LW" || r.position === "LM", count: 1 },
    { pos: "RW", filter: (r) => r.position === "RW" || r.position === "RM", count: 1 },
    { pos: "ST", filter: (r) => r.position === "ST" || r.position === "CF", count: 1 },
  ];

  for (const slot of totsSlots) {
    const pool = rows
      .filter((r) => slot.filter(r) && r.apps >= 8)
      .sort((a, b) => potyScore(b) - potyScore(a));
    for (let i = 0; i < slot.count && i < pool.length; i++) {
      awards.push(
        makeAward(world, "TeamOfTheSeason", seasonId, competitionId, {
          playerId: pool[i]!.playerId,
          clubId: pool[i]!.clubId,
          value: Math.round(potyScore(pool[i]!)),
          position: slot.pos,
        })
      );
    }
  }

  const table = world.leagueTables.get(competitionId);
  if (table && table.length) {
    const winner = [...table].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference)[0]!;
    const club = world.clubs.get(winner.clubId);
    const managerId = (club as any)?.managerId ?? null;
    awards.push(
      makeAward(world, "ManagerOfTheSeason", seasonId, competitionId, {
        managerId,
        clubId: winner.clubId,
        value: winner.points,
      })
    );
  }

  const fair = [...rows]
    .filter((r) => r.apps >= 15)
    .map((r) => {
      const p = world.players.get(r.playerId)!;
      const cards =
        (p.state.yellowCardsThisSeason ?? 0) + (p.state.redCardsThisSeason ?? 0) * 3;
      return { r, cards };
    })
    .sort((a, b) => a.cards - b.cards || b.r.apps - a.r.apps);
  if (fair[0] && fair[0].cards <= 3) {
    awards.push(
      makeAward(world, "FairPlay", seasonId, competitionId, {
        playerId: fair[0]!.r.playerId,
        clubId: fair[0]!.r.clubId,
        value: fair[0]!.cards,
      })
    );
  }

  for (const a of awards) {
    storeAward(world, a);
    emitAwardNews(world, a);
  }
  return awards;
}

export function computeMonthlyAwards(
  world: World,
  competitionId: EntityId,
  seasonId: string,
  month: number
): Award[] {
  const awards: Award[] = [];
  const competition = world.competitions.get(competitionId);
  if (!competition) return awards;

  const clubIds = new Set(competition.clubIds);
  const rows = collectRows(world, clubIds).filter((r) => r.apps >= 2);
  if (!rows.length) return awards;

  const potm = [...rows].sort(
    (a, b) =>
      b.form * 0.5 + b.goals * 4 + b.assists * 3 + b.avgRating * 0.4 -
      (a.form * 0.5 + a.goals * 4 + a.assists * 3 + a.avgRating * 0.4)
  );
  if (potm[0]) {
    const a = makeAward(world, "PlayerOfTheMonth", seasonId, competitionId, {
      playerId: potm[0]!.playerId,
      clubId: potm[0]!.clubId,
      value: Math.round(potm[0]!.form),
      month,
    });
    storeAward(world, a);
    emitAwardNews(world, a);
    awards.push(a);
  }

  const table = world.leagueTables.get(competitionId);
  if (table) {
    const ranked = [...table].sort((a, b) => {
      const formScore = (row: typeof a) => {
        const f = (row as any).form as string | undefined;
        if (!f) return row.points;
        return [...f].reduce((s, c) => s + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
      };
      return formScore(b) - formScore(a) || b.points - a.points;
    });
    if (ranked[0]) {
      const club = world.clubs.get(ranked[0]!.clubId);
      const a = makeAward(world, "ManagerOfTheMonth", seasonId, competitionId, {
        managerId: (club as any)?.managerId ?? null,
        clubId: ranked[0]!.clubId,
        value: ranked[0]!.points,
        month,
      });
      storeAward(world, a);
      emitAwardNews(world, a);
      awards.push(a);
    }
  }

  return awards;
}

export function computeInternationalAwards(world: World, seasonId: string): Award[] {
  const awards: Award[] = [];
  const candidates = [...world.players.values()]
    .filter((p) => !p.retired && ((p as any).internationalCaps ?? 0) >= 3)
    .sort(
      (a, b) =>
        ((b as any).internationalGoals ?? 0) * 3 +
          ((b as any).internationalCaps ?? 0) +
          b.reputation -
        (((a as any).internationalGoals ?? 0) * 3 +
          ((a as any).internationalCaps ?? 0) +
          a.reputation)
    );
  if (candidates[0]) {
    const a = makeAward(world, "InternationalPlayerOfTheYear", seasonId, null, {
      playerId: candidates[0]!.id,
      clubId: candidates[0]!.currentClubId,
      value: (candidates[0] as any).internationalCaps ?? 0,
    });
    storeAward(world, a);
    emitAwardNews(world, a);
    awards.push(a);
  }
  return awards;
}

export function awardLeagueAndCupTrophies(world: World): Award[] {
  const out: Award[] = [];
  const seasonId = world.calendar.currentSeason;
  const date = world.calendar.currentDate;
  const store: Award[] = (world as any).awards ?? [];

  for (const comp of world.competitions.values()) {
    if (comp.seasonId !== seasonId) continue;
    let winnerId: string | null = null;
    let type: AwardType | null = null;

    if (comp.type === "League") {
      const table = world.leagueTables.get(comp.id);
      if (table && table.length) {
        const sorted = [...table].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
        winnerId = sorted[0]?.clubId ?? null;
        type = "LeagueTitle";
      }
    } else if (comp.type === "Continental") {
      const table = world.leagueTables.get(comp.id);
      if (table && table.length) {
        const sorted = [...table].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);
        winnerId = sorted[0]?.clubId ?? null;
        type = "ContinentalChampion";
      }
    } else if (comp.type === "DomesticCup" || comp.type === "SuperCup") {
      const clubs = comp.clubIds
        .map((id) => world.clubs.get(id))
        .filter(Boolean)
        .sort((a, b) => (b!.reputation - a!.reputation));
      winnerId = clubs[0]?.id ?? null;
      type = comp.type === "SuperCup" ? "SuperCupWinner" : "CupWinner";
    }

    if (!winnerId || !type) continue;
    const award: Award = {
      id: nextId("awd"),
      type,
      seasonId,
      competitionId: comp.id,
      playerId: null,
      managerId: null,
      clubId: winnerId,
      value: 1,
      date,
      month: null,
      position: null,
    };
    store.push(award);
    out.push(award);
    const club = world.clubs.get(winnerId);
    world.events.emit(Events.NEWS_GENERATED, {
      articleId: award.id,
      headline: `${club?.name ?? "Club"} win ${comp.name}`,
    });
  }

  (world as any).awards = store;
  return out;
}
