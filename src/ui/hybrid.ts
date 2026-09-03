/**
 * Hybrid FM+FC extras layered onto the base session API.
 */

import type { GameSession } from "./api.js";
import { getHub } from "./api.js";
import { snapshotObjectives, claimObjective } from "../career/objectives.js";
import { snapshotInbox, markInboxRead, syncInboxFromState } from "../career/inbox.js";
import { getPreMatchBriefing, getPostMatchPack } from "../career/briefing.js";
import { getMatchdaySquadView } from "../career/matchday-squad.js";
import { getMedicalCentre } from "../career/medical.js";
import { openNegotiation, respondNegotiation, snapshotNegotiation } from "../career/negotiation.js";
import { snapshotRoles, setPlayerRole } from "../career/player-roles.js";
import type { PlayerRoleId, MatchInstructionId } from "../career/player-roles.js";
import { snapshotThreads } from "../narrative/engine.js";
import {
  acceptJobOffer,
  declineJobOffer,
  snapshotJobOffers,
  generateJobOffers,
} from "../managers/career.js";
import { spendSkillPointTowardPlayStyle, getSkillPoints } from "../players/skill-points.js";
import { getPlayerPlayStyles } from "../players/playstyles.js";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getHybridHub(session: GameSession) {
  const base = getHub(session) as any;
  const w = session.world;
  safe(() => syncInboxFromState(w), undefined);

  const briefing = safe(() => getPreMatchBriefing(w), null);
  const postMatch = safe(() => getPostMatchPack(w), null);

  const player = base.player
    ? {
        ...base.player,
        name: base.player.name || base.player.displayName,
        trust: base.player.trust ?? base.player.managerTrust,
        club: base.player.club || base.player.clubName,
      }
    : base.player;

  return {
    ...base,
    player,
    objectives: safe(() => snapshotObjectives(w), null),
    inbox: safe(() => snapshotInbox(w, 10), { unread: 0, messages: [] }),
    briefing,
    preMatch: briefing,
    postMatch,
    matchdaySquad: safe(() => getMatchdaySquadView(w), null),
    medical: safe(() => getMedicalCentre(w), null),
    negotiation: safe(() => snapshotNegotiation(w), null),
    roles: safe(() => snapshotRoles(w), null),
    jobOffers: safe(() => snapshotJobOffers(w), []),
  };
}

export function claimObjectiveApi(session: GameSession, objectiveId: string) {
  return claimObjective(session.world, objectiveId);
}

export function openNegotiationApi(session: GameSession) {
  openNegotiation(session.world);
  return { negotiation: snapshotNegotiation(session.world), hub: getHybridHub(session) };
}

export function respondNegotiationApi(
  session: GameSession,
  action: "accept" | "reject" | "counter" | "mediate"
) {
  respondNegotiation(session.world, action);
  return { negotiation: snapshotNegotiation(session.world), hub: getHybridHub(session) };
}

export function setRoleApi(
  session: GameSession,
  role?: PlayerRoleId,
  instruction?: MatchInstructionId
) {
  setPlayerRole(session.world, role, instruction);
  return { roles: snapshotRoles(session.world), hub: getHybridHub(session) };
}

export function markInboxApi(session: GameSession, id?: string) {
  markInboxRead(session.world, id);
  return { ok: true, inbox: snapshotInbox(session.world) };
}

export function getNarrativeThreads(
  session: GameSession,
  opts?: { playerId?: string; limit?: number }
) {
  return safe(
    () =>
      snapshotThreads(session.world, {
        playerId: opts?.playerId as any,
        limit: opts?.limit ?? 20,
      }),
    []
  );
}

export function spendPlayStylePoint(session: GameSession, playStyleId: string) {
  const pid = session.world.userPlayerId;
  if (!pid) return { ok: false, message: "No player" };
  const player = session.world.players.get(pid);
  if (!player) return { ok: false, message: "No player" };
  try {
    const result = spendSkillPointTowardPlayStyle(session.world, player, playStyleId as any);
    return {
      ok: true,
      result,
      skillPoints: getSkillPoints(player),
      styles: getPlayerPlayStyles(player),
    };
  } catch (e: any) {
    return { ok: false, message: String(e?.message ?? e) };
  }
}

export function listJobOffersApi(session: GameSession) {
  try {
    generateJobOffers(session.world);
  } catch {
    /* ignore */
  }
  return { offers: snapshotJobOffers(session.world) };
}

export function takeJobApi(session: GameSession, offerId: string) {
  const ok = acceptJobOffer(session.world, offerId);
  return { ok, hub: getHybridHub(session), offers: snapshotJobOffers(session.world) };
}

export function declineJobApi(session: GameSession, offerId?: string) {
  const ok = declineJobOffer(session.world, offerId);
  return { ok, hub: getHybridHub(session), offers: snapshotJobOffers(session.world) };
}

export function refreshJobOffersApi(session: GameSession) {
  const offers = generateJobOffers(session.world);
  return {
    count: offers.length,
    offers: snapshotJobOffers(session.world),
    hub: getHybridHub(session),
  };
}
