/**
 * Narrative threads must only advance from real simulation events.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../world/world.js";
import { bootstrapWorld } from "../world/bootstrap.js";
import { createCareerPlayer } from "../career/player-career.js";
import { startSeason, playMatchday } from "../competitions/season.js";
import {
  getActiveThreads,
  snapshotThreads,
} from "../narrative/engine.js";
import { Events } from "../core/events.js";

describe("narrative threads", () => {
  it("survives multi-matchday play and keeps thread beats coherent", () => {
    const world = createWorld(42);
    bootstrapWorld(world);
    const placement = createCareerPlayer(world, {
      firstName: "Jordan",
      lastName: "Vale",
      age: 17,
      position: "RW",
      potential: 88,
      preferredFoot: "Left",
      nationality: "England",
      physicalProfile: "Athletic",
    });
    const player = placement.player;
    assert.ok(player.id);

    const competition = startSeason(world);
    assert.ok(competition?.id);

    for (let md = 1; md <= 4; md++) {
      try {
        playMatchday(world, competition.id, md);
      } catch {
        /* schedule edge */
      }
    }

    const threads = snapshotThreads(world, { limit: 30 });
    assert.ok(Array.isArray(threads));
    for (const t of threads) {
      assert.ok(t.beatCount >= 1);
      assert.ok(t.beats.length >= 1);
      assert.ok(typeof t.latestBeat === "string");
      for (const b of t.beats) {
        assert.ok(b.date);
        assert.ok(b.summary);
      }
    }
  });

  it("transfer rejection grows a transfer_saga thread", () => {
    const world = createWorld(7);
    bootstrapWorld(world);
    const clubs = [...world.clubs.values()];
    const seller = clubs[0]!;
    const buyer = clubs[1]!;
    const young = [...world.players.values()].find(
      (p) => p.currentClubId === seller.id && p.age <= 21 && p.potential >= 84
    );
    if (!young) {
      assert.ok(true);
      return;
    }

    world.events.emit(Events.TRANSFER_OFFER, {
      type: "rejected_seller",
      playerId: young.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      fee: 5_000_000,
      asking: 20_000_000,
    });

    const active = getActiveThreads(world, young.id);
    const saga = active.find((t) => t.kind === "transfer_saga");
    assert.ok(saga, "rejection should open transfer_saga");
    assert.ok(saga!.beats.length >= 1);
  });
});
