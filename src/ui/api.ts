/**
 * Simulation API facade — the only surface the UI should talk to.
 * Mobile screens call these methods; they never touch world maps directly.
 */

import { createWorld, type World } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
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
  const userPlayer = w.userPlayerId ? w.players.get(w.userPlayerId) : null;
  const userManager = w.userManagerId ? getManager(w, w.userManagerId) : null;

  const table = session.competitionId
    ? w.leagueTables.get(session.competitionId) ?? []
    : [];

  return {
    date: w.calendar.currentDate,
    season: w.calendar.currentSeason,
    mode: session.mode,
    player: userPlayer ? snapshotPlayer(w, userPlayer.id) : null,
    manager: userManager ? snapshotManager(w, userManager.id) : null,
    table: table.slice(0, 20).map((r) => ({
      pos: r.position,
      club: w.clubs.get(r.clubId)?.name ?? "?",
      clubId: r.clubId,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      gf: r.goalsFor,
      ga: r.goalsAgainst,
      gd: r.goalDifference,
      pts: r.points,
      form: (r.form ?? []).slice(-5).join("") || "—",
    })),
    news: getNewsFeed(w)
      .slice(-8)
      .reverse()
      .map((n) => ({
        id: n.id,
        headline: n.headline,
        importance: n.importance,
        category: n.category,
        date: n.timestamp,
      })),
    social: getSocialFeed(w)
      .slice(-6)
      .reverse()
      .map((s) => ({
        author: s.authorLabel,
        content: s.content,
        engagement: s.engagement,
      })),
  };
}

export function advanceMatchday(session: GameSession) {
  if (!session.competitionId) throw new Error("No active season");
  const comp = session.world.competitions.get(session.competitionId)!;
  const next = (comp.currentMatchday ?? 0) + 1;
  if (next > 38) {
    return { done: true as const, message: "Season complete — call endSeason()" };
  }
  const played = playMatchday(session.world, session.competitionId, next);
  let europeExtra = 0;
  for (const c of session.world.competitions.values()) {
    if (c.id === session.competitionId) continue;
    if (c.type !== "League" && c.type !== "Continental") continue;
    if (next > c.matchdayCount) continue;
    try {
      europeExtra += playMatchday(session.world, c.id, next);
    } catch {
      /* skip */
    }
  }
  const press = refreshPressAfterMatchday(session.world);
  return {
    done: false as const,
    matchday: next,
    matchesPlayed: played,
    europeMatchesPlayed: europeExtra,
    pressQuestions: press,
    hub: getHub(session),
  };
}

export function endSeason(session: GameSession) {
  endSeasonProcessing(session.world);
  const awards = getAwards(session.world).slice(-15);
  return {
    awards: awards.map((a) => ({
      type: a.type,
      playerId: a.playerId,
      clubId: a.clubId,
      value: a.value,
      position: a.position,
    })),
    hub: getHub(session),
  };
}

export function nextSeason(session: GameSession) {
  const comp = beginNextSeason(session.world);
  session.competitionId = comp.id;
  return { season: session.world.calendar.currentSeason, competitionId: comp.id };
}

export function doTrain(
  session: GameSession,
  focus: "Attacking" | "Defending" | "Physical" | "Tactical" | "Goalkeeping" = "Tactical"
) {
  const id = session.world.userPlayerId;
  if (!id) throw new Error("No user player");
  const player = session.world.players.get(id)!;
  applyTrainingSession(player, focus, 70, session.world);
  return snapshotPlayer(session.world, id);
}

export function getAgentAdvice(session: GameSession) {
  const id = session.world.userPlayerId;
  if (!id) return null;
  return evaluateClientSituation(session.world, id);
}

export function requestLoanViaAgent(session: GameSession) {
  const id = session.world.userPlayerId;
  if (!id) return false;
  return agentArrangeLoan(session.world, id);
}

