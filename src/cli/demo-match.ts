/**
 * Demo: bootstrap world and simulate a match between top two clubs.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createMatch, simulateMatch, formatMatchReport } from "../matches/engine.js";

const world = createWorld({ seed: 42, startDate: "2026-07-01" });
bootstrapWorld(world);

const clubs = [...world.clubs.values()].sort((a, b) => b.reputation - a.reputation);
const home = clubs[0]!;
const away = clubs[1]!;

console.log(`\n=== DEMO MATCH ===`);
console.log(`${home.name} vs ${away.name}\n`);

const match = createMatch(world, home.id, away.id, world.calendar.currentDate);
const result = simulateMatch(world, match, world.rng);

console.log(formatMatchReport(world, match));

console.log("\nPlayer state after match (sample):");
const sampleId = match.home.startingXI[0]!;
const p = world.players.get(sampleId)!;
console.log(
  `${p.displayName}: form ${p.state.form.toFixed(0)}, fitness ${p.state.fitness}, apps ${p.state.appearancesThisSeason}, goals ${p.state.goalsThisSeason}`
);
