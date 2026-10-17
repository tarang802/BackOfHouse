import { describe, expect, it } from "vitest";
import {
  bracketSeedOrder,
  canTransition,
  firstRoundPairings,
  isValidBracketSize,
  nextRoundPairings,
  roundLabel,
  totalRounds,
} from "./tournament";

describe("elimination brackets", () => {
  it("only allows powers of two from 2 to 32", () => {
    expect([2, 4, 8, 16, 32].every(isValidBracketSize)).toBe(true);
    expect([0, 1, 3, 6, 12, 64].some(isValidBracketSize)).toBe(false);
    expect(totalRounds(8)).toBe(3);
  });

  it("seeds so top seeds meet late", () => {
    expect(bracketSeedOrder(2)).toEqual([1, 2]);
    expect(bracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(() => bracketSeedOrder(6)).toThrow();
  });

  it("pairs the first round from seeds", () => {
    expect(firstRoundPairings(["s1", "s2", "s3", "s4"])).toEqual([
      { round: 1, slot: 1, playerA: "s1", playerB: "s4" },
      { round: 1, slot: 2, playerA: "s2", playerB: "s3" },
    ]);
  });

  it("advances winners of slots 2k-1 and 2k into slot k", () => {
    const round1 = firstRoundPairings(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]).map((p) => ({
      ...p,
      winnerId: p.playerA,
    }));
    const round2 = nextRoundPairings(round1);
    expect(round2).toEqual([
      { round: 2, slot: 1, playerA: "s1", playerB: "s4" },
      { round: 2, slot: 2, playerA: "s2", playerB: "s3" },
    ]);
    const final = nextRoundPairings(round2.map((p) => ({ ...p, winnerId: p.playerB })));
    expect(final).toEqual([{ round: 3, slot: 1, playerA: "s4", playerB: "s3" }]);
    expect(nextRoundPairings(final.map((p) => ({ ...p, winnerId: "s3" })))).toEqual([]);
  });

  it("refuses to advance an unfinished round", () => {
    const round1 = firstRoundPairings(["a", "b", "c", "d"]).map((p, i) => ({ ...p, winnerId: i === 0 ? "a" : null }));
    expect(() => nextRoundPairings(round1)).toThrow();
  });

  it("labels rounds", () => {
    expect([1, 2, 3].map((r) => roundLabel(r, 3))).toEqual(["Quarter-finals", "Semi-finals", "Final"]);
    expect(roundLabel(1, 5)).toBe("Round 1");
  });
});

describe("status transitions", () => {
  it("follows the lifecycle and never reopens finished tournaments", () => {
    expect(canTransition("draft", "upcoming")).toBe(true);
    expect(canTransition("upcoming", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(false); // only via completion check
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
  });
});