export function getPress(session: GameSession) {
  const id = session.world.userPlayerId;
  if (!id) return [];
  const existing = getPressQuestions(session.world);
  if (existing.length) return existing;
  return generatePressQuestions(session.world, id);
}

export function answerPress(session: GameSession, questionId: string, responseId: string) {
  const id = session.world.userPlayerId;
  if (!id) throw new Error("No user player");
  let qs = getPressQuestions(session.world);
  if (!qs.length) qs = generatePressQuestions(session.world, id);
  const q = qs.find((x) => x.id === questionId);
  if (!q) throw new Error("Question not found — refresh press");
  const response =
    q.suggestedResponses.find((r) => r.id === responseId) ??
    aiSelectResponse(session.world, id, q);
  const result = applyPressAnswer(session.world, id, q, response);
  (session.world as any).pressQuestions = qs.filter((x) => x.id !== questionId);
  return result;
}

export function setTactics(
  session: GameSession,
  formation: string,
  identity?: "Possession" | "CounterAttack" | "HighPress" | "Direct" | "Balanced" | "Defensive"
) {
  const id = session.world.userManagerId;
  if (!id) throw new Error("No user manager");
  return setManagerTactics(session.world, id, { formation, identity });
}

export function listJobOffers(session: GameSession) {
  return getJobOffers(session.world);
}

export function takeJob(session: GameSession, offerId: string) {
  return acceptJobOffer(session.world, offerId);
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
  const json = readFileSync(path, "utf8");
  const world = loadFromJson(json);
  const mode: CareerMode = world.userPlayerId
    ? "Player"
    : world.userManagerId
      ? "Manager"
      : "None";
  const comps = [...world.competitions.values()];
  const active = comps.find((c) => c.type === "League") ?? null;
  return { world, mode, competitionId: active?.id ?? null };
}

export function getNextUserFixture(session: GameSession) {
  const userId = session.world.userPlayerId;
  if (!userId || !session.competitionId) return null;
  const player = session.world.players.get(userId);
  if (!player?.currentClubId) return null;
  const fixtures = [...session.world.fixtures.values()].filter(
    (f) =>
      f.competitionId === session.competitionId &&
      !f.played &&
      (f.homeClubId === player.currentClubId || f.awayClubId === player.currentClubId)
  );
  fixtures.sort((a, b) => a.matchday - b.matchday || a.date.localeCompare(b.date));
  const f = fixtures[0];
  if (!f) return null;
  const home = session.world.clubs.get(f.homeClubId);
  const away = session.world.clubs.get(f.awayClubId);
  return {
    fixtureId: f.id,
    matchday: f.matchday,
    date: f.date,
    home: home?.name,
    away: away?.name,
    homeClubId: f.homeClubId,
    awayClubId: f.awayClubId,
    isHome: f.homeClubId === player.currentClubId,
  };
}

export function beginPlayableMatch(session: GameSession) {
  const fix = getNextUserFixture(session);
  if (!fix) throw new Error("No upcoming fixture for user club");
  const ps = startPlayableMatch(
    session.world,
    fix.homeClubId,
    fix.awayClubId,
    fix.date,
    session.competitionId ?? undefined
  );
  const fixture = session.world.fixtures.get(fix.fixtureId);
  if (fixture) {
    fixture.matchId = ps.matchId;
  }
  (session as any).playableId = ps.id;
  playUntilHighlight(session.world, ps.id);
  return playableSnapshot(ps, session.world);
}

export function getPlayableState(session: GameSession) {
  const id = (session as any).playableId as string | undefined;
  if (!id) return null;
  const ps = getPlayableSession(id);
  if (!ps) return null;
  return playableSnapshot(ps, session.world);
}

export function chooseHighlightAction(session: GameSession, actionId: string) {
  const id = (session as any).playableId as string | undefined;
  if (!id) throw new Error("No playable match");
  const { outcome, session: ps } = resolveHighlight(session.world, id, actionId);
  return {
    outcome: {
      success: outcome.success,
      description: outcome.description,
      goal: !!outcome.goalScored,
      assist: !!outcome.assistCreated,
    },
    state: playableSnapshot(ps, session.world),
  };
}

