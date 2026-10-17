"use server";

import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/data/session";
import { fail, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  correctMatchSchema,
  recordMatchSchema,
  toSqlLedger,
  toSqlResults,
  voidMatchSchema,
  type RecordMatchInput,
} from "@/lib/validation/match";

/**
 * Records a match. The club comes from the session (never from the browser), input is
 * validated here and again in SQL, and points are calculated by the database inside
 * one transaction. Replaying the same submissionId returns the original match.
 */
export async function recordMatchAction(input: RecordMatchInput): Promise<ActionResult<{ matchId: string }>> {
  const parsed = recordMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the result and try again." };
  const { club } = await requireClub();
  const value = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("record_match", {
    p_club_id: club.id,
    p_game_type_id: value.gameTypeId,
    p_results: toSqlResults(value.results),
    p_submission_id: value.submissionId,
    p_played_at: value.playedAt ?? null,
    p_notes: value.notes ?? null,
    p_tournament_id: value.tournamentId ?? null,
    p_bracket_match_id: value.bracketMatchId ?? null,
    p_ledger: toSqlLedger(value.ledger),
  });
  if (error || !data) return fail(error, "The result was not saved. Please try again.");

  revalidatePath("/club", "layout");
  return { ok: true, data: { matchId: data as string } };
}

export async function voidMatchAction(input: { matchId: string; reason: string }): Promise<ActionResult> {
  const parsed = voidMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_match", {
    p_match_id: parsed.data.matchId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(error, "The match could not be voided.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

export async function correctMatchAction(input: {
  matchId: string;
  submissionId: string;
  reason: string;
  results: { profileId: string; placement: number }[];
}): Promise<ActionResult<{ matchId: string }>> {
  const parsed = correctMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid correction." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("correct_match", {
    p_match_id: parsed.data.matchId,
    p_results: toSqlResults(parsed.data.results),
    p_reason: parsed.data.reason,
    p_submission_id: parsed.data.submissionId,
  });
  if (error || !data) return fail(error, "The correction was not saved.");
  revalidatePath("/club", "layout");
  return { ok: true, data: { matchId: data as string } };
}
