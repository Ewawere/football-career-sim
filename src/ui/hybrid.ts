/**
 * Hybrid FM+FC extras layered onto the base session API.
 */

import type { GameSession } from "./api.js";
import { getHub } from "./api.js";
import { snapshotObjectives, claimObjective } from "../career/objectives.js";
import { snapshotInbox, markInboxRead, syncInboxFromState } from "../career/inbox.js";
import { getPreMatchBriefing, getPostMatchPack } from "../career/briefing.js";
import { getTeamComparison } from "../career/team-comparison.js";
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
import {
  generateScoutInterest,
  snapshotTransferOffers,
  acceptTransferOffer,
  declineTransferOffer,
} from "../career/transfer-offers.js";

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
  const teamComparison = safe(() => getTeamComparison(w), null);

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
    teamComparison,
    matchdaySquad: safe(() => getMatchdaySquadView(w), null),
    medical: safe(() => getMedicalCentre(w), null),
    negotiation: safe(() => snapshotNegotiation(w), null),
    roles: safe(() => snapshotRoles(w), null),
    jobOffers: safe(() => snapshotJobOffers(w), []),
    transferOffers: safe(() => snapshotTransferOffers(w), []),
  };
}

export function getTeamComparisonApi(session: GameSession) {
  return { comparison: getTeamComparison(session.world) };
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
  return { inbox: snapshotInbox(session.world, 10) };
}

export function takeJobApi(session: GameSession, offerId: string) {
  const ok = acceptJobOffer(session.world, offerId);
  return { ok, hub: getHybridHub(session), offers: snapshotJobOffers(session.world) };
}

export function declineJobApi(session: GameSession, offerId?: string) {
  const ok = declineJobOffer(session.world, offerId);
  return { ok, hub: getHybridHub(session), offers: snapshotJobOffers(session.world) };
}

export function refreshJobsApi(session: GameSession) {
  const offers = generateJobOffers(session.world);
  return {
    count: offers.length,
    offers: snapshotJobOffers(session.world),
    hub: getHybridHub(session),
  };
}

export function spendPlayStyleApi(session: GameSession, playStyleId: string) {
  const pid = session.world.userPlayerId;
  if (!pid) return { ok: false };
  try {
    spendSkillPointTowardPlayStyle(session.world, pid, playStyleId);
    return { ok: true, hub: getHybridHub(session) };
  } catch (e: any) {
    return { ok: false, message: String(e?.message || e), hub: getHybridHub(session) };
  }
}

export function refreshScoutInterestApi(session: GameSession) {
  generateScoutInterest(session.world, true);
  return { offers: snapshotTransferOffers(session.world), hub: getHybridHub(session) };
}

export function acceptTransferOfferApi(session: GameSession, offerId: string) {
  const res = acceptTransferOffer(session.world, offerId);
  return { ...res, offers: snapshotTransferOffers(session.world), hub: getHybridHub(session) };
}

export function declineTransferOfferApi(session: GameSession, offerId: string) {
  const res = declineTransferOffer(session.world, offerId);
  return { ...res, offers: snapshotTransferOffers(session.world), hub: getHybridHub(session) };
}

export function tickScoutInterest(session: GameSession) {
  try {
    generateScoutInterest(session.world, false);
  } catch {}
}
