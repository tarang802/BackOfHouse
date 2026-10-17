import { describe, expect, it } from "vitest";
import { evaluateAchievements, type AchievementContext } from "./achievements";
import { BLUFF, POKER, gameTypes, match } from "./test-fixtures";
import type { MatchRecord } from "./types";

function ctx(matches: MatchRecord[], overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    matches,
    gameTypes,
    tournamentChampions: [],
    memberIds: ["a", "b", "c"],
    legendPointsThreshold: 100,
    playfulTitles: false,
    ...overrides,
  };
}

const earned = (matches: MatchRecord[], overrides: Partial<AchievementContext> = {}, who = "a") =>
  evaluateAchievements(who, ctx(matches, overrides))
    .filter((a) => a.earned)
    .map((a) => a.id);

describe("achievements", () => {
  it("awards nothing to a player with no history", () => {
    expect(earned([])).toEqual([]);
  });

  it("awards First Blood for a first win", () => {
    expect(earned([match(["a", "b"])])).toContain("first_blood");
    expect(earned([match(["b", "a"])])).not.toContain("first_blood");
  });

  it("awards Poker Face after five poker wins", () => {
    const four = Array.from({ length: 4 }, () => match(["a", "b"], { game: POKER }));
    expect(earned(four)).not.toContain("poker_face");
    expect(earned([...four, match(["a", "b"], { game: POKER })])).toContain("poker_face");
  });

  it("awards Bluff Master after ten bluff wins", () => {
    const wins = Array.from({ length: 10 }, () => match(["a", "b"], { game: BLUFF }));
    expect(earned(wins)).toContain("bluff_master");
    expect(earned(wins.slice(1))).not.toContain("bluff_master");
  });

  it("awards On a Roll for five consecutive wins, and revokes it if a match is voided", () => {
    const streak = Array.from({ length: 5 }, (_, i) => match(["a", "b"], { day: i + 1 }));
    expect(earned(streak)).toContain("on_a_roll");
    const withVoid = streak.map((m, i) => (i === 2 ? { ...m, status: "voided" as const } : m));
    expect(earned(withVoid)).not.toContain("on_a_roll");
  });

  it("awards Comeback King for a win after three straight losses", () => {
    const history = [
      match(["b", "a"], { day: 1 }),
      match(["b", "a"], { day: 2 }),
      match(["b", "a"], { day: 3 }),
      match(["a", "b"], { day: 4 }),
    ];
    expect(earned(history)).toContain("comeback_king");
    expect(earned(history.slice(1))).not.toContain("comeback_king");
  });

  it("awards House Legend at the club's configurable milestone", () => {
    const history = [match(["a", "b"]), match(["a", "b"])]; // 6 overall points
    expect(earned(history, { legendPointsThreshold: 6 })).toContain("house_legend");
    expect(earned(history, { legendPointsThreshold: 7 })).not.toContain("house_legend");
  });

  it("does not count poker toward House Legend when poker is excluded from overall", () => {
    const history = [match(["a", "b"], { game: POKER }), match(["a", "b"], { game: POKER })];
    expect(earned(history, { legendPointsThreshold: 6 })).not.toContain("house_legend");
  });

  it("awards Tournament Champion from completed tournaments", () => {
    expect(earned([], { tournamentChampions: ["a"] })).toContain("tournament_champion");
    expect(earned([], { tournamentChampions: ["b"] })).not.toContain("tournament_champion");
  });

  it("awards Rivalry Winner for leading after five meetings", () => {
    const meetings = [
      match(["a", "b"]),
      match(["a", "b"]),
      match(["b", "a"]),
      match(["a", "b"]),
    ];
    expect(earned(meetings)).not.toContain("rivalry_winner");
    expect(earned([...meetings, match(["b", "a"])])).toContain("rivalry_winner");
    expect(earned([...meetings, match(["b", "a"])], {}, "b")).not.toContain("rivalry_winner");
  });

  it("only shows playful titles when the club enables them", () => {
    const losses = Array.from({ length: 5 }, (_, i) => match(["b", "a"], { day: i + 1 }));
    const off = evaluateAchievements("a", ctx(losses));
    expect(off.map((a) => a.id)).not.toContain("cursed_hand");
    expect(earned(losses, { playfulTitles: true })).toContain("cursed_hand");
  });

  it("reports progress toward locked achievements", () => {
    const list = evaluateAchievements("a", ctx([match(["a", "b"], { game: POKER })]));
    expect(list.find((a) => a.id === "poker_face")).toMatchObject({ earned: false, progress: "1 / 5" });
  });
});
