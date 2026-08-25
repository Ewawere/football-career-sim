/**
 * Demo: create a young player, place them, run a season.
 */

import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { describeUserStanding } from "../career/selection.js";
import {
  startSeason,
  playFullSeason,
  endSeasonProcessing,
  playMatchday,
} from "../competitions/season.js";

console.log("=== PLAYER CAREER DEMO ===\n");

const world = createWorld({ seed: 12345, startDate: "2026-07-01" });
bootstrapWorld(world);

const placement = createCareerPlayer(world, {
  firstName: "Jordan",
  lastName: "Vale",
  position: "RW",
  preferredFoot: "Left",
  nationality: "England",
  age: 17,
  physicalProfile: "Athletic",
  potential: 84,
});

console.log("PLACEMENT");
console.log(placement.reason);
console.log(`Club: ${placement.club?.name} (Rep ${placement.club?.reputation})`);
console.log();
console.log(describeUserStanding(world));

const competition = startSeason(world);
console.log("Playing first 10 matchdays...\n");
for (let md = 1; md <= 10; md++) {
  playMatchday(world, competition.id, md);
}

const user = world.players.get(world.userPlayerId!)!;
console.log("AFTER 10 MATCHDAYS");
console.log(
  `Apps: ${user.state.appearancesThisSeason} | Goals: ${user.state.goalsThisSeason} | Form: ${user.state.form.toFixed(0)}`
);
console.log(describeUserStanding(world));

console.log("Completing season...");
playFullSeason(world, competition.id);
endSeasonProcessing(world);
console.log(`Aged to ${user.age}, OVR ${user.ovr}, career apps ${user.careerAppearances}`);