export function skipToFullTime(session: GameSession) {
  const id = (session as any).playableId as string | undefined;
  if (!id) throw new Error("No playable match");
  const ps = autoCompletePlayable(session.world, id);
  const match = session.world.matches.get(ps.matchId);
  if (match && session.competitionId) {
    for (const f of session.world.fixtures.values()) {
      if (f.matchId === match.id) f.played = true;
    }
  }
  return playableSnapshot(ps, session.world);
}

export function beginContinuousMatch(session: GameSession) {
  const fix = getNextUserFixture(session);
  if (!fix) throw new Error("No upcoming fixture");
  const match = createMatch(
    session.world,
    fix.homeClubId,
    fix.awayClubId,
    fix.date,
    session.competitionId
  );
  session.world.matches.set(match.id, match);
  const state = startContinuousMatch(session.world, match, session.world.userPlayerId);
  (session as any).continuousMatchId = match.id;
  return continuousSnapshot(state);
}

export function continuousTick(
  session: GameSession,
  cmd: UserCommand = { type: "Idle" },
  dt = 0.2
) {
  const id = (session as any).continuousMatchId as string | undefined;
  if (!id) throw new Error("No continuous match");
  const state = tickContinuous(session.world, id, dt, cmd);
  return continuousSnapshot(state);
}

export function continuousSimTo(session: GameSession, minute: number) {
  const id = (session as any).continuousMatchId as string | undefined;
  if (!id) throw new Error("No continuous match");
  const state = simUntil(session.world, id, minute);
  return continuousSnapshot(state);
}

export function continuousResumeSecondHalf(session: GameSession) {
  const id = (session as any).continuousMatchId as string | undefined;
  if (!id) throw new Error("No continuous match");
  startSecondHalf(id);
  return continuousSnapshot(getContinuous(id)!);
}

export function getContinuousState(session: GameSession) {
  const id = (session as any).continuousMatchId as string | undefined;
  if (!id) return null;
  const st = getContinuous(id);
  return st ? continuousSnapshot(st) : null;
}

export function getPostMatchReport(session: GameSession) {
  const id = (session as any).playableId as string | undefined;
  if (!id) return null;
  const ps = getPlayableSession(id);
  if (!ps) return null;
  const match = session.world.matches.get(ps.matchId);
  if (!match) return null;
  return buildPostMatchReport(session.world, match, {
    userPlayerId: session.world.userPlayerId,
    playable: ps,
  });
}

function snapshotPlayer(world: World, id: EntityId) {
  const p = world.players.get(id)!;
  const club = p.currentClubId ? world.clubs.get(p.currentClubId) : null;
  return {
    id: p.id,
    name: p.displayName,
    age: p.age,
    position: p.primaryPosition,
    ovr: p.ovr,
    potential: p.potential,
    form: Math.round(p.state.form),
    fitness: Math.round(p.state.fitness),
    morale: Math.round(p.state.morale),
    managerTrust: Math.round(p.state.managerTrust),
    reputation: Math.round(p.reputation),
    apps: p.state.appearancesThisSeason,
    goals: p.state.goalsThisSeason,
    assists: p.state.assistsThisSeason,
    careerApps: p.careerAppearances,
    careerGoals: p.careerGoals,
    club: club ? club.name : "Free agent",
    clubId: p.currentClubId,
    preferredFoot: p.preferredFoot,
    heightCm: p.heightCm,
    nationality: p.nationality,
    physicalProfile: p.physicalProfile,
    caps: (p as any).internationalCaps ?? 0,
    marketValue: estimateMarketValue(world, p),
    marketValueLabel: formatMarketValue(estimateMarketValue(world, p)),
    wage: p.contract?.wage ?? 0,
    releaseClause: p.contract?.releaseClause ?? null,
  };
}

