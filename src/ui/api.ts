/**
 * Simulation API facade — the only surface the UI should talk to.
 * Mobile screens call these methods; they never touch world maps directly.
 */

import { createWorld, type World } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer, listStarterClubs, reassignStarterClub } from "../career/player-career.js";
import {
  startSeason,
  playMatchday,
  playFullSeason,
  endSeasonProcessing,
  beginNextSeason,
} from "../competitions/season.js";
import { startManagerCareer, acceptJobOffer, getJobOffers } from "../managers/career.js";
import { setManagerTactics } from "../managers/tactics.js";
import { getManager } from "../managers/generation.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";
import { getFanSentiment } from "../social/fans.js";
import { getAwards } from "../awards/engine.js";
import { evaluateClientSituation, agentArrangeLoan } from "../relationships/agent.js";
import { generatePressQuestions, refreshPressAfterMatchday, getPressQuestions } from "../media/press.js";
import { ensureClubSocial, getClubSocialFeed, clubPostUpcomingFixtures } from "../social/clubs.js";
import { applyPressAnswer, aiSelectResponse } from "../media/press-interactive.js";
import { playerInternationalStatus } from "../international/selection.js";
import { applyTrainingSession } from "../training/development.js";
import { estimateMarketValue, formatMarketValue } from "../contracts/valuation.js";
import { saveToJson, loadFromJson } from "../save/serialize.js";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { EntityId } from "../core/types.js";
import {
  startPlayableMatch,
  playUntilHighlight,
  resolveHighlight,
  autoCompletePlayable,
  playableSnapshot,
  type PlayableMatchSession,
  getPlayableSession,
} from "../matches/playable.js";
import { buildPostMatchReport } from "../matches/postmatch.js";
import {
  startContinuousMatch,
  tickContinuous,
  simUntil,
  startSecondHalf,
  continuousSnapshot,
  getContinuous,
} from "../matches/continuous/engine.js";
import type { UserCommand } from "../matches/continuous/types.js";
import { createMatch } from "../matches/engine.js";

export type CareerMode = "Player" | "Manager" | "None";

export interface GameSession {
  world: World;
  mode: CareerMode;
  competitionId: EntityId | null;
}

export function createSession(seed = 42): GameSession {
  const world = createWorld({ seed, startDate: "2026-07-01" });
  bootstrapWorld(world);
  return { world, mode: "None", competitionId: null };
}

export function startPlayerCareer(
  session: GameSession,
  opts: {
    firstName: string;
    lastName: string;
    position: string;
    nationality?: string;
    age?: number;
    potential?: number;
    preferredFoot?: "Left" | "Right" | "Both";
    physicalProfile?: "Slight" | "Average" | "Athletic" | "Powerful" | "Tall";
    heightCm?: number;
    clubId?: string;
  }
) {
  const placement = createCareerPlayer(session.world, {
    firstName: opts.firstName,
    lastName: opts.lastName,
    position: opts.position as any,
    preferredFoot: opts.preferredFoot ?? "Right",
    nationality: opts.nationality ?? "England",
    age: opts.age ?? 17,
    physicalProfile: opts.physicalProfile ?? "Athletic",
    heightCm: opts.heightCm,
    potential: opts.potential ?? 82,
    clubId: opts.clubId,
  });
  session.mode = "Player";
  const comp = startSeason(session.world);
  session.competitionId = comp.id;
  return {
    player: snapshotPlayer(session.world, placement.player.id),
    club: placement.club
      ? { id: placement.club.id, name: placement.club.name, reputation: placement.club.reputation }
      : null,
    reason: placement.reason,
    season: session.world.calendar.currentSeason,
    clubs: listStarterClubs(session.world),
  };
}

export function getStarterClubs(session: GameSession) {
  return { clubs: listStarterClubs(session.world) };
}

export function chooseStarterClub(session: GameSession, clubId: string) {
  const placement = reassignStarterClub(session.world, clubId);
  if (!placement) return { ok: false, message: "Cannot change club (already played or invalid)" };
  return {
    ok: true,
    reason: placement.reason,
    club: placement.club
      ? { id: placement.club.id, name: placement.club.name, reputation: placement.club.reputation }
      : null,
    player: snapshotPlayer(session.world, placement.player.id),
  };
}

export function startManagerMode(
  session: GameSession,
  opts: { firstName: string; lastName: string; nationality?: string }
) {
  const result = startManagerCareer(session.world, opts);
  session.mode = "Manager";
  const comp = startSeason(session.world);
  session.competitionId = comp.id;
  return {
    manager: snapshotManager(session.world, result.manager.id),
    club: { id: result.club.id, name: result.club.name, reputation: result.club.reputation },
    reason: result.reason,
  };
}
