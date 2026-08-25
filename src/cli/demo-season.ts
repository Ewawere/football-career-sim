/**
 * Demo: full season simulation – fixtures, 38 matchdays, table, end processing.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import {
  startSeason,
  playFullSeason,
  printLeagueTable,
  endSeasonProcessing,
  beginNextSeason,
} from "../competitions/season.js";

console.log("=== FULL SEASON DEMO ===\n");

const world = createWorld({ seed: 42, startDate: "2026-07-01" });
bootstrapWorld(world);

const competition = startSeason(world);

console.log("\nPlaying full season...\n");
const t0 = Date.now();
playFullSeason(world, competition.id);
const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

console.log(`\nSeason complete in ${elapsed}s\n`);
console.log("=== FINAL TABLE ===");
printLeagueTable(world, competition.id);

const scorers = [...world.players.values()]
  .filter((p) => p.state.goalsThisSeason > 0)
  .sort((a, b) => b.state.goalsThisSeason - a.state.goalsThisSeason)
  .slice(0, 10);

console.log("\n=== TOP SCORERS ===");
for (const p of scorers) {
  const club = p.currentClubId ? world.clubs.get(p.currentClubId)?.shortName : "?";
  console.log(
    `  ${p.displayName.padEnd(22)} ${club?.padEnd(4)}  ${p.state.goalsThisSeason} goals  (${p.state.appearancesThisSeason} apps)`
  );
}

endSeasonProcessing(world);

const retired = [...world.players.values()].filter((p) => p.retired).length;
console.log(`\nRetired this off-season: ${retired}`);

console.log("\n=== STARTING NEXT SEASON ===");
const next = beginNextSeason(world);
console.log(`New season: ${world.calendar.currentSeason}, competition ${next.name}`);
console.log(`Fixtures: ${[...world.fixtures.values()].length}`);
console.log(`Calendar: ${world.calendar.currentDate}`);
