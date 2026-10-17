import type { Metadata } from "next";
import Link from "next/link";
import { RivalryPicker } from "@/components/club/rivalry-picker";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMatches, getMembers } from "@/lib/data/club-data";
import { getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { frequentOpponents, headToHead } from "@/lib/domain/rivalry";
import { ordinal } from "@/lib/domain/scoring";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Rivalries" };

export default async function RivalriesPage({ searchParams }: PageProps<"/club/rivalries">) {
  const { profile, club } = await requireClub();
  const params = await searchParams;
  const [members, games, matches, tournaments] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getTournaments(club.id),
  ]);

  if (members.length < 2) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader eyebrow={club.name} title="Rivalries" />
        <EmptyState title="You need a rival">Invite friends to your club to start comparing records.</EmptyState>
      </div>
    );
  }

  const byUsername = new Map(members.map((m) => [m.username, m]));
  const me = members.find((m) => m.profileId === profile.id)!;
  const defaultOpponent = frequentOpponents(matches, me.profileId)[0]?.profileId;
  const a = byUsername.get(String(params.a ?? "")) ?? me;
  const fallbackB = members.find((m) => m.profileId === defaultOpponent && m.profileId !== a.profileId) ?? members.find((m) => m.profileId !== a.profileId)!;
  let b = byUsername.get(String(params.b ?? "")) ?? fallbackB;
  if (b.profileId === a.profileId) b = fallbackB;

  const h2h = headToHead(matches, a.profileId, b.profileId);
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";
  const tournamentName = (id: string | null) => (id ? tournaments.find((t) => t.id === id)?.name : null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Head to head" title="Rivalries" description="Every game two players have shared, from the record books." />
      <Card>
        <CardBody>
          <RivalryPicker
            players={members.map((m) => ({ username: m.username, displayName: m.displayName }))}
            a={a.username}
            b={b.username}
          />
        </CardBody>
      </Card>

      <section aria-label="Rivalry summary" className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-[1.75rem] border border-line bg-gradient-to-b from-surface-2 to-surface p-6 sm:p-10">
        {[a, b].map((player, index) => {
          const ahead = index === 0 ? h2h.aheadA : h2h.aheadB;
          const leading = h2h.leader === (index === 0 ? "a" : "b");
          return (
            <Link
              key={player.profileId}
              href={`/club/players/${player.username}`}
              className={cn("flex flex-col items-center gap-3 text-center", index === 1 && "order-3")}
            >
              <Avatar name={player.displayName} src={player.avatarUrl} emblem={player.emblem} size="xl" ring={leading ? "gold" : undefined} />
              <span className="font-display text-2xl text-ivory">{player.displayName}</span>
              <span className={cn("font-display text-6xl tabular", leading ? "text-gold" : "text-ivory")}>{ahead}</span>
              {leading ? <span className="text-xs uppercase tracking-[0.2em] text-gold">Leads</span> : <span className="h-4" />}
            </Link>
          );
        })}
        <div className="order-2 flex flex-col items-center gap-1 text-center">
          <span className="font-display text-2xl italic text-muted">vs</span>
          <span className="text-xs text-faint">{h2h.encounters} games</span>
          {h2h.draws > 0 ? <span className="text-xs text-faint">{h2h.draws} level</span> : null}
        </div>
      </section>

      {h2h.encounters === 0 ? (
        <EmptyState title="They have never met">Once these two play in the same recorded game, their rivalry starts here.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader eyebrow="Breakdown" title="By the numbers" />
            <CardBody className="flex flex-col gap-4 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="eyebrow text-[10px]">{a.displayName} ahead</dt>
                  <dd className="mt-1 font-display text-3xl tabular text-ivory">
                    {h2h.winPctA === null ? "—" : `${Math.round(h2h.winPctA * 100)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-[10px]">Outright wins</dt>
                  <dd className="mt-1 font-display text-3xl tabular text-ivory">
                    {h2h.outrightWinsA}–{h2h.outrightWinsB}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow text-[10px]">Tournament meetings</dt>
                  <dd className="mt-1 font-display text-3xl tabular text-ivory">{h2h.tournamentEncounters}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-[10px]">Level finishes</dt>
                  <dd className="mt-1 font-display text-3xl tabular text-ivory">{h2h.draws}</dd>
                </div>
              </dl>
              <table className="mt-2 w-full">
                <caption className="sr-only">Head to head by game</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-faint">
                    <th scope="col" className="pb-2 font-medium">Game</th>
                    <th scope="col" className="pb-2 text-right font-medium">Games</th>
                    <th scope="col" className="pb-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(h2h.byGame).map(([gameId, g]) => (
                    <tr key={gameId} className="border-t border-line">
                      <th scope="row" className="py-2.5 text-left font-medium text-ivory">{gameName(gameId)}</th>
                      <td className="py-2.5 text-right tabular text-ivory-dim">{g.encounters}</td>
                      <td className="py-2.5 text-right tabular text-ivory">
                        {g.aheadA}–{g.aheadB}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted">
                “Ahead” means finishing in a better position than the other player. Equal positions count for neither. Voided matches are
                excluded.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader eyebrow="Latest" title="Recent encounters" />
            <CardBody className="pt-3">
              <ul className="flex flex-col divide-y divide-line">
                {h2h.recent.map((e) => (
                  <li key={e.matchId}>
                    <Link href={`/club/matches/${e.matchId}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-white/[0.02]">
                      <span className="min-w-0">
                        <span className="block truncate text-ivory">
                          {e.outcome === "draw" ? "Level" : `${e.outcome === "a" ? a.displayName : b.displayName} ahead`}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {gameName(e.gameTypeId)}
                          {tournamentName(e.tournamentId) ? ` · ${tournamentName(e.tournamentId)}` : ""} · {formatDate(e.playedAt, club.timezone)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular text-ivory-dim">
                        {ordinal(e.placementA)} vs {ordinal(e.placementB)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
