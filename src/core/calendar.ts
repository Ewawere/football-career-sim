/**
 * Game calendar. Football seasons typically run July → June.
 */

import type { GameDate, SeasonId } from "./types.js";

export interface CalendarState {
  currentDate: GameDate;
  currentSeason: SeasonId;
  dayOfSeason: number;
  absoluteDay: number;
}

export function parseDate(d: GameDate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y: y!, m: m!, day: day! };
}

export function formatDate(y: number, m: number, day: number): GameDate {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function addDays(date: GameDate, days: number): GameDate {
  const { y, m, day } = parseDate(date);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + days);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function dayDiff(a: GameDate, b: GameDate): number {
  const da = parseDate(a);
  const db = parseDate(b);
  const ta = Date.UTC(da.y, da.m - 1, da.day);
  const tb = Date.UTC(db.y, db.m - 1, db.day);
  return Math.round((tb - ta) / 86400000);
}

export function seasonFromDate(date: GameDate): SeasonId {
  const { y, m } = parseDate(date);
  if (m >= 7) return `${y}/${String(y + 1).slice(2)}`;
  return `${y - 1}/${String(y).slice(2)}`;
}

export function createCalendar(startDate: GameDate = "2026-07-01"): CalendarState {
  return {
    currentDate: startDate,
    currentSeason: seasonFromDate(startDate),
    dayOfSeason: 0,
    absoluteDay: 0,
  };
}

export function advanceDay(cal: CalendarState): CalendarState {
  const next = addDays(cal.currentDate, 1);
  const newSeason = seasonFromDate(next);
  const seasonChanged = newSeason !== cal.currentSeason;
  return {
    currentDate: next,
    currentSeason: newSeason,
    dayOfSeason: seasonChanged ? 0 : cal.dayOfSeason + 1,
    absoluteDay: cal.absoluteDay + 1,
  };
}

export function isTransferWindow(date: GameDate): "summer" | "winter" | null {
  const { m, day } = parseDate(date);
  if (m === 7 || m === 8 || (m === 6 && day >= 15) || (m === 9 && day <= 1)) return "summer";
  if (m === 1 || (m === 12 && day >= 15) || (m === 2 && day <= 1)) return "winter";
  return null;
}
