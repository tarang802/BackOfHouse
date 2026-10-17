import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TournamentFormat = "points" | "rounds" | "elimination";
type TournamentStatus = "draft" | "upcoming" | "in_progress" | "completed" | "cancelled";

export type Tournament = {
  id: string;
  name: string;
  description: string | null;
  gameTypeId: string;
  scoringRuleId: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string | null;
  roundCount: number | null;
  championId: string | null;
  completedAt: string | null;
  createdAt: string;
  participantIds: string[];
};

export type BracketMatch = {
  id: string;
  round: number;
  slot: number;
  playerA: string | null;
  playerB: string | null;
  winnerId: string | null;
  matchId: string | null;
};

export type Season = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  status: "active" | "archived";
  championId: string | null;
  finalStandings: { profile_id: string; display_name: string; username: string; points: number; wins: number; played: number; rank: number }[] | null;
  archivedAt: string | null;
};

export type ActivityItem = {
  id: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

type TournamentRow = {
  id: string;
  name: string;
  description: string | null;
  game_type_id: string;
  scoring_rule_id: string;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_on: string;
  ends_on: string | null;
  round_count: number | null;
  champion_id: string | null;
  completed_at: string | null;
  created_at: string;
  tournament_participants: { profile_id: string; seed: number }[];
};

const TOURNAMENT_COLUMNS =
  "id, name, description, game_type_id, scoring_rule_id, format, status, starts_on, ends_on, round_count, champion_id, completed_at, created_at, tournament_participants(profile_id, seed)";

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    gameTypeId: row.game_type_id,
    scoringRuleId: row.scoring_rule_id,
    format: row.format,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    roundCount: row.round_count,
    championId: row.champion_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    participantIds: [...row.tournament_participants].sort((a, b) => a.seed - b.seed).map((p) => p.profile_id),
  };
}

export const getTournaments = cache(async (clubId: string): Promise<Tournament[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("club_id", clubId)
    .order("starts_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load tournaments.");
  return ((data ?? []) as unknown as TournamentRow[]).map(mapTournament);
});

export const getTournament = cache(async (clubId: string, id: string): Promise<Tournament | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tournaments").select(TOURNAMENT_COLUMNS).eq("club_id", clubId).eq("id", id).maybeSingle();
  return data ? mapTournament(data as unknown as TournamentRow) : null;
});

export const getBracket = cache(async (tournamentId: string): Promise<BracketMatch[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournament_bracket_matches")
    .select("id, round, slot, player_a, player_b, winner_id, match_id")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("slot");
  if (error) throw new Error("Could not load the bracket.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    round: row.round as number,
    slot: row.slot as number,
    playerA: row.player_a as string | null,
    playerB: row.player_b as string | null,
    winnerId: row.winner_id as string | null,
    matchId: row.match_id as string | null,
  }));
});

export const getSeasons = cache(async (clubId: string): Promise<Season[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, starts_on, ends_on, status, champion_id, final_standings, archived_at")
    .eq("club_id", clubId)
    .order("starts_on", { ascending: false });
  if (error) throw new Error("Could not load seasons.");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string | null,
    status: row.status as Season["status"],
    championId: row.champion_id as string | null,
    finalStandings: row.final_standings as Season["finalStandings"],
    archivedAt: row.archived_at as string | null,
  }));
});

export const getActivity = cache(async (clubId: string, limit = 12): Promise<ActivityItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load club activity.");
  return (data ?? []).map((row) => ({
    id: row.id as number,
    actorId: row.actor_id as string | null,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string | null,
    details: (row.details ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }));
});
