/**
 * Demo: news + social from real simulation events.
 */
import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { startSeason, playMatchday } from "../competitions/season.js";
import { getNewsFeed } from "../news/engine.js";
import { getSocialFeed } from "../social/engine.js";
import { getFanSentiment } from "../social/fans.js";
import { shouldConsiderLoan, findLoanDestinations, createLoanOffer, completeLoan } from "../transfers/loans.js";
import { outletById } from "../news/outlets.js";

const world = createWorld({ seed: 88, startDate: "2026-07-01" });
bootstrapWorld(world);

const placement = createCareerPlayer(world, {
  firstName: "Jordan",
  lastName: "Vale",
  position: "RW",
  preferredFoot: "Left",
  nationality: "England",
  age: 17,
  physicalProfile: "Athletic",
  potential: 87,
});
console.log(placement.reason);

const user = placement.player;
user.state.matchMinutesThisSeason = 30;
user.state.appearancesThisSeason = 1;
if (shouldConsiderLoan(world, user, placement.club!)) {
  const d = findLoanDestinations(world, user, placement.club!, 2);
  if (d[0]) {
    const o = createLoanOffer(world, user, placement.club!, d[0].club, d[0].expectation);
    o.status = "Accepted";
    completeLoan(world, o);
    console.log(`Loaned to ${d[0].club.name}`);
  }
}

const comp = startSeason(world);
for (let md = 1; md <= 8; md++) playMatchday(world, comp.id, md);

const news = getNewsFeed(world);
const social = getSocialFeed(world);

console.log(`\n=== NEWS FEED (${news.length} articles) ===`);
for (const a of news.filter((n) => n.importance !== "Minor").slice(-12)) {
  const src = outletById(a.sourceId).name;
  console.log(`[${a.importance}] ${a.headline}`);
  console.log(`  ${src} | ${a.category} | ${a.tags.join(", ")}`);
}

console.log(`\n=== SOCIAL (${social.length} posts) ===`);
const top = [...social].sort((a, b) => b.engagement - a.engagement).slice(0, 8);
for (const p of top) {
  console.log(`@${p.authorLabel}: "${p.content}" (${p.engagement} eng)`);
}

if (user.currentClubId) {
  const fan = getFanSentiment(world, "Club", user.currentClubId);
  console.log(`\nFan sentiment at club: ${fan.label} (${fan.score.toFixed(0)})`);
}
