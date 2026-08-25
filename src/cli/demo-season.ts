/**
 * Demo: bootstrap world, play a full season, print table.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { startSeason, playFullSeason, printLeagueTable, endSeasonProcessing } from "../competitions/season.js";

console.log("=== SEASON DEMO ===\n");
const world = createWorld({ seed: 42, startDate: "2026-07-01" });
bootstrapWorld(world);

const competition = startSeason(world);
console.log(`Clubs: ${world.clubs.size}, Players: ${world.players.size}`);

playFullSeason(world, competition.id);
console.log("\nFINAL TABLE");
printLeagueTable(world, competition.id);

endSeasonProcessing(world);
console.log(`\nPost-season players: ${[...world.players.values()].filter((p) => !p.retired).length}`);
