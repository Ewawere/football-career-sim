/**
 * Narrative threads — multi-event stories that evolve over time.
 * Every beat must reference a real simulation event. No filler.
 */

import type { EntityId } from "../core/types.js";

export type ThreadKind =
  | "loan_spell"
  | "breakthrough"
  | "transfer_saga"
  | "form_crisis"
  | "manager_pressure"
  | "injury_comeback"
  | "wonderkid_rise"
  | "contract_standoff"
  | "rivalry"
  | "award_run"
  | "generic";

export type ThreadStatus = "active" | "resolved" | "faded";

export interface ThreadBeat {
  /** When this beat was recorded (sim date) */
  date: string;
  /** Human-readable summary of the real event */
  summary: string;
  /** Optional link to a news storyKey or event id */
  sourceEventId?: string;
  /** Optional news article id */
  articleId?: string;
  /** Sentiment of this beat */
  sentiment: "VeryPositive" | "Positive" | "Neutral" | "Negative" | "VeryNegative";
}

export interface NarrativeThread {
  id: string;
  kind: ThreadKind;
  status: ThreadStatus;
  title: string;
  /** Primary player this story is about (if any) */
  playerId: EntityId | null;
  /** Clubs involved */
  clubIds: EntityId[];
  /** Season the thread started */
  seasonId: string;
  openedDate: string;
  updatedDate: string;
  resolvedDate: string | null;
  beats: ThreadBeat[];
  /** Rolling sentiment (-100 … 100) derived from beats */
  sentimentScore: number;
  /** Tags for UI filtering */
  tags: string[];
}
