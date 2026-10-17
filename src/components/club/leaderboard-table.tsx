import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FormPill } from "@/components/ui/badge";
import type { FormResult } from "@/lib/domain/stats";
import { formatWinRate } from "@/lib/domain/stats";
import { cn } from "@/lib/utils";

export type LeaderboardRow = {
  profileId: string;
  rank: number | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emblem: string;
  points: number;
  wins: number;
  games: number;
  winRate: number | null;
  recentForm: FormResult[];
  isMe?: boolean;
};

function RankMark({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-xs text-faint">—</span>;
  return (
    <span
      className={cn(
        "font-display tabular",
        rank === 1 ? "text-2xl text-gold" : rank <= 3 ? "text-xl text-ivory" : "text-lg text-muted",
      )}
    >
      {rank}
    </span>
  );
}

export function LeaderboardTable({
  rows,
  compact = false,
  showForm = true,
  caption,
}: {
  rows: LeaderboardRow[];
  compact?: boolean;
  showForm?: boolean;
  caption: string;
}) {
  return (
    <div className="overflow-hidden">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-faint">
            <th scope="col" className="w-12 pb-3 pl-2 font-medium">
              #
            </th>
            <th scope="col" className="pb-3 font-medium">
              Player
            </th>
            <th scope="col" className="pb-3 pr-2 text-right font-medium">
              Pts
            </th>
            <th scope="col" className={cn("pb-3 pr-2 text-right font-medium", compact && "hidden sm:table-cell")}>
              Wins
            </th>
            <th scope="col" className={cn("hidden pb-3 pr-2 text-right font-medium sm:table-cell", compact && "sm:hidden md:table-cell")}>
              Win %
            </th>
            {showForm && !compact ? (
              <th scope="col" className="hidden pb-3 pr-2 text-right font-medium md:table-cell">
                Form
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.profileId}
              className={cn(
                "group animate-fade-up",
                row.rank === 1 && "bg-gradient-to-r from-gold/[0.07] to-transparent",
                row.isMe && "bg-white/[0.025]",
              )}
              style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
            >
              <td className="border-t border-line py-3 pl-2 align-middle">
                <RankMark rank={row.rank} />
              </td>
              <td className="border-t border-line py-3 align-middle">
                <Link href={`/club/players/${row.username}`} className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={row.displayName}
                    src={row.avatarUrl}
                    emblem={row.emblem}
                    size={compact ? "sm" : "md"}
                    ring={row.rank === 1 ? "gold" : undefined}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ivory group-hover:underline group-hover:underline-offset-4">
                      {row.displayName}
                      {row.isMe ? <span className="ml-2 text-[11px] font-normal text-muted">you</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {row.games} {row.games === 1 ? "game" : "games"}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="border-t border-line py-3 pr-2 text-right align-middle">
                <span className="tabular text-base font-semibold text-ivory">{row.points}</span>
              </td>
              <td className={cn("border-t border-line py-3 pr-2 text-right align-middle tabular text-ivory-dim", compact && "hidden sm:table-cell")}>
                {row.wins}
              </td>
              <td
                className={cn(
                  "hidden border-t border-line py-3 pr-2 text-right align-middle tabular text-ivory-dim sm:table-cell",
                  compact && "sm:hidden md:table-cell",
                )}
              >
                {formatWinRate(row.winRate)}
              </td>
              {showForm && !compact ? (
                <td className="hidden border-t border-line py-3 pr-2 align-middle md:table-cell">
                  <span className="flex justify-end gap-1">
                    {row.recentForm.length === 0 ? <span className="text-xs text-faint">—</span> : null}
                    {row.recentForm.map((result, i) => (
                      <FormPill key={i} result={result} />
                    ))}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
