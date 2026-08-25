/**
 * Entry point – boots a world and prints a summary.
 */

import { createWorld } from "./world/world.js";
import { bootstrapWorld } from "./world/bootstrap.js";

console.log("=== Football Career Simulator ===");

const world = createWorld({ seed: 42, startDate: "2026-07-01" });
bootstrapWorld(world);

console.log(`\nCalendar: ${world.calendar.currentDate} (${world.calendar.currentSeason})`);
console.log(`Total players: ${world.players.size}`);
console.log(`Total clubs: ${world.clubs.size}`);
console.log(`Leagues: ${world.leagues.size}`);

const ovrs = [...world.players.values()].map((p) => p.ovr);
const avg = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
const max = Math.max(...ovrs);
const min = Math.min(...ovrs);
console.log(`OVR range: ${min}–${max}  avg ${avg.toFixed(1)}`);
console.log("\nFoundation OK.");
