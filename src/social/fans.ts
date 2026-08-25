/**
 * Fan sentiment with weighted memory.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { FanSentimentState, FanMemoryEntry, SentimentLabel } from "../news/types.js";
import { Events } from "../core/events.js";

function labelFromScore(score: number): SentimentLabel {
  if (score >= 40) return "VeryPositive";
  if (score >= 15) return "Positive";
  if (score <= -40) return "VeryNegative";
  if (score <= -15) return "Negative";
  return "Neutral";
}

function getMap(world: World): Map<string, FanSentimentState> {
  if (!(world as any).fanSentiment) {
    (world as any).fanSentiment = new Map();
  }
  return (world as any).fanSentiment;
}

function key(type: string, id: EntityId): string {
  return `${type}:${id}`;
}

export function getFanSentiment(
  world: World,
  targetType: FanSentimentState["targetType"],
  targetId: EntityId
): FanSentimentState {
  const map = getMap(world);
  const k = key(targetType, targetId);
  let state = map.get(k);
  if (!state) {
    state = {
      targetType,
      targetId,
      score: 0,
      label: "Neutral",
      memory: [],
    };
    map.set(k, state);
  }
  return state;
}

export function applyFanEvent(
  world: World,
  targetType: FanSentimentState["targetType"],
  targetId: EntityId,
  delta: number,
  eventId: string,
  summary: string,
  weight = 1
): FanSentimentState {
  const state = getFanSentiment(world, targetType, targetId);
  state.memory = state.memory.slice(-19);
  const entry: FanMemoryEntry = {
    eventId,
    weight,
    delta,
    date: world.calendar.currentDate,
    summary,
  };
  state.memory.push(entry);
  state.score = Math.max(-100, Math.min(100, state.score * 0.85 + delta * weight));
  state.label = labelFromScore(state.score);
  return state;
}

export function attachFanEngine(world: World): void {
  world.events.on(Events.NEWS_GENERATED, (p: any) => {
    const feed = ((world as any).newsFeed as any[]) ?? [];
    const article = feed.find((a) => a.id === p.articleId);
    if (!article) return;

    let delta = 0;
    if (article.sentiment === "VeryPositive") delta = 12;
    else if (article.sentiment === "Positive") delta = 6;
    else if (article.sentiment === "Negative") delta = -8;
    else if (article.sentiment === "VeryNegative") delta = -14;
    if (delta === 0) return;

    for (const clubId of article.relatedClubIds ?? []) {
      applyFanEvent(
        world,
        "Club",
        clubId,
        delta,
        article.sourceEventId,
        article.headline,
        article.importance === "Breaking" || article.importance === "Major" ? 1.4 : 1
      );
    }
    for (const playerId of article.relatedPlayerIds ?? []) {
      applyFanEvent(world, "Player", playerId, delta * 0.9, article.sourceEventId, article.headline, 1);
      const player = world.players.get(playerId);
      if (player && Math.abs(delta) >= 8) {
        player.reputation = Math.max(
          0,
          Math.min(100, player.reputation + (delta > 0 ? 1 : -1) * (player.isUserControlled ? 1 : 0.5))
        );
      }
    }
  });
}

export function formatFanSentiment(state: FanSentimentState): string {
  return `${state.targetType} ${state.targetId}: ${state.label} (${state.score.toFixed(0)}) — memory ${state.memory.length} events`;
}
