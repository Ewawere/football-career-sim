/**
 * Season engine: create league + fixtures, play matchdays, end season.
 */

import { nextId } from "../core/id.js";
import { advanceDay, seasonFromDate, addDays } from "../core/calendar.js";
import type { EntityId, SeasonId } from "../core/types.js";
import type { World } from "../world/world.js";
import { addCompetition, addFixture } from "../world/world.js";
import type { Competition, Fixture, SeasonState } from "./types.js";
import { generateLeagueFixtures } from "./fixtures.js";
import { createEmptyTable, applyResult, formatTable, sortTable } from "./league.js";
import { createMatch, simulateMatch } from "../matches/engine.js";
import { Events } from "../core/events.js";
import { calculateOVR } from "../players/attributes.js";
import { developAllPlayers } from "../training/development.js";
import { tickInjuries, getActiveInjury } from "../injuries/engine.js";
import { runTransferWindow, formatWindowReport } from "../transfers/window.js";
import { pruneAllClubs, fillThinSquads } from "../transfers/squad-rules.js";
import { runYouthCycle } from "../scouting/engine.js";
import { runInternationalBreak } from "../international/selection.js";
import { computeSeasonAwards, computeMonthlyAwards, computeInternationalAwards, awardLeagueAndCupTrophies } from "../awards/engine.js";
import { evaluateRecords } from "../awards/records.js";
import { processRetirements } from "../awards/legacy.js";
import { updateBoardConfidenceAfterMatch, endOfSeasonBoardReview, processManagerSackings } from "../managers/career.js";
function getActiveInjurySafe(world: any, id: string) { return getActiveInjury(world, id); }

const LEAGUE_DEFS: { nation: string; name: string; shortName: string }[] = [
  { nation: "England", name: "Premier League", shortName: "EPL" },
  { nation: "Spain", name: "La Liga", shortName: "LAL" },
  { nation: "Germany", name: "Bundesliga", shortName: "BUN" },
  { nation: "Italy", name: "Serie A", shortName: "SEA" },
  { nation: "France", name: "Ligue 1", shortName: "LI1" },
  { nation: "Portugal", name: "Primeira Liga", shortName: "POR" },
  { nation: "Netherlands", name: "Eredivisie", shortName: "ERE" },
];

function createDomesticLeague(
  world: World,
  seasonId: SeasonId,
  nation: string,
  name: string,
  shortName: string
): Competition | null {
  const clubIds = [...world.clubs.values()]
    .filter((c) => c.nation === nation)
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);
  if (clubIds.length < 4) return null;

  const competition: Competition = {
    id: nextId("cmp"),
    name,
    shortName,
    type: "League",
    nation,
    seasonId,
    clubIds,
    matchdayCount: 2 * (clubIds.length - 1),
    currentMatchday: 0,
    finished: false,
  };

  addCompetition(world, competition);
  world.leagues.set(competition.id, clubIds);

  const fixtures = generateLeagueFixtures(
    competition.id,
    clubIds,
    world.calendar.currentDate,
    7
  );
  for (const f of fixtures) addFixture(world, f);
  world.leagueTables.set(competition.id, createEmptyTable(clubIds));

  console.log(
    `[Season] ${name} ${seasonId}: ${clubIds.length} clubs, ${fixtures.length} fixtures, ${competition.matchdayCount} MDs`
  );
  return competition;
}

function createContinental(
  world: World,
  seasonId: SeasonId,
  name: string,
  shortName: string,
  type: "Continental",
  topN: number,
  skipN = 0
): Competition | null {
  const clubIds = [...world.clubs.values()]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(skipN, skipN + topN)
    .map((c) => c.id);
  if (clubIds.length < 8) return null;

  const competition: Competition = {
    id: nextId("cmp"),
    name,
    shortName,
    type,
    nation: null,
    seasonId,
    clubIds,
    matchdayCount: 8,
    currentMatchday: 0,
    finished: false,
  };
  addCompetition(world, competition);

  const rng = world.rng;
  for (let md = 1; md <= 8; md++) {
    const pool = rng.shuffle([...clubIds]);
    for (let i = 0; i + 1 < pool.length; i += 2) {
      const home = pool[i]!;
      const away = pool[i + 1]!;
      addFixture(world, {
        id: nextId("fx"),
        competitionId: competition.id,
        matchday: md,
        homeClubId: home,
        awayClubId: away,
        date: world.calendar.currentDate,
        matchId: null,
        played: false,
      });
    }
  }
  world.leagueTables.set(competition.id, createEmptyTable(clubIds));
  console.log(`[Season] ${name}: ${clubIds.length} clubs, 8 MD league phase`);
  return competition;
}

