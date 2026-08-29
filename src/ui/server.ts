/**
 * Playable career web server — mobile UI + sim API.
 * npm run play:web  →  http://localhost:3847
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import {
  createSession,
  startPlayerCareer,
  getHub,
  advanceMatchday,
  endSeason,
  nextSeason,
  doTrain,
  getAgentAdvice,
  getPress,
  answerPress,
  getIntlStatus,
  getNextUserFixture,
  beginPlayableMatch,
  chooseHighlightAction,
  skipToFullTime,
  getPostMatchReport,
  save,
  type GameSession,
  listMarketPlayers,
  getSquadWithValues,
  getLatestUserMatchStats,
  getMatchStatsView,
  getClubSocialView,
} from "./api.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";
import { getFanSentiment } from "../social/fans.js";
import { generateTargets } from "../transfers/market.js";
import { estimateMarketValue, formatMarketValue } from "../contracts/valuation.js";

let session: GameSession = createSession(Date.now() % 100000);
let careerStarted = false;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function feedPayload() {
  const w = session.world;
  const news = getNewsFeed(w)
    .slice(-40)
    .reverse()
    .map((n) => ({
      id: n.id,
      headline: n.headline,
      body: n.body,
      importance: n.importance,
      category: n.category,
      date: n.timestamp,
      sentiment: n.sentiment,
      tags: n.tags,
      players: n.relatedPlayerIds,
      clubs: n.relatedClubIds,
    }));
  const social = getSocialFeed(w)
    .slice(-30)
    .reverse()
    .map((s) => ({
      author: s.authorLabel,
      content: s.content,
      engagement: s.engagement,
      sentiment: s.sentiment,
    }));
  return { news, social };
}

function scoutPayload() {
  const w = session.world;
  const user = w.userPlayerId ? w.players.get(w.userPlayerId) : null;
  const club = user?.currentClubId ? w.clubs.get(user.currentClubId) : null;
  if (!club) return { targets: [] };
  const targets = generateTargets(w, club, 12).map((t) => {
    const p = w.players.get(t.playerId)!;
    const from = p.currentClubId ? w.clubs.get(p.currentClubId)?.name : "Free agent";
    const noise = (v: number) => {
      const lo = Math.max(1, v - 6 - Math.floor(Math.random() * 4));
      const hi = Math.min(99, v + 4 + Math.floor(Math.random() * 6));
      return [lo, hi];
    };
    return {
      id: p.id,
      name: p.displayName,
      age: p.age,
      position: p.primaryPosition,
      ovr: p.ovr,
      potential: p.potential,
      club: from,
      fee: t.estimatedFee,
      marketValue: estimateMarketValue(w, p),
      marketValueLabel: formatMarketValue(estimateMarketValue(w, p)),
      fit: t.score,
      reason: `${t.position} need (${t.needLevel})`,
      ranges: {
        pace: noise(p.attributes.physical.pace),
        shooting: noise(p.attributes.technical.finishing),
        passing: noise(p.attributes.technical.passing),
        dribbling: noise(p.attributes.technical.dribbling),
        defending: noise(p.attributes.technical.tackling),
        physical: noise(p.attributes.physical.strength),
      },
      reportPct: 15 + Math.floor(Math.random() * 55),
    };
  });
  return { targets };
}

function playerDevPayload() {
  const w = session.world;
  const id = w.userPlayerId;
  if (!id) return null;
  const p = w.players.get(id)!;
  const a = p.attributes;
  return {
    id: p.id,
    name: p.displayName,
    age: p.age,
    position: p.primaryPosition,
    ovr: p.ovr,
    potential: p.potential,
    foot: p.preferredFoot,
    club: p.currentClubId ? w.clubs.get(p.currentClubId)?.name : "Free agent",
    form: Math.round(p.state.form),
    fitness: Math.round(p.state.fitness),
    morale: Math.round(p.state.morale),
    trust: Math.round(p.state.managerTrust),
    reputation: Math.round(p.reputation),
    apps: p.state.appearancesThisSeason,
    goals: p.state.goalsThisSeason,
    assists: p.state.assistsThisSeason,
    careerApps: p.careerAppearances,
    careerGoals: p.careerGoals,
    groups: {
      pace: Math.round((a.physical.pace + a.physical.acceleration) / 2),
      shooting: Math.round((a.technical.finishing + a.technical.longShots) / 2),
      passing: Math.round((a.technical.passing + a.mental.vision) / 2),
      dribbling: Math.round((a.technical.dribbling + a.technical.ballControl) / 2),
      defending: Math.round((a.technical.tackling + a.technical.marking) / 2),
      physical: Math.round((a.physical.strength + a.physical.stamina) / 2),
    },
    detail: {
      sprintSpeed: a.physical.pace,
      acceleration: a.physical.acceleration,
      finishing: a.technical.finishing,
      longShots: a.technical.longShots,
      vision: a.mental.vision,
      crossing: a.technical.crossing,
      shortPass: a.technical.passing,
      heading: a.technical.heading,
      agility: a.physical.agility,
      balance: a.physical.balance,
      reactions: a.mental.reactions,
      ballControl: a.technical.ballControl,
      dribbling: a.technical.dribbling,
      marking: a.technical.marking,
      standingTackle: a.technical.tackling,
      jumping: a.physical.jumping,
      stamina: a.physical.stamina,
      strength: a.physical.strength,
      aggression: a.mental.aggression,
      composure: a.mental.composure,
      positioning: a.mental.positioning,
      decisions: a.mental.decisions,
    },
    plans: ["Balanced", "Attacking", "Defending", "Physical", "Tactical"],
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? "GET";

  if (path === "/api/status") {
    return json(res, 200, {
      careerStarted,
      mode: session.mode,
      date: session.world.calendar.currentDate,
      season: session.world.calendar.currentSeason,
    });
  }

  if ((path === "/api/start" || path === "/api/career/start") && method === "POST") {
    const body = await readBody(req);
    const result = startPlayerCareer(session, {
      firstName: body.firstName || "Jordan",
      lastName: body.lastName || "Vale",
      position: body.position || "RW",
      age: Number(body.age) || 17,
      potential: Number(body.potential) || 85,
      nationality: body.nationality || "England",
      preferredFoot: body.preferredFoot === "Left" || body.preferredFoot === "Both" ? body.preferredFoot : "Right",
      physicalProfile: ["Slight", "Average", "Athletic", "Powerful", "Tall"].includes(body.physicalProfile)
        ? body.physicalProfile
        : "Athletic",
      heightCm: body.heightCm ? Number(body.heightCm) : undefined,
    });
    careerStarted = true;
    return json(res, 200, result);
  }

  if (!careerStarted && path !== "/api/start" && path !== "/api/career/start" && path !== "/api/status") {
    return json(res, 400, { error: "Start a career first" });
  }

  if (path === "/api/hub") return json(res, 200, getHub(session));
  if (path === "/api/match/stats") {
    const url = new URL(req.url || "/", "http://localhost");
    const mid = url.searchParams.get("matchId");
    if (mid) return json(res, 200, getMatchStatsView(session, mid) ?? { error: "not found" });
    return json(res, 200, getLatestUserMatchStats(session) ?? { error: "no match yet" });
  }
  if (path === "/api/club/social") {
    const url = new URL(req.url || "/", "http://localhost");
    return json(res, 200, getClubSocialView(session, url.searchParams.get("clubId") || undefined) ?? { error: "no club" });
  }
  if (path === "/api/market") {
    const url = new URL(req.url || "/", "http://localhost");
    const clubId = url.searchParams.get("clubId") || undefined;
    const limit = Number(url.searchParams.get("limit") || 300);
    return json(res, 200, { players: listMarketPlayers(session, { clubId, limit }) });
  }
  if (path === "/api/squad") return json(res, 200, getSquadWithValues(session));
  if (path === "/api/feed") return json(res, 200, feedPayload());
  if (path === "/api/player") return json(res, 200, playerDevPayload());
  if (path === "/api/scout") return json(res, 200, scoutPayload());
  if (path === "/api/fixture") return json(res, 200, getNextUserFixture(session));
  if (path === "/api/agent") return json(res, 200, { advice: getAgentAdvice(session) });
  if (path === "/api/intl") return json(res, 200, getIntlStatus(session));

  if (path === "/api/advance" && method === "POST") {
    try {
      return json(res, 200, advanceMatchday(session));
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  if (path === "/api/train" && method === "POST") {
    const body = await readBody(req);
    const focus = body.focus || "Tactical";
    return json(res, 200, doTrain(session, focus));
  }

  if (path === "/api/match/start" && method === "POST") {
    try {
      const state = beginPlayableMatch(session);
      return json(res, 200, state);
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  if (path === "/api/match/action" && method === "POST") {
    const body = await readBody(req);
    try {
      return json(res, 200, chooseHighlightAction(session, body.actionId));
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  if (path === "/api/match/finish" && method === "POST") {
    try {
      const state = skipToFullTime(session);
      const report = getPostMatchReport(session);
      return json(res, 200, { state, report });
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  if (path === "/api/season/end" && method === "POST") {
    while (true) {
      const r = advanceMatchday(session);
      if (r.done) break;
    }
    const end = endSeason(session);
    return json(res, 200, end);
  }

  if (path === "/api/season/next" && method === "POST") {
    return json(res, 200, nextSeason(session));
  }

  if (path === "/api/save" && method === "POST") {
    const pathSaved = save(session, "web-career");
    return json(res, 200, { path: pathSaved });
  }

  if (path === "/api/press") {
    return json(res, 200, { questions: getPress(session) });
  }

  if (path === "/api/press/answer" && method === "POST") {
    const body = await readBody(req);
    try {
      return json(res, 200, answerPress(session, body.questionId, body.responseId));
    } catch (e: any) {
      return json(res, 400, { error: e.message });
    }
  }

  json(res, 404, { error: "Not found" });
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const PORT = Number(process.env.PORT || 3847);
const publicDir = join(process.cwd(), "public");

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path.startsWith("/api/")) {
    try {
      await handleApi(req, res, path);
    } catch (e: any) {
      json(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  let filePath = path === "/" ? join(publicDir, "app.html") : join(publicDir, path);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
  res.end(readFileSync(filePath));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n⚽  Football Career — playable UI`);
  console.log(`    http://0.0.0.0:${PORT}`);
  console.log(`    http://localhost:${PORT}\n`);
});
