/**
 * Career life layer — dreams, identity, weekly beats, post-match reactions.
 * Sits on top of the simulation engine.
 */

import { nextId } from "../core/id.js";
import type { World } from "../world/world.js";
import type { Player } from "../players/player.js";

export type CareerDreamId =
  | "legend"
  | "journeyman"
  | "one_club"
  | "international"
  | "superstar"
  | "academy_kid"
  | "comeback";

export type PlayerIdentityId =
  | "wonderkid"
  | "street"
  | "academy_tech"
  | "physical"
  | "late_bloomer"
  | "tactical"
  | "prodigy";

export interface CareerDreamDef {
  id: CareerDreamId;
  title: string;
  emoji: string;
  blurb: string;
  trackHint: string;
}

export interface PlayerIdentityDef {
  id: PlayerIdentityId;
  title: string;
  emoji: string;
  blurb: string;
  attrBias: Partial<Record<string, number>>;
}

export const CAREER_DREAMS: CareerDreamDef[] = [
  {
    id: "legend",
    title: "The Legend",
    emoji: "🏆",
    blurb: "Win the Champions League. Be remembered.",
    trackHint: "European nights. Finals. Immortality.",
  },
  {
    id: "journeyman",
    title: "The Journeyman",
    emoji: "🌍",
    blurb: "Play in five different countries.",
    trackHint: "New leagues. New languages. No comfort zone.",
  },
  {
    id: "one_club",
    title: "The One-Club Man",
    emoji: "🦅",
    blurb: "Spend your entire career at one club.",
    trackHint: "Loyalty. Local hero. Never leave.",
  },
  {
    id: "international",
    title: "The International",
    emoji: "🇳🇬",
    blurb: "Become a national-team regular.",
    trackHint: "Caps. Tournaments. Represent your country.",
  },
  {
    id: "superstar",
    title: "The Superstar",
    emoji: "💰",
    blurb: "Become one of the highest-paid players in the world.",
    trackHint: "Wages. Spotlight. Brand.",
  },
  {
    id: "academy_kid",
    title: "The Academy Kid",
    emoji: "🌱",
    blurb: "Rise through one academy and become a club legend.",
    trackHint: "Youth team → first team → captain.",
  },
  {
    id: "comeback",
    title: "The Comeback",
    emoji: "🔥",
    blurb: "Overcome a major setback and return to the top.",
    trackHint: "Injury. Doubt. Redemption.",
  },
];

export const PLAYER_IDENTITIES: PlayerIdentityDef[] = [
  {
    id: "wonderkid",
    title: "The Wonderkid",
    emoji: "✨",
    blurb: "Everyone already knows your name. Live up to it.",
    attrBias: { potential: 4, composure: 2 },
  },
  {
    id: "street",
    title: "The Street Footballer",
    emoji: "🏙️",
    blurb: "You learned on concrete. Flair first, rules second.",
    attrBias: { dribbling: 4, agility: 3, finishing: 1 },
  },
  {
    id: "academy_tech",
    title: "The Academy Technician",
    emoji: "🎯",
    blurb: "Clean touch. Smart angles. Coaches love you.",
    attrBias: { passing: 4, ballControl: 3, vision: 2 },
  },
  {
    id: "physical",
    title: "The Physical Beast",
    emoji: "💪",
    blurb: "Win duels. Own the air. Make them feel you.",
    attrBias: { strength: 4, jumping: 3, stamina: 2 },
  },
  {
    id: "late_bloomer",
    title: "The Late Bloomer",
    emoji: "⏳",
    blurb: "They overlooked you. You won’t stay quiet.",
    attrBias: { determination: 4, workRate: 3 },
  },
  {
    id: "tactical",
    title: "The Tactical Brain",
    emoji: "🧠",
    blurb: "You see the game two passes ahead.",
    attrBias: { vision: 4, positioning: 3, passing: 2 },
  },
  {
    id: "prodigy",
    title: "The Prodigy",
    emoji: "⚡",
    blurb: "Natural. Scary young. Still learning the hard bits.",
    attrBias: { pace: 3, acceleration: 3, finishing: 2 },
  },
];

