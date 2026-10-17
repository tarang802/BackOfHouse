import { Pencil, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AchievementGrid } from "@/components/club/achievement-grid";
import { GameStatsTable } from "@/components/club/game-stats-table";
import { MatchList } from "@/components/club/match-list";
import { PlayerCard } from "@/components/club/player-card";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { getBracket, getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { evaluateAchievements } from "@/lib/domain/achievements";
import { bestTournamentFinish } from "@/lib/domain/finishes";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { frequentOpponents, headToHead } from "@/lib/domain/rivalry";
import { ordinal } from "@/lib/domain/scoring";
import { computePlayerStats, matchesForPlayer } from "@/lib/domain/stats";
import { confirmedOnly } from "@/lib/domain/types";

export async function generateMetadata({ params }: PageProps<"/club/players/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PlayerProfilePage({ params }: PageProps<"/club/players/[username]">) {
  const { username } = await params;
  const { profile, club } = await requireClub();
  const [members, games, matches, tournaments] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getTournaments(club.id),
  ]);
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

  const completed = tournaments.filter((t) => t.status === "completed");
  const completedWithBrackets = await Promise.all(
    completed.map(async (t) => ({
      ...t,
      bracket: t.format === "elimination" && t.participantIds.includes(member.profileId) ? await getBracket(t.id) : undefined,
    })),
  );
  const bestFinish = bestTournamentFinish(completedWithBrackets, member.profileId, matches);
  const titles = completed.filter((t) => t.championId === member.profileId);

  const rivals = frequentOpponents(matches, member.profileId)
    .slice(0, 5)
    .map((o) => ({ opponent: lookup(o.profileId), h2h: headToHead(matches, member.profileId, o.profileId) }));

  const achievements = evaluateAchievements(member.profileId, {
    matches,
    gameTypes: games,
    tournamentChampions: completed.map((t) => t.championId).filter((id): id is string => !!id),
    memberIds: members.map((m) => m.profileId),
    legendPointsThreshold: club.legendPointsThreshold,
    playfulTitles: club.playfulTitles,
  });

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
          ) : (
            <ButtonLink href={`/club/rivalries?a=${profile.username}&b=${member.username}`} variant="outline" size="sm">
              <Swords /> Compare with me
            </ButtonLink>
          )
        }
      />
      <p className="-mt-2 text-xs text-muted">
        Points and rank are from the overall leaderboard. Games, wins and streaks include every game type.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader eyebrow="By game" title="Game statistics" />
          <CardBody>
            <GameStatsTable rows={perGame} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Tournaments" title="Silverware" />
          <CardBody className="flex flex-col gap-3 text-sm">
            {bestFinish ? (
              <p className="text-ivory-dim">
                Best finish:{" "}
                <Link href={`/club/tournaments/${bestFinish.tournamentId}`} className="text-ivory hover:underline hover:underline-offset-4">
                  {bestFinish.place === 1 ? "Champion" : ordinal(bestFinish.place)} · {bestFinish.tournamentName}
                </Link>
              </p>
            ) : (
              <p className="text-muted">No completed tournaments yet.</p>
            )}
            {titles.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {titles.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-ivory">
                    <Trophy className="size-4 text-gold" aria-hidden /> {t.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Trophy cabinet" title="Achievements" />
        <CardBody>
          <AchievementGrid achievements={achievements} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
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
        <Card>
          <CardHeader eyebrow="Head to head" title="Regular rivals" />
          <CardBody className="flex flex-col gap-2">
            {rivals.length === 0 ? <p className="text-sm text-muted">No shared games yet.</p> : null}
            {rivals.map(({ opponent, h2h }) => (
              <Link
                key={opponent.profileId}
                href={`/club/rivalries?a=${member.username}&b=${opponent.username}`}
                className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm hover:border-line-strong"
              >
                <Avatar name={opponent.displayName} src={opponent.avatarUrl} emblem={opponent.emblem} size="sm" />
                <span className="min-w-0 flex-1 truncate text-ivory">{opponent.displayName}</span>
                <span className="tabular text-ivory-dim">
                  {h2h.aheadA}–{h2h.aheadB}
                </span>
                <span className="text-xs text-faint">{h2h.encounters} games</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
