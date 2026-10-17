import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameHub } from "@/components/club/game-hub";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { getPokerLedger } from "@/lib/data/poker-data";
import { requireClub } from "@/lib/data/session";
import { formatAmount, summarizeLedger } from "@/lib/domain/ledger";
import { confirmedOnly } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Poker" };

export default async function PokerPage() {
  const { profile, club } = await requireClub();
  const [members, games, matches, ledger] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getMatches(club.id),
    getPokerLedger(club.id),
  ]);
  const game = games.find((g) => g.kind === "poker");
  if (!game) notFound();
  const lookup = memberLookup(members);
  const confirmedIds = new Set(confirmedOnly(matches).map((m) => m.id));
  const summary = summarizeLedger(ledger, confirmedIds);

  return (
    <GameHub
      game={game}
      members={members}
      matches={matches}
      myId={profile.id}
      lookup={lookup}
      timeZone={club.timezone}
      suit="club"
      intro={
        <>
          Record each session&apos;s finishing order — no hand-by-hand logging needed.{" "}
          {game.countsTowardOverall
            ? "Poker points count toward the overall leaderboard and the Poker board."
            : "Poker points count toward the Poker board only."}
        </>
      }
      extra={
        <Card>
          <CardHeader eyebrow="Private · optional" title="Session accounting" />
          <CardBody className="flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-muted">
              A friendly record of buy-ins and cash-outs, visible only to club members. It never changes leaderboard points, and
              The Bluff Club does not handle money.
            </p>
            {summary.length === 0 ? (
              <p className="text-sm text-muted">No sessions with accounting yet. Add it under “Date, notes and session accounting” when recording.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Session accounting by player</caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-faint">
                    <th scope="col" className="pb-2 font-medium">Player</th>
                    <th scope="col" className="pb-2 text-right font-medium">Sessions</th>
                    <th scope="col" className="pb-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.profileId} className="border-t border-line">
                      <td className="py-2.5 text-ivory">{lookup(row.profileId).displayName}</td>
                      <td className="py-2.5 text-right tabular text-ivory-dim">{row.sessions}</td>
                      <td className={`py-2.5 text-right tabular ${row.net >= 0 ? "text-ivory" : "text-loss"}`}>{formatAmount(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      }
    />
  );
}
