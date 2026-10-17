import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const error = params.error === "link" ? "That sign-in link is invalid or has expired." : null;
  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your club. The table is waiting."
      footer={
        <>
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-ivory underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error ? <p role="alert" className="mb-5 text-sm text-loss">{error}</p> : null}
      <SignInForm next={next} />
    </AuthLayout>
  );
}
