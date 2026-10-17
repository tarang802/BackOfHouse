import { Crown } from "lucide-react";
import type { Metadata } from "next";
import { LeaderboardTable } from "@/components/club/leaderboard-table";
import { toLeaderboardRows } from "@/components/club/rows";
import { ArchiveSeasonButton, NewSeasonButton } from "@/components/seasons/season-forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { getSeasons } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { buildLeaderboard, leaderboardFilters, localDay } from "@/lib/domain/leaderboard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Seasons" };

export default async function SeasonsPage() {
  const { profile, club, isAdmin } = await requireClub();
  const [seasons, members, games, matches] = await Promise.all([getSeasons(club.id), getMembers(club.id), getGameTypes(club.id), getMatches(club.id)]);
  const lookup = memberLookup(members);
  const active = seasons.find((s) => s.status === "active");
  const archived = seasons.filter((s) => s.status === "archived");
  const activeBoard = active
    ? buildLeaderboard(matches, members, leaderboardFilters.dateRange(games, active.startsOn, active.endsOn, club.timezone))
    : [];
  const leader = activeBoard.filter((e) => e.rank === 1);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={club.name}
        title="Seasons"
        description="A season is a fresh race over a date range. The all-time leaderboard keeps counting everything."
        actions={isAdmin && !active ? <NewSeasonButton seasonNumber={seasons.length + 1} today={localDay(new Date().toISOString(), club.timezone)} /> : null}
      />

      {active ? (
        <Card>
          <CardHeader
            eyebrow={<span className="flex items-center gap-2"><Badge tone="felt">Current season</Badge></span>}
            title={active.name}
            action={
              isAdmin ? (
                <ArchiveSeasonButton seasonId={active.id} seasonName={active.name} leaderName={leader.length === 1 ? leader[0].member.displayName : null} />
              ) : null
            }
          />
          <CardBody>
            <p className="mb-4 text-sm text-muted">
              From {formatDate(active.startsOn)}
              {active.endsOn ? ` to ${formatDate(active.endsOn)}` : " · open-ended"}. Overall games only.
            </p>
            {activeBoard.every((e) => e.rank === null) ? (
              <p className="text-sm text-muted">No games played this season yet.</p>
            ) : (
              <LeaderboardTable rows={toLeaderboardRows(activeBoard, profile.id)} caption={`${active.name} standings`} />
            )}
          </CardBody>
        </Card>
      ) : (
        <EmptyState suit="heart" title="No season running">
          {isAdmin ? "Start a season to give everyone a fresh race." : "When an admin starts a season, its standings appear here."}
        </EmptyState>
      )}

      {archived.length > 0 ? (
        <section aria-labelledby="archive-heading" className="flex flex-col gap-4">
          <h2 id="archive-heading" className="eyebrow">
            Archive
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {archived.map((season) => {
              const champion = season.championId ? lookup(season.championId) : null;
              const standings = season.finalStandings ?? [];
              return (
                <li key={season.id}>
                  <Card className="h-full">
                    <CardHeader eyebrow={`${formatDate(season.startsOn)} – ${season.endsOn ? formatDate(season.endsOn) : ""}`} title={season.name} />
                    <CardBody className="flex flex-col gap-4">
                      {champion ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/[0.05] px-4 py-3">
                          <Avatar name={champion.displayName} src={champion.avatarUrl} emblem={champion.emblem} size="md" ring="gold" />
                          <div>
                            <p className="eyebrow text-[10px] text-gold/80">Season champion</p>
                            <p className="font-display text-xl text-ivory">
                              <Crown className="mr-1.5 inline size-4 text-gold" aria-hidden />
                              {champion.displayName}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted">{standings.length ? "First place was shared — no single champion." : "No games were played."}</p>
                      )}
                      {standings.length > 0 ? (
                        <ol className="flex flex-col gap-1.5 text-sm">
                          {standings.slice(0, 5).map((row) => (
                            <li key={row.profile_id} className="flex items-center justify-between gap-3">
                              <span className="truncate text-ivory-dim">
                                <span className="mr-2 font-display text-lg tabular text-muted">{row.rank}</span>
                                {row.display_name}
                              </span>
                              <span className="tabular text-ivory">{row.points} pts</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
