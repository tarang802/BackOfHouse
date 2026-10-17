import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createClubWith, createTestDb, createUser, expectAppError, gameId, results, rpc, type Db } from "./harness";

let db: Db;
let owner: string, a: string, b: string;
let clubId: string;
let bluff: string;
let poker: string;

async function playedAt(iso: string, entries: [string, number][], game = bluff) {
  return rpc<string>(db, owner, "record_match", [clubId, game, results(...entries), randomUUID(), iso]);
}

beforeAll(async () => {
  db = await createTestDb();
  [owner, a, b] = await Promise.all(["season_host", "season_a", "season_b"].map((u) => createUser(db, u)));
  clubId = await createClubWith(db, owner, [a, b], "Season Club"); // club time zone: Asia/Kolkata
  bluff = await gameId(db, clubId, "bluff");
  poker = await gameId(db, clubId, "poker");
  await db.query(`update public.game_types set counts_toward_overall = false where id = $1`, [poker]);
});

afterAll(async () => {
  await db.close();
});

describe("seasons", () => {
  it("allows one active season at a time, admins only", async () => {
    await expectAppError(rpc(db, a, "create_season", [clubId, "Season I", "2026-01-01", "2026-01-31"]), "forbidden");
    await rpc(db, owner, "create_season", [clubId, "Season I — The Hostel Championship", "2026-01-01", "2026-01-31"]);
    await expectAppError(rpc(db, owner, "create_season", [clubId, "Season II", "2026-02-01", null]), "season_active");
    await expectAppError(rpc(db, owner, "create_season", [clubId, "Backwards", "2026-02-01", "2026-01-01"]), "invalid_date");
  });

  it("archives standings in the club's time zone and names the champion", async () => {
    const season = await db.query<{ id: string }>(`select id from public.seasons where club_id = $1 and status = 'active'`, [clubId]);
    const seasonId = season.rows[0].id;
    await playedAt("2026-01-10T12:00:00Z", [[a, 1], [b, 2]]); // a +3, b +1
    await playedAt("2026-01-20T12:00:00Z", [[a, 1], [b, 2]]); // a +3, b +1
    await playedAt("2026-01-31T20:00:00Z", [[b, 1], [a, 2]]); // 1 Feb in India: outside the season
    await playedAt("2026-01-15T12:00:00Z", [[b, 1], [a, 2]], poker); // poker excluded from overall

    const standings = await as(db, a, (tx) =>
      tx.query<{ profile_id: string; points: string; rank: string }>(`select * from public.season_standings($1) order by rank`, [seasonId]),
    );
    expect(standings.rows.map((r) => [r.profile_id, Number(r.points), Number(r.rank)])).toEqual([
      [a, 6, 1],
      [b, 2, 2],
    ]);

    expect(await rpc(db, owner, "archive_season", [seasonId])).toBe(a);
    const archived = await db.query<{ status: string; champion_id: string; final_standings: { profile_id: string; points: number }[] }>(
      `select status, champion_id, final_standings from public.seasons where id = $1`,
      [seasonId],
    );
    expect(archived.rows[0].status).toBe("archived");
    expect(archived.rows[0].champion_id).toBe(a);
    expect(archived.rows[0].final_standings.map((r) => [r.profile_id, r.points])).toEqual([
      [a, 6],
      [b, 2],
    ]);
    // Matches are never deleted by ending a season.
    const matches = await db.query(`select 1 from public.matches where club_id = $1`, [clubId]);
    expect(matches.rows).toHaveLength(4);
  });

  it("leaves the champion empty when first place is shared", async () => {
    const seasonId = await rpc<string>(db, owner, "create_season", [clubId, "Season II — Return of the Bluffers", "2026-03-01", "2026-03-31"]);
    await playedAt("2026-03-05T12:00:00Z", [[a, 1], [b, 2]]);
    await playedAt("2026-03-06T12:00:00Z", [[b, 1], [a, 2]]);
    expect(await rpc(db, owner, "archive_season", [seasonId])).toBeNull();
  });
});
