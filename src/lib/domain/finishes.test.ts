import { describe, expect, it } from "vitest";
import { bestTournamentFinish, tournamentFinish, type CompletedTournament } from "./finishes";
import { match } from "./test-fixtures";

const points: CompletedTournament = { id: "t-points", name: "Points Cup", format: "points", participantIds: ["a", "b", "c"], championId: "a" };
const knockout: CompletedTournament = {
  id: "t-ko",
  name: "Knockout",
  format: "elimination",
  participantIds: ["a", "b", "c", "d"],
  championId: "c",
  bracket: [
    { round: 1, playerA: "a", playerB: "d", winnerId: "a" },
    { round: 1, playerA: "b", playerB: "c", winnerId: "c" },
    { round: 2, playerA: "a", playerB: "c", winnerId: "c" },
  ],
};

describe("tournament finishes", () => {
  const matches = [match(["a", "b", "c"], { tournamentId: "t-points" }), match(["a", "c", "b"], { tournamentId: "t-points" })];

  it("uses final standings for points tournaments", () => {
    expect(tournamentFinish(points, "a", matches)).toBe(1);
    // b and c both have 1 point and no wins, so they share second place.
    expect(tournamentFinish(points, "b", matches)).toBe(2);
    expect(tournamentFinish(points, "c", matches)).toBe(2);
    expect(tournamentFinish(points, "z", matches)).toBeNull();
  });

  it("places knockout players by the round they went out in", () => {
    expect(tournamentFinish(knockout, "c", [])).toBe(1);
    expect(tournamentFinish(knockout, "a", [])).toBe(2); // lost the final
    expect(tournamentFinish(knockout, "b", [])).toBe(3); // lost a semi-final
    expect(tournamentFinish(knockout, "d", [])).toBe(3);
  });

  it("picks a player's best finish across tournaments", () => {
    expect(bestTournamentFinish([points, knockout], "a", matches)).toEqual({ place: 1, tournamentName: "Points Cup", tournamentId: "t-points" });
    expect(bestTournamentFinish([points, knockout], "b", matches)?.place).toBe(2);
    expect(bestTournamentFinish([], "a", matches)).toBeNull();
  });
});
