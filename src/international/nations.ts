/**
 * Nation strength table — original ranking for selection competitiveness.
 */

export const NATION_STRENGTH: Record<string, number> = {
  Brazil: 92,
  France: 90,
  England: 88,
  Spain: 88,
  Germany: 87,
  Argentina: 91,
  Portugal: 86,
  Netherlands: 85,
  Italy: 84,
  Belgium: 83,
  Croatia: 80,
  Uruguay: 79,
  USA: 78,
  Mexico: 77,
  Japan: 76,
  Nigeria: 75,
  Senegal: 74,
  Morocco: 78,
  Denmark: 79,
  Switzerland: 77,
  Poland: 76,
  Sweden: 74,
  Scotland: 72,
  Wales: 70,
  Ireland: 68,
  Turkey: 73,
  Serbia: 74,
  Austria: 72,
  Norway: 71,
  Colombia: 76,
  Chile: 73,
  Ecuador: 70,
  Ghana: 72,
  "Ivory Coast": 73,
  Egypt: 71,
  Algeria: 72,
  "South Korea": 75,
  Australia: 70,
  Canada: 68,
  Cameroon: 70,
};

export function nationStrength(nation: string): number {
  return NATION_STRENGTH[nation] ?? 65;
}

export const CORE_NATIONS = Object.keys(NATION_STRENGTH);