export interface LifeState {
  dreamId: CareerDreamId | null;
  identityId: PlayerIdentityId | null;
  playArchetype: string | null;
  originStory: string;
  clubSituation: string;
  weekBeats: LifeBeat[];
  lastReactions: LifeReaction[];
  rivalName: string | null;
  debuted: boolean;
  weeksPlayed: number;
}

export interface LifeBeat {
  id: string;
  day: string;
  kind: "training" | "manager" | "teammate" | "media" | "match" | "note";
  title: string;
  body: string;
  date: string;
}

export interface LifeReaction {
  id: string;
  source: "manager" | "teammate" | "news" | "social" | "agent";
  title: string;
  body: string;
  date: string;
  sentiment: "Positive" | "Neutral" | "Negative";
}

function bag(world: World): LifeState {
  if (!(world as any).lifeState) {
    (world as any).lifeState = {
      dreamId: null,
      identityId: null,
      playArchetype: null,
      originStory: "",
      clubSituation: "",
      weekBeats: [],
      lastReactions: [],
      rivalName: null,
      debuted: false,
      weeksPlayed: 0,
    } as LifeState;
  }
  return (world as any).lifeState as LifeState;
}

export function initLife(
  world: World,
  opts: {
    dreamId?: CareerDreamId;
    identityId?: PlayerIdentityId;
    playArchetype?: string;
    clubName?: string;
    clubRep?: number;
    position?: string;
    playerName?: string;
  }
): LifeState {
  const life = bag(world);
  life.dreamId = opts.dreamId ?? null;
  life.identityId = opts.identityId ?? null;
  life.playArchetype = opts.playArchetype ?? null;

  const dream = CAREER_DREAMS.find((d) => d.id === life.dreamId);
  const ident = PLAYER_IDENTITIES.find((i) => i.id === life.identityId);
  const club = opts.clubName || "your club";
  const rep = opts.clubRep ?? 70;

  life.originStory = [
    ident ? `${ident.emoji} ${ident.title}` : "A young prospect",
    opts.position ? `· ${opts.position}` : "",
    dream ? `· chasing ${dream.title}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (rep >= 85) {
    life.clubSituation = `You arrive at ${club} as one of several talents fighting for the same shirt. Elite facilities. Brutal competition. No one is waiting for you.`;
  } else if (rep >= 75) {
    life.clubSituation = `${club} see a pathway for you — but minutes are earned, not given. Impress the first-team staff or stay in the shadows.`;
  } else if (rep >= 65) {
    life.clubSituation = `At ${club}, the manager believes you could push for the first team within a season if you stay sharp.`;
  } else {
    life.clubSituation = `${club} need energy and fearlessness. This is a place where young players actually play.`;
  }

  const squad = opts.clubName
    ? [...world.players.values()].filter(
        (p) => p.currentClubId && world.clubs.get(p.currentClubId)?.name === opts.clubName && !p.isUserControlled
      )
    : [];
  const young = squad.filter((p) => p.age <= 21).sort((a, b) => b.ovr - a.ovr);
  life.rivalName = young[0]?.displayName ?? "a rival prospect";

  life.weekBeats = [
    {
      id: nextId("beat"),
      day: "Arrival",
      kind: "note",
      title: "First day",
      body: life.clubSituation,
      date: world.calendar.currentDate,
    },
  ];
  life.lastReactions = [];
  life.debuted = false;
  life.weeksPlayed = 0;
  return life;
}

export function applyIdentityToPlayer(player: Player, identityId?: PlayerIdentityId | null): void {
  if (!identityId) return;
  const def = PLAYER_IDENTITIES.find((i) => i.id === identityId);
  if (!def) return;
  const attrs = player.attributes as any;
  for (const [k, v] of Object.entries(def.attrBias)) {
    if (k === "potential") {
      player.potential = Math.min(95, (player.potential ?? 70) + (v as number));
      continue;
    }
    if (typeof attrs[k] === "number") {
      attrs[k] = Math.max(1, Math.min(99, attrs[k] + (v as number)));
    }
  }
}

export function snapshotLife(world: World) {
  const life = bag(world);
  const dream = CAREER_DREAMS.find((d) => d.id === life.dreamId) || null;
  const identity = PLAYER_IDENTITIES.find((i) => i.id === life.identityId) || null;
  return {
    ...life,
    dream,
    identity,
    dreamsCatalog: CAREER_DREAMS,
    identitiesCatalog: PLAYER_IDENTITIES,
  };
}

export function generateWeekBeats(world: World): LifeBeat[] {
  const life = bag(world);
  const pid = world.userPlayerId;
  if (!pid) return life.weekBeats;
  const player = world.players.get(pid);
  if (!player) return life.weekBeats;

  const trust = player.state.managerTrust ?? 50;
  const form = player.state.form ?? 50;
  const apps = player.state.appearancesThisSeason ?? 0;
  const rival = life.rivalName || "a teammate";
  const date = world.calendar.currentDate;
  const beats: LifeBeat[] = [];

  let managerBody = "The manager nods in training. Nothing more.";
  if (trust >= 70 && apps >= 3)
    managerBody = `"Keep this level and you'll stay in the plans," the manager says after session.`;
  else if (trust < 40)
    managerBody = `"You're not ready for regular minutes yet," the staff make clear. Work harder.`;
  else if (apps === 0)
    managerBody = `The coach watches you in training. "Show me something on Saturday."`;
  else managerBody = `Staff note your application. A start is possible if you stay sharp.`;

  beats.push({
    id: nextId("beat"),
    day: "Midweek",
    kind: "manager",
    title: "Manager",
    body: managerBody,
    date,
  });

  const teammateBody =
    form >= 70
      ? `${rival.split(" ")[0]}: "You're on one lately. First team are watching."`
      : apps === 0
        ? `${rival.split(" ")[0]}: "Everyone starts on the bench sometime. Don't vanish."`
        : `${rival.split(" ")[0]} asks you to stay for extra finishing after training.`;

  beats.push({
    id: nextId("beat"),
    day: "Thursday",
    kind: "teammate",
    title: "Teammate",
    body: teammateBody,
    date,
  });

  life.weekBeats = [...beats, ...life.weekBeats].slice(0, 12);
  life.weeksPlayed += 1;
  return beats;
}

export function generatePostMatchReactions(
  world: World,
  opts: {
    rating?: number;
    goals?: number;
    assists?: number;
    minutes?: number;
    homeScore?: number;
    awayScore?: number;
    homeName?: string;
    awayName?: string;
  }
): LifeReaction[] {
  const life = bag(world);
  const pid = world.userPlayerId;
  if (!pid) return [];
  const player = world.players.get(pid);
  if (!player) return [];

  const rating = opts.rating ?? 6.5;
  const goals = opts.goals ?? 0;
  const assists = opts.assists ?? 0;
  const minutes = opts.minutes ?? 0;
  const date = world.calendar.currentDate;
  const reactions: LifeReaction[] = [];
  const name = player.displayName;
  const club = player.currentClubId ? world.clubs.get(player.currentClubId)?.name : "the club";

  if (minutes >= 10) life.debuted = true;

  if (rating >= 7.5 || goals > 0) {
    reactions.push({
      id: nextId("rx"),
      source: "manager",
      title: "Manager",
      body: goals
        ? `"That's why we trust you," the manager says in the dressing room.`
        : `"That's the level. Do it again," the manager tells you.`,
      date,
      sentiment: "Positive",
    });
  } else if (rating < 5.5 && minutes >= 45) {
    reactions.push({
      id: nextId("rx"),
      source: "manager",
      title: "Manager",
      body: `"Not good enough today. Look at the tape." The door shuts harder than usual.`,
      date,
      sentiment: "Negative",
    });
  } else if (minutes < 15) {
    reactions.push({
      id: nextId("rx"),
      source: "manager",
      title: "Manager",
      body: `You barely got on. The manager doesn't look your way after full time.`,
      date,
      sentiment: "Neutral",
    });
  } else {
    reactions.push({
      id: nextId("rx"),
      source: "manager",
      title: "Manager",
      body: `"Solid. Keep your standards." A short nod is all you get.`,
      date,
      sentiment: "Neutral",
    });
  }

  reactions.push({
    id: nextId("rx"),
    source: "teammate",
    title: "Teammate",
    body:
      goals || assists
        ? `${life.rivalName?.split(" ")[0] || "A teammate"}: "That's your moment. Enjoy it — then go again."`
        : rating >= 7
          ? `Someone ruffles your hair in the tunnel. "You're becoming a problem for them."`
          : `Quiet bus ride. ${life.rivalName?.split(" ")[0] || "The squad"} keeps to themselves.`,
    date,
    sentiment: goals || assists || rating >= 7 ? "Positive" : "Neutral",
  });

  const score =
    opts.homeScore != null && opts.awayScore != null
      ? `${opts.homeName || "Home"} ${opts.homeScore}–${opts.awayScore} ${opts.awayName || "Away"}`
      : "Full time";

  if (goals >= 1 || assists >= 1 || rating >= 7.8) {
    reactions.push({
      id: nextId("rx"),
      source: "news",
      title: "Football Daily",
      body: `${name} (${club}) stood out — ${goals ? goals + " goal(s)" : ""}${goals && assists ? ", " : ""}${assists ? assists + " assist(s)" : ""}${!goals && !assists ? rating.toFixed(1) + " rating" : ""}. ${score}.`,
      date,
      sentiment: "Positive",
    });
    reactions.push({
      id: nextId("rx"),
      source: "social",
      title: `@${(club || "Club").replace(/\s+/g, "")}Youth`,
      body: goals
        ? `Another one for ${name.split(" ")[0]} 👀 #NextGen`
        : `Big shift from ${name.split(" ")[0]} today.`,
      date,
      sentiment: "Positive",
    });
  } else if (minutes >= 60 && rating < 5.5) {
    reactions.push({
      id: nextId("rx"),
      source: "news",
      title: "Local Press",
      body: `${name} struggled to influence the game as ${club} laboured. Questions remain over consistency.`,
      date,
      sentiment: "Negative",
    });
  }

  life.lastReactions = [...reactions, ...life.lastReactions].slice(0, 20);

  if (!(world as any).newsFeed) (world as any).newsFeed = [];
  for (const r of reactions.filter((x) => x.source === "news")) {
    (world as any).newsFeed.push({
      id: nextId("nws"),
      timestamp: date,
      category: "Career",
      importance: "Minor",
      headline: r.body.slice(0, 90),
      body: r.body,
      sourceId: "life",
      relatedPlayerIds: [pid],
      relatedClubIds: player.currentClubId ? [player.currentClubId] : [],
      relatedCompetitionId: null,
      sourceEventId: r.id,
      sentiment: r.sentiment,
      tags: ["life", "player"],
      storyKey: `life:${r.id}`,
    });
  }

  return reactions;
}

