/**
 * Press conference — questions driven by real match performance & events.
 * Varied templates; not a fixed script every time.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { PressQuestion, PressResponseOption } from "../news/types.js";
import type { Player } from "../players/player.js";
import { getNewsFeed } from "../news/engine.js";

export function getPressQuestions(world: World): PressQuestion[] {
  return ((world as any).pressQuestions as PressQuestion[]) ?? [];
}

function pick<T>(rng: { pick: (a: T[]) => T }, arr: T[]): T {
  return rng.pick(arr);
}

function three(
  a: PressResponseOption,
  b: PressResponseOption,
  c: PressResponseOption
): PressResponseOption[] {
  return [a, b, c];
}

function matchPerfQuestions(
  world: World,
  player: Player,
  rating: number,
  goals: number,
  assists: number,
  minutes: number,
  result: "W" | "D" | "L" | null,
  matchId: string
): PressQuestion[] {
  const out: PressQuestion[] = [];
  const clubId = player.currentClubId ? [player.currentClubId] : [];
  const rng = world.rng;

  if (minutes <= 0) {
    const qs = [
      `You were unused again. How are you handling limited minutes?`,
      `Supporters noticed you stayed on the bench — any frustration?`,
      `What's your message after another match without playing time?`,
      `Is patience still the plan while you wait for a chance?`,
    ];
    out.push({
      id: nextId("pq"),
      topic: "PlayingTime",
      question: pick(rng, qs),
      relatedPlayerIds: [player.id],
      relatedClubIds: clubId,
      sourceEventId: `bench:${matchId}`,
      tone: "Hard",
      suggestedResponses: three(
        { id: "patient", label: "I'll keep working in training until the gaffer calls.", sentimentEffect: 2, managerTrustEffect: 5, reputationEffect: 0 },
        { id: "hungry", label: "I want to play — that's natural for any footballer.", sentimentEffect: -1, managerTrustEffect: -2, reputationEffect: 1 },
        { id: "team", label: "The squad comes first. My chance will come.", sentimentEffect: 3, managerTrustEffect: 4, reputationEffect: 0 }
      ),
    });
    return out;
  }

  if (rating >= 78 || goals >= 1) {
    const qs = [
      `That was a strong showing — how do you rate your own performance?`,
      goals >= 1 ? `You found the net today. Talk us through the goal.` : `You influenced the game heavily. What clicked for you?`,
      `Fans are buzzing after that display. How does it feel?`,
      result === "W" ? `Big contribution in a win — how important was that for confidence?` : `Even without the perfect team result, you stood out. Thoughts?`,
    ];
    out.push({
      id: nextId("pq"),
      topic: "Performance",
      question: pick(rng, qs),
      relatedPlayerIds: [player.id],
      relatedClubIds: clubId,
      sourceEventId: `perf_good:${matchId}:${rating}`,
      tone: "Soft",
      suggestedResponses: three(
        { id: "humble", label: "It was a team effort — the win matters more than my rating.", sentimentEffect: 5, managerTrustEffect: 5, reputationEffect: 1 },
        { id: "confident", label: "I knew if I got the chance I'd take it. More of that to come.", sentimentEffect: 4, managerTrustEffect: 2, reputationEffect: 3 },
        { id: "focused", label: "Happy with the performance, but we move on to the next one.", sentimentEffect: 3, managerTrustEffect: 4, reputationEffect: 1 }
      ),
    });
  }

  if (rating > 0 && rating < 55 && minutes >= 30) {
    const qs = [
      `That wasn't your best night. How do you assess the performance?`,
      `Tough outing personally — what went wrong from your side?`,
      `Critics will question that display. How do you respond?`,
      result === "L" ? `A difficult match and a difficult personal game. Where do you go from here?` : `You struggled to get into the match. Is it a confidence issue?`,
    ];
    out.push({
      id: nextId("pq"),
      topic: "Performance",
      question: pick(rng, qs),
      relatedPlayerIds: [player.id],
      relatedClubIds: clubId,
      sourceEventId: `perf_poor:${matchId}:${rating}`,
      tone: "Hard",
      suggestedResponses: three(
        { id: "own_it", label: "I wasn't good enough today. I'll work harder to put it right.", sentimentEffect: 2, managerTrustEffect: 4, reputationEffect: 0 },
        { id: "context", label: "It happens in football. The group still has my full focus.", sentimentEffect: 1, managerTrustEffect: 1, reputationEffect: 0 },
        { id: "deflect", label: "We all have to look at ourselves — it wasn't just one player.", sentimentEffect: -3, managerTrustEffect: -4, reputationEffect: -1 }
      ),
    });
  }

  if (rating >= 55 && rating < 78 && minutes >= 20 && goals === 0) {
    const qs = [
      `A steady shift — satisfied with your contribution?`,
      `Not flashy, but involved. How do you judge nights like this?`,
      `What will you take into the next match from this one?`,
      `Where do you feel you can still improve after today?`,
    ];
    out.push({
      id: nextId("pq"),
      topic: "Performance",
      question: pick(rng, qs),
      relatedPlayerIds: [player.id],
      relatedClubIds: clubId,
      sourceEventId: `perf_mid:${matchId}:${rating}`,
      tone: "Neutral",
      suggestedResponses: three(
        { id: "improve", label: "Solid base, but I know I can give more going forward.", sentimentEffect: 2, managerTrustEffect: 3, reputationEffect: 0 },
        { id: "job_done", label: "I did my job for the team. That's what mattered.", sentimentEffect: 2, managerTrustEffect: 2, reputationEffect: 0 },
        { id: "hungry", label: "I wanted a bigger impact — next match I'll push for it.", sentimentEffect: 1, managerTrustEffect: 1, reputationEffect: 1 }
      ),
    });
  }

  return out;
}

export function generatePressQuestions(world: World, playerId: EntityId): PressQuestion[] {
  const player = world.players.get(playerId);
  if (!player) return [];

  const questions: PressQuestion[] = [];
  const clubId = player.currentClubId ? [player.currentClubId] : [];
  const rng = world.rng;

  let latestMatchId = "none";
  let rating = 0;
  let goals = 0;
  let assists = 0;
  let minutes = 0;
  let result: "W" | "D" | "L" | null = null;

  const matches = [...world.matches.values()]
    .filter((m) => m.status === "Finished")
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const m of matches.slice(0, 12)) {
    const stats = m.playerStats?.get?.(playerId);
    if (!stats) continue;
    latestMatchId = m.id;
    rating = Math.round(stats.rating || 0);
    goals = stats.goals || 0;
    assists = stats.assists || 0;
    minutes = stats.minutes || 0;
    const isHome = m.home.clubId === player.currentClubId;
    const hs = m.homeScore ?? 0;
    const as = m.awayScore ?? 0;
    if (hs === as) result = "D";
    else if (isHome) result = hs > as ? "W" : "L";
    else result = as > hs ? "W" : "L";
    break;
  }

  questions.push(...matchPerfQuestions(world, player, rating, goals, assists, minutes, result, latestMatchId));

  if (player.state.form < 42 && rng.chance(0.55)) {
    questions.push({
      id: nextId("pq"),
      topic: "Form",
      question: pick(rng, [
        `Your form has dipped recently. How are you dealing with that?`,
        `Results and ratings haven't gone your way — what's the plan?`,
        `Do you feel the pressure of needing a big performance soon?`,
      ]),
      relatedPlayerIds: [player.id],
      relatedClubIds: clubId,
      sourceEventId: `form:${player.id}:${world.calendar.currentDate}`,
      tone: "Hard",
      suggestedResponses: three(
        { id: "work", label: "I know the standards. Training will put it right.", sentimentEffect: 2, managerTrustEffect: 4, reputationEffect: 0 },
        { id: "belief", label: "I trust my quality — one moment can change everything.", sentimentEffect: 1, managerTrustEffect: 1, reputationEffect: 1 },
        { id: "blame", label: "A few decisions haven't gone for me. Football is like that.", sentimentEffect: -2, managerTrustEffect: -3, reputationEffect: -1 }
      ),
    });
  }

  for (const q of questions) {
    if (!q.suggestedResponses || q.suggestedResponses.length < 3) {
      q.suggestedResponses = three(
        { id: "a", label: "I'll keep focusing on my performances.", sentimentEffect: 2, managerTrustEffect: 2, reputationEffect: 0 },
        { id: "b", label: "The team is what matters most right now.", sentimentEffect: 3, managerTrustEffect: 3, reputationEffect: 0 },
        { id: "c", label: "No further comment — we move on to the next match.", sentimentEffect: 0, managerTrustEffect: 0, reputationEffect: 0 }
      );
    }
  }

  const seen = new Set<string>();
  const unique = questions.filter((q) => {
    const key = q.topic + ":" + q.sourceEventId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const shuffled = [...unique];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const selected = shuffled.slice(0, 3);
  (world as any).pressQuestions = selected;
  return selected;
}

export function refreshPressAfterMatchday(world: World): PressQuestion[] {
  if (!world.userPlayerId) return [];
  return generatePressQuestions(world, world.userPlayerId);
}
