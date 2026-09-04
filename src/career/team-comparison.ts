/**
 * FM-style pre-match team comparison: form strings, table context, scout chatter.
 */

import type { World } from "../world/world.js";
import type { EntityId } from "../core/types.js";
import type { Club } from "../clubs/club.js";

export interface TeamFormSnapshot {
  clubId: EntityId;
  name: string;
  short: string;
  reputation: number;
  form: string; // e.g. WWDLW
  formLabel: string;
  last5: { result: "W" | "D" | "L"; score: string; vs: string; home: boolean }[];
  tablePos: number | null;
  played: number;
  points: number;
  gf: number;
  ga: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  moraleLabel: string;
  chatter: string[];
}

export interface TeamComparison {
  home: TeamFormSnapshot;
  away: TeamFormSnapshot;
  venue: string;
  competition: string;
  date: string;
  headline: string;
  preview: string;
  edges: string[];
  userClubId: EntityId | null;
  isUserHome: boolean;
}

function formFromTable(world: World, clubId: EntityId): {
  form: string;
  pos: number | null;
  played: number;
  points: number;
  gf: number;
  ga: number;
} {
  for (const table of world.leagueTables.values()) {
    const row = table.find((r) => r.clubId === clubId);
    if (!row) continue;
    const formRaw = (row as any).form;
    const form = Array.isArray(formRaw)
      ? formRaw.slice(-5).join("")
      : String(formRaw || "").slice(-5);
    return {
      form: form || "",
      pos: row.position ?? null,
      played: row.played ?? 0,
      points: row.points ?? 0,
      gf: row.goalsFor ?? 0,
      ga: row.goalsAgainst ?? 0,
    };
  }
  return { form: "", pos: null, played: 0, points: 0, gf: 0, ga: 0 };
}

function lastMatches(world: World, clubId: EntityId, n = 5) {
  return [...world.matches.values()]
    .filter(
      (m) =>
        m.status === "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .map((m) => {
      const home = m.home.clubId === clubId;
      const gf = home ? m.homeScore : m.awayScore;
      const ga = home ? m.awayScore : m.homeScore;
      const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
      const oppId = home ? m.away.clubId : m.home.clubId;
      const opp = world.clubs.get(oppId)?.name ?? "?";
      return {
        result,
        score: `${m.homeScore}-${m.awayScore}`,
        vs: opp,
        home,
      };
    });
}

