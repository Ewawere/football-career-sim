/**
 * League table tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyTable, applyResult, sortTable } from "../competitions/league.js";

describe("league table", () => {
  it("applies wins draws losses", () => {
    const table = createEmptyTable(["A", "B"]);
    applyResult(table, "A", "B", 2, 1);
    applyResult(table, "B", "A", 0, 0);
    applyResult(table, "A", "B", 3, 1);
    const a = table.find((r) => r.clubId === "A")!;
    const b = table.find((r) => r.clubId === "B")!;
    assert.equal(a.won, 2);
    assert.equal(a.drawn, 1);
    assert.equal(a.points, 7);
    assert.equal(b.lost, 2);
    assert.equal(b.drawn, 1);
    assert.equal(a.goalsFor, 5);
    assert.equal(b.goalsFor, 2);
  });

  it("sorts by points then GD then GF", () => {
    const table = createEmptyTable(["A", "B", "C"]);
    applyResult(table, "A", "B", 1, 0);
    applyResult(table, "C", "B", 5, 0);
    applyResult(table, "C", "A", 1, 0);
    sortTable(table);
    assert.equal(table[0]!.clubId, "C");
    assert.equal(table[0]!.position, 1);
  });
});
