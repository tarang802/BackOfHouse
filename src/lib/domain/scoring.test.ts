import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORING_RULE,
  describeScoringRule,
  ordinal,
  placementsFromGroups,
  pointsForPlacement,
  scoreMatch,
  validatePlacements,
  validateScoringRule,
} from "./scoring";

const p = (profileId: string, placement: number) => ({ profileId, placement });

describe("validatePlacements", () => {
  it("accepts a simple finishing order", () => {
    expect(validatePlacements([p("a", 1), p("b", 2), p("c", 3)])).toEqual({ ok: true });
  });

  it("accepts competition-ranked ties (1, 2, 2, 4)", () => {
    expect(validatePlacements([p("a", 1), p("b", 2), p("c", 2), p("d", 4)])).toEqual({ ok: true });
  });

  it("accepts a shared first place", () => {
    expect(validatePlacements([p("a", 1), p("b", 1), p("c", 3)])).toEqual({ ok: true });
  });

  it("rejects ties that do not skip the shared places", () => {
    const result = validatePlacements([p("a", 1), p("b", 2), p("c", 2), p("d", 3)]);
    expect(result).toMatchObject({ ok: false, code: "invalid_placement_sequence" });
  });

  it("rejects gaps without ties", () => {
    expect(validatePlacements([p("a", 1), p("b", 3)])).toMatchObject({ ok: false });
  });

  it("rejects orders that do not start at first place", () => {
    expect(validatePlacements([p("a", 2), p("b", 2)])).toMatchObject({ ok: false, code: "invalid_placement_sequence" });
  });

  it("rejects duplicate participants", () => {
    expect(validatePlacements([p("a", 1), p("a", 2)])).toMatchObject({ ok: false, code: "duplicate_participant" });
  });

  it("rejects missing or non-integer placements", () => {
    expect(validatePlacements([p("a", 1), p("b", 0)])).toMatchObject({ code: "missing_placement" });
    expect(validatePlacements([p("a", 1), p("b", 1.5)])).toMatchObject({ code: "missing_placement" });
    expect(validatePlacements([p("a", 1), p("b", Number.NaN)])).toMatchObject({ code: "missing_placement" });
  });

  it("rejects placements beyond the number of players", () => {
    expect(validatePlacements([p("a", 1), p("b", 3)])).toMatchObject({ code: "invalid_placement" });
  });

  it("enforces participant limits", () => {
    expect(validatePlacements([p("a", 1)])).toMatchObject({ code: "too_few_participants" });
    const many = Array.from({ length: 21 }, (_, i) => p(`p${i}`, i + 1));
    expect(validatePlacements(many)).toMatchObject({ code: "too_many_participants" });
  });
});

describe("scoring", () => {
  it("awards the default +3 / +1 / 0", () => {
    const scored = scoreMatch(DEFAULT_SCORING_RULE, [p("c", 3), p("a", 1), p("b", 2), p("d", 4)]);
    expect(scored.map((s) => [s.profileId, s.points])).toEqual([
      ["a", 3],
      ["b", 1],
      ["c", 0],
      ["d", 0],
    ]);
  });

  it("gives tied players the points of the shared position", () => {
    const scored = scoreMatch(DEFAULT_SCORING_RULE, [p("a", 1), p("b", 1), p("c", 3)]);
    expect(Object.fromEntries(scored.map((s) => [s.profileId, s.points]))).toEqual({ a: 3, b: 3, c: 0 });
  });

  it("applies custom rules with participation points", () => {
    const rule = { placementPoints: [5, 3, 1], participationPoints: 1 };
    expect(pointsForPlacement(rule, 1)).toBe(6);
    expect(pointsForPlacement(rule, 3)).toBe(2);
    expect(pointsForPlacement(rule, 7)).toBe(1);
  });

  it("refuses to score an invalid result", () => {
    expect(() => scoreMatch(DEFAULT_SCORING_RULE, [p("a", 1), p("b", 1), p("c", 2)])).toThrow();
  });
});

describe("validateScoringRule", () => {
  it("accepts the default rule", () => {
    expect(validateScoringRule(DEFAULT_SCORING_RULE)).toEqual({ ok: true });
  });

  it("rejects increasing points, zero first place, negatives and oversized tables", () => {
    expect(validateScoringRule({ placementPoints: [1, 3], participationPoints: 0 }).ok).toBe(false);
    expect(validateScoringRule({ placementPoints: [0], participationPoints: 0 }).ok).toBe(false);
    expect(validateScoringRule({ placementPoints: [3, -1], participationPoints: 0 }).ok).toBe(false);
    expect(validateScoringRule({ placementPoints: Array(11).fill(1), participationPoints: 0 }).ok).toBe(false);
    expect(validateScoringRule({ placementPoints: [3], participationPoints: 11 }).ok).toBe(false);
    expect(validateScoringRule({ placementPoints: [], participationPoints: 0 }).ok).toBe(false);
  });
});

describe("placementsFromGroups", () => {
  it("turns ordered groups into competition ranks", () => {
    expect(placementsFromGroups([["a"], ["b", "c"], ["d"]])).toEqual([
      p("a", 1),
      p("b", 2),
      p("c", 2),
      p("d", 4),
    ]);
  });

  it("produces placements that always validate", () => {
    const placements = placementsFromGroups([["a", "b"], [], ["c"], ["d", "e", "f"]]);
    expect(validatePlacements(placements)).toEqual({ ok: true });
  });
});

describe("labels", () => {
  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });

  it("describes a rule in plain language", () => {
    expect(describeScoringRule(DEFAULT_SCORING_RULE)).toEqual([
      "1st place: +3 points",
      "2nd place: +1 point",
      "Other places: +0 points",
    ]);
  });
});
