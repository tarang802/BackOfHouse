import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * requireClub must never trust the active-club cookie: it is only a preference that is
 * checked against the memberships the database returns for the signed-in user.
 */

const state = {
  user: null as null | { id: string },
  profile: null as null | Record<string, unknown>,
  memberships: [] as { role: string; club: Record<string, unknown> }[],
  cookie: undefined as string | undefined,
};

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : new Error("no session") }) },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: async () => ({ data: table === "club_memberships" ? state.memberships : [], error: null }),
        maybeSingle: async () => ({ data: table === "profiles" ? state.profile : null, error: null }),
      };
      return builder;
    },
  }),
}));

const club = (id: string, name: string) => ({
  id,
  name,
  tagline: null,
  playful_titles: false,
  legend_points_threshold: 100,
  timezone: "Asia/Kolkata",
  created_at: "2026-01-01T00:00:00Z",
});

async function load() {
  vi.resetModules();
  return import("./session");
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.profile = { id: "user-1", username: "asha", display_name: "Asha", avatar_url: null, emblem: "spade", created_at: "2026-01-01" };
  state.memberships = [
    { role: "member", club: club("club-a", "Room 214") },
    { role: "owner", club: club("club-b", "Library Table") },
  ];
  state.cookie = undefined;
});

describe("requireClub", () => {
  it("sends signed-out visitors to login", async () => {
    state.user = null;
    const { requireClub } = await load();
    await expect(requireClub()).rejects.toMatchObject({ url: "/login?next=%2Fclub" });
  });

  it("sends users without a profile or a club to onboarding", async () => {
    state.profile = null;
    await expect((await load()).requireClub()).rejects.toMatchObject({ url: "/onboarding" });
    state.profile = { id: "user-1", username: "asha", display_name: "Asha", avatar_url: null, emblem: "spade", created_at: "2026-01-01" };
    state.memberships = [];
    await expect((await load()).requireClub()).rejects.toMatchObject({ url: "/onboarding" });
  });

  it("honours the cookie only for a club the user belongs to", async () => {
    state.cookie = "club-b";
    let ctx = await (await load()).requireClub();
    expect(ctx.club).toMatchObject({ id: "club-b", role: "owner" });
    expect(ctx.isOwner).toBe(true);

    state.cookie = "someone-elses-club";
    ctx = await (await load()).requireClub();
    expect(ctx.club.id).toBe("club-a");
    expect(ctx.isAdmin).toBe(false);
  });
});
