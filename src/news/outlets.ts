/**
 * Fictional media outlets — original names only.
 */

import type { MediaOutlet } from "./types.js";

export const MEDIA_OUTLETS: MediaOutlet[] = [
  {
    id: "gfn",
    name: "Global Football Network",
    reliability: 88,
    transferReliability: 70,
    matchCoverage: 95,
    region: "Global",
    style: "Factual",
  },
  {
    id: "fdaily",
    name: "Football Daily",
    reliability: 72,
    transferReliability: 65,
    matchCoverage: 85,
    region: "England",
    style: "Sensational",
  },
  {
    id: "tfj",
    name: "The Football Journal",
    reliability: 92,
    transferReliability: 80,
    matchCoverage: 80,
    region: "Europe",
    style: "Analytical",
  },
  {
    id: "efr",
    name: "European Football Report",
    reliability: 85,
    transferReliability: 75,
    matchCoverage: 75,
    region: "Europe",
    style: "Factual",
  },
  {
    id: "cinsider",
    name: "Club Insider",
    reliability: 60,
    transferReliability: 55,
    matchCoverage: 40,
    region: "Local",
    style: "ClubFriendly",
  },
  {
    id: "tcentral",
    name: "Transfer Central",
    reliability: 68,
    transferReliability: 90,
    matchCoverage: 30,
    region: "Global",
    style: "Sensational",
  },
  {
    id: "pitchwire",
    name: "PitchWire",
    reliability: 45,
    transferReliability: 35,
    matchCoverage: 50,
    region: "Global",
    style: "Sensational",
  },
];

export function pickOutlet(
  preferTransfer = false,
  minReliability = 0,
  seed = 0
): MediaOutlet {
  const pool = MEDIA_OUTLETS.filter((o) =>
    preferTransfer ? o.transferReliability >= minReliability : o.reliability >= minReliability
  );
  if (!pool.length) return MEDIA_OUTLETS[0]!;
  const sorted = [...pool].sort(
    (a, b) =>
      (preferTransfer ? b.transferReliability : b.reliability) -
      (preferTransfer ? a.transferReliability : a.reliability)
  );
  const idx = Math.min(sorted.length - 1, Math.abs(seed) % Math.min(3, sorted.length));
  return sorted[idx]!;
}

export function outletById(id: string): MediaOutlet {
  return MEDIA_OUTLETS.find((o) => o.id === id) ?? MEDIA_OUTLETS[0]!;
}
