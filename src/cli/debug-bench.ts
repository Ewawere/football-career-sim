/**
 * Debug: inspect selection / depth for user player.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { getDepthChart, describeUserStanding } from "../career/selection.js";

const world = createWorld({ seed: 7, startDate: "2026-07-01" });
bootstrapWorld(world);

const placement = createCareerPlayer(world, {
  firstName: "Debug",
  lastName: "Bench",
  position: "ST",
  preferredFoot: "Right",
  nationality: "England",
  age: 17,
  physicalProfile: "Athletic",
  potential: 80,
});

console.log(placement.reason);
console.log(describeUserStanding(world));

if (placement.club) {
  const chart = getDepthChart(world, placement.club.id, "ST");
  console.log("\nST depth:");
  for (const row of chart.slice(0, 8)) {
    console.log(`  #${row.rank} ${row.player.displayName} OVR ${row.player.ovr} score ${row.score.toFixed(1)}`);
  }
}
