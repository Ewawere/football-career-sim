/**
 * Press conference question generation from recent news/events.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { PressQuestion } from "../news/types.js";
import { getNewsFeed } from "../news/engine.js";

export function getPressQuestions(world: World): PressQuestion[] {
  return ((world as any).pressQuestions as PressQuestion[]) ?? [];
}

export function generatePressQuestions(world: World, playerId: EntityId): PressQuestion[] {
  const player = world.players.get(playerId);
  if (!player) return [];

  const news = getNewsFeed(world)
    .filter((n) => n.relatedPlayerIds.includes(playerId))
    .slice(-5);

  const questions: PressQuestion[] = [];

  for (const article of news) {
    if (article.tags.includes("goal")) {
      questions.push({
        id: nextId("pq"),
        topic: "Performance",
        question: `Your goal made the difference — how do you feel about your match?`,
        relatedPlayerIds: [playerId],
        relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
        sourceEventId: article.sourceEventId,
        tone: "Soft",
        suggestedResponses: [
          {
            id: "team",
            label: "It was a team effort — proud of the group.",
            sentimentEffect: 5,
            managerTrustEffect: 4,
            reputationEffect: 1,
          },
          {
            id: "confident",
            label: "I knew if I got the chance I'd take it.",
            sentimentEffect: 3,
            managerTrustEffect: 1,
            reputationEffect: 2,
          },
          {
            id: "humble",
            label: "Still plenty to improve on.",
            sentimentEffect: 2,
            managerTrustEffect: 3,
            reputationEffect: 0,
          },
        ],
      });
    }
  }

  if (player.state.managerTrust < 40) {
    questions.push({
      id: nextId("pq"),
      topic: "PlayingTime",
      question: "There's talk you're unhappy with your role. Care to comment?",
      relatedPlayerIds: [playerId],
      relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
      sourceEventId: `trust_${playerId}`,
      tone: "Hard",
      suggestedResponses: [
        {
          id: "loyal",
          label: "I'm focused on working hard in training.",
          sentimentEffect: 2,
          managerTrustEffect: 5,
          reputationEffect: 0,
        },
        {
          id: "honest",
          label: "I want more minutes — that's natural.",
          sentimentEffect: -2,
          managerTrustEffect: -4,
          reputationEffect: 1,
        },
      ],
    });
  }

  if (!(world as any).pressQuestions) (world as any).pressQuestions = [];
  (world as any).pressQuestions.push(...questions);
  return questions;
}
