/**
 * Event-driven News Engine.
 * Consumes world events → articles. No random disconnected stories.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import type {
  NewsArticle,
  NewsImportance,
  NewsCategory,
  SentimentLabel,
} from "./types.js";
import { MEDIA_OUTLETS, pickOutlet } from "./outlets.js";
import { renderHeadline, renderBody, type TemplateContext } from "./templates.js";
import { clubPostMatchResult } from "../social/clubs.js";

const processedStories = new Set<string>();

export function resetNewsDedup(): void {
  processedStories.clear();
}

function importanceFromScore(score: number): NewsImportance {
  if (score >= 85) return "Breaking";
  if (score >= 70) return "Major";
  if (score >= 50) return "Important";
  if (score >= 30) return "Normal";
  return "Minor";
}

function feeStr(fee: number): string {
  if (fee <= 0) return "free";
  if (fee >= 1_000_000) return `€${(fee / 1e6).toFixed(1)}m`;
  return `€${Math.round(fee / 1000)}k`;
}

function playerName(world: World, id: EntityId | undefined): string {
  if (!id) return "A player";
  return world.players.get(id)?.displayName ?? "A player";
}

function clubName(world: World, id: EntityId | undefined | null): string {
  if (!id) return "a club";
  return world.clubs.get(id)?.name ?? "a club";
}

export function scoreImportance(opts: {
  playerRep?: number;
  clubRep?: number;
  matchImportance?: number;
  fee?: number;
  rarity?: number;
  rivalry?: boolean;
  goals?: number;
}): number {
  let s = 25;
  s += (opts.playerRep ?? 40) * 0.25;
  s += (opts.clubRep ?? 50) * 0.2;
  s += (opts.matchImportance ?? 0.4) * 25;
  if (opts.fee && opts.fee > 5_000_000) s += 15;
  else if (opts.fee && opts.fee > 1_000_000) s += 8;
  s += (opts.rarity ?? 0) * 30;
  if (opts.rivalry) s += 18;
  if ((opts.goals ?? 0) >= 3) s += 20;
  else if ((opts.goals ?? 0) >= 2) s += 10;
  return Math.max(0, Math.min(100, s));
}

function publish(
  world: World,
  article: Omit<NewsArticle, "id"> & { id?: string }
): NewsArticle | null {
  if (processedStories.has(article.storyKey)) return null;
  processedStories.add(article.storyKey);

  if (article.importance === "Minor") {
    const userId = world.userPlayerId;
    if (userId && !article.relatedPlayerIds.includes(userId)) {
      if (world.rng.chance(0.7)) return null;
    }
  }

  const full: NewsArticle = {
    ...article,
    id: article.id ?? nextId("nws"),
  };

  if (!(world as any).newsFeed) (world as any).newsFeed = [];
  (world as any).newsFeed.push(full);

  world.events.emit(Events.NEWS_GENERATED, { articleId: full.id, headline: full.headline });
  return full;
}

export function getNewsFeed(world: World): NewsArticle[] {
  return ((world as any).newsFeed as NewsArticle[]) ?? [];
}

export function onMatchFinished(
  world: World,
  payload: {
    matchId?: string;
    homeClubId?: EntityId;
    awayClubId?: EntityId;
    homeScore?: number;
    awayScore?: number;
    playerId?: EntityId;
    rating?: number;
  }
): NewsArticle[] {
  const created: NewsArticle[] = [];
  const match = payload.matchId ? world.matches.get(payload.matchId) : null;

  if (match) {
    const home = world.clubs.get(match.home.clubId);
    const away = world.clubs.get(match.away.clubId);
    if (!home || !away) return created;

    const score = `${match.homeScore}–${match.awayScore}`;
    const ctx: TemplateContext = {
      club: home.name,
      opponent: away.name,
      score,
    };

    const margin = Math.abs(match.homeScore - match.awayScore);
    const imp = scoreImportance({
      clubRep: Math.max(home.reputation, away.reputation),
      matchImportance: match.context?.matchImportance ?? 0.5,
      rivalry: Math.abs(home.reputation - away.reputation) < 8 && home.reputation >= 75,
      goals: margin >= 3 ? 3 : 0,
    });

    let resultKey: string =
      match.homeScore > match.awayScore
        ? "matchWin"
        : match.homeScore < match.awayScore
          ? "matchLoss"
          : "matchDraw";
    if (margin >= 3 && match.homeScore !== match.awayScore) {
      if (match.homeScore > match.awayScore) {
        ctx.club = home.name;
        ctx.opponent = away.name;
      } else {
        ctx.club = away.name;
        ctx.opponent = home.name;
        ctx.score = `${match.awayScore}–${match.homeScore}`;
      }
      resultKey = "thrashing";
    }

    const article = publish(world, {
      timestamp: match.date,
      category: "MatchReport",
      importance: importanceFromScore(imp),
      headline: renderHeadline(resultKey as any, ctx, match.homeScore + match.awayScore),
      body: renderBody("matchReport", ctx),
      sourceId: pickOutlet(false, 60).id,
      relatedPlayerIds: [],
      relatedClubIds: [home.id, away.id],
      relatedCompetitionId: match.competitionId,
      sourceEventId: `match:${match.id}`,
      sentiment: match.homeScore === match.awayScore ? "Neutral" : "Positive",
      tags: ["match"],
      storyKey: `match-report:${match.id}`,
    });
    if (article) created.push(article);

    try {
      clubPostMatchResult(world, match);
    } catch {
      /* club social optional */
    }

    for (const [pid, stats] of match.playerStats) {
      if (stats.minutes < 20) continue;
      const player = world.players.get(pid);
      if (!player) continue;

      if (stats.goals >= 3) {
        const scorerClub = player.currentClubId === home.id ? home : away;
        const oppClub = player.currentClubId === home.id ? away : home;
        const a = publish(world, {
          timestamp: match.date,
          category: "Breaking",
          importance: "Breaking",
          headline: renderHeadline(
            "hatTrick",
            {
              player: player.displayName,
              club: scorerClub.name,
              opponent: oppClub.name,
              score,
              goals: String(stats.goals),
            },
            stats.goals
          ),
          body: `${player.displayName} scored a hat-trick as ${scorerClub.name} defeated ${oppClub.name} ${score}. The ${player.primaryPosition} finished with ${stats.goals} goals and a match rating of ${(stats.rating / 10).toFixed(1)}. Fans and media are already talking about a statement performance.`,
          sourceId: pickOutlet(false, 70).id,
          relatedPlayerIds: [pid],
          relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
          relatedCompetitionId: match.competitionId,
          sourceEventId: `hattrick:${match.id}:${pid}`,
          sentiment: "VeryPositive",
          tags: ["hattrick", "player"],
          storyKey: `hattrick:${match.id}:${pid}`,
        });
        if (a) created.push(a);
      } else if (stats.goals >= 1 && (player.isUserControlled || player.reputation >= 60)) {
        const lateGoal = match.events.some(
          (e) => e.type === "Goal" && e.playerId === pid && e.minute >= 80
        );
        if (lateGoal) {
          const a = publish(world, {
            timestamp: match.date,
            category: "Player",
            importance: importanceFromScore({
              playerRep: player.reputation,
              clubRep: home.reputation,
              matchImportance: 0.7,
              rivalry: true,
            }),
            headline: renderHeadline(
              "lateWinner",
              {
                player: player.displayName,
                club: clubName(world, player.currentClubId),
                opponent: player.currentClubId === home.id ? away.name : home.name,
              },
              pid.length
            ),
            body: renderBody("lateWinner", {
              player: player.displayName,
              club: clubName(world, player.currentClubId),
              opponent: player.currentClubId === home.id ? away.name : home.name,
            }),
            sourceId: pickOutlet(false, 65).id,
            relatedPlayerIds: [pid],
            relatedClubIds: [home.id, away.id],
            relatedCompetitionId: match.competitionId,
            sourceEventId: `late:${match.id}:${pid}`,
            sentiment: "VeryPositive",
            tags: ["late-winner", "player"],
            storyKey: `late:${match.id}:${pid}`,
          });
          if (a) created.push(a);
        }
      }

      if (player.careerAppearances === 1 && stats.minutes > 0) {
        const a = publish(world, {
          timestamp: match.date,
          category: "Milestone",
          importance: player.potential >= 80 ? "Important" : "Normal",
          headline: renderHeadline("debut", {
            player: player.displayName,
            club: clubName(world, player.currentClubId),
          }),
          body: renderBody("debut", {
            player: player.displayName,
            club: clubName(world, player.currentClubId),
            age: String(player.age),
          }),
          sourceId: "cinsider",
          relatedPlayerIds: [pid],
          relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
          relatedCompetitionId: match.competitionId,
          sourceEventId: `debut:${pid}`,
          sentiment: "Positive",
          tags: ["debut", "milestone"],
          storyKey: `debut:${pid}`,
        });
        if (a) created.push(a);
      }

      for (const [n, label] of [
        [10, "10 career appearances"],
        [50, "50 career appearances"],
        [100, "100 career appearances"],
      ] as const) {
        if (player.careerAppearances === n) {
          const a = publish(world, {
            timestamp: match.date,
            category: "Milestone",
            importance: n >= 50 ? "Important" : "Normal",
            headline: renderHeadline("milestone", {
              player: player.displayName,
              milestone: label,
            }),
            body: renderBody("milestone", {
              player: player.displayName,
              milestone: label,
            }),
            sourceId: pickOutlet(false, 50).id,
            relatedPlayerIds: [pid],
            relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
            relatedCompetitionId: null,
            sourceEventId: `milestone:apps:${pid}:${n}`,
            sentiment: "Positive",
            tags: ["milestone"],
            storyKey: `milestone:apps:${pid}:${n}`,
          });
          if (a) created.push(a);
        }
      }
      if (player.careerGoals === 50 || player.careerGoals === 100) {
        const a = publish(world, {
          timestamp: match.date,
          category: "Milestone",
          importance: "Important",
          headline: renderHeadline("milestone", {
            player: player.displayName,
            milestone: `${player.careerGoals} career goals`,
          }),
          body: renderBody("milestone", {
            player: player.displayName,
            milestone: `${player.careerGoals} career goals`,
          }),
          sourceId: pickOutlet(false, 60).id,
          relatedPlayerIds: [pid],
          relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
          relatedCompetitionId: null,
          sourceEventId: `milestone:goals:${pid}:${player.careerGoals}`,
          sentiment: "VeryPositive",
          tags: ["milestone", "goals"],
          storyKey: `milestone:goals:${pid}:${player.careerGoals}`,
        });
        if (a) created.push(a);
      }
    }
  }

  return created;
}

