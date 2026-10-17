import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameStatsTable } from "@/components/club/game-stats-table";
import { MatchList } from "@/components/club/match-list";
import { PlayerCard } from "@/components/club/player-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { computePlayerStats, matchesForPlayer } from "@/lib/domain/stats";
import { confirmedOnly } from "@/lib/domain/types";

export async function generateMetadata({ params }: PageProps<"/club/players/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PlayerProfilePage({ params }: PageProps<"/club/players/[username]">) {
  const { username } = await params;
  const { profile, club } = await requireClub();
  const [members, games, matches] = await Promise.all([getMembers(club.id), getGameTypes(club.id), getMatches(club.id)]);
  // Only members of this club can be viewed here; anyone else is "not found".
  const member = members.find((m) => m.username === username.toLowerCase());
  if (!member) notFound();

  const lookup = memberLookup(members);
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";
  const board = buildLeaderboard(matches, members, leaderboardFilters.overall(games));
  const entry = board.find((e) => e.member.profileId === member.profileId)!;
  const allStats = computePlayerStats(matches, member.profileId);
  const perGame = games.map((g) => ({
    gameName: g.name,
    stats: computePlayerStats(matches, member.profileId, leaderboardFilters.game(g.id)),
  }));
  const recent = confirmedOnly(matchesForPlayer(matches, member.profileId)).slice(0, 8);
  const isMe = member.profileId === profile.id;

  return (
    <div className="flex flex-col gap-6">
      <PlayerCard
        displayName={member.displayName}
        username={member.username}
        avatarUrl={member.avatarUrl}
        emblem={member.emblem}
        role={member.role}
        joinedAt={member.joinedAt}
        rank={entry.rank}
        rankedCount={board.filter((e) => e.rank !== null).length}
        stats={{ ...allStats, points: entry.stats.points }}
        actions={
          isMe ? (
            <ButtonLink href="/club/profile" variant="outline" size="sm">
              <Pencil /> Edit profile
            </ButtonLink>
          ) : null
        }
      />
      <p className="-mt-2 text-xs text-muted">
        Points and rank are from the overall leaderboard. Games, wins and streaks include every game type.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="By game" title="Game statistics" />
          <CardBody>
            <GameStatsTable rows={perGame} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="History" title="Recent matches" />
          <CardBody className="pt-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No recorded matches yet.</p>
            ) : (
              <MatchList matches={recent} lookup={lookup} gameName={gameName} timeZone={club.timezone} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
