/**
 * Player attribute model.
 * Categories: Technical, Physical, Mental.
 * All values intended 1–99.
 */

import type { AttributeValue } from "../core/types.js";

export interface TechnicalAttributes {
  finishing: AttributeValue;
  passing: AttributeValue;
  crossing: AttributeValue;
  dribbling: AttributeValue;
  ballControl: AttributeValue;
  longShots: AttributeValue;
  heading: AttributeValue;
  setPieces: AttributeValue;
  tackling: AttributeValue;
  marking: AttributeValue;
}

export interface PhysicalAttributes {
  pace: AttributeValue;
  acceleration: AttributeValue;
  strength: AttributeValue;
  stamina: AttributeValue;
  agility: AttributeValue;
  jumping: AttributeValue;
  balance: AttributeValue;
}

export interface MentalAttributes {
  vision: AttributeValue;
  composure: AttributeValue;
  decisions: AttributeValue;
  positioning: AttributeValue;
  reactions: AttributeValue;
  workRate: AttributeValue;
  anticipation: AttributeValue;
  aggression: AttributeValue;
  leadership: AttributeValue;
}

export interface PlayerAttributes {
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
}

export function averageAttributes(attrs: PlayerAttributes): number {
  const all: number[] = [
    ...Object.values(attrs.technical),
    ...Object.values(attrs.physical),
    ...Object.values(attrs.mental),
  ];
  return all.reduce((a, b) => a + b, 0) / all.length;
}

export function calculateOVR(attrs: PlayerAttributes, primary: string): number {
  const t = attrs.technical;
  const p = attrs.physical;
  const m = attrs.mental;

  let score: number;
  switch (primary) {
    case "GK":
      score =
        (m.positioning * 1.4 +
          m.reactions * 1.4 +
          m.composure * 1.2 +
          p.agility * 1.1 +
          p.jumping * 1.0 +
          m.decisions * 1.0) /
        7.1;
      break;
    case "CB":
      score =
        (t.marking * 1.3 +
          t.tackling * 1.3 +
          t.heading * 1.2 +
          p.strength * 1.2 +
          p.jumping * 1.1 +
          m.positioning * 1.2 +
          m.anticipation * 1.1 +
          m.decisions * 1.0) /
        9.4;
      break;
    case "LB":
    case "RB":
    case "LWB":
    case "RWB":
      score =
        (p.pace * 1.2 +
          p.stamina * 1.1 +
          t.crossing * 1.2 +
          t.tackling * 1.1 +
          t.passing * 1.0 +
          m.workRate * 1.1 +
          m.positioning * 1.0) /
        7.7;
      break;
    case "CDM":
      score =
        (t.tackling * 1.2 +
          t.marking * 1.1 +
          t.passing * 1.2 +
          m.positioning * 1.2 +
          m.decisions * 1.1 +
          m.workRate * 1.1 +
          p.stamina * 1.0 +
          p.strength * 1.0) /
        8.9;
      break;
    case "CM":
      score =
        (t.passing * 1.3 +
          t.ballControl * 1.1 +
          m.vision * 1.2 +
          m.decisions * 1.2 +
          m.workRate * 1.1 +
          p.stamina * 1.1 +
          t.tackling * 0.9) /
        7.9;
      break;
    case "CAM":
      score =
        (t.passing * 1.2 +
          t.dribbling * 1.2 +
          t.ballControl * 1.1 +
          m.vision * 1.3 +
          m.composure * 1.1 +
          t.finishing * 1.0 +
          t.longShots * 1.0) /
        7.9;
      break;
    case "LM":
    case "RM":
    case "LW":
    case "RW":
      score =
        (p.pace * 1.3 +
          t.dribbling * 1.2 +
          t.crossing * 1.1 +
          t.passing * 1.0 +
          t.finishing * 1.0 +
          p.acceleration * 1.1 +
          m.workRate * 0.9) /
        7.6;
      break;
    case "CF":
    case "ST":
    default:
      score =
        (t.finishing * 1.4 +
          t.heading * 1.1 +
          p.pace * 1.1 +
          p.strength * 1.0 +
          m.composure * 1.2 +
          m.positioning * 1.2 +
          t.ballControl * 1.0 +
          t.longShots * 0.9) /
        8.9;
      break;
  }

  const avg = averageAttributes(attrs);
  const blended = score * 0.85 + avg * 0.15;
  return Math.max(1, Math.min(99, Math.round(blended)));
}

export function createBaseAttributes(base: number = 50): PlayerAttributes {
  const v = () => Math.max(1, Math.min(99, Math.round(base + (Math.random() - 0.5) * 10)));
  return {
    technical: {
      finishing: v(),
      passing: v(),
      crossing: v(),
      dribbling: v(),
      ballControl: v(),
      longShots: v(),
      heading: v(),
      setPieces: v(),
      tackling: v(),
      marking: v(),
    },
    physical: {
      pace: v(),
      acceleration: v(),
      strength: v(),
      stamina: v(),
      agility: v(),
      jumping: v(),
      balance: v(),
    },
    mental: {
      vision: v(),
      composure: v(),
      decisions: v(),
      positioning: v(),
      reactions: v(),
      workRate: v(),
      anticipation: v(),
      aggression: v(),
      leadership: v(),
    },
  };
}