export function onTransferCompleted(
  world: World,
  payload: Record<string, unknown>
): NewsArticle[] {
  const created: NewsArticle[] = [];

  if (payload.type === "loan") {
    const playerId = payload.playerId as EntityId;
    const player = world.players.get(playerId);
    if (!player) return created;
    const ctx: TemplateContext = {
      player: player.displayName,
      club: String(payload.loanClub ?? "a club"),
      club2: String(payload.parent ?? ""),
    };
    const a = publish(world, {
      timestamp: world.calendar.currentDate,
      category: "Transfer",
      importance: importanceFromScore({
        playerRep: player.reputation,
        rarity: player.isUserControlled ? 0.5 : 0.2,
      }),
      headline: renderHeadline("loanComplete", ctx, playerId.length),
      body: renderBody("loanComplete", ctx),
      sourceId: pickOutlet(true, 50).id,
      relatedPlayerIds: [playerId],
      relatedClubIds: [],
      relatedCompetitionId: null,
      sourceEventId: `loan:${playerId}:${world.calendar.currentDate}`,
      sentiment: "Positive",
      tags: ["loan", "transfer"],
      storyKey: `loan:${playerId}:${world.calendar.currentDate}`,
    });
    if (a) created.push(a);
    return created;
  }

  const record = payload.record as
    | {
        id: string;
        playerId: EntityId;
        fromClubId: EntityId | null;
        toClubId: EntityId;
        fee: number;
      }
    | undefined;

  if (record) {
    const player = world.players.get(record.playerId);
    if (!player) return created;
    const ctx: TemplateContext = {
      player: player.displayName,
      club: clubName(world, record.toClubId),
      club2: record.fromClubId ? clubName(world, record.fromClubId) : "Free Agency",
      fee: feeStr(record.fee),
      position: player.primaryPosition,
    };
    const imp = scoreImportance({
      playerRep: player.reputation,
      clubRep: world.clubs.get(record.toClubId)?.reputation,
      fee: record.fee,
      rarity: record.fee > 10_000_000 ? 0.6 : 0.3,
    });
    const a = publish(world, {
      timestamp: world.calendar.currentDate,
      category: record.fee > 8_000_000 ? "Breaking" : "Transfer",
      importance: importanceFromScore(imp),
      headline: renderHeadline("transferComplete", ctx, record.fee),
      body: renderBody("transferComplete", ctx),
      sourceId: pickOutlet(true, 70).id,
      relatedPlayerIds: [record.playerId],
      relatedClubIds: [record.toClubId, ...(record.fromClubId ? [record.fromClubId] : [])],
      relatedCompetitionId: null,
      sourceEventId: `transfer:${record.id}`,
      sentiment: "Positive",
      tags: ["transfer"],
      storyKey: `transfer:${record.id}`,
    });
    if (a) created.push(a);
  }

  return created;
}

