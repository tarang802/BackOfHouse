import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { createTournamentAction } from "@/lib/actions/tournaments";
import { getGameTypes, getMembers } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";
import { localDay } from "@/lib/domain/leaderboard";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const { club, isAdmin } = await requireClub();
  if (!isAdmin) redirect("/club/tournaments");
  const [members, games] = await Promise.all([getMembers(club.id), getGameTypes(club.id)]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Competition" title="New tournament" description="Set the stakes — bragging rights only." />
      <Card>
        <CardBody>
          <TournamentForm
            games={games.filter((g) => !g.isArchived).map((g) => ({ id: g.id, name: g.name }))}
            players={members.map((m) => ({ profileId: m.profileId, displayName: m.displayName, avatarUrl: m.avatarUrl, emblem: m.emblem }))}
            today={localDay(new Date().toISOString(), club.timezone)}
            action={createTournamentAction}
          />
        </CardBody>
      </Card>
    </div>
  );
}
