import { ArrowRight, Crown, Plus, Trophy, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/club/activity-feed";
import { MatchList } from "@/components/club/match-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge, FormPill } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/feedback";
import { FormMessage } from "@/components/ui/field";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { getActivity, getSeasons, getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { computePlayerStats, formatWinRate } from "@/lib/domain/stats";
import { confirmedOnly } from "@/lib/domain/types";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/club">) {
  const { profile, club } = await requireClub();
  const params = await searchParams;
  const [members, games, matches, tournaments, seasons, activity] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getTournaments(club.id),
    getSeasons(club.id),
    getActivity(club.id, 8),
  ]);
  const lookup = memberLookup(members);
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";
  // Overall points from games that count toward the overall table, most first.
  const overall = new Set(games.filter((g) => g.countsTowardOverall).map((g) => g.id));
  const board = members
    .map((member) => ({ member, stats: computePlayerStats(matches, member.profileId, (m) => overall.has(m.gameTypeId)) }))
    .sort((a, b) => b.stats.points - a.stats.points || b.stats.wins - a.stats.wins || a.member.displayName.localeCompare(b.member.displayName))
    .map((entry, index) => ({ ...entry, rank: entry.stats.games > 0 ? index + 1 : null }));
  const me = board.find((entry) => entry.member.profileId === profile.id);
  const confirmed = confirmedOnly(matches);
  const activeSeason = seasons.find((s) => s.status === "active");
  const liveTournaments = tournaments.filter((t) => t.status === "in_progress" || t.status === "upcoming");
  const champions = tournaments.filter((t) => t.status === "completed" && t.championId).slice(0, 3);
  const welcome = params.welcome === "1" ? "Your club is open. Invite your friends from Club settings." : params.joined === "1" ? `Welcome to ${club.name}.` : null;

  return (
    <div className="flex flex-col gap-8">
      {welcome ? <FormMessage tone="success">{welcome}</FormMessage> : null}

      {/* Identity */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="animate-fade-up">
          <p className="eyebrow">{pluralize(members.length, "member")} · {activeSeason ? activeSeason.name : "All-time"}</p>
          <h1 className="mt-2 font-display text-[2.6rem] leading-[1] text-ivory sm:text-6xl">{club.name}</h1>
          {club.tagline ? <p className="mt-3 font-display text-xl italic text-muted">{club.tagline}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/club/matches/new">
            <Plus /> Record a match
          </ButtonLink>
          <ButtonLink href="/club/settings#invite" variant="outline">
            <UserPlus /> Invite
          </ButtonLink>
        </div>
      </header>

      {/* Personal standing */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={profile.displayName} src={profile.avatarUrl} emblem={profile.emblem} size="lg" ring={me?.rank === 1 ? "gold" : "felt"} />
            <div>
              <p className="eyebrow">Your standing</p>
              <p className="mt-1 font-display text-3xl text-ivory">
                {me?.rank ? `#${me.rank}` : "Unranked"}
                <span className="ml-2 text-base text-muted">of {board.filter((e) => e.rank !== null).length || members.length}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:justify-items-end">
            <Stat label="Points" value={<CountUp value={me?.stats.points ?? 0} />} />
            <Stat label="Win rate" value={formatWinRate(me?.stats.winRate ?? null)} />
            <Stat
              label="Form"
              value={
                <span className="flex gap-1 pt-1.5">
                  {me && me.stats.recentForm.length > 0 ? me.stats.recentForm.map((r, i) => <FormPill key={i} result={r} />) : <span className="text-base text-faint">—</span>}
                </span>
              }
            />
          </div>
        </div>
        {me && me.stats.games === 0 ? (
          <p className="border-t border-line px-6 py-3 text-sm text-muted">Play your first recorded game to get ranked.</p>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader eyebrow="Overall" title="Most points" />
          <CardBody>
            {confirmed.length === 0 ? (
              <EmptyState title="No games yet" action={<ButtonLink href="/club/matches/new" size="sm">Record the first one</ButtonLink>}>
                Standings appear after your first recorded match.
              </EmptyState>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {board.filter((e) => e.rank !== null).slice(0, 5).map((entry) => (
                  <li key={entry.member.profileId} className="flex items-center gap-3 py-3">
                    <span className="w-6 font-display text-xl tabular text-muted">{entry.rank}</span>
                    <Avatar name={entry.member.displayName} src={entry.member.avatarUrl} emblem={entry.member.emblem} size="sm" />
                    <Link href={`/club/players/${entry.member.username}`} className="min-w-0 flex-1 truncate text-ivory hover:underline hover:underline-offset-4">
                      {entry.member.displayName}
                    </Link>
                    <span className="tabular text-ivory">{entry.stats.points} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader eyebrow="Competition" title="Tournaments" action={<Link href="/club/tournaments" className="text-sm text-muted hover:text-ivory">All</Link>} />
            <CardBody className="flex flex-col gap-3">
              {liveTournaments.length === 0 && champions.length === 0 ? (
                <p className="text-sm text-muted">
                  No tournaments yet.{" "}
                  {club.role !== "member" ? (
                    <Link href="/club/tournaments/new" className="text-ivory underline-offset-4 hover:underline">
                      Start one
                    </Link>
                  ) : (
                    "Ask an admin to start one."
                  )}
                </p>
              ) : null}
              {liveTournaments.slice(0, 3).map((t) => (
                <Link key={t.id} href={`/club/tournaments/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-line-strong">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ivory">{t.name}</span>
                    <span className="block text-xs text-muted">{gameName(t.gameTypeId)} · {pluralize(t.participantIds.length, "player")}</span>
                  </span>
                  <Badge tone={t.status === "in_progress" ? "felt" : "neutral"}>{t.status === "in_progress" ? "Live" : "Upcoming"}</Badge>
                </Link>
              ))}
              {champions.map((t) => {
                const champ = lookup(t.championId!);
                return (
                  <Link key={t.id} href={`/club/tournaments/${t.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <Trophy className="size-4 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0 truncate text-sm text-ivory-dim">
                      <span className="text-ivory">{champ.displayName}</span> won {t.name}
                    </span>
                  </Link>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Top players" title="Hall of form" />
            <CardBody className="grid grid-cols-3 gap-3">
              {board.filter((e) => e.rank !== null).slice(0, 3).map((entry) => (
                <Link key={entry.member.profileId} href={`/club/players/${entry.member.username}`} className="flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-4 text-center hover:border-line-strong">
                  <Avatar name={entry.member.displayName} src={entry.member.avatarUrl} emblem={entry.member.emblem} size="lg" ring={entry.rank === 1 ? "gold" : undefined} />
                  <span className="w-full truncate text-xs text-ivory">{entry.member.displayName}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    {entry.rank === 1 ? <Crown className="size-3 text-gold" aria-hidden /> : null}#{entry.rank} · {entry.stats.points} pts
                  </span>
                </Link>
              ))}
              {board.every((e) => e.rank === null) ? <p className="col-span-3 text-sm text-muted">Nobody has scored yet.</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader eyebrow="Latest" title="Recent matches" action={<Link href="/club/matches" className="text-sm text-muted hover:text-ivory">History</Link>} />
          <CardBody className="pt-3">
            {matches.length === 0 ? (
              <p className="text-sm text-muted">Recorded games will appear here.</p>
            ) : (
              <MatchList matches={matches.slice(0, 6)} lookup={lookup} gameName={gameName} timeZone={club.timezone} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Club" title="Activity" />
          <CardBody className="pt-3">
            <ActivityFeed items={activity} lookup={lookup} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
