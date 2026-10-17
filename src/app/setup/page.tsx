import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Finish setup", robots: { index: false } };

/** Shown when the deployment has no Supabase configuration yet. */
export default async function SetupPage() {
  await connection();
  if (isSupabaseConfigured()) redirect("/club");
  return (
    <main id="main" className="felt min-h-dvh px-4 py-6 sm:px-10">
      <Logo />
      <div className="mx-auto max-w-xl py-16">
        <p className="eyebrow">Almost there</p>
        <h1 className="mt-3 font-display text-5xl leading-none text-ivory">The table isn&apos;t set yet.</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-muted">
          This deployment is not connected to a Supabase project, so sign-in and club data are unavailable. Whoever runs this
          site needs to add these environment variables and redeploy:
        </p>
        <ul className="mt-6 space-y-2 rounded-2xl border border-line bg-surface p-5 font-mono text-sm text-ivory-dim">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
          <li>NEXT_PUBLIC_SITE_URL</li>
        </ul>
        <p className="mt-5 text-sm text-muted">Step-by-step instructions are in the project README under “Deploying”.</p>
      </div>
    </main>
  );
}
