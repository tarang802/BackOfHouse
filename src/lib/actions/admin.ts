"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClub } from "@/lib/data/session";
import { validateScoringRule } from "@/lib/domain/scoring";
import { fail, type ActionResult } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clubNameSchema } from "@/lib/validation/profile";

const uuid = z.string().uuid();

function done(): ActionResult {
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

const settingsSchema = z.object({
  name: clubNameSchema,
  tagline: z.string().trim().max(120, "Taglines can be at most 120 characters."),
  playfulTitles: z.boolean(),
  legendPointsThreshold: z.number().int().min(10, "At least 10 points.").max(10000, "At most 10,000 points."),
  timezone: z.string().trim().min(1).max(64),
});

export async function updateClubSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the settings." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_club_settings", {
    p_club_id: club.id,
    p_name: parsed.data.name,
    p_tagline: parsed.data.tagline,
    p_playful_titles: parsed.data.playfulTitles,
    p_legend_points_threshold: parsed.data.legendPointsThreshold,
    p_timezone: parsed.data.timezone,
  });
  return error ? fail(error, "Settings were not saved.") : done();
}

export async function updateScoringAction(input: { placementPoints: number[]; participationPoints: number }): Promise<ActionResult> {
  const shape = z.object({ placementPoints: z.array(z.number().int()).min(1).max(10), participationPoints: z.number().int() }).safeParse(input);
  if (!shape.success) return { ok: false, error: "Enter whole numbers for each place." };
  const check = validateScoringRule(shape.data);
  if (!check.ok) return { ok: false, error: check.message };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_scoring_rules", {
    p_club_id: club.id,
    p_placement_points: shape.data.placementPoints,
    p_participation_points: shape.data.participationPoints,
  });
  return error ? fail(error, "Scoring was not updated.") : done();
}

export async function addGameAction(input: { name: string; countsTowardOverall: boolean }): Promise<ActionResult> {
  const parsed = z.object({ name: z.string().trim().min(2, "Name the game.").max(40), countsTowardOverall: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the game name." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_game_type", {
    p_club_id: club.id,
    p_name: parsed.data.name,
    p_counts_toward_overall: parsed.data.countsTowardOverall,
  });
  return error ? fail(error, "The game was not added.") : done();
}

export async function updateGameAction(input: { gameTypeId: string; countsTowardOverall?: boolean; isArchived?: boolean }): Promise<ActionResult> {
  const parsed = z.object({ gameTypeId: uuid, countsTowardOverall: z.boolean().optional(), isArchived: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_game_type", {
    p_game_type_id: parsed.data.gameTypeId,
    p_counts_toward_overall: parsed.data.countsTowardOverall ?? null,
    p_is_archived: parsed.data.isArchived ?? null,
  });
  return error ? fail(error, "The game was not updated.") : done();
}

export async function setMemberRoleAction(input: { profileId: string; role: "admin" | "member" }): Promise<ActionResult> {
  const parsed = z.object({ profileId: uuid, role: z.enum(["admin", "member"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_member_role", { p_club_id: club.id, p_profile_id: parsed.data.profileId, p_role: parsed.data.role });
  return error ? fail(error, "The role was not changed.") : done();
}

export async function removeMemberAction(profileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "Invalid request." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_member", { p_club_id: club.id, p_profile_id: profileId });
  return error ? fail(error, "The member was not removed.") : done();
}

export async function transferOwnershipAction(profileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "Invalid request." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transfer_ownership", { p_club_id: club.id, p_profile_id: profileId });
  return error ? fail(error, "Ownership was not transferred.") : done();
}
