import { describe, expect, it } from "vitest";
import { computePlayerStats, formatWinRate, longestLosingRun, winRate } from "./stats";
import { BLUFF, POKER, match } from "./test-fixtures";

describe("computePlayerStats", () => {
  it("returns honest empty stats for a new player", () => {
    const stats = computePlayerStats([], "newbie");
    expect(stats).toMatchObject({ games: 0, wins: 0, losses: 0, points: 0, winRate: null, averagePlacement: null });
    expect(formatWinRate(stats.winRate)).toBe("—");
  });

  it("counts wins, losses, points and average placement", () => {
    const matches = [match(["a", "b", "c"]), match(["b", "a", "c"]), match(["c", "b", "a"])];
    const a = computePlayerStats(matches, "a");
    expect(a).toMatchObject({ games: 3, wins: 1, losses: 2, points: 4 });
    expect(a.winRate).toBeCloseTo(1 / 3);
    expect(a.averagePlacement).toBeCloseTo(2);
  });

  it("ignores voided matches entirely", () => {
    const matches = [match(["a", "b"]), match(["a", "b"], { status: "voided" })];
    expect(computePlayerStats(matches, "a")).toMatchObject({ games: 1, wins: 1, points: 3 });
  });

  it("counts a shared first place as a win for each tied player", () => {
    const stats = computePlayerStats([match([["a", "b"], "c"])], "b");
    expect(stats).toMatchObject({ wins: 1, points: 3 });
  });

  it("tracks current and best winning streaks in played order", () => {
    const matches = [
      match(["a", "b"], { day: 1 }),
      match(["a", "b"], { day: 2 }),
      match(["a", "b"], { day: 3 }),
      match(["b", "a"], { day: 4 }),
      match(["a", "b"], { day: 5 }),
    ];
    // Shuffle input to prove ordering comes from playedAt, not array order.
    const stats = computePlayerStats([matches[4], matches[1], matches[3], matches[0], matches[2]], "a");
    expect(stats.bestStreak).toBe(3);
    expect(stats.currentStreak).toBe(1);
    expect(stats.recentForm).toEqual(["W", "L", "W", "W", "W"]);
  });

  it("filters by game", () => {
    const matches = [match(["a", "b"], { game: BLUFF }), match(["b", "a"], { game: POKER })];
    expect(computePlayerStats(matches, "a", (m) => m.gameTypeId === POKER)).toMatchObject({ games: 1, wins: 0 });
  });

  it("counts second and last places", () => {
    const matches = [match(["b", "a", "c"]), match(["c", "b", "a"]), match(["a", "c"])];
    const a = computePlayerStats(matches, "a");
    expect(a.secondPlaces).toBe(1);
    expect(a.lastPlaces).toBe(1);
  });
});

describe("win rate", () => {
  it("is null without games and a fraction otherwise", () => {
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(3, 4)).toBe(0.75);
    expect(formatWinRate(2 / 3)).toBe("67%");
  });
});

describe("longestLosingRun", () => {
  it("finds the longest run of non-wins", () => {
    const matches = [
      match(["b", "a"], { day: 1 }),
      match(["b", "a"], { day: 2 }),
      match(["a", "b"], { day: 3 }),
      match(["b", "a"], { day: 4 }),
    ];
    expect(longestLosingRun(matches, "a")).toBe(2);
  });
});
