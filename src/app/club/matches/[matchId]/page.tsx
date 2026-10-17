import { ArrowLeft, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/field";
import { getGameTypes, getMatch, getMembers, getScoringRules, memberLookup } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";
import { describeScoringRule, ordinal } from "@/lib/domain/scoring";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Match" };

export default async function MatchDetailPage({ params, searchParams }: PageProps<"/club/matches/[matchId]">) {
  const { matchId } = await params;
  const query = await searchParams;
  const { club } = await requireClub();
  const match = await getMatch(club.id, matchId);
  if (!match) notFound();
  const [members, games, rules] = await Promise.all([getMembers(club.id), getGameTypes(club.id), getScoringRules(club.id)]);
  const lookup = memberLookup(members);
  const game = games.find((g) => g.id === match.gameTypeId);
  const rule = rules.find((r) => r.id === match.scoringRuleId);
  const voided = match.status === "voided";
  const recorder = match.createdBy ? lookup(match.createdBy) : null;
  const winners = match.participants.filter((p) => p.placement === 1).map((p) => lookup(p.profileId));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/club/matches" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-ivory">
        <ArrowLeft className="size-4" /> Match history
      </Link>

      {query.recorded === "1" && !voided ? (
        <FormMessage tone="success">
          <span className="flex items-center gap-2">
            <CircleCheck className="size-4 text-[#9fd3b8]" /> Result saved. The leaderboard has been updated.
          </span>
        </FormMessage>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={voided ? "loss" : "felt"}>{voided ? "Voided" : "Confirmed"}</Badge>
          {match.tournamentId ? <Badge tone="gold">Tournament</Badge> : null}
          {match.correctsMatchId ? <Badge>Correction</Badge> : null}
        </div>
        <h1 className="font-display text-[2.6rem] leading-none text-ivory sm:text-5xl">
          {game?.name ?? "Match"}
          <span className="text-muted"> · </span>
          <span className={voided ? "text-muted line-through" : "italic text-gold"}>{winners.map((w) => w.displayName).join(" & ")}</span>
        </h1>
        <p className="text-sm text-muted">
          <time dateTime={match.playedAt}>{formatDateTime(match.playedAt, club.timezone)}</time>
          {recorder ? ` · Recorded by ${recorder.displayName}` : ""}
          {match.tournamentRound ? ` · Round ${match.tournamentRound}` : ""}
        </p>
      </header>

      {voided ? (
        <FormMessage>
          This match was voided{match.voidedAt ? ` on ${formatDateTime(match.voidedAt, club.timezone)}` : ""}: {match.voidReason}. It no
          longer counts toward any statistics.
        </FormMessage>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader eyebrow="Result" title="Final standings" />
          <CardBody>
            <ol className="flex flex-col gap-2">
              {match.participants.map((p) => {
                const player = lookup(p.profileId);
                return (
                  <li key={p.profileId} className="flex items-center gap-4 rounded-xl border border-line bg-ink-2 px-4 py-3">
                    <span className={`w-12 font-display text-2xl tabular ${p.placement === 1 ? "text-gold" : "text-ivory-dim"}`}>
                      {ordinal(p.placement)}
                    </span>
                    <Avatar name={player.displayName} src={player.avatarUrl} emblem={player.emblem} size="sm" ring={p.placement === 1 ? "gold" : undefined} />
                    {player.username ? (
                      <Link href={`/club/players/${player.username}`} className="min-w-0 flex-1 truncate text-ivory hover:underline hover:underline-offset-4">
                        {player.displayName}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-muted">{player.displayName}</span>
                    )}
                    <span className={`tabular font-semibold ${voided ? "text-faint line-through" : p.pointsAwarded > 0 ? "text-[#9fd3b8]" : "text-faint"}`}>
                      +{p.pointsAwarded}
                      <span className="sr-only"> points</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            {match.notes ? (
              <div className="mt-5 rounded-xl border border-line px-4 py-3">
                <p className="eyebrow mb-1">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-ivory-dim">{match.notes}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Breakdown" title="How points were scored" />
          <CardBody className="text-sm text-muted">
            {rule ? (
              <>
                <p className="mb-3">Scoring rules v{rule.version} (in force when this match was recorded):</p>
                <ul className="flex flex-col gap-1 text-ivory-dim">
                  {describeScoringRule(rule).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Scoring rules unavailable.</p>
            )}
            <p className="mt-4">Tied players received the points for their shared place.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
