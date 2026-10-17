import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClubWith, createTestDb, createUser, expectAppError, gameId, pointsByPlayer, recordMatch, results, rpc, type Db } from "./harness";

let db: Db;
let owner: string, member: string, other: string, outsider: string;
let clubId: string;
let bluff: string;

async function confirmedPoints(profileId: string): Promise<number> {
  const r = await db.query<{ total: number }>(
    `select coalesce(sum(mp.points_awarded), 0)::int as total
     from public.match_participants mp join public.matches m on m.id = mp.match_id
     where m.club_id = $1 and m.status = 'confirmed' and mp.profile_id = $2`,
    [clubId, profileId],
  );
  return r.rows[0].total;
}

beforeAll(async () => {
  db = await createTestDb();
  [owner, member, other, outsider] = await Promise.all(["owen", "mia", "omar", "xavi"].map((u) => createUser(db, u)));
  clubId = await createClubWith(db, owner, [member, other], "Fix Club");
  await createClubWith(db, outsider, [], "Outside Club");
  bluff = await gameId(db, clubId, "bluff");
});

afterAll(async () => {
  await db.close();
});

describe("voiding", () => {
  it("removes a match from every total but keeps it in history with a reason", async () => {
    const matchId = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2]]);
    const before = await confirmedPoints(member);
    await rpc(db, owner, "void_match", [matchId, "Wrong game recorded"]);
    expect(await confirmedPoints(member)).toBe(before - 3);
    const row = await db.query<{ status: string; void_reason: string; voided_by: string }>(
      `select status, void_reason, voided_by from public.matches where id = $1`,
      [matchId],
    );
    expect(row.rows[0]).toEqual({ status: "voided", void_reason: "Wrong game recorded", voided_by: owner });
    await expectAppError(rpc(db, owner, "void_match", [matchId, "Again"]), "invalid_match_state");
  });

  it("is restricted to owners and admins of that club, with a reason", async () => {
    const matchId = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2]]);
    await expectAppError(rpc(db, member, "void_match", [matchId, "I lost"]), "forbidden");
    await expectAppError(rpc(db, outsider, "void_match", [matchId, "Sabotage"]), "not_found");
    await expectAppError(rpc(db, owner, "void_match", [matchId, ""]), "invalid_reason");
  });
});

describe("corrections", () => {
  it("voids the original and records a linked replacement under the original scoring rules", async () => {
    const original = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2], [owner, 3]]);
    // Scoring changes after the match was played...
    await db.query(`insert into public.scoring_rules (club_id, version, placement_points) values ($1, 2, '{10,5}')`, [clubId]);
    const corrected = await rpc<string>(db, owner, "correct_match", [original, results([other, 1], [member, 2], [owner, 3]), "Swapped first and second", randomUUID()]);
    expect(corrected).not.toBe(original);
    // ...but the correction is still scored with the version the match was played under.
    expect(await pointsByPlayer(db, corrected)).toEqual({ [other]: 3, [member]: 1, [owner]: 0 });
    const rows = await db.query<{ id: string; status: string; corrects_match_id: string | null }>(
      `select id, status, corrects_match_id from public.matches where id in ($1, $2)`,
      [original, corrected],
    );
    const byId = Object.fromEntries(rows.rows.map((r) => [r.id, r]));
    expect(byId[original].status).toBe("voided");
    expect(byId[corrected]).toMatchObject({ status: "confirmed", corrects_match_id: original });
  });

  it("is idempotent per submission and validates the new result", async () => {
    const original = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2]]);
    const submission = randomUUID();
    const first = await rpc<string>(db, owner, "correct_match", [original, results([other, 1], [member, 2]), "Fix", submission]);
    const replay = await rpc<string>(db, owner, "correct_match", [original, results([other, 1], [member, 2]), "Fix", submission]);
    expect(replay).toBe(first);

    const another = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2]]);
    await expectAppError(rpc(db, owner, "correct_match", [another, results([other, 1], [other, 2]), "Bad", randomUUID()]), "duplicate_participant");
    // A failed correction must leave the original untouched.
    const status = await db.query<{ status: string }>(`select status from public.matches where id = $1`, [another]);
    expect(status.rows[0].status).toBe("confirmed");
  });

  it("is restricted to admins", async () => {
    const original = await recordMatch(db, member, clubId, bluff, [[member, 1], [other, 2]]);
    await expectAppError(rpc(db, member, "correct_match", [original, results([other, 1], [member, 2]), "Mine", randomUUID()]), "forbidden");
  });

  it("logs voids and corrections in the audit trail", async () => {
    const log = await db.query<{ action: string }>(
      `select action from public.audit_logs where club_id = $1 and action in ('match.voided', 'match.corrected')`,
      [clubId],
    );
    expect(log.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["match.voided", "match.corrected"]));
  });
});
