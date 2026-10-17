import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClubWith, createTestDb, createUser, expectAppError, gameId, pointsByPlayer, recordMatch, rpc, type Db } from "./harness";

let db: Db;
let owner: string, admin: string, member: string, member2: string, outsider: string;
let clubId: string;

async function roleOf(profileId: string) {
  const r = await db.query<{ role: string }>(`select role from public.club_memberships where club_id = $1 and profile_id = $2`, [clubId, profileId]);
  return r.rows[0]?.role ?? null;
}

beforeAll(async () => {
  db = await createTestDb();
  [owner, admin, member, member2, outsider] = await Promise.all(["root", "deputy", "regular", "regular2", "intruder"].map((u) => createUser(db, u)));
  clubId = await createClubWith(db, owner, [admin, member, member2], "Admin Club");
  await createClubWith(db, outsider, [], "Intruder Club");
  await rpc(db, owner, "set_member_role", [clubId, admin, "admin"]);
});

afterAll(async () => {
  await db.close();
});

describe("scoring settings", () => {
  it("creates gapless versions, owner only, and applies to new matches only", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const before = await recordMatch(db, member, clubId, bluff, [[member, 1], [member2, 2], [admin, 3]]);
    await expectAppError(rpc(db, admin, "update_scoring_rules", [clubId, [5, 3, 1], 0]), "forbidden");
    await expectAppError(rpc(db, outsider, "update_scoring_rules", [clubId, [5, 3, 1], 0]), "forbidden");
    expect(await rpc(db, owner, "update_scoring_rules", [clubId, [5, 3, 1], 1])).toBe(2);
    const after = await recordMatch(db, member, clubId, bluff, [[member, 1], [member2, 2], [admin, 3]]);
    expect(await pointsByPlayer(db, before)).toEqual({ [member]: 3, [member2]: 1, [admin]: 0 });
    expect(await pointsByPlayer(db, after)).toEqual({ [member]: 6, [member2]: 4, [admin]: 2 });
  });

  it("rejects invalid scoring configurations", async () => {
    await expectAppError(rpc(db, owner, "update_scoring_rules", [clubId, [1, 3], 0]), "invalid_scoring");
    await expectAppError(rpc(db, owner, "update_scoring_rules", [clubId, [0], 0]), "invalid_scoring");
    await expectAppError(rpc(db, owner, "update_scoring_rules", [clubId, [], 0]), "invalid_scoring");
    await expectAppError(rpc(db, owner, "update_scoring_rules", [clubId, [3, -1], 0]), "invalid_scoring");
    await expectAppError(rpc(db, owner, "update_scoring_rules", [clubId, [3], 11]), "invalid_scoring");
  });
});

describe("games", () => {
  it("adds custom games and toggles overall inclusion", async () => {
    const id = await rpc<string>(db, admin, "add_game_type", [clubId, "Rummy 500", true]);
    const game = await db.query<{ slug: string; kind: string }>(`select slug, kind from public.game_types where id = $1`, [id]);
    expect(game.rows[0]).toEqual({ slug: "rummy-500", kind: "custom" });
    await expectAppError(rpc(db, admin, "add_game_type", [clubId, "rummy 500", true]), "duplicate_game");
    await expectAppError(rpc(db, member, "add_game_type", [clubId, "Hearts", true]), "forbidden");

    const poker = await gameId(db, clubId, "poker");
    await rpc(db, owner, "update_game_type", [poker, false, null]);
    const p = await db.query<{ counts_toward_overall: boolean }>(`select counts_toward_overall from public.game_types where id = $1`, [poker]);
    expect(p.rows[0].counts_toward_overall).toBe(false);
    await expectAppError(rpc(db, outsider, "update_game_type", [poker, true, null]), "not_found");
  });
});

describe("membership administration", () => {
  it("lets only the owner change roles", async () => {
    await expectAppError(rpc(db, admin, "set_member_role", [clubId, member, "admin"]), "forbidden");
    await expectAppError(rpc(db, owner, "set_member_role", [clubId, member, "owner"]), "invalid_role");
    await expectAppError(rpc(db, owner, "set_member_role", [clubId, owner, "member"]), "forbidden");
  });

  it("lets admins remove members but not other admins or the owner", async () => {
    await expectAppError(rpc(db, admin, "remove_member", [clubId, owner]), "forbidden");
    await expectAppError(rpc(db, member, "remove_member", [clubId, member2]), "forbidden");
    await rpc(db, admin, "remove_member", [clubId, member2]);
    expect(await roleOf(member2)).toBeNull();
    // Their history stays.
    const history = await db.query(`select 1 from public.match_participants where profile_id = $1`, [member2]);
    expect(history.rows.length).toBeGreaterThan(0);
  });

  it("transfers ownership atomically", async () => {
    await expectAppError(rpc(db, admin, "transfer_ownership", [clubId, admin]), "forbidden");
    await rpc(db, owner, "transfer_ownership", [clubId, admin]);
    expect(await roleOf(admin)).toBe("owner");
    expect(await roleOf(owner)).toBe("admin");
    const owners = await db.query(`select 1 from public.club_memberships where club_id = $1 and role = 'owner'`, [clubId]);
    expect(owners.rows).toHaveLength(1);
  });

  it("updates club settings with validation", async () => {
    await rpc(db, admin, "update_club_settings", [clubId, "Admin Club Prime", "New tagline", true, 250, "Asia/Kolkata"]);
    const club = await db.query<{ name: string; playful_titles: boolean; legend_points_threshold: number }>(
      `select name, playful_titles, legend_points_threshold from public.clubs where id = $1`,
      [clubId],
    );
    expect(club.rows[0]).toEqual({ name: "Admin Club Prime", playful_titles: true, legend_points_threshold: 250 });
    await expectAppError(rpc(db, admin, "update_club_settings", [clubId, "Admin Club", null, false, 5, "UTC"]), "invalid_threshold");
    await expectAppError(rpc(db, admin, "update_club_settings", [clubId, "Admin Club", null, false, 100, "Nowhere/Land"]), "invalid_timezone");
    await expectAppError(rpc(db, member, "update_club_settings", [clubId, "Hijacked", null, false, 100, "UTC"]), "forbidden");
  });
});
