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

  let mentality: Mentality = "Balanced";
  let pressing = 0.5;
  let defensiveLine = 0.5;
  let width = 0.55;
  let tempo = 0.5;

  // Club tactical identity baseline
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
    mentality = "Defensive";
    defensiveLine = 0.3;
    pressing = 0.35;
    width = 0.4;
  } else if (identity === "Direct") {
    tempo = 0.75;
    width = 0.5;
  }

  // Manager lean
  if (manager) {
    pressing += (manager.attributes.attacking - 50) / 200;
    defensiveLine += (manager.attributes.attacking - manager.attributes.defending) / 250;
    if (manager.preferredIdentity === "HighPress") pressing += 0.1;
  }

  // Game-state shifts
  if (gameState === "Winning") {
    const leadBy = Math.abs(goalDiff);
    if (minute >= 65 || leadBy >= 2) {
      mentality = leadBy >= 2 && minute >= 70 ? "UltraDefensive" : "Defensive";
      pressing = Math.max(0.2, pressing - 0.2 - (leadBy >= 2 ? 0.05 : 0));
      defensiveLine = Math.max(0.2, defensiveLine - 0.15);
      tempo = Math.max(0.25, tempo - 0.15 - (leadBy >= 2 ? 0.05 : 0));
    } else {
      mentality = "Balanced";
      pressing = Math.max(0.35, pressing - 0.05);
    }
  } else if (gameState === "Losing") {
    const trailBy = Math.abs(goalDiff);
    if (minute >= 55 || trailBy >= 2) {
      mentality =
        minute >= 75 || trailBy >= 2 ? "AllOutAttack" : "Attacking";
      pressing = Math.min(0.98, pressing + 0.2 + (trailBy >= 2 ? 0.08 : 0));
      defensiveLine = Math.min(0.92, defensiveLine + 0.15);
      tempo = Math.min(0.98, tempo + 0.2 + (trailBy >= 2 ? 0.05 : 0));
      width = Math.min(0.92, width + 0.12);
    } else {
      mentality = "Attacking";
      pressing = Math.min(0.85, pressing + 0.1);
    }
  } else {
    // Drawing: gradual push, all-out in final stretch
    if (minute >= 60) {
      mentality = minute >= 82 ? "AllOutAttack" : minute >= 72 ? "Attacking" : "Balanced";
      tempo = Math.min(0.92, tempo + (minute >= 80 ? 0.18 : 0.08));
      pressing = Math.min(0.88, pressing + (minute >= 80 ? 0.12 : 0.06));
      width = Math.min(0.88, width + 0.06);
    }
  }

  const attackBias =
    mentality === "AllOutAttack"
      ? 1.35
      : mentality === "Attacking"
        ? 1.18
        : mentality === "Defensive"
          ? 0.75
          : mentality === "UltraDefensive"
            ? 0.55
            : 1.0;

  const defendBias =
    mentality === "AllOutAttack"
      ? 1.3
      : mentality === "Attacking"
        ? 1.12
        : mentality === "Defensive"
          ? 0.8
          : mentality === "UltraDefensive"
            ? 0.65
            : 1.0;

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
  // Attacker's tempo & mentality vs defender's shape
  let c = baseChance * attackAI.attackBias * attackAI.tempo;
  c *= 0.85 + defendAI.defendBias * 0.3;
  // High press increases both turnovers and chances
  c *= 0.9 + attackAI.pressing * 0.2;
  // Compact defence reduces
  if (defendAI.mentality === "Defensive" || defendAI.mentality === "UltraDefensive") {
    c *= 0.88;
  }
  return Math.max(0.01, Math.min(0.95, c));
}
