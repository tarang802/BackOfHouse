import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, seedClubDirect, type Db } from "./harness";

/**
 * Cross-club isolation: members of one club must not be able to read or write another
 * club's rows, whatever IDs they guess.
 */
let db: Db;
let alice: string;
let bob: string;
let mallory: string;
let clubA: string;
let clubB: string;
let matchA: string;

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, "alice");
  bob = await createUser(db, "bob");
  mallory = await createUser(db, "mallory");
  clubA = await seedClubDirect(db, alice, [bob], "Club A");
  clubB = await seedClubDirect(db, mallory, [], "Club B");

  // A match in club A, inserted directly as the owner of the database.
  const game = await db.query<{ id: string }>(`select id from public.game_types where club_id = $1`, [clubA]);
  const rule = await db.query<{ id: string }>(`select id from public.scoring_rules where club_id = $1`, [clubA]);
  const m = await db.query<{ id: string }>(
    `insert into public.matches (club_id, game_type_id, scoring_rule_id, submission_id, created_by)
     values ($1, $2, $3, $4, $5) returning id`,
    [clubA, game.rows[0].id, rule.rows[0].id, randomUUID(), alice],
  );
  matchA = m.rows[0].id;
  await db.query(
    `insert into public.match_participants (match_id, club_id, profile_id, placement, points_awarded)
     values ($1, $2, $3, 1, 3), ($1, $2, $4, 2, 1)`,
    [matchA, clubA, alice, bob],
  );
  await db.query(`insert into public.audit_logs (club_id, actor_id, action, entity_type) values ($1, $2, 'match.recorded', 'match')`, [
    clubA,
    alice,
  ]);
});

afterAll(async () => {
  await db.close();
});

const count = async (userId: string | null, sql: string, params: unknown[] = []) =>
  as(db, userId, async (tx) => (await tx.query(sql, params)).rows.length);

describe("row level security", () => {
  it("lets members read their own club", async () => {
    expect(await count(bob, `select id from public.clubs where id = $1`, [clubA])).toBe(1);
    expect(await count(bob, `select id from public.matches where club_id = $1`, [clubA])).toBe(1);
    expect(await count(bob, `select match_id from public.match_participants where match_id = $1`, [matchA])).toBe(2);
    expect(await count(bob, `select profile_id from public.club_memberships where club_id = $1`, [clubA])).toBe(2);
  });

  it("hides another club's rows even when the id is known", async () => {
    expect(await count(mallory, `select id from public.clubs where id = $1`, [clubA])).toBe(0);
    expect(await count(mallory, `select id from public.matches where id = $1`, [matchA])).toBe(0);
    expect(await count(mallory, `select * from public.match_participants where match_id = $1`, [matchA])).toBe(0);
    expect(await count(mallory, `select * from public.club_memberships where club_id = $1`, [clubA])).toBe(0);
    expect(await count(mallory, `select * from public.game_types where club_id = $1`, [clubA])).toBe(0);
    expect(await count(mallory, `select * from public.scoring_rules where club_id = $1`, [clubA])).toBe(0);
    expect(await count(mallory, `select * from public.audit_logs where club_id = $1`, [clubA])).toBe(0);
    expect(await count(mallory, `select id from public.profiles where id in ($1, $2)`, [alice, bob])).toBe(0);
  });

  it("returns nothing at all to anonymous visitors", async () => {
    await expect(count(null, `select id from public.clubs`)).rejects.toThrow(/permission denied/);
    await expect(count(null, `select id from public.profiles`)).rejects.toThrow(/permission denied/);
  });

  it("blocks direct writes to club data, even by members", async () => {
    await expect(
      as(db, alice, (tx) => tx.query(`update public.match_participants set points_awarded = 100 where match_id = $1`, [matchA])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, alice, (tx) =>
        tx.query(`insert into public.club_memberships (club_id, profile_id, role) values ($1, $2, 'member')`, [clubB, alice]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, bob, (tx) => tx.query(`update public.club_memberships set role = 'owner' where profile_id = $1`, [bob]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(db, mallory, (tx) => tx.query(`delete from public.matches where id = $1`, [matchA]))).rejects.toThrow(
      /permission denied/,
    );
    const points = await db.query<{ points_awarded: number }>(
      `select points_awarded from public.match_participants where match_id = $1 order by placement`,
      [matchA],
    );
    expect(points.rows.map((r) => r.points_awarded)).toEqual([3, 1]);
  });

  it("does not let users create a profile for someone else", async () => {
    const id = randomUUID();
    await db.query(`insert into auth.users (id) values ($1)`, [id]);
    await expect(
      as(db, mallory, (tx) => tx.query(`insert into public.profiles (id, username, display_name) values ($1, 'impostor', 'Bob')`, [id])),
    ).rejects.toThrow(/row-level security/);
  });

  it("keeps invitation codes visible to admins only", async () => {
    await db.query(`insert into public.club_invitations (club_id, code, created_by) values ($1, 'ABCDEFGH', $2)`, [clubA, alice]);
    expect(await count(alice, `select code from public.club_invitations where club_id = $1`, [clubA])).toBe(1);
    expect(await count(bob, `select code from public.club_invitations where club_id = $1`, [clubA])).toBe(0);
  });

  it("does not let API roles call internal helpers directly", async () => {
    await expect(as(db, alice, (tx) => tx.query(`select public.require_club_role($1, true)`, [clubA]))).rejects.toThrow(/permission denied/);
  });
});
