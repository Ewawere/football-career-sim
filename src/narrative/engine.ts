/**
 * Narrative Thread Engine
 * Consumes world events and grows multi-beat stories.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import { Events } from "../core/events.js";
import type {
  NarrativeThread,
  ThreadBeat,
  ThreadKind,
  ThreadStatus,
} from "./types.js";

const STORE_KEY = "narrativeThreads";

function store(world: World): NarrativeThread[] {
  if (!(world as any)[STORE_KEY]) (world as any)[STORE_KEY] = [] as NarrativeThread[];
  return (world as any)[STORE_KEY] as NarrativeThread[];
}

function sentimentDelta(s: ThreadBeat["sentiment"]): number {
  switch (s) {
    case "VeryPositive":
      return 18;
    case "Positive":
      return 8;
    case "Neutral":
      return 0;
    case "Negative":
      return -8;
    case "VeryNegative":
      return -18;
    default:
      return 0;
  }
}

function findActive(
  world: World,
  kind: ThreadKind,
  playerId?: EntityId | null
): NarrativeThread | undefined {
  return store(world).find(
    (t) =>
      t.status === "active" &&
      t.kind === kind &&
      (!playerId || t.playerId === playerId || t.beats.length > 0)
  );
}

function openThread(
  world: World,
  opts: {
    kind: ThreadKind;
    title: string;
    playerId: EntityId | null;
    clubIds: EntityId[];
    tags: string[];
    beat: ThreadBeat;
  }
): NarrativeThread {
  const seasonId =
    (world as any).season?.seasonId ?? world.calendar.currentSeason ?? "unknown";
  const thread: NarrativeThread = {
    id: nextId("nth"),
    kind: opts.kind,
    status: "active",
    title: opts.title,
    playerId: opts.playerId,
    clubIds: opts.clubIds,
    seasonId,
    openedDate: world.calendar.currentDate,
    updatedDate: world.calendar.currentDate,
    resolvedDate: null,
    beats: [opts.beat],
    sentimentScore: sentimentDelta(opts.beat.sentiment),
    tags: opts.tags,
  };
  store(world).push(thread);
  return thread;
}

function appendBeat(thread: NarrativeThread, beat: ThreadBeat, world: World): void {
  if (
    beat.sourceEventId &&
    thread.beats.some((b) => b.sourceEventId === beat.sourceEventId)
  ) {
    return;
  }
  thread.beats.push(beat);
  thread.updatedDate = world.calendar.currentDate;
  thread.sentimentScore = Math.max(
    -100,
    Math.min(100, thread.sentimentScore + sentimentDelta(beat.sentiment))
  );
}

function resolveThread(
  thread: NarrativeThread,
  world: World,
  closingSummary?: string
): void {
  if (thread.status !== "active") return;
  thread.status = "resolved";
  thread.resolvedDate = world.calendar.currentDate;
  thread.updatedDate = world.calendar.currentDate;
  if (closingSummary) {
    appendBeat(
      thread,
      {
        date: world.calendar.currentDate,
        summary: closingSummary,
        sourceEventId: `resolve:${thread.id}`,
        sentiment: "Neutral",
      },
      world
    );
  }
}

export function fadeStaleThreads(world: World): number {
  let n = 0;
  for (const t of store(world)) {
    if (t.status !== "active") continue;
    if (t.beats.length < 2) {
      const opened = t.openedDate;
      if (opened < world.calendar.currentDate.slice(0, 7)) {
        t.status = "faded";
        t.updatedDate = world.calendar.currentDate;
        n++;
      }
    }
  }
  return n;
}

function onTransferCompleted(world: World, payload: any): void {
  const playerId = payload?.playerId as EntityId | undefined;
  if (!playerId) return;
  const player = world.players.get(playerId);
  if (!player) return;
  const toClub = payload.toClubId ? world.clubs.get(payload.toClubId) : null;
  let t = findActive(world, "transfer_saga", playerId);
  if (!t) {
    openThread(world, {
      kind: "transfer_saga",
      title: `${player.displayName} transfer`,
      playerId,
      clubIds: [payload.fromClubId, payload.toClubId].filter(Boolean),
      tags: ["transfer"],
      beat: {
        date: world.calendar.currentDate,
        summary: `${player.displayName} completes move${toClub ? ` to ${toClub.name}` : ""}.`,
        sourceEventId: `tx:${payload.transferId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Positive",
      },
    });
  } else {
    appendBeat(
      t,
      {
        date: world.calendar.currentDate,
        summary: `Deal done${toClub ? ` - ${toClub.name}` : ""}.`,
        sourceEventId: `tx:${payload.transferId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Positive",
      },
      world
    );
    resolveThread(t, world, "Transfer completed.");
  }
}

function onTransferOffer(world: World, payload: any): void {
  const playerId = payload?.playerId as EntityId | undefined;
  if (!playerId) return;
  const player = world.players.get(playerId);
  if (!player) return;
  let t = findActive(world, "transfer_saga", playerId);
  if (!t) {
    openThread(world, {
      kind: "transfer_saga",
      title: `${player.displayName} transfer saga`,
      playerId,
      clubIds: [payload.fromClubId, payload.toClubId].filter(Boolean),
      tags: ["transfer", "rumour"],
      beat: {
        date: world.calendar.currentDate,
        summary: `Offer lodged for ${player.displayName}.`,
        sourceEventId: `offer:${payload.offerId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Neutral",
      },
    });
  } else {
    appendBeat(
      t,
      {
        date: world.calendar.currentDate,
        summary: `Fresh offer activity around ${player.displayName}.`,
        sourceEventId: `offer:${payload.offerId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Neutral",
      },
      world
    );
  }
}

function onMatchFinished(world: World, payload: any): void {
  const matchId = payload?.matchId as EntityId | undefined;
  if (!matchId) return;
  const match = world.matches.get(matchId);
  if (!match) return;

  const userId = world.userPlayerId;
  if (!userId) return;
  const player = world.players.get(userId);
  if (!player) return;
  const st = match.playerStats.get(userId);
  if (!st || st.minutes < 1) return;

  const rating = Math.round((st.rating / 10) * 10) / 10;

  if (rating < 5.5 && st.minutes >= 30) {
    const crisis = findActive(world, "form_crisis", userId);
    if (!crisis) {
      openThread(world, {
        kind: "form_crisis",
        title: `${player.displayName} under scrutiny`,
        playerId: userId,
        clubIds: player.currentClubId ? [player.currentClubId] : [],
        tags: ["form"],
        beat: {
          date: match.date,
          summary: `Poor display (${rating.toFixed(1)}) - pressure builds.`,
          sourceEventId: `crisis:${match.id}:${userId}`,
          sentiment: "Negative",
        },
      });
    } else {
      appendBeat(
        crisis,
        {
          date: match.date,
          summary: `Another below-par rating (${rating.toFixed(1)}).`,
          sourceEventId: `crisis:${match.id}:${userId}`,
          sentiment: "Negative",
        },
        world
      );
    }
  } else if (rating >= 7.2) {
    const crisis = findActive(world, "form_crisis", userId);
    if (crisis) {
      appendBeat(
        crisis,
        {
          date: match.date,
          summary: `Response: ${rating.toFixed(1)} - pressure eases.`,
          sourceEventId: `crisis-end:${match.id}:${userId}`,
          sentiment: "Positive",
        },
        world
      );
      resolveThread(crisis, world, "Form crisis eased after strong display.");
    }

    let hot = findActive(world, "breakthrough", userId);
    if (!hot && rating >= 8) {
      openThread(world, {
        kind: "breakthrough",
        title: `${player.displayName} breakthrough`,
        playerId: userId,
        clubIds: player.currentClubId ? [player.currentClubId] : [],
        tags: ["form", "breakthrough"],
        beat: {
          date: match.date,
          summary: `Standout ${rating.toFixed(1)} performance.`,
          sourceEventId: `hot:${match.id}:${userId}`,
          sentiment: "VeryPositive",
        },
      });
    } else if (hot) {
      appendBeat(
        hot,
        {
          date: match.date,
          summary: `Another strong showing (${rating.toFixed(1)}).`,
          sourceEventId: `hot:${match.id}:${userId}`,
          sentiment: "Positive",
        },
        world
      );
    }
  }
}

function onInjury(world: World, payload: any): void {
  const playerId = payload?.playerId as EntityId | undefined;
  if (!playerId) return;
  const player = world.players.get(playerId);
  if (!player) return;
  if (!player.isUserControlled && player.reputation < 65) return;

  let t = findActive(world, "injury_comeback", playerId);
  if (!t) {
    openThread(world, {
      kind: "injury_comeback",
      title: `${player.displayName} injury battle`,
      playerId,
      clubIds: player.currentClubId ? [player.currentClubId] : [],
      tags: ["injury"],
      beat: {
        date: world.calendar.currentDate,
        summary: `${player.displayName} suffers an injury setback.`,
        sourceEventId: `injury:${payload.injuryId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Negative",
      },
    });
  } else {
    appendBeat(
      t,
      {
        date: world.calendar.currentDate,
        summary: `Further injury concern for ${player.displayName}.`,
        sourceEventId: `injury:${payload.injuryId ?? playerId}:${world.calendar.currentDate}`,
        sentiment: "Negative",
      },
      world
    );
  }
}

function onNewsGenerated(world: World, payload: any): void {
  if (payload?.type === "manager_sacked") {
    openThread(world, {
      kind: "manager_pressure",
      title: `${payload.clubName || "Club"} manager exit`,
      playerId: null,
      clubIds: payload.clubId ? [payload.clubId] : [],
      tags: ["manager", "sack"],
      beat: {
        date: world.calendar.currentDate,
        summary: `${payload.name || "Manager"} leaves ${payload.clubName || "the club"}.`,
        sourceEventId: `sack:${payload.managerId || payload.clubId}:${world.calendar.currentDate}`,
        sentiment: "Negative",
      },
    });
  }

  if (payload?.type === "award" || payload?.award) {
    const playerId = (payload.playerId || world.userPlayerId) as EntityId | undefined;
    if (!playerId) return;
    const player = world.players.get(playerId);
    if (!player) return;
    const label = String(payload.award || payload.label || "Award");
    const src = `award:${label}:${playerId}:${world.calendar.currentDate}`;

    let run = findActive(world, "award_run", playerId);
    if (!run) {
      openThread(world, {
        kind: "award_run",
        title: `${player.displayName} awards run`,
        playerId,
        clubIds: player.currentClubId ? [player.currentClubId] : [],
        tags: ["award"],
        beat: {
          date: world.calendar.currentDate,
          summary: `Recognised: ${label}.`,
          sourceEventId: src,
          sentiment: "VeryPositive",
        },
      });
    } else {
      let summary = `Another honour: ${label}.`;
      let sentiment: ThreadBeat["sentiment"] = "Positive";
      const totwCount = run.beats.filter((b) => /Week/i.test(b.summary)).length + 1;
      if (/Week/i.test(label) && totwCount >= 3) {
        summary = `${totwCount}x Team of the Week this season - media push Player of the Month talk.`;
        sentiment = "VeryPositive";
      } else if (/Month/i.test(label)) {
        summary = `Named ${label} - awards run peaks.`;
        sentiment = "VeryPositive";
      } else if (/Season|Golden|PlayerOfTheYear/i.test(label)) {
        summary = `Season-defining honour: ${label}.`;
        sentiment = "VeryPositive";
      }
      appendBeat(
        run,
        { date: world.calendar.currentDate, summary, sourceEventId: src, sentiment },
        world
      );
      if (/Season|Golden|PlayerOfTheYear/i.test(label) && run.beats.length >= 2) {
        resolveThread(run, world, `${player.displayName} sealed a major seasonal award.`);
      }
    }
  }
}

export function attachNarrativeEngine(world: World): void {
  world.events.on(Events.TRANSFER_COMPLETED, (p) => onTransferCompleted(world, p as any));
  world.events.on(Events.TRANSFER_OFFER, (p) => onTransferOffer(world, p as any));
  world.events.on(Events.MATCH_FINISHED, (p) => onMatchFinished(world, p as any));
  world.events.on(Events.INJURY_OCCURRED, (p) => onInjury(world, p as any));
  world.events.on(Events.NEWS_GENERATED, (p) => onNewsGenerated(world, p as any));
  world.events.on(Events.SEASON_ENDED, () => {
    fadeStaleThreads(world);
  });
}

export function snapshotThreads(
  world: World,
  opts?: { playerId?: EntityId; limit?: number }
): Array<{
  id: string;
  kind: ThreadKind;
  status: ThreadStatus;
  title: string;
  playerId: EntityId | null;
  playerName: string | null;
  sentimentScore: number;
  beatCount: number;
  latestBeat: string;
  openedDate: string;
  updatedDate: string;
  tags: string[];
  beats: ThreadBeat[];
}> {
  let list = [...store(world)].sort((a, b) => (a.updatedDate < b.updatedDate ? 1 : -1));
  if (opts?.playerId) {
    list = list.filter((t) => t.playerId === opts.playerId || t.beats.length > 0);
  }
  const limit = opts?.limit ?? 20;
  return list.slice(0, limit).map((t) => ({
    id: t.id,
    kind: t.kind,
    status: t.status,
    title: t.title,
    playerId: t.playerId,
    playerName: t.playerId
      ? world.players.get(t.playerId)?.displayName ?? null
      : null,
    sentimentScore: t.sentimentScore,
    beatCount: t.beats.length,
    latestBeat: t.beats[t.beats.length - 1]?.summary ?? "",
    openedDate: t.openedDate,
    updatedDate: t.updatedDate,
    tags: t.tags,
    beats: t.beats,
  }));
}
