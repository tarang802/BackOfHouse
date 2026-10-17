import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { headToHead } from "@/lib/domain/rivalry";
import { computePlayerStats } from "@/lib/domain/stats";
import type { GameTypeInfo, MatchRecord, MemberInfo } from "@/lib/domain/types";
import { as, createTestDb, createUser, expectAppError, gameId, inviteCode, recordMatch, results, rpc, type Db } from "./harness";

/**
 * The definition-of-done journey, end to end against the real migrations: a user opens a
 * club, friends join by invitation, results are recorded, validated and scored by the
 * database, and the leaderboard / stats / rivalries computed from what each member can read
 * through RLS reflect exactly what happened — including a correction and a tournament.
 */

let db: Db;
let host: string, friendA: string, friendB: string, stranger: string;
let clubId: string;

/** Everything a member sees, loaded the way the app loads it (as that member, through RLS). */
async function loadAs(userId: string) {
  return as(db, userId, async (tx) => {
    const members = await tx.query<{ profile_id: string; role: MemberInfo["role"]; joined_at: string; username: string; display_name: string }>(
      `select m.profile_id, m.role, m.joined_at, p.username, p.display_name
       from public.club_memberships m join public.profiles p on p.id = m.profile_id where m.club_id = $1`,
      [clubId],
    );
    const games = await tx.query<{ id: string; slug: string; name: string; kind: GameTypeInfo["kind"]; counts_toward_overall: boolean; is_archived: boolean }>(
      `select id, slug, name, kind, counts_toward_overall, is_archived from public.game_types where club_id = $1`,
      [clubId],
    );
    const rows = await tx.query<{ id: string; game_type_id: string; tournament_id: string | null; played_at: string; created_at: string; status: "confirmed" | "voided"; profile_id: string; placement: number; points_awarded: number }>(
      `select m.id, m.game_type_id, m.tournament_id, m.played_at::text, m.created_at::text, m.status, mp.profile_id, mp.placement, mp.points_awarded
       from public.matches m join public.match_participants mp on mp.match_id = m.id where m.club_id = $1`,
      [clubId],
    );
    const matches = new Map<string, MatchRecord>();
    for (const r of rows.rows) {
      const m = matches.get(r.id) ?? { id: r.id, gameTypeId: r.game_type_id, tournamentId: r.tournament_id, playedAt: r.played_at, createdAt: r.created_at, status: r.status, participants: [] };
      m.participants.push({ profileId: r.profile_id, placement: r.placement, pointsAwarded: r.points_awarded });
      matches.set(r.id, m);
    }
    return {
      members: members.rows.map((m) => ({ profileId: m.profile_id, username: m.username, displayName: m.display_name, avatarUrl: null, emblem: "spade", role: m.role, joinedAt: m.joined_at })),
      games: games.rows.map((g) => ({ id: g.id, slug: g.slug, name: g.name, kind: g.kind, countsTowardOverall: g.counts_toward_overall, isArchived: g.is_archived })),
      matches: [...matches.values()],
    };
  });
}

beforeAll(async () => {
  db = await createTestDb();
  [host, friendA, friendB, stranger] = await Promise.all(["host_h", "friend_a", "friend_b", "stranger_s"].map((u) => createUser(db, u)));
});

afterAll(async () => {
  await db.close();
});

