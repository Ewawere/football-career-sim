/**
 * Generate clubs for career start — real names, simulated world.
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

export const ALL_LEAGUE_TEMPLATES: LeagueTemplate[] = [
  { id: "eng-1", name: "Premier League", nation: "England", tier: 1, clubCount: 20, baseRep: 78 },
  { id: "esp-1", name: "La Liga", nation: "Spain", tier: 1, clubCount: 18, baseRep: 76 },
  { id: "ger-1", name: "Bundesliga", nation: "Germany", tier: 1, clubCount: 18, baseRep: 75 },
  { id: "ita-1", name: "Serie A", nation: "Italy", tier: 1, clubCount: 18, baseRep: 74 },
  { id: "fra-1", name: "Ligue 1", nation: "France", tier: 1, clubCount: 16, baseRep: 72 },
];

interface ClubSeed {
  name: string;
  short: string;
  city: string;
  rep: number;
}

/** Real clubs the player will recognise */
const CLUBS_BY_NATION: Record<string, ClubSeed[]> = {
  England: [
    { name: "Manchester City", short: "MCI", city: "Manchester", rep: 92 },
    { name: "Arsenal", short: "ARS", city: "London", rep: 90 },
    { name: "Liverpool", short: "LIV", city: "Liverpool", rep: 91 },
    { name: "Manchester United", short: "MUN", city: "Manchester", rep: 88 },
    { name: "Chelsea", short: "CHE", city: "London", rep: 87 },
    { name: "Tottenham Hotspur", short: "TOT", city: "London", rep: 85 },
    { name: "Newcastle United", short: "NEW", city: "Newcastle", rep: 84 },
    { name: "Aston Villa", short: "AVL", city: "Birmingham", rep: 82 },
    { name: "Brighton", short: "BHA", city: "Brighton", rep: 78 },
    { name: "West Ham United", short: "WHU", city: "London", rep: 77 },
    { name: "Crystal Palace", short: "CRY", city: "London", rep: 74 },
    { name: "Fulham", short: "FUL", city: "London", rep: 73 },
    { name: "Brentford", short: "BRE", city: "London", rep: 72 },
    { name: "Wolves", short: "WOL", city: "Wolverhampton", rep: 71 },
    { name: "Everton", short: "EVE", city: "Liverpool", rep: 70 },
    { name: "Nottingham Forest", short: "NFO", city: "Nottingham", rep: 69 },
    { name: "Bournemouth", short: "BOU", city: "Bournemouth", rep: 68 },
    { name: "Leicester City", short: "LEI", city: "Leicester", rep: 72 },
    { name: "Leeds United", short: "LEE", city: "Leeds", rep: 71 },
    { name: "Southampton", short: "SOU", city: "Southampton", rep: 67 },
  ],
  Spain: [
    { name: "Real Madrid", short: "RMA", city: "Madrid", rep: 94 },
    { name: "Barcelona", short: "BAR", city: "Barcelona", rep: 92 },
    { name: "Atletico Madrid", short: "ATM", city: "Madrid", rep: 88 },
    { name: "Sevilla", short: "SEV", city: "Seville", rep: 82 },
    { name: "Real Sociedad", short: "RSO", city: "San Sebastian", rep: 80 },
    { name: "Villarreal", short: "VIL", city: "Villarreal", rep: 79 },
    { name: "Athletic Club", short: "ATH", city: "Bilbao", rep: 78 },
    { name: "Real Betis", short: "BET", city: "Seville", rep: 77 },
    { name: "Valencia", short: "VAL", city: "Valencia", rep: 76 },
    { name: "Osasuna", short: "OSA", city: "Pamplona", rep: 72 },
    { name: "Girona", short: "GIR", city: "Girona", rep: 74 },
    { name: "Celta Vigo", short: "CEL", city: "Vigo", rep: 71 },
    { name: "Getafe", short: "GET", city: "Getafe", rep: 69 },
    { name: "Mallorca", short: "MLL", city: "Palma", rep: 68 },
    { name: "Rayo Vallecano", short: "RAY", city: "Madrid", rep: 68 },
    { name: "Espanyol", short: "ESP", city: "Barcelona", rep: 67 },
    { name: "Alaves", short: "ALA", city: "Vitoria", rep: 65 },
    { name: "Las Palmas", short: "LPA", city: "Las Palmas", rep: 66 },
  ],
  Germany: [
    { name: "Bayern Munich", short: "BAY", city: "Munich", rep: 93 },
    { name: "Borussia Dortmund", short: "BVB", city: "Dortmund", rep: 88 },
    { name: "RB Leipzig", short: "RBL", city: "Leipzig", rep: 84 },
    { name: "Bayer Leverkusen", short: "B04", city: "Leverkusen", rep: 86 },
    { name: "Eintracht Frankfurt", short: "SGE", city: "Frankfurt", rep: 80 },
    { name: "Wolfsburg", short: "WOB", city: "Wolfsburg", rep: 76 },
    { name: "Borussia Monchengladbach", short: "BMG", city: "Monchengladbach", rep: 75 },
    { name: "Freiburg", short: "SCF", city: "Freiburg", rep: 74 },
    { name: "Hoffenheim", short: "TSG", city: "Sinsheim", rep: 73 },
    { name: "Stuttgart", short: "VFB", city: "Stuttgart", rep: 75 },
    { name: "Werder Bremen", short: "SVW", city: "Bremen", rep: 72 },
    { name: "Union Berlin", short: "FCU", city: "Berlin", rep: 73 },
    { name: "Augsburg", short: "FCA", city: "Augsburg", rep: 68 },
    { name: "Mainz", short: "M05", city: "Mainz", rep: 69 },
    { name: "Koln", short: "KOE", city: "Cologne", rep: 70 },
    { name: "Heidenheim", short: "FCH", city: "Heidenheim", rep: 66 },
    { name: "Bochum", short: "BOC", city: "Bochum", rep: 65 },
    { name: "Darmstadt", short: "DAR", city: "Darmstadt", rep: 63 },
  ],
  Italy: [
    { name: "Inter", short: "INT", city: "Milan", rep: 90 },
    { name: "AC Milan", short: "MIL", city: "Milan", rep: 88 },
    { name: "Juventus", short: "JUV", city: "Turin", rep: 87 },
    { name: "Napoli", short: "NAP", city: "Naples", rep: 86 },
    { name: "Roma", short: "ROM", city: "Rome", rep: 83 },
    { name: "Lazio", short: "LAZ", city: "Rome", rep: 81 },
    { name: "Atalanta", short: "ATA", city: "Bergamo", rep: 84 },
    { name: "Fiorentina", short: "FIO", city: "Florence", rep: 78 },
    { name: "Bologna", short: "BOL", city: "Bologna", rep: 76 },
    { name: "Torino", short: "TOR", city: "Turin", rep: 74 },
    { name: "Udinese", short: "UDI", city: "Udine", rep: 71 },
    { name: "Sassuolo", short: "SAS", city: "Sassuolo", rep: 70 },
    { name: "Monza", short: "MON", city: "Monza", rep: 68 },
    { name: "Genoa", short: "GEN", city: "Genoa", rep: 69 },
    { name: "Cagliari", short: "CAG", city: "Cagliari", rep: 67 },
    { name: "Lecce", short: "LEC", city: "Lecce", rep: 66 },
    { name: "Empoli", short: "EMP", city: "Empoli", rep: 65 },
    { name: "Verona", short: "VER", city: "Verona", rep: 66 },
  ],
  France: [
    { name: "Paris Saint-Germain", short: "PSG", city: "Paris", rep: 93 },
    { name: "Marseille", short: "OM", city: "Marseille", rep: 82 },
    { name: "Monaco", short: "ASM", city: "Monaco", rep: 81 },
    { name: "Lyon", short: "OL", city: "Lyon", rep: 80 },
    { name: "Lille", short: "LIL", city: "Lille", rep: 79 },
    { name: "Nice", short: "NIC", city: "Nice", rep: 76 },
    { name: "Rennes", short: "REN", city: "Rennes", rep: 75 },
    { name: "Lens", short: "RCL", city: "Lens", rep: 74 },
    { name: "Strasbourg", short: "RCSA", city: "Strasbourg", rep: 72 },
    { name: "Nantes", short: "FCN", city: "Nantes", rep: 70 },
    { name: "Reims", short: "REI", city: "Reims", rep: 69 },
    { name: "Montpellier", short: "MON", city: "Montpellier", rep: 68 },
    { name: "Toulouse", short: "TFC", city: "Toulouse", rep: 67 },
    { name: "Brest", short: "SB29", city: "Brest", rep: 71 },
    { name: "Auxerre", short: "AJA", city: "Auxerre", rep: 65 },
    { name: "Le Havre", short: "HAC", city: "Le Havre", rep: 64 },
  ],
};

