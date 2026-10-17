import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/onboarding");
  return (
    <AuthLayout
      title="Take a seat."
      subtitle="Create your account, then set up your player card and club. It takes about a minute."
      footer={
        <>
          Already a member?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-ivory underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthLayout>
  );
}
