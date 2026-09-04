/**
 * Simulation API facade for the mobile UI.
 */

import { createWorld, type World } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer, listStarterClubs } from "../career/player-career.js";
import {
  startSeason,
  playMatchday,
  endSeasonProcessing,
  beginNextSeason,
} from "../competitions/season.js";
import { startManagerCareer, acceptJobOffer, getJobOffers } from "../managers/career.js";
import { setManagerTactics } from "../managers/tactics.js";
import { getManager } from "../managers/generation.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";
import { evaluateClientSituation, agentArrangeLoan } from "../relationships/agent.js";
import { generatePressQuestions, refreshPressAfterMatchday, getPressQuestions } from "../media/press.js";
import { ensureClubSocial, getClubSocialFeed, clubPostUpcomingFixtures } from "../social/clubs.js";
import { applyPressAnswer } from "../media/press-interactive.js";
import { playerInternationalStatus } from "../international/selection.js";
import { applyTrainingSession } from "../training/development.js";
import { estimateMarketValue, formatMarketValue } from "../contracts/valuation.js";
import { saveToJson, loadFromJson } from "../save/serialize.js";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { EntityId } from "../core/types.js";
import {
  startPlayableMatch,
  resolveHighlight,
  autoCompletePlayable,
  playableSnapshot,
  type PlayableMatchSession,
} from "../matches/playable.js";
import { buildPostMatchReport } from "../matches/postmatch.js";
import {
  startContinuousMatch,
  tickContinuous,
  simUntil,
  startSecondHalf,
  continuousSnapshot,
  getContinuous,
} from "../matches/continuous.js";
import { getPlayerPlayStyles } from "../players/playstyles.js";
import { getSkillPoints } from "../players/skill-points.js";

export interface GameSession {
  world: World;
  mode: "None" | "Player" | "Manager";
  competitionId: EntityId | null;
  playable?: PlayableMatchSession | null;
}

export function createSession(seed = 42): GameSession {
  const world = createWorld({ seed, startDate: "2026-07-01" });
  bootstrapWorld(world);
  return { world, mode: "None", competitionId: null, playable: null };
}

export function initWorldSession(seed = Date.now() % 100000): GameSession {
  return createSession(seed);
}