export function clubChoiceCard(club: {
  id: string;
  name: string;
  nation?: string;
  reputation: number;
  city?: string;
}): {
  id: string;
  name: string;
  nation: string;
  reputation: number;
  difficulty: number;
  pathway: string;
  situation: string;
  label: string;
} {
  const rep = club.reputation;
  let difficulty = 3;
  let pathway = "First-team pathway";
  let situation = "A chance to play and grow.";
  let label = "Solid start";

  if (rep >= 90) {
    difficulty = 5;
    pathway = "Elite academy — long queue";
    situation = `You are one of several young ${club.name} prospects fighting for the same position. Huge stage. No guarantees.`;
    label = "Dream club · brutal";
  } else if (rep >= 82) {
    difficulty = 5;
    pathway = "Elite academy / U21";
    situation = `Excellent facilities. Fierce competition for minutes. First-team staff rarely look down.`;
    label = "Elite · hard mode";
  } else if (rep >= 74) {
    difficulty = 4;
    pathway = "U21 → rotation chance";
    situation = `Strong environment. If you outgrow the youth side, a bench role is realistic.`;
    label = "Competitive";
  } else if (rep >= 65) {
    difficulty = 3;
    pathway = "Clearer first-team route";
    situation = `The manager is open to youth. You could reach the first team within two years if you perform.`;
    label = "Balanced path";
  } else {
    difficulty = 2;
    pathway = "Likely minutes early";
    situation = `Smaller stage, fewer places to hide. Young players actually play here.`;
    label = "Play now";
  }

  return {
    id: club.id,
    name: club.name,
    nation: club.nation || "",
    reputation: rep,
    difficulty,
    pathway,
    situation,
    label,
  };
}
