import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, seedClubDirect, type Db } from "./harness";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

describe("profiles", () => {
  it("only lets avatars point into the user's own storage folder", async () => {
    const id = await createUser(db, "photo_owner");
    const own = `https://x.supabase.co/storage/v1/object/public/avatars/${id}/avatar.webp?v=1`;
    const other = `https://x.supabase.co/storage/v1/object/public/avatars/${randomUUID()}/avatar.webp`;
    await as(db, id, (tx) => tx.query(`update public.profiles set avatar_url = $2 where id = $1`, [id, own]));
    await expect(as(db, id, (tx) => tx.query(`update public.profiles set avatar_url = $2 where id = $1`, [id, other]))).rejects.toThrow(
      /profiles_avatar_url_own_folder/,
    );
    await expect(
      as(db, id, (tx) => tx.query(`update public.profiles set avatar_url = 'javascript:alert(1)' where id = $1`, [id])),
    ).rejects.toThrow();
  });

  it("lets users edit only their own profile", async () => {
    const me = await createUser(db, "editor");
    const other = await createUser(db, "victim");
    await seedClubDirect(db, me, [other], "Edit Room");
    await as(db, me, (tx) => tx.query(`update public.profiles set display_name = 'Hacked' where id = $1`, [other]));
    const result = await db.query<{ display_name: string }>(`select display_name from public.profiles where id = $1`, [other]);
    expect(result.rows[0].display_name).toBe("victim");
  });

  it("hides profiles of people who share no club", async () => {
    const me = await createUser(db, "loner");
    const stranger = await createUser(db, "stranger");
    const visible = await as(db, me, (tx) => tx.query(`select id from public.profiles where id = $1`, [stranger]));
    expect(visible.rows).toHaveLength(0);
  });

  it("never exposes auth emails through the API roles", async () => {
    const me = await createUser(db, "curious");
    await expect(as(db, me, (tx) => tx.query(`select email from auth.users`))).rejects.toThrow(/permission denied/);
  });
});
