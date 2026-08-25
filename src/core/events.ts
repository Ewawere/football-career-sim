/**
 * Lightweight typed event bus.
 */

export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler as EventHandler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<T>(event: string, payload: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

export const Events = {
  DAY_ADVANCED: "day_advanced",
  SEASON_STARTED: "season_started",
  SEASON_ENDED: "season_ended",

  MATCH_SCHEDULED: "match_scheduled",
  MATCH_STARTED: "match_started",
  MATCH_FINISHED: "match_finished",
  MATCH_COMPLETED: "match_finished", // alias used across systems
  GOAL_SCORED: "goal_scored",
  CARD_ISSUED: "card_issued",
  INJURY_OCCURRED: "injury_occurred",
  SUBSTITUTION: "substitution",

  PLAYER_SELECTED: "player_selected",
  PLAYER_BENCHED: "player_benched",
  PLAYER_FORM_CHANGED: "player_form_changed",

  TRANSFER_RUMOUR: "transfer_rumour",
  TRANSFER_OFFER: "transfer_offer",
  TRANSFER_COMPLETED: "transfer_completed",
  LOAN_COMPLETED: "loan_completed",
  CONTRACT_RENEWED: "contract_renewed",
  CONTRACT_EXPIRED: "contract_expired",

  MANAGER_HIRED: "manager_hired",
  MANAGER_SACKED: "manager_sacked",

  PLAYER_DEVELOPED: "player_developed",
  YOUTH_PROMOTED: "youth_promoted",
  PLAYER_RETIRED: "player_retired",

  HIGHLIGHT_RESOLVED: "highlight_resolved",
  PLAYABLE_MATCH_FINISHED: "playable_match_finished",

  NEWS_GENERATED: "news_generated",
  SOCIAL_POST: "social_post",
  AWARD_WON: "award_won",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
