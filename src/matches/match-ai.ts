/**
 * Advanced match AI — game-state behaviour, shape, pressing, sub logic.
 * Feeds the existing simulator; does not replace it.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Match, MatchContext } from "./types.js";
import type { FormationId } from "./tactics.js";
import { getFormation } from "./tactics.js";
import { getManager } from "../managers/generation.js";
import type { Player } from "../players/player.js";

export type GameState = "Winning" | "Drawing" | "Losing";
export type Mentality = "UltraDefensive" | "Defensive" | "Balanced" | "Attacking" | "AllOutAttack";

export interface TeamAIState {
  clubId: EntityId;
  mentality: Mentality;
  pressing: number;       // 0–1
  defensiveLine: number;  // 0–1 higher = higher line
  width: number;          // 0–1
  tempo: number;          // 0–1
  gameState: GameState;
  /** Multiplier on attack chance */
  attackBias: number;
  /** Multiplier on concede chance */
  defendBias: number;
}

export function scoreGameState(our: number, their: number): GameState {
  if (our > their) return "Winning";
  if (our < their) return "Losing";
  return "Drawing";
}

/**
 * Derive mentality from score, minute, manager attributes, club identity.
 * Continuous urgency curve → granular attack/defend bias (not only 5 hard steps).
 */
export function computeTeamAI(
  world: World,
  match: Match,
  isHome: boolean
): TeamAIState {
  const lineup = isHome ? match.home : match.away;
  const our = isHome ? match.homeScore : match.awayScore;
  const their = isHome ? match.awayScore : match.homeScore;
  const goalDiff = our - their;
  const gameState = scoreGameState(our, their);
  const minute = match.context.minute;
  const club = world.clubs.get(lineup.clubId);
  const manager = club?.managerId ? getManager(world, club.managerId) : null;

  let pressing = 0.5;
  let defensiveLine = 0.5;
  let width = 0.55;
  let tempo = 0.5;

  const identity = club?.tacticalIdentity ?? "Balanced";
  if (identity === "HighPress") {
    pressing = 0.75;
    defensiveLine = 0.7;
    tempo = 0.7;
  } else if (identity === "Possession") {
    tempo = 0.45;
    width = 0.65;
    pressing = 0.55;
  } else if (identity === "CounterAttack") {
    defensiveLine = 0.35;
    pressing = 0.4;
    tempo = 0.6;
  } else if (identity === "Defensive") {
    defensiveLine = 0.3;
    pressing = 0.35;
    width = 0.4;
  } else if (identity === "Direct") {
    tempo = 0.75;
    width = 0.5;
  }

  if (manager) {
    pressing += (manager.attributes.attacking - 50) / 200;
    defensiveLine += (manager.attributes.attacking - manager.attributes.defending) / 250;
    if (manager.preferredIdentity === "HighPress") pressing += 0.1;
  }

  // Continuous urgency: negative = protect, positive = chase
  let urgency = 0;
  if (goalDiff > 0) {
    urgency -= Math.min(2.2, goalDiff * 0.85 + (goalDiff >= 3 ? 0.35 : 0));
  } else if (goalDiff < 0) {
    urgency += Math.min(2.4, -goalDiff * 0.95 + (goalDiff <= -3 ? 0.4 : 0));
  }

  if (goalDiff < 0) {
    if (minute >= 35) urgency += 0.08;
    if (minute >= 45) urgency += 0.12;
    if (minute >= 55) urgency += 0.18;
    if (minute >= 65) urgency += 0.22;
    if (minute >= 72) urgency += 0.2;
    if (minute >= 78) urgency += 0.22;
    if (minute >= 85) urgency += 0.28;
    if (minute >= 88) urgency += 0.15;
  } else if (goalDiff > 0) {
    if (minute >= 50) urgency -= 0.08;
    if (minute >= 60) urgency -= 0.12;
    if (minute >= 70) urgency -= 0.18;
    if (minute >= 80) urgency -= 0.2;
    if (minute >= 85) urgency -= 0.12;
    if (goalDiff >= 2 && minute >= 55) urgency -= 0.2;
    if (goalDiff >= 3 && minute >= 50) urgency -= 0.15;
  } else {
    if (minute >= 55) urgency += 0.08;
    if (minute >= 65) urgency += 0.14;
    if (minute >= 72) urgency += 0.18;
    if (minute >= 78) urgency += 0.22;
    if (minute >= 84) urgency += 0.28;
    if (minute >= 88) urgency += 0.18;
  }

  const importance = match.context.matchImportance ?? 0.5;
  if (goalDiff <= 0 && importance >= 0.7) {
    urgency += 0.12 + (importance - 0.7) * 0.25;
  }
  if (goalDiff > 0 && importance >= 0.75 && minute >= 75) {
    urgency -= 0.08;
  }

  const mom = match.context.momentum ?? 0;
  const momForUs = isHome ? mom : -mom;
  urgency += Math.max(-0.25, Math.min(0.25, momForUs / 200));
  urgency = Math.max(-2.5, Math.min(2.8, urgency));

  let attackBias = 1 + urgency * 0.22;
  let defendBias = 1 + urgency * 0.16;
  attackBias = Math.max(0.48, Math.min(1.48, attackBias));
  defendBias = Math.max(0.58, Math.min(1.42, defendBias));

  pressing += urgency * 0.1;
  defensiveLine += urgency * 0.09;
  tempo += urgency * 0.1;
  width += urgency * 0.06;

  let mentality: Mentality;
  if (urgency <= -1.6) mentality = "UltraDefensive";
  else if (urgency <= -0.55) mentality = "Defensive";
  else if (urgency < 0.55) mentality = "Balanced";
  else if (urgency < 1.55) mentality = "Attacking";
  else mentality = "AllOutAttack";

  if (identity === "Defensive" && mentality === "AllOutAttack") {
    attackBias = Math.min(attackBias, 1.28);
    pressing = Math.min(pressing, 0.85);
    mentality = urgency >= 1.9 ? "AllOutAttack" : "Attacking";
  }
  if (identity === "HighPress" && mentality === "UltraDefensive") {
    pressing = Math.max(pressing, 0.4);
  }

  return {
    clubId: lineup.clubId,
    mentality,
    pressing: Math.max(0.15, Math.min(1, pressing)),
    defensiveLine: Math.max(0.15, Math.min(1, defensiveLine)),
    width: Math.max(0.25, Math.min(1, width)),
    tempo: Math.max(0.25, Math.min(1, tempo)),
    gameState,
    attackBias,
    defendBias,
  };
}

