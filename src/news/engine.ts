/**
 * Event-driven news engine — only reports real simulation events.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import type { NewsArticle, NewsImportance, SentimentLabel } from "./types.js";

const processedStories = new Set<string>();

export function resetNewsDedup(): void {
  processedStories.clear();
}

export function getNewsFeed(world: World): NewsArticle[] {
  return ((world as any).newsFeed as NewsArticle[]) ?? [];
}

function publish(
  world: World,
  article: Omit<NewsArticle, "id"> & { id?: string }
): NewsArticle | null {
  if (processedStories.has(article.storyKey)) return null;
  processedStories.add(article.storyKey);

  const full: NewsArticle = {
    ...article,
    id: article.id ?? nextId("nws"),
  };
  if (!(world as any).newsFeed) (world as any).newsFeed = [];
  (world as any).newsFeed.push(full);
  world.events.emit(Events.NEWS_GENERATED, { articleId: full.id, headline: full.headline });
  return full;
}

function importanceFromScore(s: number): NewsImportance {
  if (s >= 85) return "Breaking";
  if (s >= 70) return "Major";
  if (s >= 55) return "Important";
  if (s >= 35) return "Normal";
  return "Minor";
}

export function attachNewsEngine(world: World): void {
  if (!(world as any).newsFeed) (world as any).newsFeed = [];

  world.events.on(Events.MATCH_COMPLETED, (p: any) => {
    const home = world.clubs.get(p.homeClubId);
    const away = world.clubs.get(p.awayClubId);
    if (!home || !away) return;
    const score = `${p.homeScore}–${p.awayScore}`;
    publish(world, {
      timestamp: world.calendar.currentDate,
      category: "MatchReport",
      importance: "Normal",
      headline: `${home.name} ${score} ${away.name}`,
      body: `Full-time at ${home.stadiumName}.`,
      sourceId: "gfn",
      relatedPlayerIds: [],
      relatedClubIds: [home.id, away.id],
      relatedCompetitionId: null,
      sourceEventId: p.matchId ?? `match_${home.id}_${away.id}`,
      sentiment: "Neutral",
      tags: ["match"],
      storyKey: `ft_${p.matchId ?? home.id + away.id + score}`,
    });
  });

  world.events.on(Events.GOAL_SCORED, (p: any) => {
    const player = world.players.get(p.playerId);
    const club = world.clubs.get(p.clubId);
    if (!player || !club) return;
    const imp: NewsImportance = player.isUserControlled ? "Important" : "Normal";
    publish(world, {
      timestamp: world.calendar.currentDate,
      category: "MatchReport",
      importance: imp,
      headline: `${player.displayName} on the scoresheet for ${club.shortName}`,
      body: `Goal in the ${p.minute}' minute.`,
      sourceId: "fdaily",
      relatedPlayerIds: [player.id],
      relatedClubIds: [club.id],
      relatedCompetitionId: null,
      sourceEventId: `goal_${p.matchId}_${p.minute}_${player.id}`,
      sentiment: "Positive",
      tags: ["goal"],
      storyKey: `goal_${p.matchId}_${player.id}_${p.minute}`,
    });
  });

  world.events.on(Events.TRANSFER_COMPLETED, (p: any) => {
    const player = world.players.get(p.playerId);
    const to = world.clubs.get(p.toClubId);
    const from = p.fromClubId ? world.clubs.get(p.fromClubId) : null;
    if (!player || !to) return;
    publish(world, {
      timestamp: world.calendar.currentDate,
      category: "Transfer",
      importance: p.fee > 10_000_000 ? "Major" : "Important",
      headline: `${to.name} complete signing of ${player.displayName}`,
      body: from
        ? `Arrives from ${from.name} for €${(p.fee / 1e6).toFixed(1)}m.`
        : `Joins as a free agent.`,
      sourceId: "txcentral",
      relatedPlayerIds: [player.id],
      relatedClubIds: [to.id, from?.id].filter(Boolean) as EntityId[],
      relatedCompetitionId: null,
      sourceEventId: `tx_${player.id}_${to.id}`,
      sentiment: "Positive",
      tags: ["transfer"],
      storyKey: `tx_${player.id}_${to.id}_${world.calendar.currentDate}`,
    });
  });

  world.events.on(Events.LOAN_COMPLETED, (p: any) => {
    const player = world.players.get(p.playerId);
    const dest = world.clubs.get(p.loanClubId);
    const parent = world.clubs.get(p.parentClubId);
    if (!player || !dest) return;
    publish(world, {
      timestamp: world.calendar.currentDate,
      category: "Transfer",
      importance: "Normal",
      headline: `${player.displayName} joins ${dest.name} on loan`,
      body: parent ? `Parent club: ${parent.name}.` : "",
      sourceId: "txcentral",
      relatedPlayerIds: [player.id],
      relatedClubIds: [dest.id, parent?.id].filter(Boolean) as EntityId[],
      relatedCompetitionId: null,
      sourceEventId: `loan_${player.id}_${dest.id}`,
      sentiment: "Neutral",
      tags: ["loan"],
      storyKey: `loan_${player.id}_${dest.id}`,
    });
  });
}

export function scoreImportance(opts: {
  playerRep?: number;
  clubRep?: number;
  matchImportance?: number;
  fee?: number;
}): number {
  let s = 25;
  s += (opts.playerRep ?? 40) * 0.25;
  s += (opts.clubRep ?? 50) * 0.2;
  s += (opts.matchImportance ?? 0.4) * 25;
  if (opts.fee && opts.fee > 5_000_000) s += 15;
  return Math.max(0, Math.min(100, s));
}