export function startSeason(world: World, leagueName = "Premier League"): Competition {
  const seasonId = world.calendar.currentSeason;
  const leagueIds: EntityId[] = [];
  const cupIds: EntityId[] = [];
  let primary: Competition | null = null;

  for (const def of LEAGUE_DEFS) {
    const c = createDomesticLeague(world, seasonId, def.nation, def.name, def.shortName);
    if (c) {
      leagueIds.push(c.id);
      if (def.nation === "England") primary = c;
      if (!primary && def.name === leagueName) primary = c;
    }
  }

  const ucl = createContinental(world, seasonId, "UEFA Champions League", "UCL", "Continental", 32, 0);
  const uel = createContinental(world, seasonId, "UEFA Europa League", "UEL", "Continental", 24, 32);
  const uecl = createContinental(world, seasonId, "UEFA Conference League", "UECL", "Continental", 24, 56);
  if (ucl) cupIds.push(ucl.id);
  if (uel) cupIds.push(uel.id);
  if (uecl) cupIds.push(uecl.id);

  const cupNames: Record<string, { main: string; league?: string; super?: string }> = {
    England: { main: "FA Cup", league: "EFL Cup", super: "Community Shield" },
    Spain: { main: "Copa del Rey", super: "Supercopa de España" },
    Germany: { main: "DFB-Pokal", super: "DFL-Supercup" },
    Italy: { main: "Coppa Italia", super: "Supercoppa Italiana" },
    France: { main: "Coupe de France", league: "Coupe de la Ligue", super: "Trophée des Champions" },
    Portugal: { main: "Taça de Portugal", league: "Taça da Liga", super: "Supertaça" },
    Netherlands: { main: "KNVB Cup", super: "Johan Cruyff Shield" },
  };
  for (const def of LEAGUE_DEFS) {
    const clubIds = [...world.clubs.values()]
      .filter((c) => c.nation === def.nation)
      .map((c) => c.id);
    if (clubIds.length < 4) continue;
    const names = cupNames[def.nation] ?? { main: `${def.nation} Cup` };
    for (const [key, cupName] of Object.entries(names)) {
      if (!cupName) continue;
      const cup: Competition = {
        id: nextId("cmp"),
        name: cupName,
        shortName: key === "main" ? "CUP" : key === "league" ? "LC" : "SC",
        type: key === "super" ? "SuperCup" : "DomesticCup",
        nation: def.nation,
        seasonId,
        clubIds: key === "super" ? clubIds.slice(0, 2) : clubIds,
        matchdayCount: key === "super" ? 1 : 0,
        currentMatchday: 0,
        finished: false,
      };
      addCompetition(world, cup);
      cupIds.push(cup.id);
    }
  }

  if (!primary) {
    primary = [...world.competitions.values()].find((c) => c.type === "League") ?? null;
  }
  if (!primary) throw new Error("No league competition created");

  world.season = {
    seasonId,
    phase: "InSeason",
    leagueIds,
    cupIds,
    activeMatchday: 0,
    totalMatchdays: primary.matchdayCount,
  };

  world.events.emit(Events.SEASON_STARTED, {
    seasonId,
    competitionId: primary.id,
    leagues: leagueIds.length,
    cups: cupIds.length,
  });

  console.log(
    `[Season] Europe ${seasonId}: ${leagueIds.length} leagues, ${cupIds.length} cups/continental — primary ${primary.name}`
  );

  return primary;
}

export function playMatchday(world: World, competitionId: EntityId, matchday: number): number {
  const competition = world.competitions.get(competitionId);
  if (!competition) throw new Error("Competition not found");

  if (matchday === 5 || matchday === 13 || matchday === 25) {
    runInternationalBreak(world, 10);
    console.log(`[International] Break before MD${matchday}`);
  }

  if (matchday > 1 && matchday % 4 === 0) {
    const month = Math.ceil(matchday / 4);
    const monthly = computeMonthlyAwards(world, competitionId, competition.seasonId, month);
    if (monthly.length) {
      console.log(`[Awards] Month ${month}: ${monthly.map((a) => a.type).join(", ")}`);
    }
  }

  const fixtures = [...world.fixtures.values()].filter(
    (f) => f.competitionId === competitionId && f.matchday === matchday && !f.played
  );

  if (fixtures.length === 0) {
    console.warn(`[Matchday ${matchday}] No unplayed fixtures`);
    return 0;
  }

  const targetDate = fixtures[0]!.date;
  while (world.calendar.currentDate < targetDate) {
    world.calendar = advanceDay(world.calendar);
  }

  const table = world.leagueTables.get(competitionId)!;
  let played = 0;

  for (const fixture of fixtures) {
    const match = createMatch(
      world,
      fixture.homeClubId,
      fixture.awayClubId,
      fixture.date,
      competitionId
    );
    world.matches.set(match.id, match);

    const result = simulateMatch(world, match, world.rng);
    fixture.played = true;
    fixture.matchId = match.id;

    applyResult(table, result.homeClubId, result.awayClubId, result.homeScore, result.awayScore);

    world.events.emit(Events.MATCH_FINISHED, {
      matchId: match.id,
      homeClubId: result.homeClubId,
      awayClubId: result.awayClubId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    });

    const hs = result.homeScore;
    const as_ = result.awayScore;
    updateBoardConfidenceAfterMatch(
      world,
      result.homeClubId,
      hs > as_ ? "W" : hs < as_ ? "L" : "D",
      true
    );
    updateBoardConfidenceAfterMatch(
      world,
      result.awayClubId,
      as_ > hs ? "W" : as_ < hs ? "L" : "D",
      false
    );

    played++;
  }

  competition.currentMatchday = matchday;
  if (world.season) world.season.activeMatchday = matchday;

  for (let d = 0; d < 7; d++) tickInjuries(world);
  for (const p of world.players.values()) {
    if (p.retired) continue;
    if (getActiveInjurySafe(world, p.id)) continue;
    p.state.fitness = Math.min(100, p.state.fitness + 8);
    p.state.fatigue = Math.max(0, p.state.fatigue - 10);
  }

  return played;
}

