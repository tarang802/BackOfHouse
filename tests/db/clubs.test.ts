import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createClubWith, createTestDb, createUser, expectAppError, inviteCode, rpc, type Db } from "./harness";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("club creation", () => {
  it("makes the creator owner and seeds games, scoring and an invitation", async () => {
    const owner = await createUser(db, "founder");
    const clubId = await rpc<string>(db, owner, "create_club", ["  Room 214  ", "Trust no one", "Asia/Kolkata"]);
    const club = await db.query<{ name: string; timezone: string }>(`select name, timezone from public.clubs where id = $1`, [clubId]);
    expect(club.rows[0]).toEqual({ name: "Room 214", timezone: "Asia/Kolkata" });
    const role = await db.query<{ role: string }>(`select role from public.club_memberships where club_id = $1 and profile_id = $2`, [clubId, owner]);
    expect(role.rows[0].role).toBe("owner");
    const games = await db.query<{ slug: string }>(`select slug from public.game_types where club_id = $1 order by slug`, [clubId]);
    expect(games.rows.map((g) => g.slug)).toEqual(["bluff", "poker", "teen-patti"]);
    const rule = await db.query<{ placement_points: number[]; version: number }>(
      `select placement_points, version from public.scoring_rules where club_id = $1`,
      [clubId],
    );
    expect(rule.rows[0]).toEqual({ placement_points: [3, 1], version: 1 });
    expect(await inviteCode(db, owner, clubId)).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("requires a profile and a sensible name", async () => {
    await expectAppError(rpc(db, null, "create_club", ["Ghost Club", null, "UTC"]), "unauthenticated");
    const owner = await createUser(db, "namer");
    await expectAppError(rpc(db, owner, "create_club", ["X", null, "UTC"]), "invalid_name");
  });

  it("falls back to UTC for unknown time zones", async () => {
    const owner = await createUser(db, "tz_tester");
    const clubId = await rpc<string>(db, owner, "create_club", ["TZ Club", null, "Mars/Olympus"]);
    const club = await db.query<{ timezone: string }>(`select timezone from public.clubs where id = $1`, [clubId]);
    expect(club.rows[0].timezone).toBe("UTC");
  });
});

describe("invitations and joining", () => {
  it("joins with a valid code (any case, any spacing) and is idempotent", async () => {
    const owner = await createUser(db, "host");
    const guest = await createUser(db, "guest");
    const clubId = await rpc<string>(db, owner, "create_club", ["Join Club", null, "UTC"]);
    const code = await inviteCode(db, owner, clubId);
    expect(await rpc(db, guest, "join_club", [` ${code.toLowerCase()} `])).toBe(clubId);
    expect(await rpc(db, guest, "join_club", [code])).toBe(clubId);
    const members = await db.query(`select 1 from public.club_memberships where club_id = $1`, [clubId]);
    expect(members.rows).toHaveLength(2);
    const role = await db.query<{ role: string }>(`select role from public.club_memberships where club_id = $1 and profile_id = $2`, [clubId, guest]);
    expect(role.rows[0].role).toBe("member");
  });

  it("rejects unknown, revoked, expired and used-up codes", async () => {
    const owner = await createUser(db, "gatekeeper");
    const guest = await createUser(db, "hopeful");
    const late = await createUser(db, "latecomer");
    const clubId = await rpc<string>(db, owner, "create_club", ["Strict Club", null, "UTC"]);
    await expectAppError(rpc(db, guest, "join_club", ["NOPE1234"]), "invalid_invite");
    await expectAppError(rpc(db, guest, "join_club", ["bad"]), "invalid_invite");

    const single = await rpc<string>(db, owner, "create_invitation", [clubId, 1, 1]);
    await rpc(db, guest, "join_club", [single]);
    await expectAppError(rpc(db, late, "join_club", [single]), "invalid_invite");

    const revoked = await rpc<string>(db, owner, "create_invitation", [clubId, null, null]);
    const id = await db.query<{ id: string }>(`select id from public.club_invitations where code = $1`, [revoked]);
    await rpc(db, owner, "revoke_invitation", [id.rows[0].id]);
    await expectAppError(rpc(db, late, "join_club", [revoked]), "invalid_invite");

    const expired = await rpc<string>(db, owner, "create_invitation", [clubId, 1, null]);
    await db.query(`update public.club_invitations set expires_at = now() - interval '1 minute' where code = $1`, [expired]);
    await expectAppError(rpc(db, late, "join_club", [expired]), "invalid_invite");
  });

  it("only lets owners and admins create or revoke invitations", async () => {
    const owner = await createUser(db, "boss");
    const member = await createUser(db, "pleb");
    const outsider = await createUser(db, "outsider");
    const clubId = await createClubWith(db, owner, [member], "Admin Only");
    await expectAppError(rpc(db, member, "create_invitation", [clubId, 7, null]), "forbidden");
    await expectAppError(rpc(db, outsider, "create_invitation", [clubId, 7, null]), "forbidden");
    await expectAppError(rpc(db, owner, "create_invitation", [clubId, 365, null]), "invalid_invite");
  });

  it("previews a club name without leaking members", async () => {
    const owner = await createUser(db, "previewer");
    const guest = await createUser(db, "peeker");
    const clubId = await rpc<string>(db, owner, "create_club", ["Preview Club", null, "UTC"]);
    const code = await inviteCode(db, owner, clubId);
    const preview = await as(db, guest, (tx) => tx.query(`select * from public.preview_invitation($1)`, [code]));
    expect(preview.rows).toEqual([{ club_name: "Preview Club", member_count: 1 }]);
  });

  it("lets members leave but not the owner", async () => {
    const owner = await createUser(db, "stayer");
    const member = await createUser(db, "leaver");
    const clubId = await createClubWith(db, owner, [member], "Leaving Club");
    await rpc(db, member, "leave_club", [clubId]);
    const rows = await db.query(`select 1 from public.club_memberships where club_id = $1 and profile_id = $2`, [clubId, member]);
    expect(rows.rows).toHaveLength(0);
    await expectAppError(rpc(db, owner, "leave_club", [clubId]), "forbidden");
  });
});