export function getStarterClubs(session: GameSession) {
  return listStarterClubs(session.world);
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
    playArchetype?: string;
    secondaryPositions?: string[];
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
    playArchetype: opts.playArchetype as any,
    secondaryPositions: opts.secondaryPositions as any,
  });
  session.mode = "Player";
  session.world.userPlayerId = placement.player.id;
  const comp = startSeason(session.world);
  session.competitionId = comp.id;
  return {
    player: snapshotPlayer(session.world, placement.player.id),
    club: placement.club
      ? { id: placement.club.id, name: placement.club.name, reputation: placement.club.reputation }
      : null,
    reason: placement.reason,
    season: session.world.calendar.currentSeason,
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

export function getHub(session: GameSession) {
  const w = session.world;
  const pid = w.userPlayerId;
  const player = pid ? snapshotPlayer(w, pid) : null;
  let news: any[] = [];
  let social: any[] = [];
  try {
    news = getNewsFeed(w).slice(-20).reverse();
  } catch {}
  try {
    social = getSocialFeed(w).slice(-20).reverse();
  } catch {}
  return {
    date: w.calendar.currentDate,
    season: w.calendar.currentSeason,
    mode: session.mode,
    player,
    news,
    social,
    threads: [],
  };
}

function bumpDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function advanceMatchday(session: GameSession) {
  const w = session.world;
  if (!session.competitionId) {
    const comp = startSeason(w);
    session.competitionId = comp.id;
  }
  w.calendar.currentDate = bumpDate(w.calendar.currentDate);
  try {
    if (session.competitionId) playMatchday(w, session.competitionId, 1);
  } catch {}
  try {
    refreshPressAfterMatchday(w);
  } catch {}
  return { date: w.calendar.currentDate, hub: getHub(session) };
}

export function endSeason(session: GameSession) {
  endSeasonProcessing(session.world);
  return { ok: true };
}

export function nextSeason(session: GameSession) {
  const comp = beginNextSeason(session.world);
  session.competitionId = comp.id;
  return { season: session.world.calendar.currentSeason, competitionId: comp.id };
}

export function doTrain(session: GameSession, focus: string) {
  const pid = session.world.userPlayerId;
  if (!pid) return null;
  const player = session.world.players.get(pid);
  if (!player) return null;
  try {
    applyTrainingSession(session.world, player, focus as any);
  } catch {
    player.state.fitness = Math.min(100, (player.state.fitness ?? 70) + 3);
    player.state.form = Math.min(100, (player.state.form ?? 50) + 1);
  }
  return snapshotPlayer(session.world, pid);
}

export function getAgentAdvice(session: GameSession) {
  const pid = session.world.userPlayerId;
  if (!pid) return null;
  try {
    return evaluateClientSituation(session.world, pid);
  } catch {
    return { summary: "Stay patient and play well." };
  }
}

export function requestLoanViaAgent(session: GameSession) {
  const pid = session.world.userPlayerId;
  if (!pid) return { ok: false };
  try {
    return agentArrangeLoan(session.world, pid);
  } catch {
    return { ok: false };
  }
}

export function getPress(session: GameSession) {
  try {
    return getPressQuestions(session.world) || generatePressQuestions(session.world);
  } catch {
    return [];
  }
}

export function answerPress(session: GameSession, questionId: string, responseId: string) {
  try {
    return applyPressAnswer(session.world, questionId, responseId);
  } catch {
    return { ok: true };
  }
}

export function setTactics(session: GameSession, tactics: any) {
  try {
    setManagerTactics(session.world, tactics);
  } catch {}
  return { ok: true };
}

export function listJobOffers(session: GameSession) {
  try {
    return getJobOffers(session.world);
  } catch {
    return [];
  }
}

export function takeJob(session: GameSession, offerId: string) {
  try {
    return acceptJobOffer(session.world, offerId);
  } catch {
    return false;
  }
}

export function getIntlStatus(session: GameSession) {
  const id = session.world.userPlayerId;
  if (!id) return null;
  return playerInternationalStatus(session.world, id);
}

export function save(session: GameSession, name = "career") {
  const dir = join(process.cwd(), "saves");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  writeFileSync(path, saveToJson(session.world), "utf8");
  return path;
}

export function load(name = "career"): GameSession {
  const path = join(process.cwd(), "saves", `${name}.json`);
  const world = loadFromJson(readFileSync(path, "utf8"));
  return { world, mode: world.userPlayerId ? "Player" : "None", competitionId: null, playable: null };
}

export function getNextUserFixture(session: GameSession) {
  const pid = session.world.userPlayerId;
  if (!pid) return null;
  const player = session.world.players.get(pid);
  if (!player?.currentClubId) return null;
  const clubId = player.currentClubId;
  const upcoming = [...session.world.matches.values()]
    .filter(
      (m) =>
        m.status !== "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export function beginPlayableMatch(session: GameSession) {
  const fx = getNextUserFixture(session);
  if (!fx) throw new Error("No fixture available");
  session.playable = startPlayableMatch(session.world, fx.id);
  return playableSnapshot(session.playable);
}

export function getPlayableState(session: GameSession) {
  if (!session.playable) return null;
  return playableSnapshot(session.playable);
}

export function chooseHighlightAction(session: GameSession, actionId: string) {
  if (!session.playable) throw new Error("No live match");
  resolveHighlight(session.world, session.playable, actionId);
  return playableSnapshot(session.playable);
}

export function skipToFullTime(session: GameSession) {
  if (!session.playable) {
    try {
      beginPlayableMatch(session);
    } catch {
      return null;
    }
  }
  if (session.playable) autoCompletePlayable(session.world, session.playable);
  return session.playable ? playableSnapshot(session.playable) : null;
}

export function beginContinuousMatch(session: GameSession) {
  const fx = getNextUserFixture(session);
  if (!fx) throw new Error("No fixture");
  return continuousSnapshot(startContinuousMatch(session.world, fx.id));
}

export function continuousTick(session: GameSession, n = 1) {
  const c = getContinuous();
  if (!c) return null;
  for (let i = 0; i < n; i++) tickContinuous(session.world, c);
  return continuousSnapshot(c);
}

export function continuousSimTo(session: GameSession, minute: number) {
  const c = getContinuous();
  if (!c) return null;
  simUntil(session.world, c, minute);
  return continuousSnapshot(c);
}

export function continuousResumeSecondHalf(session: GameSession) {
  const c = getContinuous();
  if (!c) return null;
  startSecondHalf(c);
  return continuousSnapshot(c);
}

export function getContinuousState(session: GameSession) {
  const c = getContinuous();
  return c ? continuousSnapshot(c) : null;
}

export function getPostMatchReport(session: GameSession) {
  try {
    return buildPostMatchReport(session.world);
  } catch {
    return null;
  }
}

function snapshotPlayer(world: World, id: EntityId) {
  const p = world.players.get(id);
  if (!p) return null;
  const club = p.currentClubId ? world.clubs.get(p.currentClubId) : null;
  let marketValue = 0;
  let marketValueLabel = "—";
  try {
    marketValue = estimateMarketValue(p);
    marketValueLabel = formatMarketValue(marketValue);
  } catch {
    marketValue = Math.round((p.ovr || 60) ** 2 * 1000);
    marketValueLabel = `€${(marketValue / 1e6).toFixed(1)}M`;
  }
  let playStyles: any = { unlocked: [], near: [], equipped: [] };
  try {
    playStyles = getPlayerPlayStyles(p);
  } catch {}
  let skillPoints: any = 0;
  try {
    skillPoints = getSkillPoints(p);
  } catch {}
  return {
    id: p.id,
    name: p.displayName,
    displayName: p.displayName,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.primaryPosition,
    secondaryPositions: p.secondaryPositions || [],
    ovr: p.ovr,
    age: p.age,
    nationality: p.nationality,
    preferredFoot: p.preferredFoot,
    physicalProfile: p.physicalProfile,
    playArchetype: (p as any).playArchetype || null,
    heightCm: p.heightCm,
    club: club?.name ?? null,
    clubName: club?.name ?? null,
    clubId: p.currentClubId,
    form: p.state.form,
    fitness: p.state.fitness,
    managerTrust: p.state.managerTrust ?? 50,
    trust: p.state.managerTrust ?? 50,
    apps: p.careerAppearances ?? 0,
    goals: p.careerGoals ?? 0,
    assists: p.careerAssists ?? 0,
    wage: p.contract?.wage ?? 0,
    marketValue,
    marketValueLabel,
    playStyles,
    skillPoints,
    attributes: p.attributes,
  };
}

function snapshotManager(world: World, id: EntityId) {
  const m = getManager(world, id);
  if (!m) return null;
  return {
    id: m.id,
    name: (m as any).displayName || (m as any).name,
    clubId: (m as any).clubId,
  };
}

export function listMarketPlayers(session: GameSession, opts?: { clubId?: string; limit?: number }) {
  const limit = opts?.limit ?? 50;
  return [...session.world.players.values()]
    .filter((p) => !p.retired)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, limit)
    .map((p) => snapshotPlayer(session.world, p.id));
}

export function getSquadWithValues(session: GameSession) {
  const pid = session.world.userPlayerId;
  const player = pid ? session.world.players.get(pid) : null;
  const clubId = player?.currentClubId;
  if (!clubId) return [];
  const club = session.world.clubs.get(clubId);
  if (!club) return [];
  return club.squadPlayerIds.map((id) => snapshotPlayer(session.world, id)).filter(Boolean);
}

export function getMatchStatsView(session: GameSession, matchId: string) {
  const match = session.world.matches.get(matchId as EntityId);
  if (!match) return null;
  return formatMatchStats(session, match);
}

export function getLatestUserMatchStats(session: GameSession) {
  const pid = session.world.userPlayerId;
  if (!pid) return null;
  const player = session.world.players.get(pid);
  if (!player?.currentClubId) return null;
  const clubId = player.currentClubId;
  const finished = [...session.world.matches.values()]
    .filter(
      (m) =>
        m.status === "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!finished[0]) return null;
  return formatMatchStats(session, finished[0]);
}

function formatMatchStats(session: GameSession, match: any) {
  const homeClub = session.world.clubs.get(match.home.clubId);
  const awayClub = session.world.clubs.get(match.away.clubId);
  const ratings: any[] = [];
  if (match.playerStats) {
    for (const [id, st] of match.playerStats.entries()) {
      const p = session.world.players.get(id);
      ratings.push({
        id,
        name: p?.displayName,
        rating: st.rating,
        goals: st.goals,
        assists: st.assists,
        minutes: st.minutes,
        shots: st.shots,
        keyPasses: st.keyPasses,
      });
    }
  }
  return {
    score: `${match.homeScore}-${match.awayScore}`,
    venue: homeClub?.stadiumName || "Stadium",
    home: {
      name: homeClub?.name || "Home",
      short: homeClub?.shortName,
      stats: match.home?.stats || { possession: 50, xG: 0, shots: 0 },
    },
    away: {
      name: awayClub?.name || "Away",
      short: awayClub?.shortName,
      stats: match.away?.stats || { possession: 50, xG: 0, shots: 0 },
    },
    ratings,
    mentality: "Home Attacking · Away Balanced",
  };
}

export function getClubSocialView(session: GameSession, clubId?: string) {
  const pid = session.world.userPlayerId;
  const player = pid ? session.world.players.get(pid) : null;
  const id = (clubId || player?.currentClubId) as EntityId | undefined;
  if (!id) return { posts: [] };
  const club = session.world.clubs.get(id);
  if (!club) return { posts: [] };
  try {
    ensureClubSocial(session.world, club);
    clubPostUpcomingFixtures(session.world, id, 2);
    return { posts: getClubSocialFeed(session.world, id, 20) };
  } catch {
    return { posts: [] };
  }
}
