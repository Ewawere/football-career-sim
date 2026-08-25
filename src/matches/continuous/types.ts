/**
 * Continuous 22-player match state.
 * Pitch: 105m x 68m.
 */

import type { EntityId } from "../../core/types.js";
import type { FormationId, TacticalRole } from "../tactics.js";

export interface Vec2 {
  x: number;
  y: number;
}

export type PitchSide = "home" | "away";

export interface ContinuousPlayer {
  id: EntityId;
  side: PitchSide;
  role: TacticalRole;
  position: Vec2;
  velocity: Vec2;
  facing: number;
  stamina: number;
  onPitch: boolean;
  isUser: boolean;
  target: Vec2 | null;
  hasBall: boolean;
}

export interface BallState {
  position: Vec2;
  velocity: Vec2;
  ownerId: EntityId | null;
  height: number;
}

export type UserCommand =
  | { type: "Move"; dir: Vec2 }
  | { type: "Sprint"; active: boolean }
  | { type: "Pass"; aim: Vec2 }
  | { type: "ThroughBall"; aim: Vec2 }
  | { type: "Shoot"; aim: Vec2 }
  | { type: "Cross"; aim: Vec2 }
  | { type: "Tackle" }
  | { type: "Idle" };

export interface ContinuousMatchEvent {
  minute: number;
  type: "Goal" | "Shot" | "Pass" | "Tackle" | "Foul" | "Card" | "Injury" | "Sub" | "KickOff";
  playerId?: EntityId;
  clubSide?: PitchSide;
  description: string;
  meta?: Record<string, unknown>;
}

export interface ContinuousMatchState {
  matchId: EntityId;
  minute: number;
  second: number;
  homeScore: number;
  awayScore: number;
  phase: "FirstHalf" | "HalfTime" | "SecondHalf" | "FullTime";
  players: ContinuousPlayer[];
  ball: BallState;
  possessionSide: PitchSide | null;
  homeFormation: FormationId;
  awayFormation: FormationId;
  events: ContinuousMatchEvent[];
  userPlayerId: EntityId | null;
  tick: number;
}

export const PITCH = { width: 105, height: 68 } as const;
