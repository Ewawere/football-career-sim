/**
 * Manager career: board confidence, sackings, hirings.
 */

import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import type { Manager } from "./types.js";
import { getManager, generateManager, storeManager } from "./generation.js";
import { Events } from "../core/events.js";

export function updateBoardConfidenceAfterMatch(
  world: World,
  clubId: string,
  result: "W" | "D" | "L"
): void {
  const club = world.clubs.get(clubId);
  if (!club?.managerId) return;
  const manager = getManager(world, club.managerId);
  if (!manager) return;

  let delta = 0;
  if (result === "W") delta = 2.5 + (club.reputation >= 80 ? 0.5 : 1);
  else if (result === "D") delta = club.reputation >= 82 ? -1 : 0.5;
  else delta = club.reputation >= 80 ? -4 : -2.5;

  const table = [...world.leagueTables.values()][0];
  if (table) {
    const row = table.find((r) => r.clubId === clubId);
    if (row) {
      if (row.position >= 18) delta -= 2;
      if (row.position <= 4) delta += 0.5;
    }
  }

  manager.boardConfidence = Math.max(0, Math.min(100, manager.boardConfidence + delta));
  if (result === "W") manager.careerWins++;
  else if (result === "D") manager.careerDraws++;
  else manager.careerLosses++;

  const job = manager.jobHistory.find((j) => j.reason === "Active");
  if (job) {
    job.matches++;
    if (result === "W") job.wins++;
  }
}

export function sackManager(
  world: World,
  club: Club,
  manager: Manager,
  reason: "Sacked" | "Resigned" | "ContractEnded"
): void {
  const job = manager.jobHistory.find((j) => j.reason === "Active");
  if (job) {
    job.endDate = world.calendar.currentDate;
    job.reason = reason;
  }
  manager.status = "Unemployed";
  manager.currentClubId = null;
  manager.boardConfidence = 40;
  club.managerId = null;

  world.events.emit(Events.MANAGER_SACKED, {
    managerId: manager.id,
    clubId: club.id,
    reason,
    name: manager.displayName,
    clubName: club.name,
  });
}

export function processManagerSackings(world: World): Manager[] {
  const sacked: Manager[] = [];
  for (const club of world.clubs.values()) {
    if (!club.managerId) continue;
    const manager = getManager(world, club.managerId);
    if (!manager) continue;
    const threshold = manager.isUserControlled ? 18 : 28;
    if (manager.boardConfidence > threshold) continue;
    const job = manager.jobHistory.find((j) => j.reason === "Active");
    if (job && job.matches < 8) continue;
    sackManager(world, club, manager, "Sacked");
    sacked.push(manager);
  }
  return sacked;
}

export function hireManager(world: World, club: Club, manager: Manager): void {
  manager.status = "Employed";
  manager.currentClubId = club.id;
  manager.boardConfidence = 55;
  manager.contractEnd = `${parseInt(world.calendar.currentDate.slice(0, 4), 10) + 2}-06-30`;
  manager.jobHistory.push({
    clubId: club.id,
    clubName: club.name,
    startDate: world.calendar.currentDate,
    endDate: null,
    reason: "Active",
    matches: 0,
    wins: 0,
    trophies: 0,
  });
  club.managerId = manager.id;
  club.tacticalIdentity = manager.preferredIdentity;
  storeManager(world, manager);
  world.events.emit(Events.MANAGER_HIRED, {
    managerId: manager.id,
    clubId: club.id,
  });
}

export function endOfSeasonBoardReview(world: World): void {
  processManagerSackings(world);
  for (const club of world.clubs.values()) {
    if (club.managerId) continue;
    const m = generateManager(world.rng, {
      reputation: Math.round(club.reputation * 0.8),
    });
    hireManager(world, club, m);
  }
}

export function startManagerCareer(
  world: World,
  opts: { firstName: string; lastName: string; clubId?: string }
): Manager {
  const { createUserManager } = require("./generation.js") as typeof import("./generation.js");
  const m = createUserManager(world, opts);
  const club =
    (opts.clubId ? world.clubs.get(opts.clubId) : null) ??
    [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation)[5];
  if (club) {
    if (club.managerId) {
      const old = getManager(world, club.managerId);
      if (old) sackManager(world, club, old, "Sacked");
    }
    hireManager(world, club, m);
  }
  return m;
}
