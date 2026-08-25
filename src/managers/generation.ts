/**
 * Generate AI and user managers.
 */

import { nextId } from "../core/id.js";
import type { RNG } from "../core/rng.js";
import type { World } from "../world/world.js";
import type { Manager, ManagerAttributes } from "./types.js";
import type { TacticalIdentity, TransferPhilosophy } from "../clubs/club.js";

const FIRST = ["Antonio", "Marco", "Erik", "Jose", "Thomas", "Pep", "Jurgen", "Carlo", "Diego", "Roberto"];
const LAST = ["Silva", "Rossi", "Schmidt", "Martin", "Weber", "Lopez", "Costa", "Andersen", "Novak", "Brown"];

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "4-1-4-1"];
const IDENTITIES: TacticalIdentity[] = ["Possession", "CounterAttack", "HighPress", "Direct", "Balanced", "Defensive"];
const PHILOSOPHIES: TransferPhilosophy[] = ["DevelopAndSell", "BuyStars", "Balanced", "YouthFocused", "BargainHunt", "FinanciallyCautious"];

function clamp(n: number): number {
  return Math.max(20, Math.min(95, Math.round(n)));
}

export function generateManager(
  rng: RNG,
  opts: { reputation?: number; age?: number; isUser?: boolean } = {}
): Manager {
  const rep = opts.reputation ?? rng.int(35, 75);
  const age = opts.age ?? rng.int(35, 58);
  const first = rng.pick(FIRST);
  const last = rng.pick(LAST);

  const attributes: ManagerAttributes = {
    attacking: clamp(rng.normal(50, 15)),
    defending: clamp(rng.normal(50, 15)),
    manManagement: clamp(rng.normal(50 + rep * 0.15, 12)),
    tacticalKnowledge: clamp(rng.normal(45 + rep * 0.2, 12)),
    youthDevelopment: clamp(rng.normal(50, 18)),
    negotiation: clamp(rng.normal(50, 15)),
    discipline: clamp(rng.normal(55, 12)),
    mediaHandling: clamp(rng.normal(50, 18)),
  };

  return {
    id: nextId("mgr"),
    firstName: first,
    lastName: last,
    displayName: `${first} ${last}`,
    nationality: rng.pick(["England", "Spain", "Italy", "Germany", "France", "Portugal", "Netherlands"]),
    age,
    reputation: rep,
    attributes,
    preferredFormation: rng.pick(FORMATIONS),
    preferredIdentity: rng.pick(IDENTITIES),
    preferredPhilosophy: rng.pick(PHILOSOPHIES),
    status: "Unemployed",
    currentClubId: null,
    contractEnd: null,
    wageWeekly: Math.round(2000 + rep * 400),
    careerWins: 0,
    careerDraws: 0,
    careerLosses: 0,
    trophies: 0,
    isUserControlled: opts.isUser ?? false,
    boardConfidence: 55,
    jobHistory: [],
  };
}

export function createUserManager(
  world: World,
  opts: { firstName: string; lastName: string; nationality?: string; age?: number }
): Manager {
  const m = generateManager(world.rng, { reputation: 45, age: opts.age ?? 38, isUser: true });
  m.firstName = opts.firstName;
  m.lastName = opts.lastName;
  m.displayName = `${opts.firstName} ${opts.lastName}`;
  if (opts.nationality) m.nationality = opts.nationality;
  m.attributes.manManagement = 55;
  m.attributes.tacticalKnowledge = 52;
  m.attributes.mediaHandling = 50;
  storeManager(world, m);
  world.userManagerId = m.id;
  return m;
}

export function storeManager(world: World, manager: Manager): void {
  if (!(world as any).managers) (world as any).managers = new Map();
  (world as any).managers.set(manager.id, manager);
}

export function getManagers(world: World): Map<string, Manager> {
  if (!(world as any).managers) (world as any).managers = new Map();
  return (world as any).managers;
}

export function getManager(world: World, id: string): Manager | null {
  return getManagers(world).get(id) ?? null;
}

export function assignManagersToClubs(world: World): void {
  for (const club of world.clubs.values()) {
    if (club.managerId) continue;
    const m = generateManager(world.rng, {
      reputation: Math.round(club.reputation * 0.85 + world.rng.int(-5, 10)),
    });
    m.status = "Employed";
    m.currentClubId = club.id;
    m.boardConfidence = 60;
    m.contractEnd = `${parseInt(world.calendar.currentDate.slice(0, 4), 10) + 2}-06-30`;
    m.jobHistory.push({
      clubId: club.id,
      clubName: club.name,
      startDate: world.calendar.currentDate,
      endDate: null,
      reason: "Active",
      matches: 0,
      wins: 0,
      trophies: 0,
    });
    club.tacticalIdentity = m.preferredIdentity;
    club.transferPhilosophy = m.preferredPhilosophy;
    club.managerId = m.id;
    storeManager(world, m);
  }
}