function formLabel(form: string): string {
  if (!form) return "No recent data";
  const pts = [...form].reduce((s, c) => s + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
  const max = form.length * 3;
  const ratio = max ? pts / max : 0;
  if (ratio >= 0.75) return "Excellent form";
  if (ratio >= 0.55) return "Good form";
  if (ratio >= 0.35) return "Mixed form";
  return "Poor form";
}

function moraleFromForm(form: string, rep: number): string {
  const label = formLabel(form);
  if (label.startsWith("Excellent")) return rep >= 80 ? "High — title push energy" : "Buoyant in the dressing room";
  if (label.startsWith("Good")) return "Settled and confident";
  if (label.startsWith("Mixed")) return "Looking for consistency";
  return rep >= 75 ? "Under pressure — board watching" : "Low — needs a response";
}

function chatterFor(
  club: Club,
  form: string,
  pos: number | null,
  last5: { result: string; vs: string; home: boolean }[]
): string[] {
  const lines: string[] = [];
  const label = formLabel(form);
  lines.push(`${club.name} come in on ${label.toLowerCase()} (${form || "—"}).`);

  if (pos != null) {
    if (pos <= 3) lines.push(`Sitting ${pos} in the table — every match feels like a statement.`);
    else if (pos <= 8) lines.push(`Around ${pos}th — solid mid-upper table, still hunting a run.`);
    else if (pos >= 18) lines.push(`Down in ${pos}th — this has the feel of a six-pointer.`);
    else lines.push(`Currently ${pos}th — room to climb if they click.`);
  }

  const wins = last5.filter((x) => x.result === "W").length;
  const losses = last5.filter((x) => x.result === "L").length;
  if (wins >= 3) lines.push(`They've taken ${wins} wins from the last ${last5.length} — momentum is real.`);
  if (losses >= 3) lines.push(`${losses} defeats in the last ${last5.length} has the fans restless.`);

  if (last5[0]) {
    const r = last5[0];
    const side = r.home ? "at home" : "away";
    if (r.result === "W") lines.push(`Last time out they beat ${r.vs} ${side}.`);
    else if (r.result === "L") lines.push(`Last time out they lost to ${r.vs} ${side}.`);
    else lines.push(`Last time out they drew with ${r.vs} ${side}.`);
  }

  if (club.reputation >= 85) lines.push("Quality on the sheet — they expect to control big spells of the game.");
  else if (club.reputation <= 55) lines.push("Underdogs on paper, but form can flatten the hierarchy.");

  return lines.slice(0, 4);
}

function snapshotTeam(world: World, club: Club): TeamFormSnapshot {
  const table = formFromTable(world, club.id);
  let form = table.form;
  const last5 = lastMatches(world, club.id, 5);
  if (!form && last5.length) {
    form = last5.map((x) => x.result).join("");
  }
  const played = table.played || last5.length;
  const gf = table.gf;
  const ga = table.ga;
  return {
    clubId: club.id,
    name: club.name,
    short: (club as any).shortName || club.name.slice(0, 3).toUpperCase(),
    reputation: club.reputation,
    form: form || "—",
    formLabel: formLabel(form),
    last5,
    tablePos: table.pos,
    played,
    points: table.points,
    gf,
    ga,
    avgGoalsFor: played ? Math.round((gf / played) * 100) / 100 : 0,
    avgGoalsAgainst: played ? Math.round((ga / played) * 100) / 100 : 0,
    moraleLabel: moraleFromForm(form, club.reputation),
    chatter: chatterFor(club, form, table.pos, last5),
  };
}

function nextUserFixtureClubs(world: World): { home: Club; away: Club; date: string } | null {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player?.currentClubId) return null;
  const clubId = player.currentClubId;

  const upcoming = [...world.matches.values()]
    .filter(
      (m) =>
        m.status !== "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming[0]) {
    const m = upcoming[0];
    const home = world.clubs.get(m.home.clubId);
    const away = world.clubs.get(m.away.clubId);
    if (home && away) return { home, away, date: m.date };
  }

  // Fallback: pick a league opponent for the user's club
  const userClub = world.clubs.get(clubId);
  if (!userClub) return null;
  const rivals = [...world.clubs.values()].filter((c) => c.id !== clubId);
  if (!rivals.length) return null;
  const opp = rivals[Math.floor(rivals.length / 3)] || rivals[0]!;
  return { home: userClub, away: opp, date: world.calendar.currentDate };
}

/**
 * Full FM-style comparison for the next user fixture.
 */
export function getTeamComparison(world: World): TeamComparison | null {
  const fx = nextUserFixtureClubs(world);
  if (!fx) return null;
  const home = snapshotTeam(world, fx.home);
  const away = snapshotTeam(world, fx.away);
  const userClubId = world.userPlayerId
    ? world.players.get(world.userPlayerId)?.currentClubId ?? null
    : null;
  const isUserHome = userClubId === home.clubId;

  const edges: string[] = [];
  if (home.reputation - away.reputation >= 12)
    edges.push(`${home.name} hold a clear quality edge on reputation.`);
  else if (away.reputation - home.reputation >= 12)
    edges.push(`${away.name} are the stronger side on paper.`);
  else edges.push("Evenly matched on reputation — margins will decide it.");

  if (home.formLabel.startsWith("Excellent") && !away.formLabel.startsWith("Excellent"))
    edges.push(`${home.name}'s recent run makes them favourites in the form guide.`);
  if (away.formLabel.startsWith("Excellent") && !home.formLabel.startsWith("Excellent"))
    edges.push(`${away.name} arrive in better nick — dangerous on the break.`);

  if (home.tablePos != null && away.tablePos != null) {
    if (Math.abs(home.tablePos - away.tablePos) <= 2)
      edges.push("Table neighbours — a proper scrap for territory.");
  }

  const headline =
    home.formLabel.startsWith("Poor") && away.formLabel.startsWith("Poor")
      ? "Two sides searching for answers"
      : home.formLabel.startsWith("Excellent") || away.formLabel.startsWith("Excellent")
        ? "Form horses collide"
        : `${home.short} vs ${away.short} — fine margins`;

  const preview = isUserHome
    ? `You host ${away.name}. ${home.chatter[0] || ""} ${away.chatter[0] || ""}`.
        replace(/\s+/g, " ")
        .trim()
    : `You travel to ${home.name}. ${away.chatter[0] || ""} ${home.chatter[0] || ""}`.
        replace(/\s+/g, " ")
        .trim();

  return {
    home,
    away,
    venue: `${home.name} Stadium`,
    competition: "League",
    date: fx.date,
    headline,
    preview,
    edges,
    userClubId,
    isUserHome,
  };
}
