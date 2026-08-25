/**
 * League table computation and result application.
 */

import type { EntityId } from "../core/types.js";
import type { LeagueTableRow } from "./types.js";

export function createEmptyTable(clubIds: EntityId[]): LeagueTableRow[] {
  return clubIds.map((clubId) => ({
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
    position: 0,
  }));
}

export function applyResult(
  table: LeagueTableRow[],
  homeClubId: EntityId,
  awayClubId: EntityId,
  homeScore: number,
  awayScore: number
): void {
  const home = table.find((r) => r.clubId === homeClubId);
  const away = table.find((r) => r.clubId === awayClubId);
  if (!home || !away) throw new Error("Club not in table");

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (homeScore > awayScore) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
    pushForm(home, "W");
    pushForm(away, "L");
  } else if (homeScore < awayScore) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
    pushForm(home, "L");
    pushForm(away, "W");
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
    pushForm(home, "D");
    pushForm(away, "D");
  }

  sortTable(table);
}

function pushForm(row: LeagueTableRow, r: string): void {
  row.form.push(r);
  if (row.form.length > 5) row.form.shift();
}

export function sortTable(table: LeagueTableRow[]): void {
  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId.localeCompare(b.clubId);
  });
  table.forEach((row, i) => {
    row.position = i + 1;
  });
}

export function formatTable(
  table: LeagueTableRow[],
  nameFn: (id: EntityId) => string
): string {
  let out = "Pos  Club                     P   W   D   L   GF  GA  GD   Pts  Form\n";
  out += "─".repeat(78) + "\n";
  for (const r of table) {
    const name = nameFn(r.clubId).padEnd(24).slice(0, 24);
    const gd = (r.goalDifference >= 0 ? "+" : "") + r.goalDifference;
    const form = r.form.join("");
    out += `${String(r.position).padStart(2)}   ${name} ${String(r.played).padStart(2)}  ${String(r.won).padStart(2)}  ${String(r.drawn).padStart(2)}  ${String(r.lost).padStart(2)}  ${String(r.goalsFor).padStart(3)} ${String(r.goalsAgainst).padStart(3)} ${gd.padStart(4)}  ${String(r.points).padStart(3)}  ${form}\n`;
  }
  return out;
}