/**
 * Adjust expected goals mid-match based on AI state.
 */
export function applyAIToChance(
  baseChance: number,
  attackAI: TeamAIState,
  defendAI: TeamAIState
): number {
  let c = baseChance * attackAI.attackBias * (0.85 + attackAI.tempo * 0.3);
  c *= 0.82 + defendAI.defendBias * 0.28;
  c *= 0.88 + attackAI.pressing * 0.22;
  if (defendAI.defensiveLine < 0.4) {
    c *= 0.9 + defendAI.defensiveLine * 0.15;
  }
  if (defendAI.mentality === "UltraDefensive") {
    c *= 0.9;
  } else if (defendAI.mentality === "Defensive") {
    c *= 0.94;
  }
  return Math.max(0.01, Math.min(0.95, c));
}

/**
 * Smart substitution targets: tired, poor rating, tactical (trailing → attack).
 */
export function pickSmartSub(
  world: World,
  match: Match,
  isHome: boolean,
  ai: TeamAIState
): { offId: EntityId; onId: EntityId } | null {
  const lineup = isHome ? match.home : match.away;
  const pitchPlayers: Player[] = [];
  for (const id of lineup.startingXI) {
    const p = world.players.get(id);
    if (p && !p.retired) pitchPlayers.push(p);
  }
  const bench = lineup.substitutes
    .map((id) => world.players.get(id))
    .filter((p): p is Player => !!p && !p.retired);

  if (!pitchPlayers.length || !bench.length) return null;

  const rankedOff = [...pitchPlayers].sort((a, b) => {
    const sa =
      a.state.fatigue * 0.4 +
      (100 - a.state.fitness) * 0.3 +
      (a.isUserControlled ? -40 : 0) +
      (match.playerStats.get(a.id)?.rating ?? 50) * -0.15;
    const sb =
      b.state.fatigue * 0.4 +
      (100 - b.state.fitness) * 0.3 +
      (b.isUserControlled ? -40 : 0) +
      (match.playerStats.get(b.id)?.rating ?? 50) * -0.15;
    return sb - sa;
  });

  const off = rankedOff[0]!;
  if (off.state.fatigue < 55 && off.state.fitness > 60 && ai.gameState === "Drawing") {
    if ((match.playerStats.get(off.id)?.rating ?? 60) > 55) return null;
  }

  const needAttack =
    ai.gameState === "Losing" ||
    ai.mentality === "Attacking" ||
    ai.mentality === "AllOutAttack";
  const needDefend = ai.gameState === "Winning" && match.context.minute >= 70;

  const rankedOn = [...bench].sort((a, b) => {
    let sa = a.ovr + a.state.fitness * 0.2;
    let sb = b.ovr + b.state.fitness * 0.2;
    if (needAttack) {
      if (["ST", "CF", "RW", "LW", "CAM"].includes(a.primaryPosition)) sa += 12;
      if (["ST", "CF", "RW", "LW", "CAM"].includes(b.primaryPosition)) sb += 12;
    }
    if (needDefend) {
      if (["CB", "CDM", "FB", "LB", "RB"].includes(a.primaryPosition)) sa += 12;
      if (["CB", "CDM", "FB", "LB", "RB"].includes(b.primaryPosition)) sb += 12;
    }
    return sb - sa;
  });

  const on = rankedOn[0]!;
  if (on.id === off.id) return null;
  return { offId: off.id, onId: on.id };
}

/**
 * Snapshot for UI / debugging.
 */
export function describeMatchAI(home: TeamAIState, away: TeamAIState): string {
  return (
    `Home ${home.gameState}/${home.mentality} atk=${home.attackBias.toFixed(2)} def=${home.defendBias.toFixed(2)} press=${home.pressing.toFixed(2)} ` +
    `| Away ${away.gameState}/${away.mentality} atk=${away.attackBias.toFixed(2)} def=${away.defendBias.toFixed(2)} press=${away.pressing.toFixed(2)}`
  );
}
