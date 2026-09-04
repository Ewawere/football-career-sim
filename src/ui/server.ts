/**
 * Playable career web server - mobile UI + sim API.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

let session: any = null;
let careerStarted = false;
let bootError: string | null = null;

async function loadApi() {
  return import("./api.js");
}

async function loadHybrid() {
  return import("./hybrid.js");
}

async function ensureSession() {
  if (session) return session;
  try {
    const api = await loadApi();
    session = api.createSession(Date.now() % 100000);
    bootError = null;
    return session;
  } catch (e: any) {
    bootError = String(e?.stack || e?.message || e);
    console.error("[boot] createSession failed", bootError);
    throw e;
  }
}

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

  if (path === "/api/health" || path === "/api/status") {
    return json(res, 200, {
      ok: true,
      careerStarted,
      bootError,
      date: session?.world?.calendar?.currentDate ?? null,
      season: session?.world?.calendar?.currentSeason ?? null,
    });
  }

  const api = await loadApi();
  const hybrid = await loadHybrid();

  // Build world only — return club list for picker
  if (path === "/api/start/init" && method === "POST") {
    try {
      console.log("[start/init] building world…");
      session = api.initWorldSession
        ? api.initWorldSession(Date.now() % 100000)
        : api.createSession(Date.now() % 100000);
      careerStarted = false;
      bootError = null;
      const clubs = api.getStarterClubs
        ? api.getStarterClubs(session)
        : [...session.world.clubs.values()].map((c: any) => ({
            id: c.id,
            name: c.name,
            nation: c.nation,
            reputation: c.reputation,
            city: c.city,
          }));
      console.log("[start/init] clubs", clubs.length);
      return json(res, 200, { ok: true, clubs });
    } catch (e: any) {
      bootError = String(e?.message || e);
      console.error("[start/init] FAILED", e);
      return json(res, 500, { error: bootError, stack: String(e?.stack || "").slice(0, 1200) });
    }
  }

  if ((path === "/api/start" || path === "/api/career/start") && method === "POST") {
    const body = await readBody(req);
    try {
      if (!session) {
        console.log("[start] creating world…");
        session = api.createSession(Date.now() % 100000);
      }
      console.log("[start] placing player", body.clubId || "(auto)");
      const result = api.startPlayerCareer(session, {
        firstName: body.firstName || "Alex",
        lastName: body.lastName || "Player",
        position: body.position || "CM",
        nationality: body.nationality || "England",
        age: body.age ?? 17,
        potential: body.potential ?? 82,
        preferredFoot: body.preferredFoot || "Right",
        physicalProfile: body.physicalProfile || "Athletic",
        clubId: body.clubId,
      });
      careerStarted = true;
      bootError = null;
      console.log("[start] career started at", result.club?.name);
      return json(res, 200, { ...result, hub: hybrid.getHybridHub(session) });
    } catch (e: any) {
      bootError = String(e?.message || e);
      console.error("[start] FAILED", e);
      return json(res, 500, {
        error: bootError,
        stack: String(e?.stack || "").slice(0, 1200),
      });
    }
  }

  if (!careerStarted && path !== "/api/start" && path !== "/api/career/start" && path !== "/api/start/init") {
    return json(res, 400, { error: "Start a career first (POST /api/start)" });
  }

  await ensureSession();

  if (path === "/api/hub") return json(res, 200, hybrid.getHybridHub(session));
  if (path === "/api/comparison") {
    return json(
      res,
      200,
      hybrid.getTeamComparisonApi
        ? hybrid.getTeamComparisonApi(session)
        : { comparison: hybrid.getHybridHub(session).teamComparison }
    );
  }
  if (path === "/api/threads") return json(res, 200, { threads: hybrid.getNarrativeThreads(session) });
  if (path === "/api/match/stats") {
    const id = new URL(req.url || "/", "http://x").searchParams.get("id");
    return json(
      res,
      200,
      id ? api.getMatchStatsView(session, id) : api.getLatestUserMatchStats(session)
    );
  }
  if (path === "/api/club/social") return json(res, 200, api.getClubSocialView(session));
  if (path === "/api/market")
    return json(res, 200, { players: api.listMarketPlayers(session, { limit: 100 }) });
  if (path === "/api/squad") return json(res, 200, api.getSquadWithValues(session));
  if (path === "/api/fixture") return json(res, 200, api.getNextUserFixture(session));
  if (path === "/api/agent") return json(res, 200, { advice: api.getAgentAdvice(session) });
  if (path === "/api/intl") return json(res, 200, api.getIntlStatus(session));

  try {
    const { getNewsFeed } = await import("../news/engine.js");
    const { getSocialFeed } = await import("../social/engine.js");
    if (path === "/api/news") {
      return json(res, 200, { news: getNewsFeed(session.world).slice(-30).reverse() });
    }
    if (path === "/api/social") {
      return json(res, 200, { posts: getSocialFeed(session.world).slice(-30).reverse() });
    }
  } catch (e: any) {
    if (path === "/api/news" || path === "/api/social") {
      return json(res, 200, { news: [], posts: [], error: String(e?.message || e) });
    }
  }

  if (path === "/api/advance" && method === "POST") {
    const result = api.advanceMatchday(session);
    return json(res, 200, { ...result, hub: hybrid.getHybridHub(session) });
  }
  if (path === "/api/train" && method === "POST") {
    const body = await readBody(req);
    const player = api.doTrain(session, body.focus || "Tactical");
    return json(res, 200, { player, hub: hybrid.getHybridHub(session) });
  }
  if (path === "/api/roles" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, hybrid.setRoleApi(session, body.role, body.instruction));
  }
  if (path === "/api/negotiation/open" && method === "POST") {
    return json(res, 200, hybrid.openNegotiationApi(session));
  }
  if (path === "/api/negotiation/respond" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, hybrid.respondNegotiationApi(session, body.action || "mediate"));
  }
  if (path === "/api/objectives/claim" && method === "POST") {
    const body = await readBody(req);
    return json(
      res,
      200,
      hybrid.claimObjectiveApi(session, String(body.objectiveId || body.id || ""))
    );
  }
  if (path === "/api/inbox/read" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, hybrid.markInboxApi(session, body.id));
  }
  if (path === "/api/playstyle/spend" && method === "POST") {
    const body = await readBody(req);
    return json(
      res,
      200,
      hybrid.spendPlayStylePoint(session, String(body.playStyleId || body.id || ""))
    );
  }
  if (path === "/api/jobs") return json(res, 200, hybrid.listJobOffersApi(session));
  if (path === "/api/jobs/refresh" && method === "POST") {
    return json(res, 200, hybrid.refreshJobOffersApi(session));
  }
  if (path === "/api/jobs/accept" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, hybrid.takeJobApi(session, String(body.offerId || body.id || "")));
  }
  if (path === "/api/jobs/decline" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, hybrid.declineJobApi(session, body.offerId || body.id));
  }
  if (path === "/api/match/start" && method === "POST") {
    try {
      const state = api.beginPlayableMatch(session);
      return json(res, 200, { state });
    } catch (e: any) {
      return json(res, 400, { error: String(e?.message ?? e) });
    }
  }
  if (path === "/api/match/action" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, api.chooseHighlightAction(session, String(body.actionId || body.id || "")));
  }
  if (path === "/api/match/finish" && method === "POST") {
    const state = api.skipToFullTime(session);
    return json(res, 200, {
      state,
      report: api.getPostMatchReport(session),
      hub: hybrid.getHybridHub(session),
    });
  }
  if (path === "/api/season/end" && method === "POST") {
    return json(res, 200, { ...api.endSeason(session), hub: hybrid.getHybridHub(session) });
  }
  if (path === "/api/season/next" && method === "POST") {
    return json(res, 200, { ...api.nextSeason(session), hub: hybrid.getHybridHub(session) });
  }
  if (path === "/api/save" && method === "POST") {
    const body = await readBody(req);
    return json(res, 200, { path: api.save(session, body.name || "career") });
  }
  if (path === "/api/press") return json(res, 200, { questions: api.getPress(session) });
  if (path === "/api/press/answer" && method === "POST") {
    const body = await readBody(req);
    return json(
      res,
      200,
      api.answerPress(session, String(body.questionId), String(body.responseId))
    );
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
      console.error("[api]", path, e);
      json(res, 500, { error: String(e?.message ?? e), stack: String(e?.stack || "").slice(0, 1200) });
    }
    return;
  }

  if (path === "/" || path === "/index.html") {
    return serveStatic(res, join(publicDir, "index.html"));
  }
  if (path === "/app" || path === "/app.html") {
    return serveStatic(res, join(publicDir, "app.html"));
  }

  const safePath = path.replace(/\.\./g, "");
  serveStatic(res, join(publicDir, safePath));
});

const PORT = Number(process.env.PORT || 3847);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Football Career Sim listening on :${PORT}`);
});

process.on("uncaughtException", (e) => {
  console.error("[uncaught]", e);
});
process.on("unhandledRejection", (e) => {
  console.error("[unhandled]", e);
});
