/**
 * Interactive press conference - answer questions, affect trust/reputation/fans.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { PressQuestion, PressResponseOption } from "../news/types.js";
import { generatePressQuestions } from "./press.js";
import { getPersonality, adjustRelationship } from "../relationships/engine.js";
import { applyFanEvent } from "../social/fans.js";
import { Events } from "../core/events.js";

export function aiSelectResponse(
  world: World,
  playerId: EntityId,
  q: PressQuestion
): PressResponseOption {
  const player = world.players.get(playerId);
  const personality = player ? getPersonality(world, playerId) : null;
  const options = q.suggestedResponses;
  if (!options.length) {
    return { id: "default", text: "No comment.", sentiment: "Neutral" as any };
  }
  // Prefer measured answers unless aggressive personality
  const prefer =
    personality && (personality as any).temperament === "HotHead"
      ? options.find((o) => /honest|direct|fire/i.test(o.text)) ?? options[0]
      : options.find((o) => /team|work|grateful/i.test(o.text)) ?? options[0];
  return prefer!;
}

export function applyPressAnswer(
  world: World,
  playerId: EntityId,
  question: PressQuestion,
  response: PressResponseOption
): { trustDelta: number; repDelta: number; message: string } {
  const player = world.players.get(playerId);
  if (!player) return { trustDelta: 0, repDelta: 0, message: "No player" };

  let trustDelta = 0;
  let repDelta = 0;
  const text = (response.text || "").toLowerCase();

  if (/team|grateful|work hard|focus/.test(text)) {
    trustDelta = 2;
    repDelta = 1;
  } else if (/deserve|more minutes|not fair/.test(text)) {
    trustDelta = -3;
    repDelta = 2;
  } else if (/no comment|next question/.test(text)) {
    trustDelta = 0;
    repDelta = -1;
  } else if (/best|quality|ambition/.test(text)) {
    trustDelta = 1;
    repDelta = 2;
  } else {
    trustDelta = 1;
  }

  player.state.managerTrust = Math.max(
    0,
    Math.min(100, (player.state.managerTrust ?? 50) + trustDelta)
  );
  player.reputation = Math.max(0, Math.min(100, player.reputation + repDelta));

  if (player.currentClubId) {
    try {
      applyFanEvent(world, player.currentClubId, trustDelta >= 0 ? "positive_press" : "negative_press");
    } catch {
      /* optional */
    }
  }

  try {
    adjustRelationship(world, playerId, "manager", trustDelta);
  } catch {
    /* optional */
  }

  world.events.emit(Events.NEWS_GENERATED, {
    type: "press_answer",
    playerId,
    question: question.prompt ?? (question as any).text,
    answer: response.text,
  });

  const message =
    trustDelta > 0
      ? "Measured answer - trust ticks up."
      : trustDelta < 0
        ? "That will not go down well with the manager."
        : "Neutral coverage.";

  return { trustDelta, repDelta, message };
}

export function ensurePressQuestions(world: World, playerId: EntityId): PressQuestion[] {
  const existing = (world as any).pressQuestions as PressQuestion[] | undefined;
  if (existing?.length) return existing;
  return generatePressQuestions(world, playerId);
}
