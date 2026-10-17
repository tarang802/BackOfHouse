import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tournamentStandings } from "@/lib/domain/standings";
import { as, createClubWith, createTestDb, createUser, expectAppError, gameId, recordMatch, results, rpc, type Db } from "./harness";

let db: Db;
let owner: string;
let players: string[];
let member: string;
let clubId: string;
let bluff: string;
let poker: string;

const today = "2026-10-17";

async function createTournament(format: "points" | "rounds" | "elimination", ids: string[], roundCount: number | null = null) {
  return rpc<string>(db, owner, "create_tournament", [clubId, `Cup ${randomUUID().slice(0, 6)}`, null, bluff, format, today, null, roundCount, ids, "draft"]);
}

async function status(id: string) {
  const r = await db.query<{ status: string; champion_id: string | null }>(`select status, champion_id from public.tournaments where id = $1`, [id]);
  return r.rows[0];
}

async function bracket(id: string) {
  const r = await db.query<{ id: string; round: number; slot: number; player_a: string; player_b: string; winner_id: string | null }>(
    `select id, round, slot, player_a, player_b, winner_id from public.tournament_bracket_matches where tournament_id = $1 order by round, slot`,
    [id],
  );
  return r.rows;
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db, "commissioner");
  players = await Promise.all(["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map((u) => createUser(db, `player_${u}`)));
  member = players[0];
  clubId = await createClubWith(db, owner, players, "Cup Club");
  bluff = await gameId(db, clubId, "bluff");
  poker = await gameId(db, clubId, "poker");
});

afterAll(async () => {
  await db.close();
});

describe("points tournaments", () => {
  it("only accepts registered players and the tournament's game", async () => {
    const id = await createTournament("points", [owner, member]);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[owner, 1], [players[3], 2]], { tournamentId: id }), "invalid_participant");
    await expectAppError(recordMatch(db, owner, clubId, poker, [[owner, 1], [member, 2]], { tournamentId: id }), "invalid_game");
  });

  it("refuses to crown a champion while first place is tied, then crowns the outright leader", async () => {
    const [x, y, z] = [players[1], players[2], players[3]];
    const id = await createTournament("points", [x, y, z]);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    await expectAppError(rpc(db, owner, "complete_tournament", [id]), "invalid_tournament_state");

    await recordMatch(db, owner, clubId, bluff, [[x, 1], [y, 2], [z, 3]], { tournamentId: id });
    await recordMatch(db, owner, clubId, bluff, [[y, 1], [x, 2], [z, 3]], { tournamentId: id });
    await expectAppError(rpc(db, owner, "complete_tournament", [id]), "tied_for_first");
    expect((await status(id)).status).toBe("in_progress");

    await recordMatch(db, owner, clubId, bluff, [[y, 1], [z, 2], [x, 3]], { tournamentId: id });

    // SQL standings agree with the TypeScript engine.
    const sql = await as(db, owner, (tx) =>
      tx.query<{ profile_id: string; points: string; rank: string }>(`select * from public.tournament_standings($1) order by rank, profile_id`, [id]),
    );
    const matches = await db.query<{ id: string; profile_id: string; placement: number; points_awarded: number }>(
      `select m.id, mp.profile_id, mp.placement, mp.points_awarded from public.matches m join public.match_participants mp on mp.match_id = m.id where m.tournament_id = $1`,
      [id],
    );
    const records = Object.values(
      matches.rows.reduce<Record<string, { id: string; participants: { profileId: string; placement: number; pointsAwarded: number }[] }>>((acc, row) => {
        (acc[row.id] ??= { id: row.id, participants: [] }).participants.push({ profileId: row.profile_id, placement: row.placement, pointsAwarded: row.points_awarded });
        return acc;
      }, {}),
    ).map((m) => ({ ...m, gameTypeId: bluff, tournamentId: id, playedAt: today, createdAt: today, status: "confirmed" as const }));
    const ts = tournamentStandings([x, y, z], records, id);
    expect(sql.rows.map((r) => [r.profile_id, Number(r.points), Number(r.rank)]).sort()).toEqual(ts.map((r) => [r.profileId, r.points, r.rank]).sort());

    expect(await rpc(db, owner, "complete_tournament", [id])).toBe(y);
    expect(await status(id)).toEqual({ status: "completed", champion_id: y });
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[x, 1], [y, 2]], { tournamentId: id }), "invalid_tournament_state");
  });

  it("freezes the results of a completed tournament", async () => {
    const id = await createTournament("points", [owner, member]);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    const matchId = await recordMatch(db, owner, clubId, bluff, [[owner, 1], [member, 2]], { tournamentId: id });
    await rpc(db, owner, "complete_tournament", [id]);
    await expectAppError(rpc(db, owner, "void_match", [matchId, "Second thoughts"]), "invalid_tournament_state");
  });
});

describe("rounds tournaments", () => {
  it("requires every round before completion and rejects extra rounds", async () => {
    const id = await createTournament("rounds", [owner, member], 2);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    await recordMatch(db, owner, clubId, bluff, [[owner, 1], [member, 2]], { tournamentId: id });
    await expectAppError(rpc(db, owner, "complete_tournament", [id]), "invalid_tournament_state");
    await recordMatch(db, owner, clubId, bluff, [[owner, 1], [member, 2]], { tournamentId: id });
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[owner, 1], [member, 2]], { tournamentId: id }), "invalid_tournament_state");
    const rounds = await db.query<{ tournament_round: number }>(`select tournament_round from public.matches where tournament_id = $1 order by tournament_round`, [id]);
    expect(rounds.rows.map((r) => r.tournament_round)).toEqual([1, 2]);
    expect(await rpc(db, owner, "complete_tournament", [id])).toBe(owner);
  });
});
