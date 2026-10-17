import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { MatchHistory } from "@/components/matches/match-history";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMatches, getMembers } from "@/lib/data/club-data";
import { getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";

export const metadata: Metadata = { title: "Match history" };

export default async function MatchesPage({ searchParams }: PageProps<"/club/matches">) {
  const { club } = await requireClub();
  const params = await searchParams;
  const [members, games, matches, tournaments] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getTournaments(club.id),
  ]);
  const tournamentName = new Map(tournaments.map((t) => [t.id, t.name]));
  const str = (value: unknown) => (typeof value === "string" ? value : "");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={club.name}
        title="Match history"
        description="Every recorded game, newest first. Voided matches stay on the record, marked and excluded from all statistics."
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
            <MatchHistory
              matches={matches.map((m) => ({ ...m, tournamentName: m.tournamentId ? tournamentName.get(m.tournamentId) ?? null : null }))}
              members={members}
              games={games.map((g) => ({ id: g.id, name: g.name }))}
              tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
              timeZone={club.timezone}
              initial={{ game: str(params.game), player: str(params.player), tournament: str(params.tournament) }}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
