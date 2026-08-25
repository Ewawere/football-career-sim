/**
 * World serialization for save/load.
 */

import type { World } from "../world/world.js";
import { RNG } from "../core/rng.js";
import { seedIdGenerator, getIdCounter, resetIdCounter } from "../core/id.js";
import type { Player } from "../players/player.js";
import type { Club } from "../clubs/club.js";
import type { Competition, Fixture, LeagueTableRow, SeasonState } from "../competitions/types.js";
import type { Injury } from "../injuries/types.js";
import { EventBus } from "../core/events.js";

export interface SerializedWorld {
  version: number;
  seed: number;
  rngState: number;
  idCounter: number;
  calendar: World["calendar"];
  players: Player[];
  clubs: Club[];
  competitions: Competition[];
  fixtures: Fixture[];
  leagueTables: Record<string, LeagueTableRow[]>;
  leagues: Record<string, string[]>;
  season: SeasonState | null;
  userPlayerId: string | null;
  userManagerId: string | null;
  transferWindowOpen: boolean;
  injuries: Injury[];
}

export function serializeWorld(world: World): SerializedWorld {
  const leagueTables: Record<string, LeagueTableRow[]> = {};
  for (const [k, v] of world.leagueTables) leagueTables[k] = v;

  const leagues: Record<string, string[]> = {};
  for (const [k, v] of world.leagues) leagues[k] = v;

  return {
    version: world.version,
    seed: world.seed,
    rngState: world.rng.getState(),
    idCounter: getIdCounter(),
    calendar: { ...world.calendar },
    players: [...world.players.values()],
    clubs: [...world.clubs.values()],
    competitions: [...world.competitions.values()],
    fixtures: [...world.fixtures.values()],
    leagueTables,
    leagues,
    season: world.season ? { ...world.season } : null,
    userPlayerId: world.userPlayerId,
    userManagerId: world.userManagerId,
    transferWindowOpen: world.transferWindowOpen,
    injuries: [...world.injuries.values()],
  };
}

export function deserializeWorld(data: SerializedWorld): World {
  seedIdGenerator(data.seed);
  resetIdCounter(data.idCounter);

  const rng = new RNG(data.seed);
  rng.setState(data.rngState);

  const world: World = {
    version: data.version,
    seed: data.seed,
    rng,
    calendar: data.calendar,
    events: new EventBus(),
    players: new Map(data.players.map((p) => [p.id, p])),
    clubs: new Map(data.clubs.map((c) => [c.id, c])),
    competitions: new Map(data.competitions.map((c) => [c.id, c])),
    fixtures: new Map(data.fixtures.map((f) => [f.id, f])),
    matches: new Map(),
    leagueTables: new Map(Object.entries(data.leagueTables)),
    leagues: new Map(Object.entries(data.leagues)),
    season: data.season,
    userPlayerId: data.userPlayerId,
    userManagerId: data.userManagerId,
    transferWindowOpen: data.transferWindowOpen,
    injuries: new Map((data.injuries ?? []).map((i) => [i.id, i])),
  };
  return world;
}

export function saveToJson(world: World): string {
  return JSON.stringify(serializeWorld(world));
}

export function loadFromJson(json: string): World {
  return deserializeWorld(JSON.parse(json) as SerializedWorld);
}
