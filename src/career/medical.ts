/**
 * Medical centre — active injury timeline + recovery phases (FM medical).
 */

import type { World } from "../world/world.js";
import { getActiveInjury, getComebackPenalty } from "../injuries/engine.js";
import type { Injury } from "../injuries/types.js";

function phaseFor(injury: Injury): { id: string; label: string; detail: string } {
  const rem = injury.recoveryDaysRemaining;
  const total = Math.max(1, injury.recoveryDaysTotal);
  const done = total - rem;
  const pct = done / total;
  if (!injury.active) {
    return {
      id: "cleared",
      label: "Cleared",
      detail: "Medically available - residual rust may remain",
    };
  }
  if (pct < 0.25) {
    return {
      id: "acute",
      label: "Acute care",
      detail: "Immobilisation / protection phase - no training",
    };
  }
  if (pct < 0.55) {
    return {
      id: "rehab",
      label: "Rehab",
      detail: "Structured physio - gym only, no contact",
    };
  }
  if (pct < 0.85) {
    return {
      id: "return_train",
      label: "Return to train",
      detail: "Non-contact team sessions; minutes carefully managed",
    };
  }
  return {
    id: "return_play",
    label: "Return to play",
    detail: "Match consideration if fitness allows - risk of recurrence",
  };
}

function timelineSteps(injury: Injury) {
  const total = Math.max(1, injury.recoveryDaysTotal);
  const rem = injury.recoveryDaysRemaining;
  const elapsed = total - rem;
  const steps = [
    { id: "acute", label: "Acute", at: 0 },
    { id: "rehab", label: "Rehab", at: 0.25 },
    { id: "rtt", label: "Train", at: 0.55 },
    { id: "rtp", label: "Play", at: 0.85 },
    { id: "clear", label: "Clear", at: 1 },
  ];
  const progress = injury.active ? elapsed / total : 1;
  return steps.map((s) => ({
    ...s,
    done: progress >= s.at,
    current:
      injury.active &&
      ((s.id === "acute" && progress < 0.25) ||
        (s.id === "rehab" && progress >= 0.25 && progress < 0.55) ||
        (s.id === "rtt" && progress >= 0.55 && progress < 0.85) ||
        (s.id === "rtp" && progress >= 0.85 && progress < 1) ||
        (s.id === "clear" && progress >= 1)),
  }));
}

export function getMedicalCentre(world: World) {
  const pid = world.userPlayerId;
  if (!pid) return null;
  const player = world.players.get(pid);
  if (!player) return null;

  const active = getActiveInjury(world, pid);
  const history: Injury[] = [];
  for (const iid of player.injuryIds || []) {
    const inj = world.injuries.get(iid);
    if (inj) history.push(inj);
  }
  history.sort((a, b) => b.occurredDate.localeCompare(a.occurredDate));

  const comePen = getComebackPenalty(world, pid);
  const fitness = Math.round(player.state.fitness ?? 80);

  let statusLabel = "Fully available";
  let statusTone: "ok" | "warn" | "bad" = "ok";
  if (active) {
    statusLabel = `Out - ${active.name}`;
    statusTone = "bad";
  } else if (comePen > 0.25) {
    statusLabel = "Available with restrictions";
    statusTone = "warn";
  } else if (fitness < 60) {
    statusLabel = "Fatigue / load concern";
    statusTone = "warn";
  }

  return {
    playerName: player.displayName,
    statusLabel,
    statusTone,
    fitness,
    comebackPenalty: Math.round(comePen * 100),
    recurrenceRisk: Math.round(Math.min(0.32, comePen * 0.16 + 0.05) * 100),
    active: active
      ? {
          id: active.id,
          name: active.name,
          severity: active.severity,
          bodyArea: active.bodyArea,
          occurredDate: active.occurredDate,
          daysRemaining: active.recoveryDaysRemaining,
          daysTotal: active.recoveryDaysTotal,
          phase: phaseFor(active),
          timeline: timelineSteps(active),
          forcesWithdrawal: active.forcesWithdrawal,
        }
      : null,
    history: history.slice(0, 8).map((h) => ({
      id: h.id,
      name: h.name,
      severity: h.severity,
      bodyArea: h.bodyArea,
      occurredDate: h.occurredDate,
      returnedDate: h.returnedDate,
      daysTotal: h.recoveryDaysTotal,
      active: h.active,
    })),
    notes: [
      active
        ? `Expected availability in ~${active.recoveryDaysRemaining} day(s) if recovery stays on track.`
        : comePen > 0.1
          ? `Residual rust ~${Math.round(comePen * 100)}% - recurrence risk elevated if minutes/training are heavy.`
          : "No active medical flags.",
      fitness < 55 ? "Fitness is low - soft tissue risk elevated in training." : null,
    ].filter(Boolean),
  };
}
