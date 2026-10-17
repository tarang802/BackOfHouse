import { describe, expect, it } from "vitest";
import { recordMatchSchema, toSqlLedger, toSqlResults } from "./match";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const GAME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const base = {
  gameTypeId: GAME,
  submissionId: SUB,
  results: [
    { profileId: A, placement: 1 },
    { profileId: B, placement: 2 },
  ],
};

describe("recordMatchSchema", () => {
  it("accepts a valid result", () => {
    expect(recordMatchSchema.safeParse(base).success).toBe(true);
  });

  it("rejects invalid placements, duplicates and malformed ids", () => {
    const issue = (input: unknown) => {
      const r = recordMatchSchema.safeParse(input);
      return r.success ? null : r.error.issues[0]?.message;
    };
    expect(issue({ ...base, results: [{ profileId: A, placement: 1 }, { profileId: A, placement: 2 }] })).toMatch(/only appear once/);
    expect(issue({ ...base, results: [{ profileId: A, placement: 1 }, { profileId: B, placement: 3 }] })).toMatch(/cannot exceed/);
    expect(issue({ ...base, results: [{ profileId: A, placement: 1 }] })).toMatch(/at least two/);
    expect(issue({ ...base, gameTypeId: "bluff" })).toBeTruthy();
    expect(issue({ ...base, results: [{ profileId: A, placement: 1 }, { profileId: B, placement: 1.5 }] })).toBeTruthy();
  });

  it("does not accept point values from the browser", () => {
    const parsed = recordMatchSchema.parse({ ...base, results: [{ profileId: A, placement: 1, points: 99 }, { profileId: B, placement: 2 }] });
    expect(parsed.results[0]).toEqual({ profileId: A, placement: 1 });
  });

  it("requires a tournament for bracket results and ledger rows for players in the session", () => {
    expect(recordMatchSchema.safeParse({ ...base, bracketMatchId: SUB }).success).toBe(false);
    expect(recordMatchSchema.safeParse({ ...base, ledger: [{ profileId: C, buyIn: "100", cashOut: "0" }] }).success).toBe(false);
    expect(recordMatchSchema.safeParse({ ...base, ledger: [{ profileId: A, buyIn: "-1", cashOut: "0" }] }).success).toBe(false);
    expect(recordMatchSchema.safeParse({ ...base, ledger: [{ profileId: A, buyIn: "100", cashOut: "250.50" }] }).success).toBe(true);
  });

  it("limits notes", () => {
    expect(recordMatchSchema.safeParse({ ...base, notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("SQL payloads", () => {
  it("maps to the shapes record_match expects", () => {
    expect(toSqlResults(base.results)).toEqual([
      { profile_id: A, placement: 1 },
      { profile_id: B, placement: 2 },
    ]);
    expect(toSqlLedger([])).toBeNull();
    expect(toSqlLedger([{ profileId: A, buyIn: "100", cashOut: "0" }])).toEqual([{ profile_id: A, buy_in: "100", cash_out: "0" }]);
  });
});
