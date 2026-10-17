import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Boots an in-process Postgres (PGlite), applies the Supabase shim and then every real
 * migration in `supabase/migrations`, in order. Tests then act as specific users with
 * `as(userId, ...)`, which runs statements under the `authenticated` role with
 * auth.uid() set — exactly how PostgREST runs requests in Supabase.
 */

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export type Db = PGlite;

export async function createTestDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

type Runner = Pick<Transaction, "query" | "exec">;

/** Run `fn` as the given user (or anonymously when userId is null) in a transaction. */
export async function as<T>(db: Db, userId: string | null, fn: (tx: Runner) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    return fn(tx);
  });
}

/** Call a SQL function as a user and return its scalar result. */
export async function rpc<T = unknown>(db: Db, userId: string | null, fn: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return as(db, userId, async (tx) => {
    const result = await tx.query<{ value: T }>(`select public.${fn}(${placeholders}) as value`, args);
    return result.rows[0]?.value as T;
  });
}

/** Expect a call to fail with one of our typed app errors (raised with a hint code). */
export async function expectAppError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const hint = (error as { hint?: string }).hint;
    if (hint === code) return;
    throw new Error(`Expected app error "${code}" but got: ${hint ?? ""} ${(error as Error).message}`);
  }
  throw new Error(`Expected app error "${code}" but the call succeeded`);
}

export async function createUser(db: Db, username: string, displayName = username): Promise<string> {
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${username}@example.test`]);
  await as(db, id, (tx) =>
    tx.query(`insert into public.profiles (id, username, display_name) values ($1, $2, $3)`, [
      id,
      username,
      displayName,
    ]),
  );
  return id;
}

/**
 * Inserts a club and memberships directly (as the database owner), bypassing the
 * club functions. Used by tests that exercise RLS independently of those functions.
 */
export async function seedClubDirect(db: Db, ownerId: string, memberIds: string[] = [], name = "Seeded Club"): Promise<string> {
  const club = await db.query<{ id: string }>(`insert into public.clubs (name, created_by) values ($1, $2) returning id`, [name, ownerId]);
  const clubId = club.rows[0].id;
  await db.query(`insert into public.club_memberships (club_id, profile_id, role) values ($1, $2, 'owner')`, [clubId, ownerId]);
  for (const id of memberIds) {
    await db.query(`insert into public.club_memberships (club_id, profile_id, role) values ($1, $2, 'member')`, [clubId, id]);
  }
  await db.query(`insert into public.game_types (club_id, slug, name, kind) values ($1, 'bluff', 'Bluff', 'bluff')`, [clubId]);
  await db.query(`insert into public.scoring_rules (club_id, version, placement_points) values ($1, 1, '{3,1}')`, [clubId]);
  return clubId;
}

export async function createClubWith(db: Db, ownerId: string, memberIds: string[] = [], name = "Room 214"): Promise<string> {
  const clubId = await rpc<string>(db, ownerId, "create_club", [name, null, "Asia/Kolkata"]);
  if (memberIds.length) {
    const code = await inviteCode(db, ownerId, clubId);
    for (const memberId of memberIds) await rpc(db, memberId, "join_club", [code]);
  }
  return clubId;
}

export async function inviteCode(db: Db, userId: string, clubId: string): Promise<string> {
  return as(db, userId, async (tx) => {
    const result = await tx.query<{ code: string }>(
      `select code from public.club_invitations where club_id = $1 and revoked_at is null order by created_at limit 1`,
      [clubId],
    );
    return result.rows[0].code;
  });
}

export async function gameId(db: Db, clubId: string, slug: string): Promise<string> {
  const result = await db.query<{ id: string }>(`select id from public.game_types where club_id = $1 and slug = $2`, [
    clubId,
    slug,
  ]);
  return result.rows[0].id;
}

export function results(...entries: [string, number][]) {
  return JSON.stringify(entries.map(([profile_id, placement]) => ({ profile_id, placement })));
}

export async function recordMatch(
  db: Db,
  userId: string,
  clubId: string,
  gameTypeId: string,
  entries: [string, number][],
  extra: { submissionId?: string; tournamentId?: string | null; bracketMatchId?: string | null; ledger?: unknown } = {},
): Promise<string> {
  return rpc<string>(db, userId, "record_match", [
    clubId,
    gameTypeId,
    results(...entries),
    extra.submissionId ?? randomUUID(),
    null,
    null,
    extra.tournamentId ?? null,
    extra.bracketMatchId ?? null,
    extra.ledger === undefined ? null : JSON.stringify(extra.ledger),
  ]);
}

export async function pointsByPlayer(db: Db, matchId: string): Promise<Record<string, number>> {
  const result = await db.query<{ profile_id: string; points_awarded: number }>(
    `select profile_id, points_awarded from public.match_participants where match_id = $1`,
    [matchId],
  );
  return Object.fromEntries(result.rows.map((row) => [row.profile_id, row.points_awarded]));
}
