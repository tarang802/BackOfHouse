import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SCORING_RULE, scoreMatch } from "@/lib/domain/scoring";
import {
  as,
  createClubWith,
  createTestDb,
  createUser,
  expectAppError,
  gameId,
  pointsByPlayer,
  recordMatch,
  results,
  rpc,
  type Db,
} from "./harness";

let db: Db;
let a: string, b: string, c: string, d: string, outsider: string;
let clubId: string;
let otherClub: string;
let bluff: string;
let poker: string;

beforeAll(async () => {
  db = await createTestDb();
  [a, b, c, d, outsider] = await Promise.all(["asha", "bilal", "chen", "dina", "olly"].map((u) => createUser(db, u)));
  clubId = await createClubWith(db, a, [b, c, d], "Match Club");
  otherClub = await createClubWith(db, outsider, [], "Other Club");
  bluff = await gameId(db, clubId, "bluff");
  poker = await gameId(db, clubId, "poker");
});

afterAll(async () => {
  await db.close();
});

describe("record_match", () => {
  it("scores on the server exactly like the TypeScript engine", async () => {
    const entries: [string, number][] = [[c, 3], [a, 1], [d, 4], [b, 2]];
    const matchId = await recordMatch(db, b, clubId, bluff, entries);
    const expected = Object.fromEntries(
      scoreMatch(DEFAULT_SCORING_RULE, entries.map(([profileId, placement]) => ({ profileId, placement }))).map((s) => [s.profileId, s.points]),
    );
    expect(await pointsByPlayer(db, matchId)).toEqual(expected);
    expect(expected).toEqual({ [a]: 3, [b]: 1, [c]: 0, [d]: 0 });
  });

  it("gives tied players the shared place's points", async () => {
    const matchId = await recordMatch(db, a, clubId, bluff, [[a, 1], [b, 1], [c, 3]]);
    expect(await pointsByPlayer(db, matchId)).toEqual({ [a]: 3, [b]: 3, [c]: 0 });
  });

  it("stores the scoring rule version and the recorder from the session", async () => {
    const matchId = await recordMatch(db, c, clubId, bluff, [[a, 1], [b, 2]]);
    const row = await db.query<{ created_by: string; version: number; status: string }>(
      `select m.created_by, r.version, m.status from public.matches m join public.scoring_rules r on r.id = m.scoring_rule_id where m.id = $1`,
      [matchId],
    );
    expect(row.rows[0]).toEqual({ created_by: c, version: 1, status: "confirmed" });
  });

  it("never awards points twice for the same submission", async () => {
    const submissionId = randomUUID();
    const first = await recordMatch(db, a, clubId, bluff, [[a, 1], [b, 2]], { submissionId });
    const second = await recordMatch(db, a, clubId, bluff, [[a, 1], [b, 2]], { submissionId });
    expect(second).toBe(first);
    const count = await db.query(`select 1 from public.matches where submission_id = $1`, [submissionId]);
    expect(count.rows).toHaveLength(1);
  });

  it("rejects invalid placements and participants", async () => {
    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1]]), "too_few_participants");
    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1], [a, 2]]), "duplicate_participant");
    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1], [b, 2], [c, 2], [d, 3]]), "invalid_placement_sequence");
    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1], [b, 5]]), "invalid_placement");
    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1], [outsider, 2]]), "invalid_participant");
    await expectAppError(
      rpc(db, a, "record_match", [clubId, bluff, JSON.stringify([{ profile_id: a, placement: 1 }, { profile_id: b }]), randomUUID()]),
      "missing_placement",
    );
    await expectAppError(
      rpc(db, a, "record_match", [clubId, bluff, JSON.stringify([{ profile_id: "nope", placement: 1 }, { profile_id: b, placement: 2 }]), randomUUID()]),
      "invalid_participant",
    );
  });

  it("refuses to record into a club the caller does not belong to", async () => {
    await expectAppError(recordMatch(db, outsider, clubId, bluff, [[a, 1], [b, 2]]), "forbidden");
    const otherBluff = await gameId(db, otherClub, "bluff");
    // A member cannot smuggle another club's game into their own club either.
    await expectAppError(recordMatch(db, a, clubId, otherBluff, [[a, 1], [b, 2]]), "invalid_game");
  });

  it("rejects dates far in the future and over-long notes", async () => {
    await expectAppError(
      rpc(db, a, "record_match", [clubId, bluff, results([a, 1], [b, 2]), randomUUID(), "2999-01-01T00:00:00Z"]),
      "invalid_date",
    );
    await expectAppError(
      rpc(db, a, "record_match", [clubId, bluff, results([a, 1], [b, 2]), randomUUID(), null, "x".repeat(501)]),
      "invalid_notes",
    );
  });

  it("keeps old points when the scoring rules change", async () => {
    const before = await recordMatch(db, a, clubId, bluff, [[c, 1], [d, 2]]);
    // A new rule version (the admin flow is tested separately in admin.test.ts).
    await db.query(`insert into public.scoring_rules (club_id, version, placement_points) values ($1, 2, '{5,2,1}')`, [clubId]);
    const after = await recordMatch(db, a, clubId, bluff, [[c, 1], [d, 2]]);
    expect(await pointsByPlayer(db, before)).toEqual({ [c]: 3, [d]: 1 });
    expect(await pointsByPlayer(db, after)).toEqual({ [c]: 5, [d]: 2 });
  });

  it("accepts a private poker ledger only for poker players in the session", async () => {
    const ledger = [{ profile_id: a, buy_in: "100", cash_out: "250.50" }, { profile_id: b, buy_in: "100", cash_out: "0" }];
    const matchId = await recordMatch(db, a, clubId, poker, [[a, 1], [b, 2]], { ledger });
    const rows = await db.query<{ cash_out: string }>(`select cash_out from public.poker_ledger_entries where match_id = $1 order by cash_out desc`, [matchId]);
    expect(rows.rows.map((r) => Number(r.cash_out))).toEqual([250.5, 0]);
    // The ledger never changes points.
    expect(await pointsByPlayer(db, matchId)).toEqual({ [a]: 5, [b]: 2 });

    await expectAppError(recordMatch(db, a, clubId, bluff, [[a, 1], [b, 2]], { ledger }), "invalid_ledger");
    await expectAppError(
      recordMatch(db, a, clubId, poker, [[a, 1], [b, 2]], { ledger: [{ profile_id: c, buy_in: "1", cash_out: "1" }] }),
      "invalid_ledger",
    );
    await expectAppError(
      recordMatch(db, a, clubId, poker, [[a, 1], [b, 2]], { ledger: [{ profile_id: a, buy_in: "-5", cash_out: "1" }] }),
      "invalid_ledger",
    );
  });

  it("writes an activity entry without private data", async () => {
    const matchId = await recordMatch(db, d, clubId, bluff, [[d, 1], [a, 2]]);
    const log = await as(db, b, (tx) =>
      tx.query<{ action: string; details: { winner_ids: string[]; game: string } }>(
        `select action, details from public.audit_logs where entity_id = $1`,
        [matchId],
      ),
    );
    expect(log.rows[0].action).toBe("match.recorded");
    expect(log.rows[0].details.winner_ids).toEqual([d]);
    expect(JSON.stringify(log.rows[0].details)).not.toContain("@");
  });
});
