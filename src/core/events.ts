/**
 * Simple typed event bus for simulation systems.
 */

export type EventHandler = (payload: unknown) => void;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event);
    if (!list) return;
    this.handlers.set(
      event,
      list.filter((h) => h !== handler)
    );
  }

  emit(event: string, payload?: unknown): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const h of list) h(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const Events = {
  MATCH_COMPLETED: "match_completed",
  GOAL_SCORED: "goal_scored",
  PLAYER_INJURED: "player_injured",
  PLAYER_RETURNED: "player_returned",
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
