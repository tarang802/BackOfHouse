import { Crown } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { BracketMatch } from "@/lib/data/competition-data";
import { roundLabel } from "@/lib/domain/tournament";
import type { MemberInfo } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function BracketView({
  bracket,
  totalRounds,
  lookup,
  tournamentId,
  canRecord,
}: {
  bracket: BracketMatch[];
  totalRounds: number;
  lookup: (id: string) => MemberInfo;
  tournamentId: string;
  canRecord: boolean;
}) {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  return (
    <div className="scrollbar-none -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <ol className="flex min-w-max gap-6">
        {rounds.map((round) => {
          const slots = bracket.filter((b) => b.round === round);
          const expected = 2 ** (totalRounds - round);
          return (
            <li key={round} className="flex w-60 flex-col">
              <h3 className="eyebrow mb-3">{roundLabel(round, totalRounds)}</h3>
              <ul className="flex flex-1 flex-col justify-around gap-4">
                {Array.from({ length: expected }, (_, i) => slots.find((s) => s.slot === i + 1) ?? null).map((slot, i) => (
                  <li key={slot?.id ?? `pending-${round}-${i}`} className="rounded-2xl border border-line bg-ink-2 p-2">
                    {[slot?.playerA ?? null, slot?.playerB ?? null].map((playerId, index) => {
                      const player = playerId ? lookup(playerId) : null;
                      const won = !!slot?.winnerId && slot.winnerId === playerId;
                      const lost = !!slot?.winnerId && !won;
                      return (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm",
                            won && "bg-gold/[0.08] text-ivory",
                            lost && "text-faint line-through",
                            !slot?.winnerId && "text-ivory-dim",
                          )}
                        >
                          {player ? (
                            <Avatar name={player.displayName} src={player.avatarUrl} emblem={player.emblem} size="xs" ring={won ? "gold" : undefined} />
                          ) : (
                            <span className="size-7 rounded-full border border-dashed border-line" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate">{player?.displayName ?? "To be decided"}</span>
                          {won ? (
                            <>
                              <Crown className="size-3.5 text-gold" aria-hidden />
                              <span className="sr-only">winner</span>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                    {slot && !slot.winnerId && slot.playerA && slot.playerB && canRecord ? (
                      <Link
                        href={`/club/matches/new?tournament=${tournamentId}&bracket=${slot.id}`}
                        className="mt-1 block rounded-lg border border-line px-2 py-1.5 text-center text-xs text-gold hover:border-gold/50"
                      >
                        Record result
                      </Link>
                    ) : null}
                    {slot?.matchId ? (
                      <Link href={`/club/matches/${slot.matchId}`} className="mt-1 block text-center text-[11px] text-muted hover:text-ivory">
                        View match
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
