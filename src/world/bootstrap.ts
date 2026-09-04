/**
 * Bootstrap a playable football world (sized for phone/Railway).
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

const SQUAD_SIZE = 18;

export function bootstrapWorld(world: World): void {
  attachMediaSystems(world);
  ensureNationalTeams(world);
  attachRelationshipHooks(world);
  if (!(world as any).personalities) (world as any).personalities = new Map();
  if (!(world as any).agents) (world as any).agents = new Map();

  const { clubs, leagueClubIds } = generateAllEuropeanClubs(world.rng);

  for (const [, ids] of leagueClubIds) {
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
        endDate: `${parseInt(world.calendar.currentSeason.split("/")[0]!, 10) + 2}-06-30`,
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

  seedUndiscoveredPool(world, 24);
  const topClubs = [...clubs].sort((a, b) => b.reputation - a.reputation);
  for (const club of topClubs.slice(0, 20)) {
    ensureClubScouts(world, club);
    generateAcademyIntake(world, club);
  }
  for (const club of topClubs.slice(20, 40)) {
    ensureClubScouts(world, club);
  }

  assignManagersToClubs(world);
  ensureAllClubSocials(world);

  console.log(
    `[Bootstrap] ${clubs.length} clubs, ${ALL_LEAGUE_TEMPLATES.length} leagues, ${world.players.size} players`
  );
  logClubSummary(world, clubs);
}

function logClubSummary(world: World, clubs: Club[]): void {
  const sorted = [...clubs].sort((a, b) => b.reputation - a.reputation);
  console.log("--- Top clubs ---");
  for (const c of sorted.slice(0, 8)) {
    const players = c.squadPlayerIds.map((id) => world.players.get(id)!).filter(Boolean);
    const avgOVR = players.length
      ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length)
      : 0;
    console.log(`${c.name} (${c.nation}) Rep ${c.reputation} AvgOVR ${avgOVR}`);
  }
}