function snapshotManager(world: World, id: EntityId) {
  const m = getManager(world, id)!;
  const club = m.currentClubId ? world.clubs.get(m.currentClubId) : null;
  return {
    id: m.id,
    name: m.displayName,
    age: m.age,
    reputation: Math.round(m.reputation),
    boardConfidence: Math.round(m.boardConfidence),
    formation: m.preferredFormation,
    identity: m.preferredIdentity,
    club: club ? club.name : "Unemployed",
    clubId: m.currentClubId,
    record: `${m.careerWins}W-${m.careerDraws}D-${m.careerLosses}L`,
    trophies: m.trophies,
    status: m.status,
  };
}

export function listMarketPlayers(session: GameSession, opts?: { clubId?: string; limit?: number }) {
  const w = session.world;
  const limit = opts?.limit ?? 500;
  const rows: ReturnType<typeof snapshotPlayer>[] = [];
  for (const pl of w.players.values()) {
    if (pl.retired) continue;
    if (opts?.clubId && pl.currentClubId !== opts.clubId) continue;
    rows.push(snapshotPlayer(w, pl.id));
  }
  rows.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  return rows.slice(0, limit);
}

export function getSquadWithValues(session: GameSession) {
  const w = session.world;
  const user = w.userPlayerId ? w.players.get(w.userPlayerId) : null;
  const clubId = user?.currentClubId ?? null;
  if (!clubId) return { clubId: null, club: null, players: [] as ReturnType<typeof snapshotPlayer>[] };
  const club = w.clubs.get(clubId);
  const players = listMarketPlayers(session, { clubId, limit: 40 });
  return {
    clubId,
    club: club?.name ?? null,
    budget: club?.transferBudget ?? 0,
    wageBudget: club?.wageBudgetWeekly ?? 0,
    players,
  };
}

export function getMatchStatsView(session: GameSession, matchId: string) {
  const m = session.world.matches.get(matchId);
  if (!m) return null;
  const home = session.world.clubs.get(m.home.clubId);
  const away = session.world.clubs.get(m.away.clubId);
  return {
    matchId: m.id,
    score: `${m.homeScore}–${m.awayScore}`,
    home: { name: home?.name, short: home?.shortName, stats: m.homeStats },
    away: { name: away?.name, short: away?.shortName, stats: m.awayStats },
    ratings: [...m.playerStats.entries()]
      .filter(([, st]) => st.minutes >= 1)
      .map(([id, st]) => {
        const p = session.world.players.get(id);
        return {
          id,
          name: p?.displayName,
          clubId: p?.currentClubId,
          rating: Math.round((st.rating / 10) * 10) / 10,
          goals: st.goals,
          assists: st.assists,
          minutes: st.minutes,
        };
      })
      .sort((a, b) => b.rating - a.rating),
  };
}

export function getLatestUserMatchStats(session: GameSession) {
  const pid = session.world.userPlayerId;
  if (!pid) return null;
  const player = session.world.players.get(pid);
  if (!player?.currentClubId) return null;
  const clubId = player.currentClubId;
  const matches = [...session.world.matches.values()]
    .filter(
      (m) =>
        m.status === "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!matches[0]) return null;
  return getMatchStatsView(session, matches[0].id);
}

export function getClubSocialView(session: GameSession, clubId?: string) {
  const w = session.world;
  const user = w.userPlayerId ? w.players.get(w.userPlayerId) : null;
  const id = clubId || user?.currentClubId;
  if (!id) return null;
  const club = w.clubs.get(id);
  if (!club) return null;
  const account = ensureClubSocial(w, club);
  const existing = getClubSocialFeed(w, id, 5);
  if (!existing.some((p) => p.tags.includes("next-match"))) {
    clubPostUpcomingFixtures(w, id, 2);
  }
  return {
    account,
    posts: getClubSocialFeed(w, id, 25),
  };
}
