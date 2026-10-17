"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClub } from "@/lib/data/session";
import { fail, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTournamentSchema, type CreateTournamentInput } from "@/lib/validation/tournament";

const uuid = z.string().uuid();

export async function createTournamentAction(input: CreateTournamentInput): Promise<ActionResult<{ tournamentId: string }>> {
  const parsed = createTournamentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the form.", fieldErrors: issue ? { [String(issue.path[0])]: issue.message } : undefined };
  }
  const { club } = await requireClub();
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_tournament", {
    p_club_id: club.id,
    p_name: v.name,
    p_description: v.description || null,
    p_game_type_id: v.gameTypeId,
    p_format: v.format,
    p_starts_on: v.startsOn,
    p_ends_on: v.endsOn || null,
    p_round_count: v.format === "rounds" ? v.roundCount ?? null : null,
    p_participant_ids: v.participantIds,
    p_status: v.status,
  });
  if (error || !data) return fail(error, "The tournament was not created.");
  revalidatePath("/club", "layout");
  return { ok: true, data: { tournamentId: data as string } };
}

const statusSchema = z.object({
  tournamentId: uuid,
  status: z.enum(["upcoming", "in_progress", "cancelled"]),
});

export async function setTournamentStatusAction(input: { tournamentId: string; status: string }): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_tournament_status", {
    p_tournament_id: parsed.data.tournamentId,
    p_status: parsed.data.status,
  });
  if (error) return fail(error, "The tournament could not be updated.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

export async function updateTournamentParticipantsAction(input: { tournamentId: string; participantIds: string[] }): Promise<ActionResult> {
  const parsed = z.object({ tournamentId: uuid, participantIds: z.array(uuid).min(2).max(32) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick between 2 and 32 players." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_tournament_participants", {
    p_tournament_id: parsed.data.tournamentId,
    p_participant_ids: parsed.data.participantIds,
  });
  if (error) return fail(error, "Players could not be updated.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

export async function completeTournamentAction(tournamentId: string): Promise<ActionResult<{ championId: string }>> {
  if (!uuid.safeParse(tournamentId).success) return { ok: false, error: "Invalid tournament." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_tournament", { p_tournament_id: tournamentId });
  if (error || !data) return fail(error, "The tournament could not be completed.");
  revalidatePath("/club", "layout");
  return { ok: true, data: { championId: data as string } };
}
