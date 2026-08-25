/**
 * Player agent — advice on contracts, loans, playing time.
 */

import { nextId } from "../core/id.js";
import type { EntityId } from "../core/types.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { estimateMarketValue } from "../contracts/valuation.js";
import { getDepthChart } from "../career/selection.js";
import { completeLoan } from "../transfers/loans.js";
import { activeSquadCount, SQUAD_HARD_CAP } from "../transfers/squad-rules.js";

export interface Agent {
  id: EntityId;
  name: string;
  aggressiveness: number; // 0–100
  loyaltyBias: number;
  clientIds: EntityId[];
}

export interface AgentAdvice {
  summary: string;
  actions: { id: string; label: string; detail: string }[];
}

function agentMap(world: World): Map<string, Agent> {
  if (!(world as any).agents) (world as any).agents = new Map();
  return (world as any).agents;
}

export function createAgent(world: World, name?: string): Agent {
  const agent: Agent = {
    id: nextId("agt"),
    name: name ?? `Agent ${world.rng.int(100, 999)}`,
    aggressiveness: world.rng.int(30, 80),
    loyaltyBias: world.rng.int(20, 70),
    clientIds: [],
  };
  agentMap(world).set(agent.id, agent);
  return agent;
}

export function assignAgent(world: World, playerId: EntityId): Agent {
  const agents = agentMap(world);
  let agent = [...agents.values()].find((a) => a.clientIds.length < 8);
  if (!agent) agent = createAgent(world);
  if (!agent.clientIds.includes(playerId)) agent.clientIds.push(playerId);
  return agent;
}

export function getPlayerAgent(world: World, playerId: EntityId): Agent | null {
  for (const a of agentMap(world).values()) {
    if (a.clientIds.includes(playerId)) return a;
  }
  return null;
}

export function evaluateClientSituation(world: World, player: Player): AgentAdvice {
  const actions: AgentAdvice["actions"] = [];
  const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  const value = estimateMarketValue(world, player);

  let summary = `${player.displayName}: market ~€${(value / 1e6).toFixed(1)}m.`;

  if (club) {
    const chart = getDepthChart(world, club.id, player.primaryPosition);
    const entry = chart.find((e) => e.playerId === player.id);
    if (entry && entry.rank >= 3 && player.age <= 22) {
      summary += " Playing time is limited.";
      actions.push({
        id: "loan",
        label: "Seek loan",
        detail: "A loan could secure regular minutes for development.",
      });
    }
    if (entry && entry.rank === 1 && player.state.managerTrust >= 70) {
      actions.push({
        id: "renew",
        label: "Push contract renewal",
        detail: "Strong position to improve wages and years.",
      });
    }
    if (player.ovr + 5 >= club.reputation && player.age <= 26) {
      actions.push({
        id: "transfer",
        label: "Explore bigger clubs",
        detail: "Ability may exceed current club level.",
      });
    }
  } else {
    summary += " Currently a free agent.";
    actions.push({
      id: "sign",
      label: "Find a club",
      detail: "Target clubs that need your position.",
    });
  }

  if (!actions.length) {
    actions.push({
      id: "patience",
      label: "Stay the course",
      detail: "Keep training and performing; situation is stable.",
    });
  }

  return { summary, actions };
}

export function agentArrangeLoan(world: World, player: Player): boolean {
  if (!player.currentClubId) return false;
  const parent = world.clubs.get(player.currentClubId);
  if (!parent) return false;
  const dest = [...world.clubs.values()]
    .filter(
      (c) =>
        c.id !== parent.id &&
        c.reputation < parent.reputation &&
        activeSquadCount(world, c) < SQUAD_HARD_CAP - 1
    )
    .sort((a, b) => b.reputation - a.reputation)[0];
  if (!dest) return false;
  return !!completeLoan(world, player, parent, dest, "Rotation");
}
