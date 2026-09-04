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

export interface LeagueTemplate {
  id: string;
  name: string;
  nation: string;
  tier: number;
  clubCount: number;
  baseRep: number;
}

/** Top leagues used to seed the world */
export const ALL_LEAGUE_TEMPLATES: LeagueTemplate[] = [
  { id: "eng-1", name: "English Premier Division", nation: "England", tier: 1, clubCount: 20, baseRep: 78 },
  { id: "esp-1", name: "Spanish Primera", nation: "Spain", tier: 1, clubCount: 20, baseRep: 76 },
  { id: "ger-1", name: "German Bundesliga", nation: "Germany", tier: 1, clubCount: 18, baseRep: 75 },
  { id: "ita-1", name: "Italian Serie A", nation: "Italy", tier: 1, clubCount: 20, baseRep: 74 },
  { id: "fra-1", name: "French Ligue 1", nation: "France", tier: 1, clubCount: 18, baseRep: 72 },
  { id: "por-1", name: "Portuguese Liga", nation: "Portugal", tier: 1, clubCount: 18, baseRep: 68 },
  { id: "ned-1", name: "Dutch Eredivisie", nation: "Netherlands", tier: 1, clubCount: 18, baseRep: 66 },
  { id: "bel-1", name: "Belgian Pro League", nation: "Belgium", tier: 1, clubCount: 16, baseRep: 62 },
  { id: "sco-1", name: "Scottish Premiership", nation: "Scotland", tier: 1, clubCount: 12, baseRep: 60 },
  { id: "tur-1", name: "Turkish Super Lig", nation: "Turkey", tier: 1, clubCount: 18, baseRep: 64 },
];

const NAME_POOLS: Record<string, string[]> = {
  England: [
    "Northbridge", "Royal Crescent", "Harbour", "Ironforge", "Westmere", "Ashford", "Kingswell",
    "Riverdale", "Stonehaven", "Elmwood", "Blackridge", "Southcliff", "Fairview", "Millbrook",
    "Oakenshield", "Redhaven", "Whitecrest", "Greenfield", "Portside", "Highland", "Eastgate",
    "Crownhill", "Silvermere", "Dunwick",
  ],
  Spain: [
    "Valle Real", "Costa Azul", "Sierra Blanca", "Puerto Dorado", "Atlético Norte", "Unido Sur",
    "Castilla FC", "Marea Alta", "Ribera", "Monteverde", "Bahía", "Alameda", "Torrevieja",
    "Cartagena", "Olivo", "Llanos", "Solana", "Río Grande", "Alcázar", "Miraflores",
  ],
  Germany: [
    "Nordstern", "Rheinwacht", "Bergwerk", "Hanse", "Waldstadt", "Stahlwerk", "Elbblick",
    "Südpark", "Kaiserwald", "Rotfels", "Blauwasser", "Grenzland", "Dornfeld", "Lichtberg",
    "Osthafen", "Westtor", "Mittelstadt", "Nordpark",
  ],
  Italy: [
    "San Marco", "Viola", "Adriatico", "Toscana", "Lombardia", "Calcio Nord", "Azzurri",
    "Montebianco", "Porto Vecchio", "Reggia", "Etna", "Laguna", "Cittadella", "Fortore",
    "Aurora", "Stella", "Vesuvio", "Piazza", "Arena", "Castello",
  ],
  France: [
    "Nordique", "Océan", "Loire", "Rhône", "Bastion", "Lumière", "Garonne", "Alpes",
    "Côte", "Plaine", "Citadelle", "Vallée", "Port Franc", "Rouge", "Bleu Marine",
    "Estuaire", "Sommet", "Marais",
  ],
  Portugal: [
    "Atlântico", "Tejo", "Douro", "Lisboa Norte", "Costa Verde", "Serra", "Marítima",
    "Bragança", "Algarve", "Minho", "Beira", "Porto Sul", "Estrela", "Ribatejo",
    "Cascais", "Faro", "Coimbra", "Setúbal",
  ],
  Netherlands: [
    "Oranje", "Noordzee", "Polder", "Damstad", "Haven", "Tulpen", "Dijk", "Gracht",
    "Zuidpark", "Windmolen", "Ijssel", "Maas", "Kanaal", "Strand", "Binnenhof",
    "Veld", "Kust", "Bos",
  ],
  Belgium: [
    "Bruxelles", "Flandre", "Wallonie", "Schelde", "Ardennes", "Meuse", "Anvers",
    "Liège", "Gand", "Charleroi", "Ostende", "Namur", "Mons", "Bruges", "Louvain", "Hasselt",
  ],
  Scotland: [
    "Highland", "Clyde", "Forth", "Glenside", "Caledonia", "Moray", "Tayside",
    "Lothian", "Ayrshire", "Borders", "Hebrides", "Granite",
  ],
  Turkey: [
    "Anadolu", "Boğaz", "Karadeniz", "Ege", "Ankara", "İstanbul", "Antalya",
    "Trakya", "Akdeniz", "Doğu", "Batı", "Marmara", "Kapadokya", "Sivas",
    "Bursa", "Izmir", "Konya", "Trabzon",
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
  const rep = Math.max(35, Math.min(95, opts.rep));
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
  for (let i = 0; i < 20; i++) {
    const city = pool[i % pool.length]!;
    const suf = SUFFIXES[i % SUFFIXES.length]!;
    const name = i % 3 === 0 ? `${city} ${suf}` : `${city} FC`;
    const rep = 88 - i * 1.8 + rng.int(-2, 2);
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

/**
 * Full European club set for bootstrap.
 */
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
      const name =
        i === 0 && tpl.baseRep >= 74
          ? `${city} ${suf}`
          : `${city} ${i % 2 === 0 ? "FC" : suf}`;
      // Spread reputation within league
      const rep =
        tpl.baseRep +
        (tpl.clubCount - 1 - i) * (12 / Math.max(1, tpl.clubCount - 1)) +
        rng.int(-2, 2);
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

    leagueClubIds.set(tpl.nation + ":" + tpl.id, ids);
  }

  return { clubs, leagueClubIds };
}
