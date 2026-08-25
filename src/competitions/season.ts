/**
 * Season engine: create league + fixtures, play matchdays, end season.
 */

import { nextId } from "../core/id.js";
import { advanceDay, seasonFromDate } from "../core/calendar.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { addCompetition, addFixture } from "../world/world.js";
import type { Competition } from "./types.js";
import { generateLeagueFixtures } from "./fixtures.js";
import { createEmptyTable, applyResult, formatTable, sortTable } from "./league.js";
import { createMatch, simulateMatch } from "../matches/engine.js";
import { tickInjuryRecovery } from "../injuries/engine.js";
import { pruneAllClubs, fillThinSquads } from "../transfers/squad-rules.js";
import { processContractExpiries, processFreeAgentSignings } from "../contracts/lifecycle.js";

export function startSeason(world: World, leagueName = "Premier Division"): Competition {
  const seasonId = world.calendar.currentSeason;
  const clubIds = [...world.clubs.values()]
    .filter((c) => c.nation === "England")
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);

  if (clubIds.length % 2 !== 0) {
    console.warn(`[Season] Club count ${clubIds.length} not even — fixture gen needs even`);
  }

  const competition: Competition = {
    id: nextId("cmp"),
    name: leagueName,
    shortName: "PD",
    type: "League",
    nation: "England",
    seasonId,
    clubIds,
    matchdayCount: (clubIds.length - 1) * 2,
    currentMatchday: 0,
    finished: false,
  };

  addCompetition(world, competition);
  world.leagueTables.set(competition.id, createEmptyTable(clubIds));

  const fixtures = generateLeagueFixtures(
    competition.id,
    clubIds,
    world.calendar.currentDate,
    7
  );
  for (const f of fixtures) addFixture(world, f);

  world.season = {
    seasonId,
    phase: "InSeason",
    leagueIds: [competition.id],
    cupIds: [],
    activeMatchday: 0,
    totalMatchdays: competition.matchdayCount,
  };

  console.log(
    `[Season] ${competition.name} ${seasonId}: ${clubIds.length} clubs, ${fixtures.length} fixtures, ${competition.matchdayCount} matchdays`
  );
  return competition;
}

export function playMatchday(world: World, competitionId: EntityId, matchday: number): void {
  const fixtures = [...world.fixtures.values()].filter(
    (f) => f.competitionId === competitionId && f.matchday === matchday && !f.played
  );

  for (const f of fixtures) {
    while (world.calendar.currentDate < f.date) {
      world.calendar = advanceDay(world.calendar);
      tickInjuryRecovery(world);
    }

    const match = createMatch(world, f.homeClubId, f.awayClubId, f.date, competitionId);
    simulateMatch(world, match, world.rng);

    f.played = true;
    f.matchId = match.id;

    const table = world.leagueTables.get(competitionId);
    if (table) applyResult(table, f.homeClubId, f.awayClubId, match.homeScore, match.awayScore);
  }

  const comp = world.competitions.get(competitionId);
  if (comp) comp.currentMatchday = matchday;
  if (world.season) world.season.activeMatchday = matchday;
}

export function playFullSeason(world: World, competitionId: EntityId): void {
  const comp = world.competitions.get(competitionId);
  if (!comp) return;
  for (let md = 1; md <= comp.matchdayCount; md++) {
    playMatchday(world, competitionId, md);
  }
  comp.finished = true;
  if (world.season) world.season.phase = "PostSeason";
}

export function endSeasonProcessing(world: World): void {
  // Age players + soft season stats
  for (const p of world.players.values()) {
    if (p.retired) continue;
    p.age += 1;
    p.state.matchMinutesThisSeason = 0;
    p.state.appearancesThisSeason = 0;
    p.state.goalsThisSeason = 0;
    p.state.assistsThisSeason = 0;
    p.state.cleanSheetsThisSeason = 0;
    p.state.yellowCardsThisSeason = 0;
    p.state.redCardsThisSeason = 0;
    p.state.averageRatingThisSeason = 0;
    p.state.ratingCount = 0;
    if (p.age >= 36 && !p.isUserControlled && world.rng.chance(0.25 + (p.age - 36) * 0.1)) {
      p.retired = true;
      p.retirementDate = world.calendar.currentDate;
      if (p.currentClubId) {
        const club = world.clubs.get(p.currentClubId);
        if (club) {
          club.squadPlayerIds = club.squadPlayerIds.filter((id) => id !== p.id);
        }
        p.currentClubId = null;
        p.contract = null;
      }
    }
  }

  processContractExpiries(world);
  processFreeAgentSignings(world);
  pruneAllClubs(world);
  fillThinSquads(world);

  for (const [compId, table] of world.leagueTables) {
    const competition = world.competitions.get(compId);
    if (!competition || competition.type !== "League") continue;
    for (const row of table) {
      const club = world.clubs.get(row.clubId);
      if (!club) continue;
      const prize = Math.round(50_000_000 * Math.pow(0.85, row.position - 1));
      club.finances.balance += prize;
      club.finances.revenueSeason += prize;
      club.finances.transferBudget = Math.round(club.finances.transferBudget * 0.4 + prize * 0.25);
    }
  }
}

export function beginNextSeason(world: World): Competition {
  const parts = world.calendar.currentDate.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const nextJulyYear = m >= 7 ? y + 1 : y;
  const nextStart = `${nextJulyYear}-07-01`;

  while (world.calendar.currentDate < nextStart) {
    world.calendar = advanceDay(world.calendar);
    tickInjuryRecovery(world);
  }
  world.calendar.currentSeason = seasonFromDate(world.calendar.currentDate);
  world.calendar.dayOfSeason = 0;

  world.fixtures.clear();
  world.matches.clear();
  world.leagueTables.clear();
  for (const [id, c] of [...world.competitions]) {
    if (c.type === "League" && c.finished) world.competitions.delete(id);
  }

  world.transferWindowOpen = true;
  return startSeason(world);
}

export function printLeagueTable(world: World, competitionId: EntityId): void {
  const table = world.leagueTables.get(competitionId);
  if (!table) {
    console.log("No table");
    return;
  }
  sortTable(table);
  console.log(formatTable(table, (id) => world.clubs.get(id)?.name ?? id));
}
