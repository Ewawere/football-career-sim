/**
 * Matchday XI + bench + role labels for UI (FM squad depth + FC clarity).
 */

import type { World } from "../world/world.js";
import type { EntityId, Position } from "../core/types.js";
import { pickStartingXI, getDepthChart, selectionScore } from "./selection.js";
import { getActiveInjury } from "../injuries/engine.js";
import { getManager } from "../managers/generation.js";

const ROLE_LABELS: Record<string, string> = {
  KeyPlayer: "Key",
  Starter: "Starter",
  Rotation: "Rotation",
  Bench: "Bench",
  Reserve: "Reserve",
  Academy: "Academy",
  Injured: "Injured",
  Suspended: "Suspended",
};

export function getMatchdaySquadView(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player?.currentClubId) return null;
  const club = world.clubs.get(player.currentClubId);
  if (!club) return null;

  const manager = club.managerId ? getManager(world, club.managerId) : null;
  const formation = manager?.preferredFormation || "4-3-3";
  const xiIds = pickStartingXI(world, club.id, formation, 0.55);
  const used = new Set(xiIds);

  const xi = xiIds.map((id, i) => {
    const p = world.players.get(id)!;
    const slots = formationSlotList(formation);
    const slot = slots[i] || p.primaryPosition;
    const { score, reasons } = selectionScore(p, slot as Position, 0.55, world);
    const chart = getDepthChart(world, club.id, p.primaryPosition, 0.55);
    const entry = chart.find((e) => e.playerId === id);
    return {
      id,
      name: p.displayName,
      ovr: p.ovr,
      position: slot,
      naturalPos: p.primaryPosition,
      role: entry?.role ?? "Starter",
      roleLabel: ROLE_LABELS[entry?.role ?? "Starter"] ?? entry?.role,
      score: Math.round(score * 10) / 10,
      reasons: (entry?.reasons || reasons).slice(0, 3),
      isUser: id === pid,
      form: Math.round(p.state.form ?? 50),
      fitness: Math.round(p.state.fitness ?? 80),
    };
  });

  const benchCandidates = club.squadPlayerIds
    .map((id) => world.players.get(id)!)
    .filter((p) => p && !p.retired && !used.has(p.id) && !getActiveInjury(world, p.id))
    .map((p) => {
      const { score } = selectionScore(p, p.primaryPosition, 0.55, world);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  const bench = benchCandidates.map(({ p, score }) => {
    const chart = getDepthChart(world, club.id, p.primaryPosition, 0.55);
    const entry = chart.find((e) => e.playerId === p.id);
    return {
      id: p.id,
      name: p.displayName,
      ovr: p.ovr,
      position: p.primaryPosition,
      role: entry?.role ?? "Bench",
      roleLabel: ROLE_LABELS[entry?.role ?? "Bench"] ?? "Bench",
      score: Math.round(score * 10) / 10,
      isUser: p.id === pid,
      form: Math.round(p.state.form ?? 50),
      fitness: Math.round(p.state.fitness ?? 80),
    };
  });

  const userChart = getDepthChart(world, club.id, player.primaryPosition, 0.55);
  const userEntry = userChart.find((e) => e.playerId === pid);
  const userInXi = xiIds.includes(pid);
  const userOnBench = bench.some((b) => b.id === pid);

  return {
    club: club.name,
    formation,
    xi,
    bench,
    user: {
      inXi: userInXi,
      onBench: userOnBench,
      role: userEntry?.role ?? "Reserve",
      roleLabel: ROLE_LABELS[userEntry?.role ?? "Reserve"] ?? "Reserve",
      rank: userEntry?.rank ?? null,
      score: userEntry?.score ?? null,
      reasons: userEntry?.reasons?.slice(0, 4) ?? [],
      standing: userInXi
        ? "Named in the starting XI"
        : userOnBench
          ? "On the bench"
          : "Not in the matchday squad",
    },
  };
}

function formationSlotList(formation: string): string[] {
  switch (formation) {
    case "4-2-3-1":
      return ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "ST", "LW"];
    case "4-4-2":
      return ["GK", "RB", "CB", "CB", "LB", "RM", "CM", "CM", "LM", "ST", "ST"];
    case "3-5-2":
      return ["GK", "CB", "CB", "CB", "RWB", "CDM", "CM", "CAM", "LWB", "ST", "ST"];
    default:
      return ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW"];
  }
}
