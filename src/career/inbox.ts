/**
 * Event-driven career inbox - hybrid FM mail + FC clarity.
 * Messages are generated from world state / recent events, not static copy.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";
import { getPlayerPlayStyles, getPlayStyleDef } from "../players/playstyles.js";

export interface InboxMessage {
  id: string;
  from: "Manager" | "Agent" | "Board" | "Media" | "Medical" | "System";
  subject: string;
  body: string;
  date: string;
  priority: "low" | "normal" | "high";
  read: boolean;
  tags: string[];
}

function ensureInbox(world: World): InboxMessage[] {
  if (!(world as any).careerInbox) (world as any).careerInbox = [] as InboxMessage[];
  return (world as any).careerInbox as InboxMessage[];
}

function pushUnique(world: World, key: string, msg: Omit<InboxMessage, "id" | "read">) {
  const box = ensureInbox(world);
  const keys: string[] = (world as any).inboxKeys ?? [];
  if (keys.includes(key)) return;
  keys.push(key);
  if (keys.length > 80) keys.shift();
  (world as any).inboxKeys = keys;
  box.unshift({
    ...msg,
    id: nextId("mail"),
    read: false,
  });
  if (box.length > 40) box.length = 40;
}

export function syncInboxFromState(world: World): void {
  const pid = world.userPlayerId;
  if (!pid) return;
  const player = world.players.get(pid);
  if (!player) return;
  const date = world.calendar.currentDate;
  const season = world.calendar.currentSeason;
  const trust = Math.round(player.state.managerTrust ?? 50);
  const form = Math.round(player.state.form ?? 50);
  const fitness = Math.round(player.state.fitness ?? 80);
  const apps = player.state.appearancesThisSeason ?? 0;
  const club = player.currentClubId ? world.clubs.get(player.currentClubId) : null;
  const clubName = club?.name ?? "the club";

  if (trust >= 75) {
    pushUnique(world, `mgr-high-${season}-${Math.floor(apps / 5)}`, {
      from: "Manager",
      subject: "Keep going",
      body: `You're earning the shirt at ${clubName}. Trust is high (${trust}). Stay sharp in training and available - I need reliable performers when the fixtures tighten.`,
      date,
      priority: "normal",
      tags: ["manager", "trust"],
    });
  } else if (trust < 40) {
    pushUnique(world, `mgr-low-${season}-${Math.floor(apps / 3)}`, {
      from: "Manager",
      subject: "Standards",
      body: `Selection is not a right. Trust is at ${trust}. Improve form, hit training hard, and deliver when you get minutes. The door closes quickly at this level.`,
      date,
      priority: "high",
      tags: ["manager", "warning"],
    });
  } else if (apps === 0) {
    pushUnique(world, `mgr-wait-${season}`, {
      from: "Manager",
      subject: "Patience and preparation",
      body: `You're in the group at ${clubName}. Minutes will come when fitness, form and the tactical plan line up. Be ready when the call comes.`,
      date,
      priority: "normal",
      tags: ["manager"],
    });
  }

  if (form >= 75 && apps >= 3) {
    pushUnique(world, `mgr-form-${season}-${Math.floor(apps / 4)}`, {
      from: "Manager",
      subject: "In form",
      body: `Your recent form (${form}) is being noticed. Keep the level and the shirt stays yours more often.`,
      date,
      priority: "normal",
      tags: ["manager", "form"],
    });
  } else if (form < 35 && apps >= 2) {
    pushUnique(world, `mgr-cold-${season}-${Math.floor(apps / 3)}`, {
      from: "Manager",
      subject: "Need a response",
      body: `Form is cold (${form}). Training standards and match focus have to rise. I select on evidence.`,
      date,
      priority: "high",
      tags: ["manager", "form"],
    });
  }

  if (apps >= 10 && trust >= 55) {
    pushUnique(world, `agent-base-${season}`, {
      from: "Agent",
      subject: "Career path",
      body: `I'm tracking your minutes and reputation. We push for a new deal or loan only if the path at ${clubName} dies. For now: train, stay fit, stack performances.`,
      date,
      priority: "low",
      tags: ["agent"],
    });
  }

  if (fitness < 55) {
    pushUnique(world, `med-fit-${date}`, {
      from: "Medical",
      subject: "Load management",
      body: `Fitness is sitting at ${fitness}. We're flagging reduced intensity in training and monitoring for soft-tissue risk. Communicate any niggles early.`,
      date,
      priority: "high",
      tags: ["medical"],
    });
  }

  const ps = getPlayerPlayStyles(player);
  if (ps.unlocked.length === 0) {
    pushUnique(world, `sys-ps-${season}`, {
      from: "System",
      subject: "PlayStyles",
      body: `Train specific attributes to unlock PlayStyles. Skill points can accelerate a near unlock. Equipped styles influence match contribution - build a unique profile, don't stack everything.`,
      date,
      priority: "low",
      tags: ["system", "playstyles"],
    });
  } else if (ps.equipped.length) {
    const names = ps.equipped
      .map((id) => getPlayStyleDef(id)?.name ?? id)
      .join(", ");
    pushUnique(world, `sys-eq-${season}-${ps.equipped.join(",")}`, {
      from: "System",
      subject: "Styles equipped",
      body: `Active PlayStyles: ${names}. You'll see them reflected in match ratings and post-match notes when they contribute.`,
      date,
      priority: "low",
      tags: ["system", "playstyles"],
    });
  }

  if (player.state.goalsThisSeason >= 5) {
    pushUnique(world, `media-goals-${season}-5`, {
      from: "Media",
      subject: "Press interest",
      body: `Your goal tally is generating local coverage. Expect more questions after matches - answers can shift reputation and trust. Stay measured.`,
      date,
      priority: "normal",
      tags: ["media"],
    });
  }
}

export function snapshotInbox(world: World, limit = 12) {
  syncInboxFromState(world);
  const box = ensureInbox(world);
  return {
    unread: box.filter((m) => !m.read).length,
    messages: box.slice(0, limit),
  };
}

export function markInboxRead(world: World, id?: string) {
  const box = ensureInbox(world);
  if (!id) {
    for (const m of box) m.read = true;
    return;
  }
  const m = box.find((x) => x.id === id);
  if (m) m.read = true;
}
