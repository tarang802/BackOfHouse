import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { MatchList } from "@/components/club/match-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";

export const metadata: Metadata = { title: "Match history" };

export default async function MatchesPage() {
  const { club } = await requireClub();
  const [members, games, matches] = await Promise.all([getMembers(club.id), getGameTypes(club.id), getMatches(club.id)]);
  const lookup = memberLookup(members);
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={club.name}
        title="Match history"
        description="Every recorded game, newest first."
        actions={
          <ButtonLink href="/club/matches/new">
            <Plus /> Record a match
          </ButtonLink>
        }
      />
      <Card>
        <CardBody>
          {matches.length === 0 ? (
            <EmptyState title="No matches yet" action={<ButtonLink href="/club/matches/new" size="sm">Record the first one</ButtonLink>}>
              Results you record will be listed here.
            </EmptyState>
          ) : (
            <MatchList matches={matches} lookup={lookup} gameName={gameName} timeZone={club.timezone} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