const STADIUMS: Record<string, string> = {
  "Manchester City": "Etihad Stadium",
  Arsenal: "Emirates Stadium",
  Liverpool: "Anfield",
  "Manchester United": "Old Trafford",
  Chelsea: "Stamford Bridge",
  "Tottenham Hotspur": "Tottenham Hotspur Stadium",
  "Newcastle United": "St James' Park",
  "Aston Villa": "Villa Park",
  "Real Madrid": "Santiago Bernabeu",
  Barcelona: "Spotify Camp Nou",
  "Atletico Madrid": "Civitas Metropolitano",
  "Bayern Munich": "Allianz Arena",
  "Borussia Dortmund": "Signal Iduna Park",
  Inter: "San Siro",
  "AC Milan": "San Siro",
  Juventus: "Allianz Stadium",
  Napoli: "Diego Armando Maradona",
  "Paris Saint-Germain": "Parc des Princes",
  Marseille: "Orange Velodrome",
};

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
    stadiumName: STADIUMS[opts.name] || `${opts.city} Stadium`,
    stadiumCapacity: Math.round(15000 + rep * 1000),
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
  const seeds = CLUBS_BY_NATION.England!;
  return seeds.map((s) =>
    makeClub(rng, {
      name: s.name,
      short: s.short,
      city: s.city,
      nation: "England",
      rep: s.rep + rng.int(-1, 1),
      leagueId,
    })
  );
}

export function generateAllEuropeanClubs(rng: RNG): {
  clubs: Club[];
  leagueClubIds: Map<string, EntityId[]>;
} {
  const clubs: Club[] = [];
  const leagueClubIds = new Map<string, EntityId[]>();

  for (const tpl of ALL_LEAGUE_TEMPLATES) {
    const leagueId = nextId("lg") as EntityId;
    const seeds = CLUBS_BY_NATION[tpl.nation] || CLUBS_BY_NATION.England!;
    const take = seeds.slice(0, tpl.clubCount);
    const ids: EntityId[] = [];

    for (const s of take) {
      const club = makeClub(rng, {
        name: s.name,
        short: s.short,
        city: s.city,
        nation: tpl.nation,
        rep: s.rep + rng.int(-1, 1),
        leagueId,
      });
      clubs.push(club);
      ids.push(club.id);
    }

    leagueClubIds.set(`${tpl.nation}:${tpl.id}`, ids);
  }

  return { clubs, leagueClubIds };
}
