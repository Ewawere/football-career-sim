/**
 * Generate fictional league clubs (original names).
 * Sized for mobile/Railway cold start.
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

export interface LeagueTemplate {
  id: string;
  name: string;
  nation: string;
  tier: number;
  clubCount: number;
  baseRep: number;
}

/** Lean league set so Start Career finishes quickly on Railway */
export const ALL_LEAGUE_TEMPLATES: LeagueTemplate[] = [
  { id: "eng-1", name: "English Premier Division", nation: "England", tier: 1, clubCount: 16, baseRep: 78 },
  { id: "esp-1", name: "Spanish Primera", nation: "Spain", tier: 1, clubCount: 14, baseRep: 76 },
  { id: "ger-1", name: "German Bundesliga", nation: "Germany", tier: 1, clubCount: 14, baseRep: 75 },
  { id: "ita-1", name: "Italian Serie A", nation: "Italy", tier: 1, clubCount: 14, baseRep: 74 },
  { id: "fra-1", name: "French Ligue 1", nation: "France", tier: 1, clubCount: 12, baseRep: 72 },
];

const NAME_POOLS: Record<string, string[]> = {
  England: [
    "Northbridge", "Royal Crescent", "Harbour", "Ironforge", "Westmere", "Ashford", "Kingswell",
    "Riverdale", "Stonehaven", "Elmwood", "Blackridge", "Southcliff", "Fairview", "Millbrook",
    "Oakenshield", "Redhaven", "Whitecrest", "Greenfield", "Portside", "Highland",
  ],
  Spain: [
    "Valle Real", "Costa Azul", "Sierra Blanca", "Puerto Dorado", "Atletico Norte", "Unido Sur",
    "Castilla FC", "Marea Alta", "Ribera", "Monteverde", "Bahia", "Alameda", "Torrevieja", "Cartagena",
  ],
  Germany: [
    "Nordstern", "Rheinwacht", "Bergwerk", "Hanse", "Waldstadt", "Stahlwerk", "Elbblick",
    "Sudpark", "Kaiserwald", "Rotfels", "Blauwasser", "Grenzland", "Dornfeld", "Lichtberg",
  ],
  Italy: [
    "San Marco", "Viola", "Adriatico", "Toscana", "Lombardia", "Calcio Nord", "Azzurri",
    "Montebianco", "Porto Vecchio", "Reggia", "Etna", "Laguna", "Cittadella", "Fortore",
  ],
  France: [
    "Nordique", "Ocean", "Loire", "Rhone", "Bastion", "Lumiere", "Garonne", "Alpes",
    "Cote", "Plaine", "Citadelle", "Vallee", "Port Franc", "Rouge",
  ],
};

const SUFFIXES = ["FC", "United", "Athletic", "City", "Town", "Rovers", "Club", "Sporting"];

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

function makeClub(
  rng: RNG,
  opts: {
    name: string;
    short: string;
    city: string;
    nation: string;
    rep: number;
    leagueId: EntityId;
  }
): Club {
  const rep = Math.max(35, Math.min(95, Math.round(opts.rep)));
  return {
    id: nextId("clb"),
    name: opts.name,
    shortName: opts.short,
    nation: opts.nation,
    city: opts.city,
    reputation: rep,
    leagueId: opts.leagueId,
    stadiumName: `${opts.city} Stadium`,
    stadiumCapacity: Math.round(12000 + rep * 900),
    finances: createDefaultFinances(rep),
    transferPhilosophy: rng.pick(PHILOSOPHIES),
    tacticalIdentity: rng.pick(IDENTITIES),
    youthFocus: rng.int(30, 85),
    riskTolerance: rng.int(25, 80),
    managerId: null,
    squadPlayerIds: [],
    academyPlayerIds: [],
    objectives: createDefaultObjectives(rep),
    trainingFacilities: Math.round(1 + rep / 25),
    youthFacilities: Math.round(1 + rep / 30),
    foundedYear: 1880 + rng.int(0, 90),
  };
}

export function generateEnglishTopLeague(rng: RNG, leagueId: EntityId): Club[] {
  const pool = NAME_POOLS.England!;
  const clubs: Club[] = [];
  for (let i = 0; i < 16; i++) {
    const city = pool[i % pool.length]!;
    const suf = SUFFIXES[i % SUFFIXES.length]!;
    const name = i % 3 === 0 ? `${city} ${suf}` : `${city} FC`;
    const rep = 88 - i * 2 + rng.int(-2, 2);
    clubs.push(
      makeClub(rng, {
        name,
        short: city.slice(0, 3).toUpperCase(),
        city,
        nation: "England",
        rep,
        leagueId,
      })
    );
  }
  return clubs;
}

export function generateAllEuropeanClubs(rng: RNG): {
  clubs: Club[];
  leagueClubIds: Map<string, EntityId[]>;
} {
  const clubs: Club[] = [];
  const leagueClubIds = new Map<string, EntityId[]>();

  for (const tpl of ALL_LEAGUE_TEMPLATES) {
    const leagueId = nextId("lg") as EntityId;
    const pool = NAME_POOLS[tpl.nation] || NAME_POOLS.England!;
    const ids: EntityId[] = [];

    for (let i = 0; i < tpl.clubCount; i++) {
      const city = pool[i % pool.length]!;
      const suf = SUFFIXES[(i + tpl.tier) % SUFFIXES.length]!;
      const name = `${city} ${i % 2 === 0 ? "FC" : suf}`;
      const spread = (tpl.clubCount - 1 - i) * (12 / Math.max(1, tpl.clubCount - 1));
      const rep = tpl.baseRep + spread + rng.int(-2, 2);
      const club = makeClub(rng, {
        name,
        short: city.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "FC",
        city,
        nation: tpl.nation,
        rep,
        leagueId,
      });
      clubs.push(club);
      ids.push(club.id);
    }

    leagueClubIds.set(`${tpl.nation}:${tpl.id}`, ids);
  }

  return { clubs, leagueClubIds };
}
