"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/data/session";
import { requirePublicEnv } from "@/lib/env";
import { fail, invalid, type ActionResult, type FormState } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";

function readProfileForm(formData: FormData) {
  return profileSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    emblem: formData.get("emblem") ?? "spade",
  });
}

/** Creates the signed-in user's own profile row. RLS only allows id = auth.uid(). */
export async function createProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");
  const parsed = readProfileForm(formData);
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username: parsed.data.username,
    display_name: parsed.data.displayName,
    emblem: parsed.data.emblem,
  });
  if (error) {
    const mapped = fail(error, "Could not save your profile.");
    if (mapped.code === "username_taken") return invalid({ username: mapped.error }, mapped.error);
    return mapped;
  }
  revalidatePath("/onboarding");
  const code = String(formData.get("code") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  redirect(code ? `/onboarding?code=${code}` : "/onboarding");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = readProfileForm(formData);
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username: parsed.data.username, display_name: parsed.data.displayName, emblem: parsed.data.emblem })
    .eq("id", user.id);
  if (error) {
    const mapped = fail(error, "Could not update your profile.");
    if (mapped.code === "username_taken") return invalid({ username: mapped.error }, mapped.error);
    return mapped;
  }
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}

/**
 * Saves the public URL of an avatar the browser already uploaded to the user's own
 * storage folder. The URL is checked here and by a database constraint.
 */
export async function setAvatarAction(avatarUrl: string | null): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (avatarUrl !== null) {
    const env = requirePublicEnv();
    const prefix = `${env.supabaseUrl}/storage/v1/object/public/avatars/${user.id}/`;
    if (!avatarUrl.startsWith(prefix) || !/^[A-Za-z0-9._-]+(\?v=\d+)?$/.test(avatarUrl.slice(prefix.length))) {
      return { ok: false, error: "That image location is not allowed." };
    }
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (error) return fail(error, "Could not update your photo.");
  revalidatePath("/club", "layout");
  return { ok: true, data: null };
}
