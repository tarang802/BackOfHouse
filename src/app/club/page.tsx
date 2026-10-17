import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/feedback";
import { requireClub } from "@/lib/data/session";

export const metadata: Metadata = { title: "Club" };

export default async function ClubHomePage({ searchParams }: PageProps<"/club">) {
  const { club } = await requireClub();
  const params = await searchParams;
  const welcome =
    params.welcome === "1" ? "Your club is open. Invite your friends from Club settings." : params.joined === "1" ? `Welcome to ${club.name}.` : null;
  return (
    <div className="flex flex-col gap-8">
      {welcome ? <FormMessage tone="success">{welcome}</FormMessage> : null}
      <PageHeader
        eyebrow={`You are the ${club.role}`}
        title={club.name}
        description={club.tagline ?? undefined}
        actions={
          <ButtonLink href="/club/settings#invite" variant="outline">
            <UserPlus /> Invite friends
          </ButtonLink>
        }
      />
    </div>
  );
}
