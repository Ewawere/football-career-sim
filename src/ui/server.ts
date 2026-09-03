/**
 * Playable career web server - mobile UI + sim API.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import {
  createSession,
  startPlayerCareer,
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
import {
  getHybridHub,
  claimObjectiveApi,
  markInboxApi as markInboxReadApi,
  openNegotiationApi,
  respondNegotiationApi,
  setRoleApi,
  getNarrativeThreads,
  spendPlayStylePoint,
  listJobOffersApi,
  takeJobApi,
  declineJobApi,
  refreshJobOffersApi,
} from "./hybrid.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";

let session: GameSession = createSession(Date.now() % 100000);
let careerStarted = false;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function contentType(path: string): string {
  const ext = extname(path).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

function serveStatic(res: ServerResponse, filePath: string) {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(readFileSync(filePath));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (path === "/api/status") {
    return json(res, 200, {
      ok: true,
      careerStarted,
      date: session.world.calendar.currentDate,
      season: session.world.calendar.currentSeason,
    });
  }

  if ((path === "/api/start" || path === "/api/career/start") && method === "POST") {
    const body = await readBody(req);
    session = createSession(Date.now() % 100000);
    const result = startPlayerCareer(session, {
      firstName: body.firstName || "Alex",
      lastName: body.lastName || "Player",
      position: body.position || "CM",
      nationality: body.nationality || "England",
      age: body.age ?? 17,
      potential: body.potential ?? 82,
      preferredFoot: body.preferredFoot || "Right",
      physicalProfile: body.physicalProfile || "Athletic",
    });
    careerStarted = true;
    return json(res, 200, { ...result, hub: getHybridHub(session) });
  }

  if (!careerStarted && path !== "/api/start" && path !== "/api/career/start" && path !== "/api/status") {
    return json(res, 400, { error: "Start a career first (POST /api/start)" });
  }

  if (path === "/api/hub") return json(res, 200, getHybridHub(session));
  if (path === "/api/threads") return json(res, 200, { threads: getNarrativeThreads(session) });
  if (path === "/api/match/stats") {
    const id = new URL(req.url || "/", "http://x").searchParams.get("id");
    return json(res, 200, id ? getMatchStatsView(session, id) : getLatestUserMatchStats(session));
  }
  if (path === "/api/club/social") return json(res, 200, getClubSocialView(session));
  if (path === "/api/market") return json(res, 200, { players: listMarketPlayers(session, { limit: 100 }) });
  if (path === "/api/squad") return json(res, 200, getSquadWithValues(session));
  if (path === "/api/fixture") return json(res, 200, getNextUserFixture(session));
  if (path === "/api/agent") return json(res, 200, { advice: getAgentAdvice(session) });
  if (path === "/api/intl") return json(res, 200, getIntlStatus(session));
  if (path === "/api/news") {
    return json(res, 200, { news: getNewsFeed(session.world).slice(-30).reverse() });
  }
  if (path === "/api/social") {
    return json(res, 200, { posts: getSocialFeed(session.world).slice(-30).reverse() });
  }

  if (path === "/api/advance" && method === "POST") {
    const result = advanceMatchday(session);
    return json(res, 200, { ...result, hub: getHybridHub(session) });
  }
  if (path === "/api/train" && method === "POST") {
    const body = await readBody(req);
    const player = doTrain(session, body.focus || "Tactical");
    return json(res, 200, { player, hub: getHybridHub(session) });
  }
  if (path === "/api/roles" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, setRoleApi(session, body.role, body.instruction));
  }
  if (path === "/api/negotiation/open" && method === "POST") {
    return json(res, 200, openNegotiationApi(session));
  }
  if (path === "/api/negotiation/respond" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, respondNegotiationApi(session, body.action || "mediate"));
  }
  if (path === "/api/objectives/claim" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, claimObjectiveApi(session, String(body.objectiveId || body.id || "")));
  }
  if (path === "/api/inbox/read" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, markInboxReadApi(session, body.id));
  }
  if (path === "/api/playstyle/spend" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, spendPlayStylePoint(session, String(body.playStyleId || body.id || "")));
  }
  if (path === "/api/jobs") return json(res, 200, listJobOffersApi(session));
  if (path === "/api/jobs/refresh" && method === "POST") {
    return json(res, 200, refreshJobOffersApi(session));
  }
  if (path === "/api/jobs/accept" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, takeJobApi(session, String(body.offerId || body.id || "")));
  }
  if (path === "/api/jobs/decline" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, declineJobApi(session, body.offerId || body.id));
  }
  if (path === "/api/match/start" && method === "POST") {
    try {
      const state = beginPlayableMatch(session);
      return json(res, 200, { state });
    } catch (e: any) {
      return json(res, 400, { error: String(e?.message ?? e) });
    }
  }
  if (path === "/api/match/action" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, chooseHighlightAction(session, String(body.actionId || body.id || "")));
  }
  if (path === "/api/match/finish" && method === "POST") {
    const state = skipToFullTime(session);
    return json(res, 200, { state, report: getPostMatchReport(session), hub: getHybridHub(session) });
  }
  if (path === "/api/season/end" && method === "POST") {
    return json(res, 200, { ...endSeason(session), hub: getHybridHub(session) });
  }
  if (path === "/api/season/next" && method === "POST") {
    return json(res, 200, { ...nextSeason(session), hub: getHybridHub(session) });
  }
  if (path === "/api/save" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, { path: save(session, body.name || "career") });
  }
  if (path === "/api/press") return json(res, 200, { questions: getPress(session) });
  if (path === "/api/press/answer" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, answerPress(session, String(body.questionId), String(body.responseId)));
  }

  return json(res, 404, { error: `Unknown API ${path}` });
}

const publicDir = join(process.cwd(), "public");

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname;

  if (path.startsWith("/api/")) {
    try {
      await handleApi(req, res, path);
    } catch (e: any) {
      json(res, 500, { error: String(e?.message ?? e) });
    }
    return;
  }

  if (path === "/" || path === "/index.html") {
    return serveStatic(res, join(publicDir, "index.html"));
  }
  if (path === "/app" || path === "/app.html") {
    return serveStatic(res, join(publicDir, "app.html"));
  }

  const safe = path.replace(/\.\./g, "");
  serveStatic(res, join(publicDir, safe));
});

const PORT = Number(process.env.PORT || 3847);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Football Career Sim`);
  console.log(`  http://0.0.0.0:${PORT}`);
  console.log(`  http://localhost:${PORT}\n`);
});
