/**
 * Post-match report snapshot for UI — reads simulation only.
 */

import type { World } from "../world/world.js";
import type { Match } from "./types.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";
import { getFanSentiment } from "../social/fans.js";

export interface PostMatchPlayerCard {
  playerId: string;
  name: string;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  passes: number;
  minutes: number;
}

export interface PostMatchReport {
  matchId: string;
  home: string;
  away: string;
  scoreline: string;
  homeScore: number;
  awayScore: number;
  player: PostMatchPlayerCard | null;
  reaction: {
    headlines: { importance: string; headline: string; source: string }[];
    social: { author: string; content: string; engagement: number; sentiment: string }[];
    fanSentiment: { label: string; score: number };
    managerTrust: number;
    reputation: number;
    form: number;
  } | null;
  date: string;
}

export function buildPostMatchReport(world: World, match: Match): PostMatchReport {
  const home = world.clubs.get(match.home.clubId);
  const away = world.clubs.get(match.away.clubId);
  const userId = world.userPlayerId;

  let playerCard: PostMatchPlayerCard | null = null;
  let reaction: PostMatchReport["reaction"] = null;

  if (userId && match.playerStats.has(userId)) {
    const stats = match.playerStats.get(userId)!;
    const player = world.players.get(userId)!;
    playerCard = {
      playerId: userId,
      name: player.displayName,
      rating: Math.round(stats.rating / 10 * 10) / 10,
      goals: stats.goals,
      assists: stats.assists,
      shots: stats.shots,
      passes: stats.passCompleted,
      minutes: stats.minutes,
    };

    const news = getNewsFeed(world)
      .filter(
        (n) =>
          n.relatedPlayerIds.includes(userId) ||
          n.sourceEventId.includes(match.id)
      )
      .slice(-8)
      .reverse();

    const social = getSocialFeed(world)
      .filter(
        (s) =>
          s.relatedPlayerIds.includes(userId) || s.sourceEventId.includes(match.id)
      )
      .slice(-10)
      .sort((a, b) => b.engagement - a.engagement);

    const fan = getFanSentiment(world, "Player", userId);

    reaction = {
      headlines: news.map((n) => ({
        importance: n.importance,
        headline: n.headline,
        source: n.sourceId,
      })),
      social: social.slice(0, 6).map((s) => ({
        author: s.authorLabel,
        content: s.content,
        engagement: s.engagement,
        sentiment: s.sentiment,
      })),
      fanSentiment: { label: fan.label, score: Math.round(fan.score) },
      managerTrust: Math.round(player.state.managerTrust),
      reputation: Math.round(player.reputation),
      form: Math.round(player.state.form),
    };
  }

  return {
    matchId: match.id,
    home: home?.name ?? "Home",
    away: away?.name ?? "Away",
    scoreline: `${match.homeScore}–${match.awayScore}`,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    player: playerCard,
    reaction,
    date: match.date,
  };
}
