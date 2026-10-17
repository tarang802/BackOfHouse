import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { PlayerDirectory } from "@/components/club/player-directory";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMatches, getMembers } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage() {
  const { profile, club } = await requireClub();
  const [members, games, matches] = await Promise.all([getMembers(club.id), getGameTypes(club.id), getMatches(club.id)]);
  const board = buildLeaderboard(matches, members, leaderboardFilters.overall(games));
  const players = board
    .map((entry) => ({
      profileId: entry.member.profileId,
      username: entry.member.username,
      displayName: entry.member.displayName,
      avatarUrl: entry.member.avatarUrl,
      emblem: entry.member.emblem,
      role: entry.member.role,
      joinedAt: entry.member.joinedAt,
      rank: entry.rank,
      points: entry.stats.points,
      games: entry.stats.games,
      wins: entry.stats.wins,
      winRate: entry.stats.winRate,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={club.name}
        title="Players"
        description={`${pluralize(members.length, "member")} at the table.`}
        actions={
          <ButtonLink href="/club/settings#invite" variant="outline">
            <UserPlus /> Invite a friend
          </ButtonLink>
        }
      />
      <PlayerDirectory players={players} myId={profile.id} />
    </div>
  );
}
