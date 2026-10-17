import { describe, expect, it } from "vitest";
import { BLUFF, POKER, match, member } from "@/lib/domain/test-fixtures";
import type { MemberInfo } from "@/lib/domain/types";
import { filterMatches, type HistoryFilters } from "./match-history";

const members = new Map([member("a", "Arjun"), member("b", "Bela"), member("c", "Chirag")].map((m) => [m.profileId, m]));
const lookup = (id: string) => members.get(id) as MemberInfo;
const gameName = (id: string) => (id === BLUFF ? "Bluff" : id === POKER ? "Poker" : "Rummy");
const none: HistoryFilters = { game: "", tournament: "", player: "", status: "all", query: "" };

const history = [
  { ...match(["a", "b"], { game: BLUFF }), tournamentName: null },
  { ...match(["b", "c"], { game: POKER, tournamentId: "t1" }), tournamentName: "Winter Cup" },
  { ...match(["c", "a"], { game: BLUFF, status: "voided" }), tournamentName: null },
];

describe("filterMatches", () => {
  it("returns everything with no filters", () => {
    expect(filterMatches(history, none, lookup, gameName)).toHaveLength(3);
  });

  it("filters by game, player, tournament and status", () => {
    expect(filterMatches(history, { ...none, game: POKER }, lookup, gameName)).toHaveLength(1);
    expect(filterMatches(history, { ...none, player: "a" }, lookup, gameName)).toHaveLength(2);
    expect(filterMatches(history, { ...none, tournament: "t1" }, lookup, gameName)).toHaveLength(1);
    expect(filterMatches(history, { ...none, tournament: "none" }, lookup, gameName)).toHaveLength(2);
    expect(filterMatches(history, { ...none, status: "voided" }, lookup, gameName)).toHaveLength(1);
    expect(filterMatches(history, { ...none, status: "confirmed", player: "a" }, lookup, gameName)).toHaveLength(1);
  });

  it("searches player names, games and tournament names", () => {
    expect(filterMatches(history, { ...none, query: "chirag" }, lookup, gameName)).toHaveLength(2);
    expect(filterMatches(history, { ...none, query: "winter" }, lookup, gameName)).toHaveLength(1);
    expect(filterMatches(history, { ...none, query: "poker" }, lookup, gameName)).toHaveLength(1);
  });
});