export function onInjury(
  world: World,
  payload: { playerId: EntityId; injuryId?: string; minute?: number }
): NewsArticle[] {
  const player = world.players.get(payload.playerId);
  if (!player) return [];
  const injury = payload.injuryId ? world.injuries.get(payload.injuryId) : null;
  if (injury && injury.severity === "Minor" && !player.isUserControlled) {
    if (player.reputation < 70) return [];
  }
  const ctx: TemplateContext = {
    player: player.displayName,
    injury: injury?.name ?? "an injury",
    club: clubName(world, player.currentClubId),
  };
  const a = publish(world, {
    timestamp: world.calendar.currentDate,
    category: "Injury",
    importance:
      injury?.severity === "Severe"
        ? "Major"
        : injury?.severity === "Moderate"
          ? "Important"
          : "Normal",
    headline: renderHeadline("injury", ctx, payload.minute ?? 0),
    body: renderBody("injury", ctx),
    sourceId: pickOutlet(false, 55).id,
    relatedPlayerIds: [player.id],
    relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
    relatedCompetitionId: null,
    sourceEventId: `injury:${payload.injuryId ?? player.id}:${world.calendar.currentDate}`,
    sentiment: "Negative",
    tags: ["injury"],
    storyKey: `injury:${payload.injuryId ?? player.id}`,
  });
  return a ? [a] : [];
}

