/**
 * News / media data models — UI-independent.
 */

import type { EntityId, GameDate } from "../core/types.js";

export type NewsCategory =
  | "Breaking"
  | "MatchReport"
  | "Transfer"
  | "Injury"
  | "Player"
  | "Club"
  | "Competition"
  | "Rumour"
  | "Milestone";

export type NewsImportance = "Minor" | "Normal" | "Important" | "Major" | "Breaking";

export type SentimentLabel =
  | "VeryPositive"
  | "Positive"
  | "Neutral"
  | "Negative"
  | "VeryNegative";

export interface MediaOutlet {
  id: string;
  name: string;
  reliability: number;
  transferReliability: number;
  matchCoverage: number;
  region: string;
  style: "Factual" | "Sensational" | "Analytical" | "ClubFriendly";
}

export interface NewsArticle {
  id: EntityId;
  timestamp: GameDate;
  category: NewsCategory;
  importance: NewsImportance;
  headline: string;
  body: string;
  sourceId: string;
  relatedPlayerIds: EntityId[];
  relatedClubIds: EntityId[];
  relatedCompetitionId: EntityId | null;
  sourceEventId: string;
  sentiment: SentimentLabel;
  tags: string[];
  storyKey: string;
}

export interface SocialPost {
  id: EntityId;
  timestamp: GameDate;
  authorType?: "Fan" | "RivalFan" | "Journalist" | "Player" | "Club" | "FormerPlayer" | "Coach";
  authorLabel: string;
  content: string;
  sentiment: SentimentLabel;
  engagement: number;
  sourceEventId: string;
  relatedPlayerIds: EntityId[];
  relatedClubIds: EntityId[];
  topic?: string;
  virality?: number;
}

export interface FanSentimentState {
  targetType: "Player" | "Manager" | "Club" | "Board";
  targetId: EntityId;
  score: number;
  label: SentimentLabel;
  memory: FanMemoryEntry[];
}

export interface FanMemoryEntry {
  eventId: string;
  weight: number;
  delta: number;
  date: GameDate;
  summary: string;
}

export interface PressQuestion {
  id: EntityId;
  topic: string;
  question: string;
  relatedPlayerIds: EntityId[];
  relatedClubIds: EntityId[];
  sourceEventId: string;
  tone: "Soft" | "Neutral" | "Hard";
  suggestedResponses: PressResponseOption[];
}

export interface PressResponseOption {
  id: string;
  label: string;
  sentimentEffect: number;
  managerTrustEffect: number;
  reputationEffect: number;
}
