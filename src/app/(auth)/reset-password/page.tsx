import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/data/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in; without that session there is nothing to reset.
  await requireUser("/reset-password");
  return (
    <AuthLayout title="New password." subtitle="Choose a new password for your account.">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