export function onContractRenewed(
  world: World,
  payload: { playerId: EntityId; clubId: EntityId }
): NewsArticle[] {
  const player = world.players.get(payload.playerId);
  if (!player) return [];
  if (player.reputation < 55 && !player.isUserControlled && player.ovr < 78) return [];
  const ctx: TemplateContext = {
    player: player.displayName,
    club: clubName(world, payload.clubId),
  };
  const a = publish(world, {
    timestamp: world.calendar.currentDate,
    category: "Player",
    importance: "Normal",
    headline: renderHeadline("contractRenewed", ctx),
    body: `${player.displayName} has agreed a new contract with ${ctx.club}.`,
    sourceId: "cinsider",
    relatedPlayerIds: [player.id],
    relatedClubIds: [payload.clubId],
    relatedCompetitionId: null,
    sourceEventId: `renew:${player.id}:${world.calendar.currentDate}`,
    sentiment: "Positive",
    tags: ["contract"],
    storyKey: `renew:${player.id}:${world.calendar.currentSeason}`,
  });
  return a ? [a] : [];
}

export function publishRumour(
  world: World,
  playerId: EntityId,
  buyingClubId: EntityId,
  reliability = 70
): NewsArticle | null {
  const player = world.players.get(playerId);
  const club = world.clubs.get(buyingClubId);
  if (!player || !club) return null;

  const trueRumour = world.rng.chance(reliability / 100);
  if (!trueRumour && world.rng.chance(0.5)) {
  }

  const outlet =
    MEDIA_OUTLETS.find((o) => o.transferReliability >= reliability - 10) ??
    MEDIA_OUTLETS.find((o) => o.id === "pitchwire")!;

  const ctx: TemplateContext = {
    player: player.displayName,
    club: club.name,
  };
  return publish(world, {
    timestamp: world.calendar.currentDate,
    category: "Rumour",
    importance: importanceFromScore({
      playerRep: player.reputation,
      clubRep: club.reputation,
      rarity: 0.35,
    }),
    headline: renderHeadline("transferRumour", ctx, club.reputation),
    body: renderBody("transferRumour", ctx),
    sourceId: outlet.id,
    relatedPlayerIds: [playerId],
    relatedClubIds: [buyingClubId, ...(player.currentClubId ? [player.currentClubId] : [])],
    relatedCompetitionId: null,
    sourceEventId: `rumour:${playerId}:${buyingClubId}:${world.calendar.currentDate}`,
    sentiment: "Neutral",
    tags: ["rumour", "transfer"],
    storyKey: `rumour:${playerId}:${buyingClubId}:${world.calendar.currentSeason}`,
  });
}

