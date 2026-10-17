import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ACTIVE_CLUB_COOKIE = "bc_active_club";

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emblem: string;
  createdAt: string;
};

export type ClubSummary = {
  id: string;
  name: string;
  tagline: string | null;
  role: "owner" | "admin" | "member";
  playfulTitles: boolean;
  legendPointsThreshold: number;
  timezone: string;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  emblem: string;
  created_at: string;
};

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    emblem: row.emblem,
    createdAt: row.created_at,
  };
}

/** Verified user for this request (validated with Supabase Auth, not just the cookie). */
export const getSessionUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, emblem, created_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  return data ? mapProfile(data) : null;
});

export const getMyClubs = cache(async (): Promise<ClubSummary[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select("role, club:clubs(id, name, tagline, playful_titles, legend_points_threshold, timezone, created_at)")
    .eq("profile_id", user.id)
    .order("joined_at", { ascending: true });
  if (error) throw new Error("Could not load your clubs.");
  type Row = {
    role: ClubSummary["role"];
    club: {
      id: string;
      name: string;
      tagline: string | null;
      playful_titles: boolean;
      legend_points_threshold: number;
      timezone: string;
      created_at: string;
    } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.club)
    .map((row) => ({
      id: row.club!.id,
      name: row.club!.name,
      tagline: row.club!.tagline,
      role: row.role,
      playfulTitles: row.club!.playful_titles,
      legendPointsThreshold: row.club!.legend_points_threshold,
      timezone: row.club!.timezone,
      createdAt: row.club!.created_at,
    }));
});

/** Must be signed in; otherwise go to login and come back afterwards. */
export async function requireUser(next = "/club") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireProfile(next = "/club") {
  await requireUser(next);
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");
  return profile;
}

export type ClubContext = {
  profile: Profile;
  club: ClubSummary;
  clubs: ClubSummary[];
  isAdmin: boolean;
  isOwner: boolean;
};

/**
 * Resolves the club the user is looking at. The cookie is only a preference — it is
 * validated against the user's real memberships on every request.
 */
export const requireClub = cache(async (): Promise<ClubContext> => {
  const profile = await requireProfile();
  const clubs = await getMyClubs();
  if (clubs.length === 0) redirect("/onboarding");
  const preferred = (await cookies()).get(ACTIVE_CLUB_COOKIE)?.value;
  const club = clubs.find((c) => c.id === preferred) ?? clubs[0];
  return {
    profile,
    club,
    clubs,
    isAdmin: club.role === "owner" || club.role === "admin",
    isOwner: club.role === "owner",
  };
});
