import { describe, expect, it } from "vitest";
import { buildLeaderboard, leaderboardFilters, localDay, searchLeaderboard, sortLeaderboard } from "./leaderboard";
import { BLUFF, CUSTOM, POKER, gameTypes, match, member } from "./test-fixtures";

const members = [member("a", "Arjun"), member("b", "Bela"), member("c", "Chirag"), member("d", "Dev")];

describe("buildLeaderboard", () => {
  it("ranks by points, then wins, then win rate", () => {
    const matches = [
      match(["a", "b", "c"]), // a+3 b+1
      match(["a", "c", "b"]), // a+3 c+1
      match(["b", "c", "a"]), // b+3 c+1
    ];
    const board = buildLeaderboard(matches, members);
    expect(board.map((e) => [e.member.profileId, e.rank, e.stats.points])).toEqual([
      ["a", 1, 6],
      ["b", 2, 4],
      ["c", 3, 2],
      ["d", null, 0],
    ]);
  });

  it("breaks equal points by wins", () => {
    // a: one win (3). b: three seconds (3), no wins.
    const matches = [match(["a", "b", "c"]), match(["c", "b", "a"]), match(["c", "b", "a"])];
    const board = buildLeaderboard(matches, members);
    const a = board.find((e) => e.member.profileId === "a")!;
    const b = board.find((e) => e.member.profileId === "b")!;
    expect(a.stats.points).toBe(b.stats.points);
    expect(a.rank).toBeLessThan(b.rank!);
  });

  it("shares a rank when points, wins and win rate are all equal (1, 1, 3)", () => {
    const matches = [match(["a", "b"]), match(["b", "a"]), match(["c", "d"])];
    const board = buildLeaderboard(matches, members);
    const ranks = Object.fromEntries(board.map((e) => [e.member.profileId, e.rank]));
    // a and b: 4 pts, 1 win, 50%. c: 3 pts 1 win 100%. d: 1 pt.
    expect(ranks).toEqual({ a: 1, b: 1, c: 3, d: 4 });
    // Tied players are listed alphabetically.
    expect(board[0].member.displayName).toBe("Arjun");
  });

  it("lists players without games as unranked, after ranked players", () => {
    const board = buildLeaderboard([match(["c", "b"])], members);
    expect(board.slice(2).map((e) => [e.member.profileId, e.rank])).toEqual([
      ["a", null],
      ["d", null],
    ]);
  });

  it("excludes games that do not count toward overall", () => {
    const matches = [match(["a", "b"], { game: POKER }), match(["b", "a"], { game: BLUFF })];
    const board = buildLeaderboard(matches, members, leaderboardFilters.overall(gameTypes));
    expect(board[0].member.profileId).toBe("b");
    expect(board.find((e) => e.member.profileId === "a")!.stats.points).toBe(1);
  });

  it("builds game-specific boards", () => {
    const matches = [match(["a", "b"], { game: POKER }), match(["b", "a"], { game: CUSTOM })];
    const board = buildLeaderboard(matches, members, leaderboardFilters.game(POKER));
    expect(board[0]).toMatchObject({ rank: 1, member: { profileId: "a" } });
  });

  it("drops voided matches so a correction updates the board", () => {
    const original = match(["a", "b"]);
    const voided = { ...original, status: "voided" as const };
    const corrected = match(["b", "a"]);
    const board = buildLeaderboard([voided, corrected], members);
    expect(board[0].member.profileId).toBe("b");
    expect(board[1].stats).toMatchObject({ games: 1, wins: 0 });
  });
});

describe("filters and search", () => {
  it("bounds a season by the club's calendar day", () => {
    // 20:00 UTC on 31 Jan is 1 Feb in India.
    const late = match(["a", "b"], { playedAt: "2026-01-31T20:00:00.000Z" });
    expect(localDay(late.playedAt, "Asia/Kolkata")).toBe("2026-02-01");
    const feb = leaderboardFilters.dateRange(gameTypes, "2026-02-01", "2026-02-28", "Asia/Kolkata");
    const jan = leaderboardFilters.dateRange(gameTypes, "2026-01-01", "2026-01-31", "Asia/Kolkata");
    expect(feb(late)).toBe(true);
    expect(jan(late)).toBe(false);
  });

  it("searches by display name or username", () => {
    const board = buildLeaderboard([], members);
    expect(searchLeaderboard(board, "bel").map((e) => e.member.profileId)).toEqual(["b"]);
    expect(searchLeaderboard(board, "  ").length).toBe(4);
  });

  it("re-sorts by wins, win rate, games and name", () => {
    const matches = [match(["a", "b"]), match(["b", "a"]), match(["b", "c"])];
    const board = buildLeaderboard(matches, members);
    expect(sortLeaderboard(board, "wins")[0].member.profileId).toBe("b");
    expect(sortLeaderboard(board, "name").map((e) => e.member.profileId)).toEqual(["a", "b", "c", "d"]);
    expect(sortLeaderboard(board, "games")[0].member.profileId).toBe("b");
    expect(sortLeaderboard(board, "winRate")[0].member.profileId).toBe("b");
  });
});
