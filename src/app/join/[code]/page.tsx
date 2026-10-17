import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/data/session";

export const metadata: Metadata = { title: "Join a club" };

/**
 * Invitation link: /join/ABCD2345. Sends the visitor through sign-in and profile setup
 * as needed, then lands on the join form with the code filled in.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const target = `/onboarding?code=${encodeURIComponent(clean)}`;
  const user = await getSessionUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(target)}`);
  redirect(target);
}
