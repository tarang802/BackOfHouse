"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_CLUB_COOKIE, getMyClubs, requireClub, requireProfile } from "@/lib/data/session";
import { fail, invalid, type ActionResult, type FormState } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { createClubSchema, inviteCodeSchema } from "@/lib/validation/profile";

async function rememberClub(clubId: string) {
  (await cookies()).set(ACTIVE_CLUB_COOKIE, clubId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createClubAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile("/onboarding");
  const parsed = createClubSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline") || undefined,
    timezone: formData.get("timezone") || undefined,
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_club", {
    p_name: parsed.data.name,
    p_tagline: parsed.data.tagline ?? null,
    p_timezone: parsed.data.timezone ?? "UTC",
  });
  if (error || !data) return fail(error, "Could not create the club.");
  await rememberClub(data as string);
  revalidatePath("/", "layout");
  redirect("/club?welcome=1");
}

export async function joinClubAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile("/onboarding");
  const parsed = inviteCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return invalid({ code: parsed.error.issues[0]?.message });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_club", { p_code: parsed.data });
  if (error || !data) {
    const mapped = fail(error, "Could not join the club.");
    return invalid({ code: mapped.error }, mapped.error);
  }
  await rememberClub(data as string);
  revalidatePath("/", "layout");
  redirect("/club?joined=1");
}

export async function switchClubAction(clubId: string): Promise<void> {
  const clubs = await getMyClubs();
  // Only remember clubs the user actually belongs to.
  if (clubs.some((club) => club.id === clubId)) await rememberClub(clubId);
  revalidatePath("/club", "layout");
  redirect("/club");
}

const invitationSchema = z.object({
  expiresInDays: z.number().int().min(1).max(90).nullable(),
  maxUses: z.number().int().min(1).max(100).nullable(),
});

export async function createInvitationAction(input: { expiresInDays: number | null; maxUses: number | null }): Promise<ActionResult<{ code: string }>> {
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid expiry and use limit." };
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_club_id: club.id,
    p_expires_in_days: parsed.data.expiresInDays,
    p_max_uses: parsed.data.maxUses,
  });
  if (error || !data) return fail(error, "Could not create an invitation.");
  revalidatePath("/club/settings");
  return { ok: true, data: { code: data as string } };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(invitationId).success) return { ok: false, error: "Invalid invitation." };
  await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return fail(error, "Could not revoke the invitation.");
  revalidatePath("/club/settings");
  return { ok: true, data: null };
}

export async function leaveClubAction(): Promise<ActionResult> {
  const { club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("leave_club", { p_club_id: club.id });
  if (error) return fail(error, "Could not leave the club.");
  (await cookies()).delete(ACTIVE_CLUB_COOKIE);
  revalidatePath("/", "layout");
  redirect("/onboarding");
}
