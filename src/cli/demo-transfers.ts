/**
 * Demo: run a transfer window and print report.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { startSeason, playFullSeason, endSeasonProcessing, beginNextSeason } from "../competitions/season.js";
import { runTransferWindow, formatWindowReport, validateSquads } from "../transfers/window.js";

console.log("=== TRANSFER WINDOW DEMO ===\n");

const world = createWorld({ seed: 77, startDate: "2026-07-01" });
bootstrapWorld(world);

const competition = startSeason(world);
playFullSeason(world, competition.id);
endSeasonProcessing(world);

console.log("Running summer window...\n");
const report = runTransferWindow(world);
console.log(formatWindowReport(world, report));

const errors = validateSquads(world);
if (errors.length) {
  console.log("\nSquad validation issues:");
  for (const e of errors) console.log(" -", e);
} else {
  console.log("\nSquad validation OK");
}

const next = beginNextSeason(world);
console.log(`\nNext season competition: ${next.name} ${next.seasonId}`);
