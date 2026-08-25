/**
 * Generate fictional league clubs (original names).
 */

import { nextId } from "../core/id.js";
import type { RNG } from "../core/rng.js";
import type { EntityId } from "../core/types.js";
import {
  createDefaultFinances,
  createDefaultObjectives,
  type Club,
  type TacticalIdentity,
  type TransferPhilosophy,
} from "./club.js";

const CLUB_TEMPLATES: { name: string; short: string; city: string; rep: number }[] = [
  { name: "Northbridge FC", short: "NOR", city: "Northbridge", rep: 88 },
  { name: "Royal Crescent", short: "RC", city: "Crescent", rep: 86 },
  { name: "Harbour United", short: "HAR", city: "Harbour", rep: 84 },
  { name: "Ironforge Athletic", short: "IRO", city: "Ironforge", rep: 82 },
  { name: "Westmere Rovers", short: "WES", city: "Westmere", rep: 80 },
  { name: "Ashford City", short: "ASH", city: "Ashford", rep: 78 },
  { name: "Kingswell Town", short: "KIN", city: "Kingswell", rep: 76 },
  { name: "Riverdale FC", short: "RIV", city: "Riverdale", rep: 74 },
  { name: "Stonehaven", short: "STO", city: "Stonehaven", rep: 72 },
  { name: "Elmwood Rangers", short: "ELM", city: "Elmwood", rep: 70 },
  { name: "Blackridge United", short: "BLA", city: "Blackridge", rep: 68 },
  { name: "Southcliff", short: "SOU", city: "Southcliff", rep: 66 },
  { name: "Fairview Athletic", short: "FAI", city: "Fairview", rep: 64 },
  { name: "Millbrook FC", short: "MIL", city: "Millbrook", rep: 62 },
  { name: "Oakenshield", short: "OAK", city: "Oakenshield", rep: 60 },
  { name: "Redhaven", short: "RED", city: "Redhaven", rep: 58 },
  { name: "Whitecrest", short: "WHI", city: "Whitecrest", rep: 56 },
  { name: "Greenfield Town", short: "GRE", city: "Greenfield", rep: 54 },
  { name: "Portside FC", short: "POR", city: "Portside", rep: 52 },
  { name: "Highland FC", short: "HIG", city: "Highland", rep: 50 },
];

const IDENTITIES: TacticalIdentity[] = [
  "Possession",
  "CounterAttack",
  "HighPress",
  "Direct",
  "Balanced",
  "Defensive",
];

const PHILOSOPHIES: TransferPhilosophy[] = [
  "DevelopAndSell",
  "BuyStars",
  "Balanced",
  "YouthFocused",
  "BargainHunt",
  "FinanciallyCautious",
];

export function generateEnglishTopLeague(rng: RNG, leagueId: EntityId): Club[] {
  const clubs: Club[] = [];
  for (const t of CLUB_TEMPLATES) {
    const rep = Math.max(40, Math.min(95, t.rep + rng.int(-2, 2)));
    const club: Club = {
      id: nextId("clb"),
      name: t.name,
      shortName: t.short,
      nation: "England",
      city: t.city,
      reputation: rep,
      leagueId,
      stadiumName: `${t.city} Stadium`,
      stadiumCapacity: Math.round(15000 + rep * 800),
      finances: createDefaultFinances(rep),
      transferPhilosophy: rng.pick(PHILOSOPHIES),
      tacticalIdentity: rng.pick(IDENTITIES),
      youthFocus: rng.int(30, 80),
      riskTolerance: rng.int(25, 75),
      managerId: null,
      squadPlayerIds: [],
      academyPlayerIds: [],
      objectives: createDefaultObjectives(rep),
      trainingFacilities: Math.round(1 + rep / 25),
      youthFacilities: Math.round(1 + rep / 30),
      foundedYear: 1880 + rng.int(0, 80),
    };
    clubs.push(club);
  }
  return clubs;
}
