/**
 * Round-robin fixture generator (double: home + away).
 */

import { nextId } from "../core/id.js";
import { addDays } from "../core/calendar.js";
import type { EntityId, GameDate } from "../core/types.js";
import type { Fixture } from "./types.js";

export function generateLeagueFixtures(
  competitionId: EntityId,
  clubIds: EntityId[],
  seasonStart: GameDate,
  daysBetweenMatchdays: number = 7
): Fixture[] {
  const n = clubIds.length;
  if (n < 2) throw new Error("Need at least 2 clubs");
  if (n % 2 !== 0) {
    throw new Error("League fixture generator currently requires even number of clubs");
  }

  const teams = [...clubIds];
  const rounds = n - 1;
  const matchesPerRound = n / 2;
  const halfFixtures: { home: EntityId; away: EntityId; round: number }[] = [];
  const idx = teams.map((_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let m = 0; m < matchesPerRound; m++) {
      const homeIdx = idx[m]!;
      const awayIdx = idx[n - 1 - m]!;
      if (round % 2 === 0) {
        halfFixtures.push({ home: teams[homeIdx]!, away: teams[awayIdx]!, round: round + 1 });
      } else {
        halfFixtures.push({ home: teams[awayIdx]!, away: teams[homeIdx]!, round: round + 1 });
      }
    }
    const last = idx[n - 1]!;
    for (let i = n - 1; i > 1; i--) idx[i] = idx[i - 1]!;
    idx[1] = last;
  }

  const all: { home: EntityId; away: EntityId; matchday: number }[] = [];
  for (const f of halfFixtures) {
    all.push({ home: f.home, away: f.away, matchday: f.round });
  }
  for (const f of halfFixtures) {
    all.push({ home: f.away, away: f.home, matchday: f.round + rounds });
  }

  let date = addDays(seasonStart, 7);
  const fixtures: Fixture[] = [];
  const byMatchday = new Map<number, typeof all>();
  for (const f of all) {
    if (!byMatchday.has(f.matchday)) byMatchday.set(f.matchday, []);
    byMatchday.get(f.matchday)!.push(f);
  }

  const maxMD = 2 * rounds;
  for (let md = 1; md <= maxMD; md++) {
    const games = byMatchday.get(md) ?? [];
    for (const g of games) {
      if (g.home === g.away) throw new Error("Club playing itself");
      fixtures.push({
        id: nextId("fx"),
        competitionId,
        matchday: md,
        homeClubId: g.home,
        awayClubId: g.away,
        date,
        matchId: null,
        played: false,
      });
    }
    date = addDays(date, daysBetweenMatchdays);
  }

  validateFixtures(fixtures, clubIds, maxMD);
  return fixtures;
}

function validateFixtures(fixtures: Fixture[], clubIds: EntityId[], expectedMatchdays: number): void {
  const n = clubIds.length;
  const expectedTotal = n * (n - 1);
  if (fixtures.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} fixtures, got ${fixtures.length}`);
  }

  for (let md = 1; md <= expectedMatchdays; md++) {
    const mdFixtures = fixtures.filter((f) => f.matchday === md);
    if (mdFixtures.length !== n / 2) {
      throw new Error(`Matchday ${md}: expected ${n / 2} matches, got ${mdFixtures.length}`);
    }
    const seen = new Set<EntityId>();
    for (const f of mdFixtures) {
      if (seen.has(f.homeClubId) || seen.has(f.awayClubId)) {
        throw new Error(`Matchday ${md}: club plays more than once`);
      }
      seen.add(f.homeClubId);
      seen.add(f.awayClubId);
      if (f.homeClubId === f.awayClubId) throw new Error("Self fixture");
    }
    if (seen.size !== n) {
      throw new Error(`Matchday ${md}: not all clubs scheduled`);
    }
  }

  const pairs = new Set<string>();
  for (const f of fixtures) {
    const key = `${f.homeClubId}|${f.awayClubId}`;
    if (pairs.has(key)) throw new Error(`Duplicate fixture ${key}`);
    pairs.add(key);
  }
}
