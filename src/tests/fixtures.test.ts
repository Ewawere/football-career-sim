/**
 * Fixture generator tests – deterministic, no self-play, full coverage.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resetIds } from "../core/id.js";
import { generateLeagueFixtures } from "../competitions/fixtures.js";

describe("generateLeagueFixtures", () => {
  it("produces correct count for 20 teams", () => {
    resetIds();
    const clubs = Array.from({ length: 20 }, (_, i) => `club_${i}`);
    const fixtures = generateLeagueFixtures("cmp_1", clubs, "2026-07-01", 7);
    assert.equal(fixtures.length, 20 * 19);
    assert.equal(Math.max(...fixtures.map((f) => f.matchday)), 38);
  });

  it("never schedules a club against itself", () => {
    resetIds();
    const clubs = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const fixtures = generateLeagueFixtures("cmp_2", clubs, "2026-07-01");
    for (const f of fixtures) {
      assert.notEqual(f.homeClubId, f.awayClubId);
    }
  });

  it("each matchday has every club exactly once", () => {
    resetIds();
    const clubs = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const fixtures = generateLeagueFixtures("cmp_3", clubs, "2026-07-01");
    const maxMD = 14;
    for (let md = 1; md <= maxMD; md++) {
      const mdF = fixtures.filter((f) => f.matchday === md);
      assert.equal(mdF.length, 4);
      const seen = new Set<string>();
      for (const f of mdF) {
        assert.ok(!seen.has(f.homeClubId));
        assert.ok(!seen.has(f.awayClubId));
        seen.add(f.homeClubId);
        seen.add(f.awayClubId);
      }
      assert.equal(seen.size, 8);
    }
  });

  it("each ordered pair appears exactly once", () => {
    resetIds();
    const clubs = Array.from({ length: 6 }, (_, i) => `x${i}`);
    const fixtures = generateLeagueFixtures("cmp_4", clubs, "2026-07-01");
    const pairs = new Set<string>();
    for (const f of fixtures) {
      const key = `${f.homeClubId}|${f.awayClubId}`;
      assert.ok(!pairs.has(key), `duplicate ${key}`);
      pairs.add(key);
    }
    assert.equal(pairs.size, 6 * 5);
  });
});
