/**
 * Multi-season player career: 3 seasons with training + development.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { describeUserStanding } from "../career/selection.js";
import {
  startSeason,
  playFullSeason,
  endSeasonProcessing,
  beginNextSeason,
} from "../competitions/season.js";

console.log("=== MULTI-SEASON CAREER DEMO ===\n");

const world = createWorld({ seed: 99, startDate: "2026-07-01" });
bootstrapWorld(world);

const placement = createCareerPlayer(world, {
  firstName: "Jordan",
  lastName: "Vale",
  position: "RW",
  preferredFoot: "Left",
  nationality: "England",
  age: 17,
  physicalProfile: "Athletic",
  potential: 86,
});
console.log(placement.reason);

for (let season = 1; season <= 3; season++) {
  const competition = startSeason(world);
  playFullSeason(world, competition.id);
  const user = world.players.get(world.userPlayerId!)!;
  console.log(`\n=== END OF SEASON ${season} (${world.calendar.currentSeason}) ===`);
  console.log(
    `Age ${user.age} | OVR ${user.ovr} | POT ${user.potential} | Apps ${user.state.appearancesThisSeason} | G ${user.state.goalsThisSeason}`
  );
  endSeasonProcessing(world);
  if (season < 3) beginNextSeason(world);
}

const user = world.players.get(world.userPlayerId!)!;
console.log("\n=== CAREER SUMMARY AFTER 3 SEASONS ===");
console.log(
  `${user.displayName}: age ${user.age}, OVR ${user.ovr}, POT ${user.potential}, career apps ${user.careerAppearances}`
);
