"use client";

import { LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/lib/actions/auth";
import type { FormState } from "@/lib/errors";

function errorsOf(state: FormState<unknown>) {
  return state && !state.ok ? state.fieldErrors ?? {} : {};
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" block size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, null);
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors.password} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-[13px] text-muted underline-offset-4 hover:text-ivory hover:underline">
          Forgot your password?
        </Link>
      </div>
      <Submit pending={pending}>Sign in</Submit>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUpAction, null);
  const errors = errorsOf(state);
  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-2xl border border-felt-bright/40 bg-felt-deep/40 p-6">
        <MailCheck className="size-6 text-gold" />
        <p className="font-display text-2xl text-ivory">Check your inbox</p>
        <p className="text-sm leading-relaxed text-ivory-dim">
          We sent a confirmation link. Open it on this device to finish creating your account.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={errors.email} hint="Only used to sign in. Other members never see it.">
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-invalid={!!errors.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!errors.confirmPassword}
        />
      </Field>
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  const errors = errorsOf(state);
  if (state?.ok) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, a reset link is on its way. The link opens a page where you choose a new password.
      </FormMessage>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
      <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!errors.confirmPassword}
        />
      </Field>
      <Submit pending={pending}>Update password</Submit>
    </form>
  );
}
