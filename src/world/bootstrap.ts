/**
 * Bootstrap a playable European football world:
 * leagues, clubs, squads, youth, managers.
 */

import type { World } from "./world.js";
import { addClub, addPlayer } from "./world.js";
import { generateAllEuropeanClubs, ALL_LEAGUE_TEMPLATES } from "../clubs/generation.js";
import { generateSquad } from "../players/generation.js";
import type { Club } from "../clubs/club.js";
import { attachMediaSystems } from "../news/attach.js";
import { attachRelationshipHooks } from "../relationships/engine.js";
import { seedUndiscoveredPool, generateAcademyIntake } from "../youth/generation.js";
import { ensureClubScouts } from "../scouting/engine.js";
import { ensureNationalTeams } from "../international/teams.js";
import { assignManagersToClubs } from "../managers/generation.js";
import { ensureAllClubSocials } from "../social/clubs.js";

const SQUAD_SIZE = 22;

export function bootstrapWorld(world: World): void {
  attachMediaSystems(world);
  ensureNationalTeams(world);
  attachRelationshipHooks(world);
  if (!(world as any).personalities) (world as any).personalities = new Map();
  if (!(world as any).agents) (world as any).agents = new Map();

  const { clubs, leagueClubIds } = generateAllEuropeanClubs(world.rng);

  for (const [nation, ids] of leagueClubIds) {
    const firstClub = clubs.find((c) => c.id === ids[0]);
    const leagueId = firstClub?.leagueId;
    if (leagueId) world.leagues.set(leagueId, ids);
  }

  for (const club of clubs) {
    const targetOVR = Math.round(48 + club.reputation * 0.42);
    const squad = generateSquad(world.rng, club.id, targetOVR, SQUAD_SIZE);

    for (const p of squad) {
      p.contract = {
        clubId: club.id,
        wage: Math.round(p.ovr * p.ovr * 8),
        startDate: world.calendar.currentDate,
        endDate: `${parseInt(world.calendar.currentSeason.split("/")[0]!) + 2}-06-30`,
        releaseClause: p.ovr >= 80 ? Math.round(p.ovr * 1_000_000 * 1.5) : null,
        signedDate: world.calendar.currentDate,
      };
      p.currentClubId = club.id;
      addPlayer(world, p);
      const pending = (p as any)._pendingPersonality;
      if (pending) {
        (world as any).personalities.set(pending.id, pending);
        delete (p as any)._pendingPersonality;
      }
      club.squadPlayerIds.push(p.id);
    }

    club.finances.currentWageBillWeekly = squad.reduce(
      (sum, p) => sum + (p.contract?.wage ?? 0),
      0
    );

    addClub(world, club);
  }

  seedUndiscoveredPool(world, 50);
  const topClubs = [...clubs].sort((a, b) => b.reputation - a.reputation);
  for (const club of topClubs.slice(0, 40)) {
    ensureClubScouts(world, club);
    generateAcademyIntake(world, club);
  }
  for (const club of topClubs.slice(40)) {
    ensureClubScouts(world, club);
  }

  assignManagersToClubs(world);
  ensureAllClubSocials(world);

  console.log(
    `[Bootstrap] Europe: ${clubs.length} clubs across ${ALL_LEAGUE_TEMPLATES.length} leagues, ${world.players.size} players, managers ${((world as any).managers?.size ?? 0)}`
  );
  logClubSummary(world, clubs);
}

function logClubSummary(world: World, clubs: Club[]): void {
  const sorted = [...clubs].sort((a, b) => b.reputation - a.reputation);
  console.log("\n--- Biggest clubs (by reputation) ---");
  for (const c of sorted.slice(0, 12)) {
    const players = c.squadPlayerIds.map((id) => world.players.get(id)!).filter(Boolean);
    const avgOVR = players.length
      ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length)
      : 0;
    const top = [...players].sort((a, b) => b.ovr - a.ovr)[0];
    console.log(
      `${c.name.padEnd(26)} ${c.nation.padEnd(12)} Rep ${c.reputation}  AvgOVR ${avgOVR}  Top: ${top?.displayName ?? "?"} (${top?.ovr ?? "?"})`
    );
  }
  console.log("...");
  const byNation = new Map<string, number>();
  for (const c of clubs) byNation.set(c.nation, (byNation.get(c.nation) ?? 0) + 1);
  console.log("Clubs by nation:", [...byNation.entries()].map(([n, c]) => `${n}:${c}`).join(", "));
}
