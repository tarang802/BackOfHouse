import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, type Db } from "./harness";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("schema", () => {
  it("creates every core table", async () => {
    const result = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(result.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        "audit_logs",
        "club_invitations",
        "club_memberships",
        "clubs",
        "game_types",
        "match_participants",
        "matches",
        "poker_ledger_entries",
        "profiles",
        "scoring_rules",
        "seasons",
        "tournament_bracket_matches",
        "tournament_participants",
        "tournaments",
      ]),
    );
  });

  it("enforces username format and uniqueness", async () => {
    await createUser(db, "arjun");
    const id = randomUUID();
    await db.query(`insert into auth.users (id) values ($1)`, [id]);
    await expect(
      as(db, id, (tx) => tx.query(`insert into public.profiles (id, username, display_name) values ($1, 'arjun', 'Copycat')`, [id])),
    ).rejects.toThrow(/profiles_username_key/);
    await expect(
      as(db, id, (tx) => tx.query(`insert into public.profiles (id, username, display_name) values ($1, 'Bad Name!', 'X')`, [id])),
    ).rejects.toThrow(/profiles_username_format/);
  });

  it("rejects blank display names and unknown emblems", async () => {
    const id = randomUUID();
    await db.query(`insert into auth.users (id) values ($1)`, [id]);
    await expect(
      as(db, id, (tx) => tx.query(`insert into public.profiles (id, username, display_name) values ($1, 'blank_name', '   ')`, [id])),
    ).rejects.toThrow(/profiles_display_name_length/);
    await expect(
      as(db, id, (tx) =>
        tx.query(`insert into public.profiles (id, username, display_name, emblem) values ($1, 'joker_fan', 'J', 'joker')`, [id]),
      ),
    ).rejects.toThrow(/profiles_emblem_valid/);
  });
});
