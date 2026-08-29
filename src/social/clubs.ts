/**
 * Club social media accounts + official match posts (next / result).
 * Event-driven — only posts when fixtures exist or matches finish.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Club } from "../clubs/club.js";
import type { Match } from "../matches/types.js";
import type { SocialPost } from "../news/types.js";
import { Events } from "../core/events.js";

export interface ClubSocialAccount {
  clubId: EntityId;
  handle: string;
  displayName: string;
  followers: number;
  verified: boolean;
}

function slugHandle(name: string, shortName: string): string {
  const clean = shortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length >= 2) return `@${clean}`;
  return `@${name.replace(/[^A-Za-z]/g, "").slice(0, 8)}`;
}

export function ensureClubSocial(world: World, club: Club): ClubSocialAccount {
  if (!(world as any).clubSocial) (world as any).clubSocial = new Map();
  const map = (world as any).clubSocial as Map<EntityId, ClubSocialAccount>;
  let acc = map.get(club.id);
  if (!acc) {
    acc = {
      clubId: club.id,
      handle: slugHandle(club.name, club.shortName),
      displayName: club.name,
      followers: Math.round(50_000 + club.reputation * club.reputation * 180),
      verified: club.reputation >= 70,
    };
    map.set(club.id, acc);
  }
  return acc;
}

export function ensureAllClubSocials(world: World): void {
  for (const club of world.clubs.values()) {
    ensureClubSocial(world, club);
  }
}

function pushClubPost(
  world: World,
  clubId: EntityId,
  content: string,
  relatedMatchId: string | null,
  tags: string[]
): SocialPost {
  const club = world.clubs.get(clubId)!;
  const acc = ensureClubSocial(world, club);
  const post: SocialPost = {
    id: nextId("soc"),
    timestamp: world.calendar.currentDate,
    authorType: "Club",
    authorLabel: `${acc.displayName} ${acc.handle}`,
    content,
    sentiment: tags.includes("result-win")
      ? "VeryPositive"
      : tags.includes("result-loss")
        ? "Negative"
        : "Neutral",
    relatedPlayerIds: [],
    relatedClubIds: [clubId],
    sourceEventId: relatedMatchId ?? `club:${clubId}:${world.calendar.currentDate}`,
    engagement: Math.round(acc.followers * (0.002 + Math.random() * 0.008)),
    tags,
  };
  if (!(world as any).socialFeed) (world as any).socialFeed = [];
  (world as any).socialFeed.push(post);
  world.events.emit(Events.SOCIAL_POST, { postId: post.id, clubId });
  return post;
}

export function clubPostMatchResult(world: World, match: Match): SocialPost[] {
  const home = world.clubs.get(match.home.clubId);
  const away = world.clubs.get(match.away.clubId);
  if (!home || !away) return [];
  const posts: SocialPost[] = [];
  const score = `${match.homeScore}\u2013${match.awayScore}`;
  const hs = match.homeStats;
  const as = match.awayStats;

  if (match.homeScore > match.awayScore) {
    posts.push(
      pushClubPost(
        world,
        home.id,
        `FULL TIME \ud83d\udd34 ${home.shortName} ${score} ${away.shortName}\n\nThree points. ${hs.shots} shots \u00b7 ${hs.xG.toFixed(2)} xG \u00b7 ${hs.possession}% possession.\n\n#${home.shortName}`,
        match.id,
        ["match-result", "result-win", "club-official"]
      )
    );
  } else if (match.homeScore < match.awayScore) {
    posts.push(
      pushClubPost(
        world,
        home.id,
        `FULL TIME ${home.shortName} ${score} ${away.shortName}\n\nWe go again. Focus turns to the next match.\n\n#${home.shortName}`,
        match.id,
        ["match-result", "result-loss", "club-official"]
      )
    );
  } else {
    posts.push(
      pushClubPost(
        world,
        home.id,
        `FULL TIME ${home.shortName} ${score} ${away.shortName}\n\nA point on the board.\n\n#${home.shortName}`,
        match.id,
        ["match-result", "result-draw", "club-official"]
      )
    );
  }

  if (match.awayScore > match.homeScore) {
    posts.push(
      pushClubPost(
        world,
        away.id,
        `FULL TIME \ud83d\udd35 ${home.shortName} ${score} ${away.shortName}\n\nHuge away win. ${as.shots} shots \u00b7 ${as.xG.toFixed(2)} xG \u00b7 ${as.possession}% possession.\n\n#${away.shortName}`,
        match.id,
        ["match-result", "result-win", "club-official"]
      )
    );
  } else if (match.awayScore < match.homeScore) {
    posts.push(
      pushClubPost(
        world,
        away.id,
        `FULL TIME ${home.shortName} ${score} ${away.shortName}\n\nDisappointing result. Heads up for the next one.\n\n#${away.shortName}`,
        match.id,
        ["match-result", "result-loss", "club-official"]
      )
    );
  } else {
    posts.push(
      pushClubPost(
        world,
        away.id,
        `FULL TIME ${home.shortName} ${score} ${away.shortName}\n\nPoint secured on the road.\n\n#${away.shortName}`,
        match.id,
        ["match-result", "result-draw", "club-official"]
      )
    );
  }

  return posts;
}

export function clubPostUpcomingFixtures(world: World, clubId: EntityId, limit = 2): SocialPost[] {
  const club = world.clubs.get(clubId);
  if (!club) return [];
  const posts: SocialPost[] = [];
  const fixtures = [...world.fixtures.values()]
    .filter(
      (f) =>
        !f.played &&
        (f.homeClubId === clubId || f.awayClubId === clubId)
    )
    .sort((a, b) => a.matchday - b.matchday || a.date.localeCompare(b.date))
    .slice(0, limit);

  for (const f of fixtures) {
    const home = world.clubs.get(f.homeClubId)!;
    const away = world.clubs.get(f.awayClubId)!;
    const isHome = f.homeClubId === clubId;
    const opponent = isHome ? away : home;
    posts.push(
      pushClubPost(
        world,
        clubId,
        `NEXT MATCH \ud83d\udcc5\n${home.shortName} vs ${away.shortName}\nMatchday ${f.matchday} \u00b7 ${f.date}\n\n${isHome ? "Home" : "Away"} against ${opponent.name}. Let's go.\n\n#${club.shortName}`,
        f.id,
        ["next-match", "club-official", isHome ? "home" : "away"]
      )
    );
  }
  return posts;
}

export function getClubSocialFeed(world: World, clubId: EntityId, limit = 20): SocialPost[] {
  const feed = ((world as any).socialFeed as SocialPost[]) ?? [];
  return feed
    .filter((p) => p.authorType === "Club" && p.relatedClubIds.includes(clubId))
    .slice(-limit)
    .reverse();
}

export function getMatchTeamStats(match: Match) {
  return {
    home: match.homeStats,
    away: match.awayStats,
    possessionHome: match.possessionHome,
    score: `${match.homeScore}\u2013${match.awayScore}`,
  };
}
