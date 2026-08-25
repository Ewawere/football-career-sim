/**
 * Package entry — re-exports core simulation surface.
 */

export { createWorld, type World } from "./world/world.js";
export { bootstrapWorld } from "./world/bootstrap.js";
export { createCareerPlayer } from "./career/player-career.js";
export {
  startSeason,
  playMatchday,
  playFullSeason,
  endSeasonProcessing,
  beginNextSeason,
} from "./competitions/season.js";
export { createMatch, simulateMatch, formatMatchReport } from "./matches/engine.js";
export { runTransferWindow } from "./transfers/window.js";
export { saveToJson, loadFromJson } from "./save/serialize.js";

console.log("Football Career Sim — import from modules or run npm run play:web");
