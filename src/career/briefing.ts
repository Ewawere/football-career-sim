/**
 * Pre-match briefing + post-match narrative pack (FM intel + FC feedback).
 */

import type { World } from "../world/world.js";
import { getPlayerPlayStyles, getPlayStyleDef } from "../players/playstyles.js";
import { getSkillPoints } from "../players/skill-points.js";
import { getPlayerRoleState, ROLES, INSTRUCTIONS } from "./player-roles.js";

function latestUserMatch(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player?.currentClubId) return null;
  const clubId = player.currentClubId;
  const matches = [...world.matches.values()]
    .filter(
      (m) =>
        m.status === "Finished" &&
        (m.home.clubId === clubId || m.away.clubId === clubId)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return matches[0] ?? null;
}

export function getPreMatchBriefing(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  const trust = Math.round(player.state.managerTrust ?? 50);
  const form = Math.round(player.state.form ?? 50);
  const fitness = Math.round(player.state.fitness ?? 80);
  const ps = getPlayerPlayStyles(player);
  const equipped = ps.equipped.map((id) => {
    const d = getPlayStyleDef(id);
    return { id, name: d?.name ?? id, emoji: d?.emoji ?? "" };
  });

  let selectionOdds = "Fighting for a place";
  if (fitness < 50) selectionOdds = "Unlikely - fitness concern";
  else if (trust >= 70 && form >= 60) selectionOdds = "Strong chance of starting";
  else if (trust >= 55 && form >= 50) selectionOdds = "In contention for XI or bench";
  else if (trust < 40) selectionOdds = "Fringe - need a response";

  const rs = getPlayerRoleState(player);
  const roleLabel = ROLES.find((r) => r.id === rs.role)?.label ?? rs.role;
  const instrLabel = INSTRUCTIONS.find((i) => i.id === rs.instruction)?.label ?? rs.instruction;

  return {
    club: club?.name ?? "-",
    date: world.calendar.currentDate,
    season: world.calendar.currentSeason,
    form,
    fitness,
    trust,
    selectionOdds,
    equippedPlayStyles: equipped,
    role: { role: roleLabel, instruction: instrLabel },
    notes: [
      fitness < 60 ? "Medical soft-flag on load - managers notice." : null,
      form >= 70 ? "Form is hot - lean on it." : form < 40 ? "Cold form - training and attitude matter." : null,
      equipped.length
        ? `Styles ready: ${equipped.map((e) => e.emoji + " " + e.name).join(", ")}`
        : "No PlayStyles equipped yet - train to unlock.",
      `Role: ${roleLabel} · ${instrLabel}`,
    ].filter(Boolean),
  };
}

export function getPostMatchPack(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;
  const match = latestUserMatch(world);
  if (!match) return null;

  const st = match.playerStats.get(pid);
  const rating = st ? Math.round((st.rating / 10) * 10) / 10 : null;
  const goals = st?.goals ?? 0;
  const assists = st?.assists ?? 0;
  const minutes = st?.minutes ?? 0;
  const ps = getPlayerPlayStyles(player);
  const styleNotes: string[] = [];
  for (const id of ps.equipped) {
    const d = getPlayStyleDef(id);
    if (!d) continue;
    if (goals > 0 && /shot|finesse|power|goal/i.test(d.name)) {
      styleNotes.push(`${d.emoji} ${d.name} influenced finishing patterns`);
    } else if (minutes >= 60 && /rapid|quick|step/i.test(d.name)) {
      styleNotes.push(`${d.emoji} ${d.name} showed in transitions`);
    } else if (assists > 0 && /pass|incisive|vision/i.test(d.name)) {
      styleNotes.push(`${d.emoji} ${d.name} supported chance creation`);
    } else if (minutes >= 45) {
      styleNotes.push(`${d.emoji} ${d.name} was part of your toolkit`);
    }
  }

  let managerQuote = "We take the result and move on.";
  if (rating != null) {
    if (rating >= 8) managerQuote = "Exactly what we needed from you tonight.";
    else if (rating >= 7) managerQuote = "Solid shift - keep that level.";
    else if (rating < 5.5 && minutes >= 30) managerQuote = "Below the standard. Reset in training.";
    else if (minutes < 1) managerQuote = "You were not in the plan today. Stay ready.";
  }

  const home = world.clubs.get(match.home.clubId)?.name ?? "Home";
  const away = world.clubs.get(match.away.clubId)?.name ?? "Away";
  const rs = getPlayerRoleState(player);

  return {
    matchId: match.id,
    score: `${match.homeScore}-${match.awayScore}`,
    fixture: `${home} vs ${away}`,
    date: match.date,
    minutes,
    rating,
    goals,
    assists,
    managerQuote,
    playStyleNotes: styleNotes,
    skillPoints: getSkillPoints(player),
    trust: Math.round(player.state.managerTrust ?? 50),
    form: Math.round(player.state.form ?? 50),
    role: {
      role: ROLES.find((r) => r.id === rs.role)?.label ?? rs.role,
      instruction: INSTRUCTIONS.find((i) => i.id === rs.instruction)?.label ?? rs.instruction,
    },
  };
}
