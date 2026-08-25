/**
 * Wire news generation to the world event bus.
 */

import type { World } from "../world/world.js";
import { Events } from "../core/events.js";

/** Attach media systems — full news engine optional. */
export function attachMediaSystems(world: World): void {
  if (!(world as any).newsFeed) (world as any).newsFeed = [];
  if (!(world as any).socialFeed) (world as any).socialFeed = [];

  world.events.on(Events.MATCH_COMPLETED, (payload: any) => {
    const feed = (world as any).newsFeed as any[];
    feed.push({
      id: `news_${feed.length + 1}`,
      timestamp: world.calendar.currentDate,
      category: "MatchReport",
      importance: "Normal",
      headline: `Match finished ${payload.homeScore}–${payload.awayScore}`,
      body: "",
      sourceId: "gfn",
      relatedPlayerIds: [],
      relatedClubIds: [payload.homeClubId, payload.awayClubId].filter(Boolean),
      relatedCompetitionId: null,
      sourceEventId: payload.matchId ?? "match",
      sentiment: "Neutral",
      tags: ["match"],
      storyKey: payload.matchId ?? "match",
    });
  });

  world.events.on(Events.GOAL_SCORED, (payload: any) => {
    const feed = (world as any).newsFeed as any[];
    const player = world.players.get(payload.playerId);
    if (!player) return;
    feed.push({
      id: `news_${feed.length + 1}`,
      timestamp: world.calendar.currentDate,
      category: "MatchReport",
      importance: player.isUserControlled ? "Important" : "Normal",
      headline: `${player.displayName} finds the net`,
      body: "",
      sourceId: "fdaily",
      relatedPlayerIds: [payload.playerId],
      relatedClubIds: [payload.clubId].filter(Boolean),
      relatedCompetitionId: null,
      sourceEventId: `goal_${payload.matchId}_${payload.minute}`,
      sentiment: "Positive",
      tags: ["goal"],
      storyKey: payload.playerId,
    });
  });
}

export function attachNewsListeners(world: World): void {
  attachMediaSystems(world);
}
