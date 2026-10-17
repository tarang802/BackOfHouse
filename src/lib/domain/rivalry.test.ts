import { describe, expect, it } from "vitest";
import { frequentOpponents, headToHead } from "./rivalry";
import { BLUFF, POKER, match } from "./test-fixtures";

describe("headToHead", () => {
  it("counts only matches both players played", () => {
    const matches = [match(["a", "b"]), match(["a", "c"]), match(["c", "b", "a"])];
    const h2h = headToHead(matches, "a", "b");
    expect(h2h.encounters).toBe(2);
    expect(h2h.aheadA).toBe(1);
    expect(h2h.aheadB).toBe(1);
    expect(h2h.leader).toBeNull();
  });

  it("treats equal finishes between the two as draws", () => {
    const h2h = headToHead([match([["a", "b"], "c"]), match(["c", ["a", "b"]])], "a", "b");
    expect(h2h).toMatchObject({ encounters: 2, draws: 2, aheadA: 0, aheadB: 0, winPctA: null });
    expect(h2h.outrightWinsA).toBe(1);
    expect(h2h.outrightWinsB).toBe(1);
  });

  it("splits results by game and counts tournament encounters", () => {
    const matches = [
      match(["a", "b"], { game: BLUFF }),
      match(["a", "b"], { game: BLUFF, tournamentId: "t1" }),
      match(["b", "a"], { game: POKER }),
    ];
    const h2h = headToHead(matches, "a", "b");
    expect(h2h.byGame[BLUFF]).toEqual({ encounters: 2, aheadA: 2, aheadB: 0, draws: 0 });
    expect(h2h.byGame[POKER]).toEqual({ encounters: 1, aheadA: 0, aheadB: 1, draws: 0 });
    expect(h2h.tournamentEncounters).toBe(1);
    expect(h2h.winPctA).toBeCloseTo(2 / 3);
    expect(h2h.leader).toBe("a");
  });

  it("lists recent encounters newest first and ignores voided matches", () => {
    const first = match(["a", "b"], { day: 1 });
    const second = match(["b", "a"], { day: 2 });
    const voided = match(["a", "b"], { day: 3, status: "voided" });
    const h2h = headToHead([second, voided, first], "a", "b");
    expect(h2h.recent.map((e) => e.matchId)).toEqual([second.id, first.id]);
  });

  it("is empty for a player against themselves", () => {
    expect(headToHead([match(["a", "b"])], "a", "a").encounters).toBe(0);
  });
});

describe("frequentOpponents", () => {
  it("orders opponents by number of shared matches", () => {
    const matches = [match(["a", "b", "c"]), match(["a", "c"]), match(["b", "d"])];
    expect(frequentOpponents(matches, "a")).toEqual([
      { profileId: "c", encounters: 2 },
      { profileId: "b", encounters: 1 },
    ]);
  });
});