export function onTransferOfferRejected(
  world: World,
  payload: {
    type?: string;
    playerId?: EntityId;
    buyerId?: EntityId;
    sellerId?: EntityId;
    fee?: number;
    asking?: number;
    reasons?: string[];
    score?: number;
  }
): NewsArticle[] {
  const created: NewsArticle[] = [];
  if (payload.type !== "rejected_seller") return created;
  const playerId = payload.playerId;
  if (!playerId) return created;
  const player = world.players.get(playerId);
  if (!player) return created;
  const fee = payload.fee ?? 0;
  const isWonder = player.age <= 21 && player.potential >= 84;
  const bigMoney = fee >= 15_000_000 || fee >= (payload.asking ?? 0) * 0.85;
  if (!isWonder && !bigMoney && fee < 8_000_000) return created;

  const ctx: TemplateContext = {
    player: player.displayName,
    club: clubName(world, payload.buyerId),
    club2: clubName(world, payload.sellerId),
    fee: feeStr(fee),
  };
  const headlineKey = isWonder ? "bidRejectedWonderkid" : "bidRejected";
  const bodyKey = isWonder ? "bidRejectedWonderkid" : "bidRejected";
  const imp = scoreImportance({
    playerRep: player.reputation,
    clubRep: Math.max(
      world.clubs.get(payload.buyerId as any)?.reputation ?? 50,
      world.clubs.get(payload.sellerId as any)?.reputation ?? 50
    ),
    fee,
    rarity: isWonder ? 0.7 : 0.35,
  });
  const a = publish(world, {
    timestamp: world.calendar.currentDate,
    category: isWonder || fee >= 25_000_000 ? "Breaking" : "Transfer",
    importance: importanceFromScore(Math.max(imp, isWonder ? 70 : 45)),
    headline: renderHeadline(headlineKey as any, ctx, fee),
    body: renderBody(bodyKey as any, ctx),
    sourceId: pickOutlet(true, 70).id,
    relatedPlayerIds: [playerId],
    relatedClubIds: [payload.buyerId, payload.sellerId].filter(Boolean) as EntityId[],
    relatedCompetitionId: null,
    sourceEventId: `bid-reject:${playerId}:${payload.buyerId}:${world.calendar.currentDate}:${fee}`,
    sentiment: "Neutral",
    tags: isWonder
      ? ["transfer", "rejected", "wonderkid", "not-for-sale"]
      : ["transfer", "rejected", "not-for-sale"],
    storyKey: `bid-reject:${playerId}:${payload.buyerId}:${world.calendar.currentDate}`,
  });
  if (a) created.push(a);
  return created;
}

