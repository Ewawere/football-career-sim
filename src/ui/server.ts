/**
 * Playable career web server — mobile UI + sim API.
 * npm run play:web  →  http://localhost:3847
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { describeUserStanding } from "../career/selection.js";
import {
  startSeason,
  playMatchday,
  playFullSeason,
  endSeasonProcessing,
  beginNextSeason,
  printLeagueTable,
} from "../competitions/season.js";
import { applyTrainingSession } from "../training/development.js";
import { saveToJson, loadFromJson } from "../save/serialize.js";
import { runTransferWindow, formatWindowReport } from "../transfers/window.js";
import type { World } from "../world/world.js";

interface Session {
  world: World;
  competitionId: string | null;
}

let session: Session = { world: createWorld({ seed: Date.now() % 100000 }), competitionId: null };
bootstrapWorld(session.world);

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

function hubPayload() {
  const w = session.world;
  const user = w.userPlayerId ? w.players.get(w.userPlayerId) : null;
  const club = user?.currentClubId ? w.clubs.get(user.currentClubId) : null;
  const table = [...w.leagueTables.values()][0] ?? [];
  const news = ((w as any).newsFeed as any[]) ?? [];
  return {
    date: w.calendar.currentDate,
    season: w.calendar.currentSeason,
    player: user
      ? {
          id: user.id,
          name: user.displayName,
          age: user.age,
          ovr: user.ovr,
          pot: user.potential,
          position: user.primaryPosition,
          club: club?.name ?? null,
          form: Math.round(user.state.form),
          fitness: user.state.fitness,
          trust: Math.round(user.state.managerTrust),
          apps: user.state.appearancesThisSeason,
          goals: user.state.goalsThisSeason,
          standing: describeUserStanding(w),
        }
      : null,
    table: table.slice(0, 20).map((r) => ({
      pos: r.position,
      club: w.clubs.get(r.clubId)?.shortName ?? r.clubId,
      pts: r.points,
      gd: r.goalDifference,
    })),
    news: news.slice(-15).reverse(),
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url === "/api/hub") return json(res, 200, hubPayload());

  if (url === "/api/start" && req.method === "POST") {
    const body = await readBody(req);
    const placement = createCareerPlayer(session.world, {
      firstName: body.firstName ?? "Jordan",
      lastName: body.lastName ?? "Vale",
      position: body.position ?? "RW",
      preferredFoot: body.preferredFoot ?? "Left",
      nationality: body.nationality ?? "England",
      age: body.age ?? 17,
      potential: body.potential ?? 85,
    });
    const comp = startSeason(session.world);
    session.competitionId = comp.id;
    return json(res, 200, { ok: true, placement: placement.reason, hub: hubPayload() });
  }

  if (url === "/api/matchday" && req.method === "POST") {
    if (!session.competitionId) {
      const comp = startSeason(session.world);
      session.competitionId = comp.id;
    }
    const comp = session.world.competitions.get(session.competitionId)!;
    const next = Math.min(comp.matchdayCount, (comp.currentMatchday || 0) + 1);
    playMatchday(session.world, session.competitionId, next);
    return json(res, 200, hubPayload());
  }

  if (url === "/api/train" && req.method === "POST") {
    const body = await readBody(req);
    const user = session.world.userPlayerId
      ? session.world.players.get(session.world.userPlayerId)
      : null;
    if (user) applyTrainingSession(user, body.focus ?? "Technical", body.intensity ?? 70, session.world);
    return json(res, 200, hubPayload());
  }

  if (url === "/api/end-season" && req.method === "POST") {
    if (session.competitionId) {
      playFullSeason(session.world, session.competitionId);
      endSeasonProcessing(session.world);
    }
    return json(res, 200, hubPayload());
  }

  if (url === "/api/next-season" && req.method === "POST") {
    const report = runTransferWindow(session.world);
    const comp = beginNextSeason(session.world);
    session.competitionId = comp.id;
    return json(res, 200, { hub: hubPayload(), transfers: formatWindowReport(session.world, report) });
  }

  if (url === "/api/save") {
    return json(res, 200, { save: saveToJson(session.world) });
  }

  if (url === "/api/load" && req.method === "POST") {
    const body = await readBody(req);
    if (body.save) {
      session.world = loadFromJson(body.save);
      session.competitionId = [...session.world.competitions.keys()][0] ?? null;
    }
    return json(res, 200, hubPayload());
  }

  // Static files from public/
  let path = url === "/" ? "/index.html" : url.split("?")[0]!;
  if (path === "/app.html") path = "/index.html";
  const file = join(process.cwd(), "public", path);
  if (existsSync(file) && !path.includes("..")) {
    const ext = extname(file);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "text/plain" });
    res.end(readFileSync(file));
    return;
  }

  json(res, 404, { error: "not found" });
});

const PORT = Number(process.env.PORT ?? 3847);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Football Career Sim UI → http://localhost:${PORT}`);
});
