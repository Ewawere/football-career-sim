/**
 * Social media simulation — reactions to real events only.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import type { SocialPost, SentimentLabel } from "../news/types.js";

export function getSocialFeed(world: World): SocialPost[] {
  if (!(world as any).socialFeed) (world as any).socialFeed = [];
  return (world as any).socialFeed;
}

function pushPost(world: World, post: Omit<SocialPost, "id">): SocialPost {
  const full: SocialPost = { id: nextId("soc"), ...post };
  getSocialFeed(world).push(full);
  return full;
}

export function attachSocialEngine(world: World): void {
  world.events.on(Events.GOAL_SCORED, (p: any) => {
    const player = world.players.get(p.playerId);
    if (!player) return;
    const club = world.clubs.get(p.clubId);
    const eng = player.isUserControlled ? 80 + world.rng.int(0, 40) : world.rng.int(10, 50);
    pushPost(world, {
      timestamp: world.calendar.currentDate,
      authorLabel: club ? `${club.shortName} Fan` : "Fan",
      content: player.isUserControlled
        ? `${player.displayName} WHAT A GOAL 🔥`
        : `Goal for ${club?.shortName ?? "the team"} — ${player.displayName}`,
      engagement: eng,
      sentiment: "Positive",
      relatedPlayerIds: [p.playerId],
      relatedClubIds: p.clubId ? [p.clubId] : [],
      sourceEventId: `goal_${p.matchId}_${p.minute}`,
    });
  });

  world.events.on(Events.MATCH_COMPLETED, (p: any) => {
    const home = world.clubs.get(p.homeClubId);
    const away = world.clubs.get(p.awayClubId);
    if (!home || !away) return;
    let sentiment: SentimentLabel = "Neutral";
    if (p.homeScore > p.awayScore) sentiment = "Positive";
    else if (p.homeScore < p.awayScore) sentiment = "Negative";
    pushPost(world, {
      timestamp: world.calendar.currentDate,
      authorLabel: `${home.shortName} Supporters`,
      content: `FT: ${home.shortName} ${p.homeScore}–${p.awayScore} ${away.shortName}`,
      engagement: world.rng.int(15, 60),
      sentiment,
      relatedPlayerIds: [],
      relatedClubIds: [p.homeClubId, p.awayClubId],
      sourceEventId: p.matchId,
    });
  });

  world.events.on(Events.TRANSFER_COMPLETED, (p: any) => {
    const player = world.players.get(p.playerId);
    const to = world.clubs.get(p.toClubId);
    if (!player || !to) return;
    pushPost(world, {
      timestamp: world.calendar.currentDate,
      authorLabel: "TransferTalk",
      content: `HERE WE GO — ${player.displayName} to ${to.name}. Fee ~€${(p.fee / 1e6).toFixed(1)}m`,
      engagement: 100 + world.rng.int(0, 80),
      sentiment: "Positive",
      relatedPlayerIds: [p.playerId],
      relatedClubIds: [p.toClubId, p.fromClubId].filter(Boolean),
      sourceEventId: `tx_${p.playerId}`,
    });
  });
}
