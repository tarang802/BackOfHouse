import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LeaderboardTable } from "@/components/club/leaderboard-table";
import { MatchList } from "@/components/club/match-list";
import { toLeaderboardRows } from "@/components/club/rows";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import type { Suit } from "@/components/ui/suit";
import { buildLeaderboard, leaderboardFilters } from "@/lib/domain/leaderboard";
import { headToHead } from "@/lib/domain/rivalry";
import { computePlayerStats, formatWinRate } from "@/lib/domain/stats";
import { confirmedOnly, type GameTypeInfo, type MatchRecord, type MemberInfo } from "@/lib/domain/types";

/** Shared layout for a single game's section (Bluff, Poker, custom games). */
export function GameHub({
  game,
  members,
  matches,
  myId,
  lookup,
  timeZone,
  intro,
  suit,
  extra,
}: {
  game: GameTypeInfo;
  members: MemberInfo[];
  matches: MatchRecord[];
  myId: string;
  lookup: (id: string) => MemberInfo;
  timeZone: string;
  intro: ReactNode;
  suit: Suit;
  extra?: ReactNode;
}) {
  const filter = leaderboardFilters.game(game.id);
  const gameMatches = confirmedOnly(matches).filter(filter);
  const board = buildLeaderboard(matches, members, filter);
  const me = computePlayerStats(matches, myId, filter);
  const longest = board.reduce((best, e) => (e.stats.bestStreak > best.streak ? { streak: e.stats.bestStreak, name: e.member.displayName } : best), {
    streak: 0,
    name: "",
  });

  // Closest rivalries in this game: pairs with the most shared matches.
  const ids = members.map((m) => m.profileId);
  const pairs: { a: string; b: string; encounters: number; aheadA: number; aheadB: number }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const h = headToHead(gameMatches, ids[i], ids[j]);
      if (h.encounters > 0) pairs.push({ a: ids[i], b: ids[j], encounters: h.encounters, aheadA: h.aheadA, aheadB: h.aheadB });
    }
  }
  pairs.sort((x, y) => y.encounters - x.encounters || Math.abs(x.aheadA - x.aheadB) - Math.abs(y.aheadA - y.aheadB));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Game room"
        title={game.name}
        description={intro}
        actions={
          <ButtonLink href={`/club/matches/new?game=${game.slug}`}>
            <Plus /> Record {game.name}
          </ButtonLink>
        }
      />

      <Card>
        <CardBody className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Your wins" value={me.wins} detail={`${me.games} played`} />
          <Stat label="Your win rate" value={formatWinRate(me.winRate)} />
          <Stat label="Avg finish" value={me.averagePlacement ? me.averagePlacement.toFixed(1) : "—"} detail="Lower is better" />
          <Stat label="Your best streak" value={me.bestStreak} detail={longest.streak > 0 ? `Club record ${longest.streak} · ${longest.name}` : undefined} />
        </CardBody>
      </Card>

      {gameMatches.length === 0 ? (
        <EmptyState suit={suit} title={`No ${game.name} games yet`} action={<ButtonLink href={`/club/matches/new?game=${game.slug}`} size="sm">Record one</ButtonLink>}>
          Once you record a {game.name} result, its rankings, history and rivalries appear here.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader eyebrow={`${gameMatches.length} games`} title={`${game.name} leaderboard`} />
            <CardBody>
              <LeaderboardTable rows={toLeaderboardRows(board, myId)} caption={`${game.name} leaderboard`} />
            </CardBody>
          </Card>
          <div className="flex flex-col gap-6">
            {extra}
            <Card>
              <CardHeader eyebrow="Head to head" title="Fiercest rivalries" />
              <CardBody className="flex flex-col gap-3">
                {pairs.length === 0 ? <p className="text-sm text-muted">No shared games yet.</p> : null}
                {pairs.slice(0, 5).map((p) => {
                  const a = lookup(p.a);
                  const b = lookup(p.b);
                  return (
                    <Link
                      key={`${p.a}-${p.b}`}
                      href={`/club/rivalries?a=${a.username}&b=${b.username}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm hover:border-line-strong"
                    >
                      <span className="min-w-0 truncate text-ivory">
                        {a.displayName} <span className="text-muted">vs</span> {b.displayName}
                      </span>
                      <span className="shrink-0 tabular text-ivory-dim">
                        {p.aheadA}–{p.aheadB}
                        <span className="text-faint"> · {p.encounters}</span>
                      </span>
                    </Link>
                  );
                })}
                <p className="text-xs text-muted">Score = times each finished ahead of the other · total games together.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {gameMatches.length > 0 ? (
        <Card>
          <CardHeader eyebrow="History" title={`Recent ${game.name} games`} />
          <CardBody className="pt-3">
            <MatchList matches={gameMatches.slice(0, 12)} lookup={lookup} gameName={() => game.name} timeZone={timeZone} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
