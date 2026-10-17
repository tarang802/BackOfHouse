import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/club/match-list";
import { BracketView } from "@/components/tournaments/bracket-view";
import { Championship } from "@/components/tournaments/championship";
import { TournamentControls } from "@/components/tournaments/tournament-controls";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getGameTypes, getMatches, getMembers, getScoringRules, memberLookup } from "@/lib/data/club-data";
import { getBracket, getTournament } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { describeScoringRule } from "@/lib/domain/scoring";
import { checkPointsCompletion, tournamentStandings } from "@/lib/domain/standings";
import { totalRounds } from "@/lib/domain/tournament";
import { confirmedOnly } from "@/lib/domain/types";
import { formatDate, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Tournament" };

const FORMAT_LABEL = { points: "Points race", rounds: "Fixed rounds", elimination: "Knockout" } as const;
const STATUS_LABEL = { draft: "Draft", upcoming: "Upcoming", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" } as const;

export default async function TournamentPage({ params }: PageProps<"/club/tournaments/[tournamentId]">) {
  const { tournamentId } = await params;
  const { club, isAdmin } = await requireClub();
  const tournament = await getTournament(club.id, tournamentId);
  if (!tournament) notFound();
  const [members, games, matches, rules, bracket] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getScoringRules(club.id),
    tournament.format === "elimination" ? getBracket(tournament.id) : Promise.resolve([]),
  ]);
  const lookup = memberLookup(members);
  const game = games.find((g) => g.id === tournament.gameTypeId);
  const rule = rules.find((r) => r.id === tournament.scoringRuleId);
  const tMatches = confirmedOnly(matches).filter((m) => m.tournamentId === tournament.id);
  const standings = tournamentStandings(tournament.participantIds, matches, tournament.id);
  const rounds = tournament.format === "elimination" ? totalRounds(tournament.participantIds.length) : 0;
  const champion = tournament.championId ? lookup(tournament.championId) : null;

  const completionCheck =
    tournament.format === "elimination"
      ? null
      : checkPointsCompletion({
          format: tournament.format,
          status: tournament.status,
          roundCount: tournament.roundCount,
          standings,
          confirmedMatches: tMatches.length,
        });
  const completion = completionCheck
    ? completionCheck.ok
      ? { ok: true as const, championName: lookup(completionCheck.championId).displayName }
      : { ok: false as const, reason: completionCheck.reason }
    : null;
  const roundsPlayed = tournament.format === "rounds" ? `${tMatches.length} / ${tournament.roundCount} rounds` : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/club/tournaments" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-ivory">
        <ArrowLeft className="size-4" /> Tournaments
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tournament.status === "in_progress" ? "felt" : tournament.status === "completed" ? "gold" : tournament.status === "cancelled" ? "loss" : "neutral"}>
              {STATUS_LABEL[tournament.status]}
            </Badge>
            <Badge>{FORMAT_LABEL[tournament.format]}</Badge>
          </div>
          <h1 className="mt-3 font-display text-[2.6rem] leading-none text-ivory sm:text-6xl">{tournament.name}</h1>
          <p className="mt-3 text-sm text-muted">
            {game?.name} · {pluralize(tournament.participantIds.length, "player")} · {formatDate(tournament.startsOn)}
            {tournament.endsOn ? ` – ${formatDate(tournament.endsOn)}` : ""}
            {roundsPlayed ? ` · ${roundsPlayed}` : ""}
          </p>
          {tournament.description ? <p className="mt-3 max-w-2xl text-[15px] text-ivory-dim">{tournament.description}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {tournament.status === "in_progress" && tournament.format !== "elimination" ? (
            <ButtonLink href={`/club/matches/new?tournament=${tournament.id}`}>
              <Plus /> Record a tournament match
            </ButtonLink>
          ) : null}
          {isAdmin ? (
            <TournamentControls tournamentId={tournament.id} status={tournament.status} format={tournament.format} completion={completion} />
          ) : null}
        </div>
      </header>

      {champion && tournament.status === "completed" ? (
        <Championship
          tournamentName={tournament.name}
          champion={champion}
          detail={
            tournament.format === "elimination"
              ? `Won the ${pluralize(tournament.participantIds.length, "player")} knockout${tournament.completedAt ? ` · ${formatDate(tournament.completedAt)}` : ""}`
              : `${standings[0]?.points ?? 0} points from ${pluralize(tMatches.length, "match", "matches")}${tournament.completedAt ? ` · ${formatDate(tournament.completedAt)}` : ""}`
          }
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader eyebrow={tournament.format === "elimination" ? "Bracket" : "Standings"} title={tournament.format === "elimination" ? "The draw" : "Table"} />
          <CardBody>
            {tournament.format === "elimination" ? (
              bracket.length === 0 ? (
                <p className="text-sm text-muted">The bracket is drawn when the tournament starts. Seeds follow the registration order.</p>
              ) : (
                <BracketView bracket={bracket} totalRounds={rounds} lookup={lookup} tournamentId={tournament.id} canRecord={tournament.status === "in_progress"} />
              )
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Tournament standings</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-faint">
                    <th scope="col" className="w-10 pb-3 font-medium">#</th>
                    <th scope="col" className="pb-3 font-medium">Player</th>
                    <th scope="col" className="pb-3 text-right font-medium">Played</th>
                    <th scope="col" className="pb-3 text-right font-medium">Wins</th>
                    <th scope="col" className="pb-3 text-right font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const player = lookup(row.profileId);
                    const isChampion = row.profileId === tournament.championId;
                    return (
                      <tr key={row.profileId} className="border-t border-line">
                        <td className={`py-3 font-display text-xl tabular ${row.rank === 1 && row.played > 0 ? "text-gold" : "text-muted"}`}>{row.rank}</td>
                        <td className="py-3">
                          <span className="flex items-center gap-3">
                            <Avatar name={player.displayName} src={player.avatarUrl} emblem={player.emblem} size="sm" ring={isChampion ? "gold" : undefined} />
                            <span className="truncate text-ivory">{player.displayName}</span>
                            {isChampion ? <Badge tone="gold">Champion</Badge> : null}
                          </span>
                        </td>
                        <td className="py-3 text-right tabular text-ivory-dim">{row.played}</td>
                        <td className="py-3 text-right tabular text-ivory-dim">{row.wins}</td>
                        <td className="py-3 text-right tabular font-semibold text-ivory">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader eyebrow="Rules" title="How it is decided" />
            <CardBody className="flex flex-col gap-3 text-sm text-muted">
              {tournament.format === "elimination" ? (
                <p>Single elimination, one-on-one. The winner of each pairing advances; the winner of the final is champion. No ties.</p>
              ) : (
                <>
                  {rule ? (
                    <ul className="flex flex-col gap-1 text-ivory-dim">
                      {describeScoringRule(rule).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p>
                    Most points wins; level on points, most wins. A champion is crowned only when one player leads outright
                    {tournament.format === "rounds" ? ` after all ${tournament.roundCount} rounds` : ""}.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader eyebrow="Matches" title="Played so far" />
            <CardBody className="pt-3">
              {tMatches.length === 0 ? (
                <p className="text-sm text-muted">No matches recorded yet.</p>
              ) : (
                <MatchList matches={tMatches} lookup={lookup} gameName={() => game?.name ?? "Game"} timeZone={club.timezone} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
