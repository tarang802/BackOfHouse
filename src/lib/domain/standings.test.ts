import { describe, expect, it } from "vitest";
import { checkPointsCompletion, tournamentStandings } from "./standings";
import { match } from "./test-fixtures";

const T = "tour-1";

describe("tournamentStandings", () => {
  it("sums points from the tournament's confirmed matches only", () => {
    const matches = [
      match(["a", "b", "c"], { tournamentId: T }),
      match(["b", "a", "c"], { tournamentId: T }),
      match(["c", "a", "b"], { tournamentId: T, status: "voided" }),
      match(["c", "b", "a"]), // not part of the tournament
    ];
    const standings = tournamentStandings(["a", "b", "c"], matches, T);
    expect(standings.map((r) => [r.profileId, r.points, r.wins, r.played, r.rank])).toEqual([
      ["a", 4, 1, 2, 1],
      ["b", 4, 1, 2, 1],
      ["c", 0, 0, 2, 3],
    ]);
  });

  it("includes registered players who have not played yet", () => {
    const standings = tournamentStandings(["a", "b", "z"], [match(["a", "b"], { tournamentId: T })], T);
    expect(standings.find((r) => r.profileId === "z")).toMatchObject({ points: 0, played: 0, rank: 3 });
  });

  it("ignores results of players not registered in the tournament", () => {
    const standings = tournamentStandings(["a", "b"], [match(["x", "a", "b"], { tournamentId: T })], T);
    expect(standings.map((r) => r.profileId)).toEqual(["a", "b"]);
  });
});

describe("checkPointsCompletion", () => {
  const base = { format: "points" as const, status: "in_progress" as const, roundCount: null };

  it("crowns the single leader", () => {
    const standings = tournamentStandings(["a", "b"], [match(["a", "b"], { tournamentId: T })], T);
    expect(checkPointsCompletion({ ...base, standings, confirmedMatches: 1 })).toEqual({ ok: true, championId: "a" });
  });

  it("refuses to crown a champion when first place is tied", () => {
    const standings = tournamentStandings(
      ["a", "b"],
      [match(["a", "b"], { tournamentId: T }), match(["b", "a"], { tournamentId: T })],
      T,
    );
    expect(checkPointsCompletion({ ...base, standings, confirmedMatches: 2 }).ok).toBe(false);
  });

  it("requires matches, the right status and all rounds", () => {
    const standings = tournamentStandings(["a", "b"], [match(["a", "b"], { tournamentId: T })], T);
    expect(checkPointsCompletion({ ...base, standings, confirmedMatches: 0 }).ok).toBe(false);
    expect(checkPointsCompletion({ ...base, status: "upcoming", standings, confirmedMatches: 1 }).ok).toBe(false);
    expect(
      checkPointsCompletion({ format: "rounds", status: "in_progress", roundCount: 3, standings, confirmedMatches: 1 }),
    ).toMatchObject({ ok: false });
    expect(
      checkPointsCompletion({ format: "rounds", status: "in_progress", roundCount: 1, standings, confirmedMatches: 1 }),
    ).toEqual({ ok: true, championId: "a" });
  });
});
