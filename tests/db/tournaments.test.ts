import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("tournament creation", () => {
  it("validates format, players and permissions", async () => {
    await expectAppError(
      rpc(db, member, "create_tournament", [clubId, "Member Cup", null, bluff, "points", today, null, null, [owner, member], "draft"]),
      "forbidden",
    );
    await expectAppError(createTournament("points", [owner]), "invalid_participants");
    await expectAppError(createTournament("points", [owner, owner]), "duplicate_participant");
    await expectAppError(createTournament("elimination", [owner, ...players.slice(0, 2)]), "invalid_participants");
    await expectAppError(createTournament("rounds", [owner, member], null), "invalid_rounds");
    const outsider = await createUser(db, "not_in_club");
    await expectAppError(createTournament("points", [owner, outsider]), "invalid_participant");
  });

  it("follows the lifecycle and refuses illegal transitions", async () => {
    const id = await createTournament("points", [owner, member]);
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[owner, 1], [member, 2]], { tournamentId: id }), "invalid_tournament_state");
    await rpc(db, owner, "set_tournament_status", [id, "upcoming"]);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    await expectAppError(rpc(db, owner, "set_tournament_status", [id, "draft"]), "invalid_tournament_state");
    await rpc(db, owner, "set_tournament_status", [id, "cancelled"]);
    await expectAppError(rpc(db, owner, "set_tournament_status", [id, "in_progress"]), "invalid_tournament_state");
  });

  it("only changes players before the start", async () => {
    const id = await createTournament("points", [owner, member]);
    await rpc(db, owner, "update_tournament_participants", [id, [owner, member, players[1]]]);
    const count = await db.query(`select 1 from public.tournament_participants where tournament_id = $1`, [id]);
    expect(count.rows).toHaveLength(3);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    await expectAppError(rpc(db, owner, "update_tournament_participants", [id, [owner, member]]), "invalid_tournament_state");
  });
});

describe("elimination tournaments", () => {
  it("draws a seeded bracket, enforces pairings and crowns the final's winner", async () => {
    const field = [owner, ...players.slice(0, 7)]; // 8 players, seeds 1..8
    const id = await createTournament("elimination", field);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    const round1 = await bracket(id);
    expect(round1).toHaveLength(4);
    // Seed order 1v8, 4v5, 2v7, 3v6
    expect(round1.map((m) => [field.indexOf(m.player_a) + 1, field.indexOf(m.player_b) + 1])).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);

    const slot = round1[0];
    // Wrong players, ties and missing bracket ids are rejected.
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[slot.player_a, 1], [round1[1].player_a, 2]], { tournamentId: id, bracketMatchId: slot.id }), "invalid_participant");
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[slot.player_a, 1], [slot.player_b, 1]], { tournamentId: id, bracketMatchId: slot.id }), "invalid_placement");
    await expectAppError(recordMatch(db, owner, clubId, bluff, [[slot.player_a, 1], [slot.player_b, 2]], { tournamentId: id }), "invalid_tournament");

    // Higher seed (player_a) wins every match.
    for (const m of round1) await recordMatch(db, owner, clubId, bluff, [[m.player_a, 1], [m.player_b, 2]], { tournamentId: id, bracketMatchId: m.id });
    await expectAppError(
      recordMatch(db, owner, clubId, bluff, [[slot.player_a, 1], [slot.player_b, 2]], { tournamentId: id, bracketMatchId: slot.id }),
      "duplicate_result",
    );
    const round2 = (await bracket(id)).filter((m) => m.round === 2);
    expect(round2.map((m) => [field.indexOf(m.player_a) + 1, field.indexOf(m.player_b) + 1])).toEqual([[1, 4], [2, 3]]);
    expect(await status(id)).toMatchObject({ status: "in_progress", champion_id: null });

    for (const m of round2) await recordMatch(db, owner, clubId, bluff, [[m.player_b, 1], [m.player_a, 2]], { tournamentId: id, bracketMatchId: m.id });
    const final = (await bracket(id)).filter((m) => m.round === 3);
    expect(final).toHaveLength(1);
    await recordMatch(db, owner, clubId, bluff, [[final[0].player_a, 1], [final[0].player_b, 2]], { tournamentId: id, bracketMatchId: final[0].id });
    expect(await status(id)).toEqual({ status: "completed", champion_id: final[0].player_a });
  });

  it("rolls the bracket back when an unfinished round's result is voided", async () => {
    const field = [owner, players[0], players[1], players[2]];
    const id = await createTournament("elimination", field);
    await rpc(db, owner, "set_tournament_status", [id, "in_progress"]);
    const r1 = await bracket(id);
    const ids = [];
    for (const m of r1) ids.push(await recordMatch(db, owner, clubId, bluff, [[m.player_a, 1], [m.player_b, 2]], { tournamentId: id, bracketMatchId: m.id }));
    expect((await bracket(id)).filter((m) => m.round === 2)).toHaveLength(1);

    // Correct the first semi-final: the final is redrawn from the corrected winner.
    await rpc(db, owner, "correct_match", [ids[0], results([r1[0].player_b, 1], [r1[0].player_a, 2]), "Wrong winner", randomUUID()]);
    const final = (await bracket(id)).filter((m) => m.round === 2);
    expect(final).toHaveLength(1);
    expect(final[0].player_a).toBe(r1[0].player_b);
  });
});
