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
import { applyTrainingSession, developAllPlayers } from "../training/development.js";

console.log("=== MULTI-SEASON CAREER DEMO ===\n");

const world = createWorld({ seed: 999, startDate: "2026-07-01" });
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
console.log(describeUserStanding(world));
console.log();

for (let season = 1; season <= 3; season++) {
  const comp = season === 1 ? startSeason(world) : beginNextSeason(world);

  const user = world.players.get(world.userPlayerId!)!;
  for (let t = 0; t < 30; t++) {
    applyTrainingSession(user, "Attacking", 70, world);
  }

  playFullSeason(world, comp.id);
  developAllPlayers(world);

  console.log(`\n=== END OF SEASON ${season} (${world.calendar.currentSeason}) ===`);
  console.log(
    `Age ${user.age} | OVR ${user.ovr} | POT ${user.potential} | Apps ${user.state.appearancesThisSeason} | G ${user.state.goalsThisSeason}`
  );
  console.log(describeUserStanding(world).split("\n").slice(0, 4).join("\n"));

  endSeasonProcessing(world);
}

const user = world.players.get(world.userPlayerId!)!;
console.log("\n=== CAREER SUMMARY AFTER 3 SEASONS ===");
console.log(
  `${user.displayName}: age ${user.age}, OVR ${user.ovr}, POT ${user.potential}, career apps ${user.careerAppearances}, goals ${user.careerGoals}`
);
