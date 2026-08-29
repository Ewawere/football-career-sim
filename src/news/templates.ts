/**
 * Deterministic headline / body templates filled from event data.
 */

export interface TemplateContext {
  player?: string;
  club?: string;
  club2?: string;
  opponent?: string;
  manager?: string;
  competition?: string;
  injury?: string;
  fee?: string;
  score?: string;
  milestone?: string;
  position?: string;
  age?: string;
  rating?: string;
  goals?: string;
}

function fill(template: string, ctx: TemplateContext): string {
  return template
    .replace(/\{PLAYER\}/g, ctx.player ?? "A player")
    .replace(/\{CLUB\}/g, ctx.club ?? "A club")
    .replace(/\{CLUB2\}/g, ctx.club2 ?? "another club")
    .replace(/\{OPPONENT\}/g, ctx.opponent ?? "their opponents")
    .replace(/\{MANAGER\}/g, ctx.manager ?? "The manager")
    .replace(/\{COMPETITION\}/g, ctx.competition ?? "the competition")
    .replace(/\{INJURY\}/g, ctx.injury ?? "an injury")
    .replace(/\{FEE\}/g, ctx.fee ?? "an undisclosed fee")
    .replace(/\{SCORE\}/g, ctx.score ?? "the result")
    .replace(/\{MILESTONE\}/g, ctx.milestone ?? "a milestone")
    .replace(/\{POSITION\}/g, ctx.position ?? "player")
    .replace(/\{AGE\}/g, ctx.age ?? "")
    .replace(/\{RATING\}/g, ctx.rating ?? "")
    .replace(/\{GOALS\}/g, ctx.goals ?? "");
}

export const HEADLINES = {
  transferComplete: [
    "{CLUB} complete signing of {PLAYER}",
    "{PLAYER} joins {CLUB} from {CLUB2}",
    "DONE DEAL: {PLAYER} seals move to {CLUB}",
  ],
  transferRumour: [
    "{CLUB} monitoring {PLAYER}, sources claim",
    "Reports: {CLUB} interested in {PLAYER}",
    "{PLAYER} emerges as target for {CLUB}",
  ],
  transferBid: [
    "{CLUB} submit bid for {PLAYER}",
    "Offer tabled: {CLUB} move for {PLAYER}",
  ],
  bidRejected: [
    "{CLUB2} reject {CLUB} bid for {PLAYER}",
    "NOT FOR SALE: {CLUB2} turn down {FEE} offer for {PLAYER}",
    "{CLUB2} snub {CLUB}'s approach for {PLAYER}",
  ],
  bidRejectedWonderkid: [
    "NOT FOR SALE: {CLUB2} reject huge {FEE} bid for wonderkid {PLAYER}",
    "{CLUB2} slam door on {CLUB} — {PLAYER} is going nowhere",
    "Club sources: {PLAYER} is untouchable despite {FEE} offer from {CLUB}",
  ],
  loanComplete: [
    "{PLAYER} joins {CLUB} on loan",
    "Loan move: {PLAYER} heads to {CLUB} for more minutes",
  ],
  injury: [
    "{PLAYER} ruled out with {INJURY}",
    "Injury concern: {PLAYER} faces spell on the sidelines",
  ],
  injuryReturn: [
    "{PLAYER} returns to training after injury",
    "{PLAYER} back in contention following recovery",
  ],
  matchWin: [
    "{CLUB} edge past {OPPONENT} ({SCORE})",
    "{CLUB} take the points against {OPPONENT}",
    "{CLUB} run out {SCORE} winners against {OPPONENT}",
  ],
  thrashing: [
    "{CLUB} thrash {OPPONENT} {SCORE}",
    "Statement win: {CLUB} dismantle {OPPONENT} {SCORE}",
    "{CLUB} put {OPPONENT} to the sword in {SCORE} rout",
  ],
  matchDraw: [
    "{CLUB} and {OPPONENT} share the spoils ({SCORE})",
  ],
  matchLoss: [
    "{CLUB} fall to defeat against {OPPONENT} ({SCORE})",
  ],
  playerGoals: [
    "{PLAYER} on target as {CLUB} face {OPPONENT}",
    "{PLAYER} finds the net in {SCORE} contest",
  ],
  hatTrick: [
    "HAT-TRICK: {PLAYER} stars as {CLUB} crush {OPPONENT} {SCORE}",
    "{PLAYER} hits three in {CLUB}'s {SCORE} win over {OPPONENT}",
    "Clinical {PLAYER} bags a treble in {SCORE} victory",
    "Hat-trick hero {PLAYER} stars for {CLUB}",
    "{PLAYER} hits three as {CLUB} dominate",
  ],
  debut: [
    "{PLAYER} makes senior debut for {CLUB}",
    "First appearance: {PLAYER} steps up for {CLUB}",
  ],
  milestone: [
    "{PLAYER} reaches {MILESTONE}",
    "Milestone moment for {PLAYER}: {MILESTONE}",
  ],
  lateWinner: [
    "{PLAYER} strikes late as {CLUB} snatch victory",
    "Dramatic finish: {PLAYER} wins it for {CLUB}",
  ],
  contractRenewed: [
    "{PLAYER} signs new deal at {CLUB}",
    "{CLUB} secure {PLAYER} on fresh terms",
  ],
  contractExpired: [
    "{PLAYER} available as free agent after leaving {CLUB}",
  ],
  seasonStart: [
    "{COMPETITION} season gets underway",
  ],
  seasonEnd: [
    "{COMPETITION} concludes for another year",
  ],
};

export const BODIES = {
  transferComplete:
    "{CLUB} have confirmed the signing of {PLAYER} from {CLUB2}. The {POSITION} has put pen to paper on a new contract. Fee reported around {FEE}.",
  transferRumour:
    "According to sources, {CLUB} are keeping tabs on {PLAYER}. No formal bid has been confirmed at this stage.",
  loanComplete:
    "{PLAYER} will spend time at {CLUB} on loan, with the parent club retaining ownership. The move is expected to provide regular playing time.",
  injury:
    "{PLAYER} has been diagnosed with {INJURY}. The club will provide further updates on the expected recovery timeline.",
  matchReport:
    "{CLUB} faced {OPPONENT} in a contest that finished {SCORE}. Key performers and incidents from the match are reflected in the official statistics.",
  playerPerformance:
    "{PLAYER} delivered a notable display, contributing {GOALS} and earning a rating of {RATING}.",
  debut:
    "At {AGE}, {PLAYER} made a first senior appearance for {CLUB}. A milestone in a developing career.",
  milestone:
    "{PLAYER} has reached {MILESTONE} — a significant mark in their professional journey.",
  lateWinner:
    "{PLAYER} scored a decisive late goal as {CLUB} beat {OPPONENT}. The result lifts spirits among supporters.",
  bidRejected:
    "{CLUB2} have rejected an approach from {CLUB} for {PLAYER}. The offer — reported around {FEE} — did not meet the club's valuation. Sources insist the player is not available at present.",
  bidRejectedWonderkid:
    "{CLUB2} have firmly rejected a substantial {FEE} bid from {CLUB} for highly rated youngster {PLAYER}. The selling club view the player as a long-term asset and will only consider offers far above normal market levels.",
};

export function pickTemplate(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length]!;
}

export function renderHeadline(
  key: keyof typeof HEADLINES,
  ctx: TemplateContext,
  seed = 0
): string {
  const list = HEADLINES[key];
  return fill(pickTemplate(list, seed), ctx);
}

export function renderBody(
  key: keyof typeof BODIES,
  ctx: TemplateContext
): string {
  return fill(BODIES[key], ctx);
}
