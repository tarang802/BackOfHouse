import "server-only";
import { cache } from "react";
import type { GameKind, GameTypeInfo, MatchRecord, MemberInfo } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Club-wide reads. Every query runs with the user's session, so RLS guarantees only
 * this club's rows come back even if a club id were tampered with.
 */

const PAGE_SIZE = 1000;

export type MatchDetail = MatchRecord & {
  notes: string | null;
  createdBy: string | null;
  scoringRuleId: string;
  voidedAt: string | null;
  voidReason: string | null;
  correctsMatchId: string | null;
  tournamentRound: number | null;
  bracketMatchId: string | null;
};

type MatchRow = {
  id: string;
  game_type_id: string;
  tournament_id: string | null;
  tournament_round: number | null;
  bracket_match_id: string | null;
  scoring_rule_id: string;
  played_at: string;
  created_at: string;
  status: "confirmed" | "voided";
  notes: string | null;
  created_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  corrects_match_id: string | null;
  match_participants: { profile_id: string; placement: number; points_awarded: number }[];
};

export const MATCH_COLUMNS =
  "id, game_type_id, tournament_id, tournament_round, bracket_match_id, scoring_rule_id, played_at, created_at, status, notes, created_by, voided_at, void_reason, corrects_match_id, match_participants(profile_id, placement, points_awarded)";

export function mapMatch(row: MatchRow): MatchDetail {
  return {
    id: row.id,
    gameTypeId: row.game_type_id,
    tournamentId: row.tournament_id,
    tournamentRound: row.tournament_round,
    bracketMatchId: row.bracket_match_id,
    scoringRuleId: row.scoring_rule_id,
    playedAt: row.played_at,
    createdAt: row.created_at,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    correctsMatchId: row.corrects_match_id,
    participants: [...row.match_participants]
      .sort((a, b) => a.placement - b.placement)
      .map((p) => ({ profileId: p.profile_id, placement: p.placement, pointsAwarded: p.points_awarded })),
  };
}

export const getMembers = cache(async (clubId: string): Promise<MemberInfo[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select("role, joined_at, profile:profiles(id, username, display_name, avatar_url, emblem)")
    .eq("club_id", clubId);
  if (error) throw new Error("Could not load club members.");
  type Row = {
    role: MemberInfo["role"];
    joined_at: string;
    profile: { id: string; username: string; display_name: string; avatar_url: string | null; emblem: string } | null;
  };
  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.profile)
    .map((row) => ({
      profileId: row.profile!.id,
      username: row.profile!.username,
      displayName: row.profile!.display_name,
      avatarUrl: row.profile!.avatar_url,
      emblem: row.profile!.emblem,
      role: row.role,
      joinedAt: row.joined_at,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
});

export const getGameTypes = cache(async (clubId: string): Promise<GameTypeInfo[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("game_types")
    .select("id, slug, name, kind, counts_toward_overall, is_archived, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load games.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    kind: row.kind as GameKind,
    countsTowardOverall: row.counts_toward_overall as boolean,
    isArchived: row.is_archived as boolean,
  }));
});

/** All matches (confirmed and voided), newest first, paging past PostgREST's row cap. */
export const getMatches = cache(async (clubId: string): Promise<MatchDetail[]> => {
  const supabase = await createSupabaseServerClient();
  const all: MatchDetail[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("club_id", clubId)
      .order("played_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Could not load matches.");
    const rows = (data ?? []) as unknown as MatchRow[];
    all.push(...rows.map(mapMatch));
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
});

export const getMatch = cache(async (clubId: string, matchId: string): Promise<MatchDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("club_id", clubId)
    .eq("id", matchId)
    .maybeSingle();
  return data ? mapMatch(data as unknown as MatchRow) : null;
});

/** Profile lookup that also covers former members who appear in old matches. */
export function memberLookup(members: MemberInfo[]) {
  const map = new Map(members.map((m) => [m.profileId, m]));
  return (profileId: string): MemberInfo =>
    map.get(profileId) ?? {
      profileId,
      username: "",
      displayName: "Former member",
      avatarUrl: null,
      emblem: "spade",
      role: "member",
      joinedAt: "",
    };
}
