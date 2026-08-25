/**
 * Central World state.
 */

import type { EntityId, Seed } from "../core/types.js";
import { RNG } from "../core/rng.js";
import { seedIdGenerator } from "../core/id.js";
import { createCalendar, type CalendarState } from "../core/calendar.js";
import { EventBus } from "../core/events.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import type { Competition, Fixture, LeagueTableRow, SeasonState } from "../competitions/types.js";
import type { Match } from "../matches/types.js";
import type { Injury } from "../injuries/types.js";

export interface WorldConfig {
  seed: Seed;
  startDate?: string;
}

export interface World {
  version: number;
  seed: Seed;
  rng: RNG;
  calendar: CalendarState;
  events: EventBus;
  players: Map<EntityId, Player>;
  clubs: Map<EntityId, Club>;
  competitions: Map<EntityId, Competition>;
  fixtures: Map<EntityId, Fixture>;
  matches: Map<EntityId, Match>;
  injuries: Map<EntityId, Injury>;
  leagueTables: Map<EntityId, LeagueTableRow[]>;
  leagues: Map<EntityId, EntityId[]>;
  season: SeasonState | null;
  userPlayerId: EntityId | null;
  userManagerId: EntityId | null;
  transferWindowOpen: boolean;
}

export function createWorld(config: WorldConfig): World {
  seedIdGenerator(config.seed);
  const rng = new RNG(config.seed);
  return {
    version: 2,
    seed: config.seed,
    rng,
    calendar: createCalendar(config.startDate ?? "2026-07-01"),
    events: new EventBus(),
    players: new Map(),
    clubs: new Map(),
    competitions: new Map(),
    fixtures: new Map(),
    matches: new Map(),
    injuries: new Map(),
    leagueTables: new Map(),
    leagues: new Map(),
    season: null,
    userPlayerId: null,
    userManagerId: null,
    transferWindowOpen: true,
  };
}

export function getPlayer(world: World, id: EntityId): Player | undefined {
  return world.players.get(id);
}

export function getClub(world: World, id: EntityId): Club | undefined {
  return world.clubs.get(id);
}

export function addPlayer(world: World, player: Player): void {
  world.players.set(player.id, player);
}

export function addClub(world: World, club: Club): void {
  world.clubs.set(club.id, club);
}

export function addCompetition(world: World, competition: Competition): void {
  world.competitions.set(competition.id, competition);
}

export function addFixture(world: World, fixture: Fixture): void {
  world.fixtures.set(fixture.id, fixture);
}
