/**
 * Manager career: hire, sack, board confidence, job offers.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import type { JobOffer, Manager, BoardExpectation } from "./types.js";
import { getManager, getManagers, storeManager, createUserManager } from "./generation.js";
import { Events } from "../core/events.js";

export function getJobOffers(world: World): JobOffer[] {
  return ((world as any).jobOffers as JobOffer[]) ?? [];
}

export function updateBoardConfidenceAfterMatch(
  world: World,
  clubId: EntityId,
  result: "W" | "D" | "L",
  isHome: boolean
): void {
  const club = world.clubs.get(clubId);
  if (!club?.managerId) return;
  const manager = getManager(world, club.managerId);
  if (!manager) return;

  const expected = club.objectives.leaguePositionMin;
  let delta = 0;
  if (result === "W") delta = 2.5 + (club.reputation >= 80 ? 0.5 : 1);
  else if (result === "D") delta = club.reputation >= 82 ? -1 : 0.5;
  else delta = club.reputation >= 80 ? -4 : -2.5;

  for (const table of world.leagueTables.values()) {
    const row = table.find((r) => r.clubId === clubId);
    if (!row) continue;
    if (row.position > expected + 4) delta -= 1.5;
    if (row.position <= expected) delta += 0.5;
    if (row.position >= 18) delta -= 2.5;
    const form = (row as any).form as string | undefined;
    if (form) {
      const recent = form.slice(-5);
      const losses = [...recent].filter((c) => c === "L").length;
      if (losses >= 4) delta -= 3;
      else if (losses >= 3) delta -= 1.5;
      const wins = [...recent].filter((c) => c === "W").length;
      if (wins >= 4) delta += 1.5;
    }
    break;
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

export function processManagerSackings(world: World): Manager[] {
  const sacked: Manager[] = [];
  for (const club of world.clubs.values()) {
    if (!club.managerId) continue;
    const manager = getManager(world, club.managerId);
    if (!manager) continue;

    const job = manager.jobHistory.find((j) => j.reason === "Active");
    if (job && job.matches < 6) continue;

    let threshold = manager.isUserControlled ? 18 : 30;
    if (club.reputation >= 85) threshold = manager.isUserControlled ? 22 : 38;
    else if (club.reputation >= 75) threshold = manager.isUserControlled ? 20 : 34;

    let inRelegation = false;
    let formLosses = 0;
    for (const table of world.leagueTables.values()) {
      const row = table.find((r) => r.clubId === club.id);
      if (!row) continue;
      if (row.position >= 18 && row.played >= 8) inRelegation = true;
      const form = (row as any).form as string | undefined;
      if (form) formLosses = [...form.slice(-5)].filter((c) => c === "L").length;
      break;
    }
    if (inRelegation) threshold += 8;
    if (formLosses >= 4) threshold += 6;
    else if (formLosses >= 3) threshold += 3;

    if (job && job.matches >= 10) {
      const winRate = job.wins / Math.max(1, job.matches);
      if (winRate < 0.2) threshold += 5;
    }

    if (manager.boardConfidence > threshold) continue;

    sackManager(world, club, manager, "Sacked");
    sacked.push(manager);
  }
  return sacked;
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
  world.events.emit(Events.NEWS_GENERATED, {
    type: "manager_sacked",
    managerId: manager.id,
    clubId: club.id,
    name: manager.displayName,
    clubName: club.name,
  });
}

export function hireManager(
  world: World,
  club: Club,
  manager: Manager,
  contractYears = 2,
  wageWeekly?: number
): void {
  if (club.managerId) {
    const prev = getManager(world, club.managerId);
    if (prev) {
      sackManager(world, club, prev, "ContractEnded");
    }
  }

  manager.status = "Employed";
  manager.currentClubId = club.id;
  manager.boardConfidence = 55 + Math.min(15, manager.reputation * 0.15);
  manager.wageWeekly = wageWeekly ?? manager.wageWeekly;
  const year = parseInt(world.calendar.currentDate.slice(0, 4), 10);
  manager.contractEnd = `${year + contractYears}-06-30`;
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
  club.transferPhilosophy = manager.preferredPhilosophy;

  world.events.emit(Events.MANAGER_HIRED, {
    managerId: manager.id,
    clubId: club.id,
    name: manager.displayName,
    clubName: club.name,
  });
  world.events.emit(Events.NEWS_GENERATED, {
    type: "manager_hired",
    managerId: manager.id,
    clubId: club.id,
    name: manager.displayName,
    clubName: club.name,
  });
}

export function generateJobOffers(world: World): JobOffer[] {
  const offers: JobOffer[] = [];
  const vacant = [...world.clubs.values()].filter((c) => !c.managerId);
  const unemployed = [...getManagers(world).values()].filter(
    (m) => m.status === "Unemployed" && !m.isUserControlled
  );

  for (const club of vacant) {
    const candidates = unemployed
      .filter((m) => Math.abs(m.reputation - club.reputation) < 25)
      .sort(
        (a, b) =>
          Math.abs(a.reputation - club.reputation) -
          Math.abs(b.reputation - club.reputation)
      );
    const pick = candidates[0] ?? unemployed[0];
    if (pick) {
      hireManager(world, club, pick, 2);
      const idx = unemployed.indexOf(pick);
      if (idx >= 0) unemployed.splice(idx, 1);
    }
  }

  const userId = world.userManagerId;
  if (userId) {
    const user = getManager(world, userId);
    if (user && user.status === "Unemployed") {
      const targets = [...world.clubs.values()]
        .filter(
          (c) =>
            !c.managerId ||
            (getManager(world, c.managerId!)?.boardConfidence ?? 100) < 35
        )
        .filter((c) => c.reputation <= user.reputation + 20)
        .sort((a, b) => b.reputation - a.reputation)
        .slice(0, 5);

      for (const club of targets) {
        const offer: JobOffer = {
          id: nextId("job"),
          clubId: club.id,
          clubName: club.name,
          reputation: club.reputation,
          wageWeekly: Math.round(1500 + club.reputation * 350),
          contractYears: 2,
          expectations: {
            leaguePositionMin: club.objectives.leaguePositionMin,
            cupProgress: club.objectives.cupRun,
            financialFairPlay: true,
            style: club.youthFocus >= 70 ? "Youth" : "Results",
          },
          status: "Open",
        };
        offers.push(offer);
      }
    }
  }

  (world as any).jobOffers = offers;
  return offers;
}

export function acceptJobOffer(world: World, offerId: string): boolean {
  const offers = getJobOffers(world);
  const offer = offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== "Open") return false;
  const userId = world.userManagerId;
  if (!userId) return false;
  const user = getManager(world, userId);
  const club = world.clubs.get(offer.clubId);
  if (!user || !club) return false;

  hireManager(world, club, user, offer.contractYears, offer.wageWeekly);
  offer.status = "Accepted";
  club.objectives.leaguePositionMin = offer.expectations.leaguePositionMin;
  return true;
}

export function startManagerCareer(
  world: World,
  opts: { firstName: string; lastName: string; nationality?: string; age?: number }
): { manager: Manager; club: Club; reason: string } {
  const manager = createUserManager(world, opts);

  const clubs = [...world.clubs.values()].sort((a, b) => a.reputation - b.reputation);
  const candidates = clubs.filter((c) => c.reputation >= 55 && c.reputation <= 78);
  const club = candidates[Math.floor(candidates.length / 2)] ?? clubs[0]!;

  if (club.managerId) {
    const prev = getManager(world, club.managerId);
    if (prev && !prev.isUserControlled) {
      prev.status = "Unemployed";
      prev.currentClubId = null;
      const job = prev.jobHistory.find((j) => j.reason === "Active");
      if (job) {
        job.endDate = world.calendar.currentDate;
        job.reason = "ContractEnded";
      }
    }
  }

  hireManager(world, club, manager, 3, Math.round(1800 + club.reputation * 300));
  manager.boardConfidence = 60;

  return {
    manager,
    club,
    reason: `Appointed manager of ${club.name} (Rep ${club.reputation}). Board expect finish around top ${club.objectives.leaguePositionMin}.`,
  };
}

export function endOfSeasonBoardReview(world: World): void {
  for (const [compId, table] of world.leagueTables) {
    for (const row of table) {
      const club = world.clubs.get(row.clubId);
      if (!club?.managerId) continue;
      const manager = getManager(world, club.managerId);
      if (!manager) continue;

      const target = club.objectives.leaguePositionMin;
      if (row.position <= target) {
        manager.boardConfidence = Math.min(100, manager.boardConfidence + 12);
        manager.reputation = Math.min(100, manager.reputation + 3);
        if (row.position === 1) {
          manager.trophies += 1;
          const job = manager.jobHistory.find((j) => j.reason === "Active");
          if (job) job.trophies += 1;
        }
      } else if (row.position >= target + 6) {
        manager.boardConfidence = Math.max(0, manager.boardConfidence - 15);
        manager.reputation = Math.max(10, manager.reputation - 2);
      } else if (row.position >= 18) {
        manager.boardConfidence = Math.max(0, manager.boardConfidence - 25);
      }
    }
  }

  processManagerSackings(world);
  generateJobOffers(world);
}