export function attachNewsEngine(world: World): void {
  world.events.on(Events.MATCH_FINISHED, (p) => onMatchFinished(world, p as any));

  world.events.on(Events.TRANSFER_COMPLETED, (p) => onTransferCompleted(world, p as any));
  world.events.on(Events.TRANSFER_OFFER, (p) => {
    const payload = p as any;
    if (payload?.type === "rejected_seller") onTransferOfferRejected(world, payload);
  });
  world.events.on(Events.INJURY_OCCURRED, (p) => onInjury(world, p as any));
  world.events.on(Events.CONTRACT_RENEWED, (p) => onContractRenewed(world, p as any));
  world.events.on(Events.PLAYER_SELECTED, (p: any) => {
    if (p.type === "international_squad") {
    }
  });
  world.events.on(Events.NEWS_GENERATED, (p: any) => {
    if (p.type === "manager_sacked") {
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Club",
        importance: "Major",
        headline: `${p.clubName} dismiss ${p.name}`,
        body: `${p.name} has left ${p.clubName} after a difficult period.`,
        sourceId: "gfn",
        relatedPlayerIds: [],
        relatedClubIds: p.clubId ? [p.clubId] : [],
        relatedCompetitionId: null,
        sourceEventId: `sack:${p.managerId}:${world.calendar.currentDate}`,
        sentiment: "Negative",
        tags: ["manager", "sacked"],
        storyKey: `sack:${p.managerId}:${p.clubId}`,
      });
      return;
    }
    if (p.type === "manager_hired") {
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Club",
        importance: "Important",
        headline: `${p.clubName} appoint ${p.name}`,
        body: `${p.name} is the new manager of ${p.clubName}.`,
        sourceId: "tfj",
        relatedPlayerIds: [],
        relatedClubIds: p.clubId ? [p.clubId] : [],
        relatedCompetitionId: null,
        sourceEventId: `hire:${p.managerId}:${p.clubId}`,
        sentiment: "Positive",
        tags: ["manager", "hired"],
        storyKey: `hire:${p.managerId}:${p.clubId}`,
      });
      return;
    }
    if (p.type === "award") {
      const labels: Record<string, string> = {
        GoldenBoot: "Golden Boot",
        Playmaker: "Playmaker Award",
        PlayerOfTheSeason: "Player of the Season",
        YoungPlayerOfTheSeason: "Young Player of the Season",
        GoalkeeperOfTheSeason: "Goalkeeper of the Season",
        CleanSheetLeader: "Clean Sheet Award",
        TeamOfTheSeason: "Team of the Season",
        PlayerOfTheMonth: "Player of the Month",
        ManagerOfTheMonth: "Manager of the Month",
        ManagerOfTheSeason: "Manager of the Season",
        InternationalPlayerOfTheYear: "International Player of the Year",
        FairPlay: "Fair Play Award",
      };
      const label = labels[p.awardType] ?? p.awardType;
      if (p.playerId) {
        const player = world.players.get(p.playerId);
        if (!player) return;
        const posBit = p.position ? ` (${p.position})` : "";
        const monthBit = p.month ? ` — Month ${p.month}` : "";
        publish(world, {
          timestamp: world.calendar.currentDate,
          category: "Player",
          importance:
            p.awardType === "PlayerOfTheSeason" || p.awardType === "InternationalPlayerOfTheYear"
              ? "Major"
              : p.awardType === "PlayerOfTheMonth"
                ? "Normal"
                : "Important",
          headline: `${player.displayName} wins ${label}${posBit}${monthBit}`,
          body: `${player.displayName} has been named ${label}${posBit}.`,
          sourceId: "gfn",
          relatedPlayerIds: [p.playerId],
          relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
          relatedCompetitionId: null,
          sourceEventId: `award:${p.awardType}:${p.playerId}:${p.seasonId}:${p.month ?? ""}:${p.position ?? ""}`,
          sentiment: "VeryPositive",
          tags: ["award"],
          storyKey: `award:${p.awardType}:${p.seasonId}:${p.playerId}:${p.month ?? ""}:${p.position ?? ""}`,
        });
      } else if (p.clubId) {
        const club = world.clubs.get(p.clubId);
        publish(world, {
          timestamp: world.calendar.currentDate,
          category: "Club",
          importance: p.awardType === "ManagerOfTheSeason" ? "Major" : "Normal",
          headline: `${club?.name ?? "Club"} takes ${label}`,
          body: `${club?.name ?? "The club"} has been recognised with the ${label}.`,
          sourceId: "tfj",
          relatedPlayerIds: [],
          relatedClubIds: [p.clubId],
          relatedCompetitionId: null,
          sourceEventId: `award:${p.awardType}:club:${p.clubId}:${p.seasonId}:${p.month ?? ""}`,
          sentiment: "Positive",
          tags: ["award", "manager"],
          storyKey: `award:${p.awardType}:${p.seasonId}:${p.clubId}:${p.month ?? ""}`,
        });
      }
      return;
    }
    if (p.type === "retirement" && p.playerId) {
      const player = world.players.get(p.playerId);
      if (!player) return;
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Player",
        importance: (p.legacyScore ?? 0) >= 70 ? "Major" : "Normal",
        headline: `${player.displayName} announces retirement`,
        body: p.summary ?? `${player.displayName} has retired from professional football.`,
        sourceId: "tfj",
        relatedPlayerIds: [p.playerId],
        relatedClubIds: [],
        relatedCompetitionId: null,
        sourceEventId: `retire:${p.playerId}`,
        sentiment: "Neutral",
        tags: ["retirement", "legacy"],
        storyKey: `retire:${p.playerId}`,
      });
      return;
    }
    if (p.type === "record_broken" && p.playerId) {
      const player = world.players.get(p.playerId);
      if (!player) return;
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Milestone",
        importance: "Important",
        headline: `Record: ${player.displayName} — ${p.label}`,
        body: `${player.displayName} has set a new mark (${p.value}).`,
        sourceId: "fdaily",
        relatedPlayerIds: [p.playerId],
        relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
        relatedCompetitionId: null,
        sourceEventId: `record:${p.recordKey}:${p.playerId}`,
        sentiment: "Positive",
        tags: ["record"],
        storyKey: `record:${p.recordKey}:${p.playerId}:${p.value}`,
      });
      return;
    }
    if (p.type === "international_debut_call" && p.playerId) {
      const player = world.players.get(p.playerId);
      if (!player) return;
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Player",
        importance: p.level === "Senior" ? "Important" : "Normal",
        headline: `${player.displayName} earns first ${p.level} call-up for ${p.nation}`,
        body: `${player.displayName} has been named in the ${p.nation} ${p.level} squad for the upcoming international window.`,
        sourceId: "gfn",
        relatedPlayerIds: [p.playerId],
        relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
        relatedCompetitionId: null,
        sourceEventId: `intl-call:${p.playerId}:${p.level}:${world.calendar.currentDate}`,
        sentiment: "Positive",
        tags: ["international", "call-up"],
        storyKey: `intl-call:${p.playerId}:${p.level}`,
      });
    }
  });
  world.events.on(Events.YOUTH_PROMOTED, (p: any) => {
    if (p.type === "academy_signing" && p.name) {
      publish(world, {
        timestamp: world.calendar.currentDate,
        category: "Player",
        importance: "Normal",
        headline: `${clubName(world, p.clubId)} academy adds prospect ${p.name}`,
        body: `Young talent ${p.name} has joined the academy setup. Scouted potential range: ${p.potentialRange ?? "unknown"}.`,
        sourceId: "cinsider",
        relatedPlayerIds: [],
        relatedClubIds: p.clubId ? [p.clubId] : [],
        relatedCompetitionId: null,
        sourceEventId: `academy:${p.prospectId}:${world.calendar.currentDate}`,
        sentiment: "Positive",
        tags: ["youth", "academy"],
        storyKey: `academy:${p.prospectId}`,
      });
    }
  });
}
