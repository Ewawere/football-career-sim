/**
 * Bootstrap a playable world with leagues, clubs, and squads.
 */

import { nextId } from "../core/id.js";
import type { World } from "./world.js";
import { addClub, addPlayer } from "./world.js";
import { generateEnglishTopLeague } from "../clubs/generation.js";
import { generateSquad } from "../players/generation.js";
import { attachMediaSystems } from "../news/attach.js";
import { ensureNationalTeams } from "../international/teams.js";
import { assignManagersToClubs } from "../managers/generation.js";

export function bootstrapWorld(world: World): void {
  try {
    attachMediaSystems(world);
  } catch {
    /* optional until full media stack is present */
  }
  ensureNationalTeams(world);
  if (!(world as any).personalities) (world as any).personalities = new Map();
  if (!(world as any).agents) (world as any).agents = new Map();

  const leagueId = nextId("lg");
  world.leagues.set(leagueId, []);

  const clubs = generateEnglishTopLeague(world.rng, leagueId);

  for (const club of clubs) {
    const targetOVR = Math.round(48 + club.reputation * 0.42);
    const squad = generateSquad(world.rng, club.id, targetOVR, 24);

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
      club.squadPlayerIds.push(p.id);
    }

    club.finances.currentWageBillWeekly = squad.reduce(
      (sum, p) => sum + (p.contract?.wage ?? 0),
      0
    );

    addClub(world, club);
    world.leagues.get(leagueId)!.push(club.id);
  }

  assignManagersToClubs(world);

  console.log(
    `[Bootstrap] Created ${clubs.length} clubs, ${world.players.size} players, managers ${((world as any).managers?.size ?? 0)}`
  );
}
