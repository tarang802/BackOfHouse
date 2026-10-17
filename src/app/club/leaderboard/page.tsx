import type { Metadata } from "next";
import { LeaderboardExplorer, type LeaderboardView } from "@/components/club/leaderboard-explorer";
import { toLeaderboardRows } from "@/components/club/rows";
import { ScoringExplainer } from "@/components/club/scoring-explainer";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { getCurrentScoringRule, getGameTypes, getMatches, getMembers } from "@/lib/data/club-data";
import { getSeasons, getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { DEFAULT_SCORING_RULE } from "@/lib/domain/scoring";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/club/leaderboard">) {
  const { profile, club } = await requireClub();
  const params = await searchParams;
  const [members, games, matches, rule, seasons, tournaments] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getCurrentScoringRule(club.id),
    getSeasons(club.id),
    getTournaments(club.id),
  ]);
  const rows = (filter: Parameters<typeof buildLeaderboard>[2]) =>
    toLeaderboardRows(buildLeaderboard(matches, members, filter), profile.id);

  const overallGames = games.filter((g) => g.countsTowardOverall).map((g) => g.name);
  const views: LeaderboardView[] = [
    {
      id: "overall",
      label: "All-time",
      description: `All-time overall standings across ${overallGames.join(", ") || "counted games"}.`,
      rows: rows(leaderboardFilters.overall(games)),
    },
  ];
  const activeSeason = seasons.find((s) => s.status === "active");
  if (activeSeason) {
    views.push({
      id: "season",
      label: activeSeason.name,
      description: `Current season, from ${activeSeason.startsOn}${activeSeason.endsOn ? ` to ${activeSeason.endsOn}` : ""}. Overall games only.`,
      rows: rows(leaderboardFilters.dateRange(games, activeSeason.startsOn, activeSeason.endsOn, club.timezone)),
    });
  }
  for (const game of games.filter((g) => !g.isArchived)) {
    views.push({
      id: game.slug,
      label: game.name,
      description: `${game.name} only${game.countsTowardOverall ? "" : " — this game does not count toward the overall board"}.`,
      rows: rows(leaderboardFilters.game(game.id)),
    });
  }
  for (const t of tournaments.filter((t) => t.status === "in_progress" && t.format !== "elimination")) {
    const ids = new Set(t.participantIds);
    views.push({
      id: `t-${t.id}`,
      label: t.name,
      description: `Live standings for ${t.name}.`,
      rows: rows(leaderboardFilters.tournament(t.id)).filter((r) => ids.has(r.profileId)),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={club.name} title="Leaderboard" description="Every board is calculated from recorded, confirmed results." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Card>
          <CardBody>
            <LeaderboardExplorer views={views} initialView={typeof params.view === "string" ? params.view : undefined} />
          </CardBody>
        </Card>
        <Card className="lg:sticky lg:top-10">
          <CardHeader eyebrow="House rules" title="How scoring works" />
          <CardBody>
            <ScoringExplainer rule={rule ?? DEFAULT_SCORING_RULE} version={rule?.version ?? 1} overallGames={overallGames} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