describe("club journey", () => {
  it("opens a club and lets friends in by invitation only", async () => {
    clubId = await rpc<string>(db, host, "create_club", ["Room 214", "Trust no one", "Asia/Kolkata"]);
    const code = await inviteCode(db, host, clubId);
    await rpc(db, friendA, "join_club", [code]);
    await rpc(db, friendB, "join_club", [code]);
    const view = await loadAs(friendA);
    expect(view.members.map((m) => m.username).sort()).toEqual(["friend_a", "friend_b", "host_h"]);
    // The stranger cannot see the club at all.
    const strangerView = await loadAs(stranger);
    expect(strangerView.members).toEqual([]);
    expect(strangerView.matches).toEqual([]);
  });

  it("records results and the leaderboard reflects them", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const poker = await gameId(db, clubId, "poker");
    await recordMatch(db, friendA, clubId, bluff, [[friendA, 1], [host, 2], [friendB, 3]]);
    await recordMatch(db, host, clubId, bluff, [[friendB, 1], [friendA, 2], [host, 3]]);
    await recordMatch(db, friendB, clubId, poker, [[host, 1], [friendB, 2], [friendA, 3]]);

    const view = await loadAs(friendB);
    const board = buildLeaderboard(view.matches, view.members, leaderboardFilters.overall(view.games));
    // Everyone has 4 points, 1 win and a 1/3 win rate: a three-way tie that shares first place,
    // listed alphabetically.
    expect(board.map((e) => [e.member.username, e.stats.points, e.stats.wins, e.rank])).toEqual([
      ["friend_a", 4, 1, 1],
      ["friend_b", 4, 1, 1],
      ["host_h", 4, 1, 1],
    ]);

    const bluffBoard = buildLeaderboard(view.matches, view.members, leaderboardFilters.game(bluff));
    expect(bluffBoard[0]).toMatchObject({ rank: 1, member: { username: "friend_a" }, stats: { points: 4, wins: 1 } });
    expect(computePlayerStats(view.matches, host)).toMatchObject({ games: 3, wins: 1, losses: 2 });
  });

  it("rejects bad submissions without changing anything", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const before = (await loadAs(host)).matches.length;
    await expectAppError(recordMatch(db, host, clubId, bluff, [[host, 1], [stranger, 2]]), "invalid_participant");
    await expectAppError(recordMatch(db, stranger, clubId, bluff, [[host, 1], [friendA, 2]]), "forbidden");
    await expectAppError(
      rpc(db, host, "record_match", [clubId, bluff, results([host, 1], [friendA, 1], [friendB, 2]), randomUUID()]),
      "invalid_placement_sequence",
    );
    expect((await loadAs(host)).matches.length).toBe(before);
  });

  it("applies an admin correction everywhere at once", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const wrong = await recordMatch(db, friendA, clubId, bluff, [[friendA, 1], [friendB, 2]]);
    let view = await loadAs(host);
    expect(headToHead(view.matches, friendA, friendB).aheadA).toBe(2);

    await rpc(db, host, "correct_match", [wrong, results([friendB, 1], [friendA, 2]), "Bela actually won", randomUUID()]);
    view = await loadAs(host);
    const h2h = headToHead(view.matches, friendA, friendB);
    expect(h2h).toMatchObject({ aheadA: 1, aheadB: 3, encounters: 4 });
    expect(view.matches.find((m) => m.id === wrong)?.status).toBe("voided");
  });

  it("runs a tournament to a legitimate champion", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const t = await rpc<string>(db, host, "create_tournament", [clubId, "Midnight Cup", null, bluff, "rounds", "2026-10-17", null, 2, [host, friendA, friendB], "upcoming"]);
    await rpc(db, host, "set_tournament_status", [t, "in_progress"]);
    await recordMatch(db, friendA, clubId, bluff, [[friendB, 1], [host, 2], [friendA, 3]], { tournamentId: t });
    await expectAppError(rpc(db, host, "complete_tournament", [t]), "invalid_tournament_state");
    await recordMatch(db, friendA, clubId, bluff, [[friendB, 1], [friendA, 2], [host, 3]], { tournamentId: t });
    expect(await rpc(db, host, "complete_tournament", [t])).toBe(friendB);
  });

  it("treats a replayed submission from a flaky connection as the same match", async () => {
    const bluff = await gameId(db, clubId, "bluff");
    const submissionId = randomUUID();
    const [first, second] = await Promise.all([
      recordMatch(db, friendA, clubId, bluff, [[friendA, 1], [host, 2]], { submissionId }),
      recordMatch(db, friendA, clubId, bluff, [[friendA, 1], [host, 2]], { submissionId }),
    ]);
    expect(first).toBe(second);
    const count = await db.query(`select 1 from public.matches where submission_id = $1`, [submissionId]);
    expect(count.rows).toHaveLength(1);
  });

  it("does not let a member point a match at another club's tournament", async () => {
    const otherClub = await rpc<string>(db, stranger, "create_club", ["Elsewhere", null, "UTC"]);
    const otherBluff = await gameId(db, otherClub, "bluff");
    const code = await inviteCode(db, stranger, otherClub);
    await rpc(db, host, "join_club", [code]);
    const theirs = await rpc<string>(db, stranger, "create_tournament", [otherClub, "Their Cup", null, otherBluff, "points", "2026-10-17", null, null, [stranger, host], "upcoming"]);
    await rpc(db, stranger, "set_tournament_status", [theirs, "in_progress"]);
    const bluff = await gameId(db, clubId, "bluff");
    await expectAppError(recordMatch(db, host, clubId, bluff, [[host, 1], [friendA, 2]], { tournamentId: theirs }), "invalid_tournament");
  });
});
