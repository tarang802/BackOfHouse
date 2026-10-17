import { describe, expect, it } from "vitest";
import { createTournamentSchema } from "./tournament";

const ids = Array.from({ length: 9 }, (_, i) => `${String(i + 1).repeat(8)}-1111-4111-8111-111111111111`);
const base = {
  name: "Winter Cup",
  gameTypeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  format: "points" as const,
  startsOn: "2026-11-01",
  participantIds: ids.slice(0, 3),
  status: "upcoming" as const,
};

const firstIssue = (input: unknown) => {
  const result = createTournamentSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("createTournamentSchema", () => {
  it("accepts a points tournament", () => {
    expect(firstIssue(base)).toBeNull();
  });

  it("requires a power-of-two field for knockouts", () => {
    expect(firstIssue({ ...base, format: "elimination" })).toMatch(/2, 4, 8, 16 or 32/);
    expect(firstIssue({ ...base, format: "elimination", participantIds: ids.slice(0, 8) })).toBeNull();
  });

  it("requires a round count for fixed-round tournaments", () => {
    expect(firstIssue({ ...base, format: "rounds" })).toMatch(/number of rounds/);
    expect(firstIssue({ ...base, format: "rounds", roundCount: 3 })).toBeNull();
  });

  it("rejects duplicate players, too few players and backwards dates", () => {
    expect(firstIssue({ ...base, participantIds: [ids[0], ids[0]] })).toMatch(/only be registered once/);
    expect(firstIssue({ ...base, participantIds: [ids[0]] })).toMatch(/at least two/);
    expect(firstIssue({ ...base, endsOn: "2026-10-01" })).toMatch(/on or after/);
  });

  it("only creates drafts or upcoming tournaments", () => {
    expect(createTournamentSchema.safeParse({ ...base, status: "completed" }).success).toBe(false);
  });
});