export function playFullSeason(world: World, competitionId: EntityId): void {
  const competition = world.competitions.get(competitionId)!;
  const startMD = competition.currentMatchday + 1;
  const endMD = competition.matchdayCount;

  for (let md = startMD; md <= endMD; md++) {
    const n = playMatchday(world, competitionId, md);
    if (md % 5 === 0 || md === endMD) {
      const table = world.leagueTables.get(competitionId)!;
      const leader = table[0]!;
      const club = world.clubs.get(leader.clubId)!;
      console.log(
        `  MD ${md}/${endMD}: ${n} matches | Leader: ${club.name} ${leader.points}pts GD${leader.goalDifference >= 0 ? "+" : ""}${leader.goalDifference}`
      );
    }
  }

  competition.finished = true;
  if (world.season) world.season.phase = "PostSeason";
  world.events.emit(Events.SEASON_ENDED, { seasonId: competition.seasonId, competitionId });
}

export function endSeasonProcessing(world: World): void {
  console.log("[Season] End-of-season processing...");
  developAllPlayers(world);

  for (const [compId, table] of world.leagueTables) {
    const competition = world.competitions.get(compId);
    if (!competition || competition.type !== "League") continue;
    const awards = awardLeagueAndCupTrophies(world);
    computeSeasonAwards(world, compId, competition.seasonId);
    const records = evaluateRecords(world, compId, competition.seasonId);
    if (awards.length) {
      console.log(`[Awards] ${awards.map((a) => a.type).join(", ")}`);
    }
    if (records.length) {
      console.log(`[Records] ${records.length} broken`);
    }
  }

  for (const player of world.players.values()) {
    if (player.retired) continue;
    player.age += 1;
    if (player.age >= 31) {
      const decline = player.age >= 34 ? 1.5 : 0.8;
      player.attributes.physical.pace = Math.max(1, Math.round(player.attributes.physical.pace - decline * world.rng.float(0.5, 1.2)));
      player.attributes.physical.acceleration = Math.max(1, Math.round(player.attributes.physical.acceleration - decline * world.rng.float(0.4, 1.0)));
      player.attributes.physical.stamina = Math.max(1, Math.round(player.attributes.physical.stamina - decline * world.rng.float(0.3, 0.9)));
      player.ovr = calculateOVR(player.attributes, player.primaryPosition);
    }
    player.state.matchMinutesThisSeason = 0;
    player.state.appearancesThisSeason = 0;
    player.state.goalsThisSeason = 0;
    player.state.assistsThisSeason = 0;
    (player.state as any).cleanSheetsThisSeason = 0;
    player.state.yellowCardsThisSeason = 0;
    player.state.redCardsThisSeason = 0;
    player.state.averageRatingThisSeason = 0;
    player.state.ratingCount = 0;
    player.state.form = Math.round(player.state.form * 0.7 + 50 * 0.3);
    player.state.fitness = Math.min(100, player.state.fitness + 15);
    player.state.fatigue = Math.max(0, player.state.fatigue - 30);
    player.state.sharpness = Math.max(50, player.state.sharpness - 10);
  }

  for (const [compId, table] of world.leagueTables) {
    const competition = world.competitions.get(compId);
    if (competition) {
      computeInternationalAwards(world, competition.seasonId);
      break;
    }
  }

  const retirements = processRetirements(world);
  if (retirements.length) {
    console.log(`[Retirement] ${retirements.length} players retired`);
  }

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

  endOfSeasonBoardReview(world);

  const youth = runYouthCycle(world);
  const pruned = pruneAllClubs(world);
  const filled = fillThinSquads(world);
  console.log(`[Season] Aged ${world.players.size} players; processed finances`);
  console.log(`[Youth] Intake ${youth.intake}, scout reports ${youth.reports}, academy signings ${youth.signings}`);
  if (pruned || filled) console.log(`[Squads] Pruned ${pruned}, filled thin ${filled}`);
}

export function beginNextSeason(world: World): Competition {
  const parts = world.calendar.currentDate.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const nextJulyYear = m >= 7 ? y + 1 : y;
  const nextStart = `${nextJulyYear}-07-01`;

  while (world.calendar.currentDate < nextStart) {
    world.calendar = advanceDay(world.calendar);
  }
  world.calendar.currentSeason = seasonFromDate(world.calendar.currentDate);
  world.calendar.dayOfSeason = 0;

  world.transferWindowOpen = true;
  const report = runTransferWindow(world);
  console.log(formatWindowReport(world, report));

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
  const text = formatTable(table, (id) => world.clubs.get(id)?.name ?? id);
  console.log(text);
}
