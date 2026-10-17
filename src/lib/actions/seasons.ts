"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClub } from "@/lib/data/session";
import { fail, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const seasonSchema = z
  .object({
    name: z.string().trim().min(2, "Name the season.").max(80),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, { path: ["endsOn"], message: "The end must be after the start." });

export async function createSeasonAction(input: { name: string; startsOn: string; endsOn?: string }): Promise<ActionResult> {
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the season details." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_season", {
    p_club_id: club.id,
    p_name: parsed.data.name,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn || null,
  });
  if (error) return fail(error, "The season could not be created.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

export async function archiveSeasonAction(seasonId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(seasonId).success) return { ok: false, error: "Invalid season." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("archive_season", { p_season_id: seasonId });
  if (error) return fail(error, "The season could not be closed.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}
