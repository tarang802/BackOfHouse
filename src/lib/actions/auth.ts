"use server";

import { redirect } from "next/navigation";
import { requirePublicEnv } from "@/lib/env";
import { fail, invalid, type FormState } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  newPasswordSchema,
  resetRequestSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

function authMessage(error: { message?: string; code?: string } | null, fallback: string): string {
  const code = error?.code ?? "";
  if (code === "invalid_credentials") return "That email and password do not match.";
  if (code === "email_not_confirmed") return "Confirm your email first — check your inbox for the link.";
  if (code === "user_already_exists" || code === "email_exists") return "An account with this email already exists. Sign in instead.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return "Too many attempts. Wait a minute and try again.";
  }
  return fallback;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: authMessage(error, "Could not sign you in. Please try again.") };
  redirect(safeNextPath(formData.get("next")));
}

export async function signUpAction(
  _prev: FormState<{ needsConfirmation: boolean }>,
  formData: FormData,
): Promise<FormState<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const env = requirePublicEnv();
  const next = safeNextPath(formData.get("next"), "/onboarding");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { ok: false, error: authMessage(error, "Could not create your account. Please try again.") };
  // With email confirmation on, Supabase returns no session until the link is clicked.
  if (!data.session) return { ok: true, data: { needsConfirmation: true } };
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const env = requirePublicEnv();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  // Same response whether or not the account exists, so emails cannot be probed.
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { ok: false, error: authMessage(error, "") };
  }
  return { ok: true, data: null };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error, authMessage(error, "Could not update your password."));
  redirect("/club");
}
