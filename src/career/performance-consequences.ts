/**
 * Consequences when a player underperforms: bench, transfer list, loan pressure.
 */

import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { Events } from "../core/events.js";
import { getDepthChart } from "./selection.js";

export interface PlayerConsequence {
  playerId: EntityId;
  clubId: EntityId;
  action:
    | "Warned"
    | "Benched"
    | "TransferListed"
    | "LoanListed"
    | "ForcedExitPressure"
    | "Restored";
  reason: string;
}

function isTransferListed(p: Player): boolean {
  return !!(p.state as any).transferListed;
}

function setTransferListed(p: Player, listed: boolean): void {
  (p.state as any).transferListed = listed;
}

function getPoorStreak(p: Player): number {
  return (p.state as any).poorFormStreak ?? 0;
}

function setPoorStreak(p: Player, n: number): void {
  (p.state as any).poorFormStreak = Math.max(0, n);
}

export function processUnderperformingPlayers(world: World): PlayerConsequence[] {
  const results: PlayerConsequence[] = [];

  for (const club of world.clubs.values()) {
    if (!club.squadPlayerIds.length) continue;

    for (const pid of club.squadPlayerIds) {
      const player = world.players.get(pid);
      if (!player || player.retired || !player.contract) continue;
      if (player.state.appearancesThisSeason < 3 && player.state.ratingCount < 3) continue;

      const avg =
        player.state.ratingCount > 0
          ? player.state.averageRatingThisSeason
          : player.state.form;
      const form = player.state.form;
      const trust = player.state.managerTrust;
      const depth = getDepthChart(world, club.id, player.primaryPosition, 0.5);
      const entry = depth.find((d) => d.playerId === pid);
      const rank = entry?.rank ?? 99;

      let health =
        form * 0.35 +
        (avg / 100) * 40 +
        trust * 0.25 +
        (rank <= 2 ? 10 : rank <= 4 ? 4 : -5);

      if (player.age >= 32) health += 3;
      if (player.age <= 20) health += 2;

      const wasListed = isTransferListed(player);

      if (health >= 55) {
        setPoorStreak(player, 0);
        if (wasListed && health >= 62) {
          setTransferListed(player, false);
          (player.state as any).loanListed = false;
          results.push({
            playerId: pid,
            clubId: club.id,
            action: "Restored",
            reason: "Form recovered - removed from transfer list",
          });
        }
        continue;
      }

      const streak = getPoorStreak(player) + 1;
      setPoorStreak(player, streak);

      if (health < 28 && streak >= 4) {
        setTransferListed(player, true);
        (player.state as any).openToTransfer = true;
        player.state.morale = Math.max(15, player.state.morale - 12);
        results.push({
          playerId: pid,
          clubId: club.id,
          action: "ForcedExitPressure",
          reason: "Sustained underperformance - club wants them moved on",
        });
        world.events.emit(Events.NEWS_GENERATED, {
          type: "player_ousted",
          playerId: pid,
          clubId: club.id,
          name: player.displayName,
          clubName: club.name,
          severity: "forced",
        });
      } else if (health < 36 && streak >= 3) {
        if (!wasListed) {
          setTransferListed(player, true);
          player.state.morale = Math.max(20, player.state.morale - 8);
          results.push({
            playerId: pid,
            clubId: club.id,
            action: "TransferListed",
            reason: "Dropped below club standards - placed on transfer list",
          });
          world.events.emit(Events.NEWS_GENERATED, {
            type: "player_ousted",
            playerId: pid,
            clubId: club.id,
            name: player.displayName,
            clubName: club.name,
            severity: "listed",
          });
        }
      } else if (health < 42 && streak >= 2 && player.age <= 23 && rank >= 4) {
        if (!(player.state as any).loanListed) {
          (player.state as any).loanListed = true;
          results.push({
            playerId: pid,
            clubId: club.id,
            action: "LoanListed",
            reason: "Limited minutes and poor form - loan move sought",
          });
          world.events.emit(Events.NEWS_GENERATED, {
            type: "player_ousted",
            playerId: pid,
            clubId: club.id,
            name: player.displayName,
            clubName: club.name,
            severity: "loan",
          });
        }
      } else if (health < 48 && rank >= 3) {
        player.state.managerTrust = Math.max(15, player.state.managerTrust - 3);
        player.state.morale = Math.max(25, player.state.morale - 2);
        if (streak >= 2) {
          results.push({
            playerId: pid,
            clubId: club.id,
            action: "Benched",
            reason: "Manager loses patience - reduced role",
          });
        }
      } else if (health < 52 && streak === 1) {
        results.push({
          playerId: pid,
          clubId: club.id,
          action: "Warned",
          reason: "Below expected level - warned to improve",
        });
      }
    }
  }

  return results;
}

export function isPlayerOnTransferList(player: Player): boolean {
  return isTransferListed(player);
}

export function isPlayerLoanListed(player: Player): boolean {
  return !!(player.state as any).loanListed;
}
