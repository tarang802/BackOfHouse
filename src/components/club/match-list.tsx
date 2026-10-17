import { ChevronRight, Crown } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { MatchRecord, MemberInfo } from "@/lib/domain/types";
import { cn, formatDateTime } from "@/lib/utils";

export type MatchListItem = MatchRecord & { tournamentName?: string | null };

export function MatchList({
  matches,
  lookup,
  gameName,
  timeZone,
  highlightId,
}: {
  matches: MatchListItem[];
  lookup: (profileId: string) => MemberInfo;
  gameName: (gameTypeId: string) => string;
  timeZone?: string;
  highlightId?: string;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {matches.map((match) => {
        const winners = match.participants.filter((p) => p.placement === 1).map((p) => lookup(p.profileId));
        const others = match.participants.filter((p) => p.placement !== 1);
        const voided = match.status === "voided";
        return (
          <li key={match.id}>
            <Link
              href={`/club/matches/${match.id}`}
              className={cn(
                "group flex items-center gap-4 py-3.5 transition-colors hover:bg-white/[0.02] sm:px-2",
                match.id === highlightId && "bg-felt/10",
              )}
            >
              <div className="flex -space-x-2">
                {winners.slice(0, 2).map((w) => (
                  <Avatar key={w.profileId} name={w.displayName} src={w.avatarUrl} emblem={w.emblem} size="md" ring={voided ? undefined : "gold"} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("flex items-center gap-2 truncate text-sm", voided ? "text-muted line-through" : "text-ivory")}>
                  <Crown className="size-3.5 shrink-0 text-gold/80" aria-hidden />
                  <span className="truncate">
                    {winners.map((w) => w.displayName).join(" & ")}
                    <span className="sr-only"> won</span>
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {gameName(match.gameTypeId)}
                  {match.tournamentName ? ` · ${match.tournamentName}` : ""} · {match.participants.length} players
                  {others.length > 0 ? ` · ${others.slice(0, 3).map((o) => lookup(o.profileId).displayName).join(", ")}${others.length > 3 ? "…" : ""}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {voided ? <Badge tone="loss">Voided</Badge> : null}
                <time dateTime={match.playedAt} className="text-xs text-faint">
                  {formatDateTime(match.playedAt, timeZone)}
                </time>
              </div>
              <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
