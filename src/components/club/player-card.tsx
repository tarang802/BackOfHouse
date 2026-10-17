import { Flame } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, FormPill } from "@/components/ui/badge";
import { SuitIcon, isSuit } from "@/components/ui/suit";
import { formatWinRate, type PlayerStats } from "@/lib/domain/stats";
import { formatDate } from "@/lib/utils";

/** The hero "player card" at the top of a profile. */
export function PlayerCard({
  displayName,
  username,
  avatarUrl,
  emblem,
  role,
  joinedAt,
  rank,
  rankedCount,
  stats,
  actions,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  emblem: string;
  role: string;
  joinedAt: string;
  rank: number | null;
  rankedCount: number;
  stats: PlayerStats;
  actions?: ReactNode;
}) {
  const suit = isSuit(emblem) ? emblem : "spade";
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-br from-surface-2 via-surface to-ink-2 p-6 shadow-[var(--shadow-card)] sm:p-8">
      <SuitIcon suit={suit} aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-64 text-white/[0.025]" />
      <div className="absolute inset-3 rounded-[1.35rem] border border-white/[0.03]" aria-hidden />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar name={displayName} src={avatarUrl} emblem={emblem} size="xl" ring={rank === 1 ? "gold" : "felt"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank === 1 ? <Badge tone="gold">Club leader</Badge> : null}
            {role !== "member" ? <Badge>{role}</Badge> : null}
          </div>
          <h1 className="mt-2 truncate font-display text-[2.6rem] leading-none text-ivory sm:text-5xl">{displayName}</h1>
          <p className="mt-2 text-sm text-muted">
            @{username}
            {joinedAt ? ` · Joined ${formatDate(joinedAt)}` : ""}
          </p>
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>

      <dl className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-4 lg:grid-cols-8">
        <Metric label="Rank" value={rank ? `#${rank}` : "—"} detail={rank ? `of ${rankedCount}` : "Unranked"} gold={rank === 1} />
        <Metric label="Points" value={stats.points} />
        <Metric label="Games" value={stats.games} />
        <Metric label="Wins" value={stats.wins} />
        <Metric label="Losses" value={stats.losses} />
        <Metric label="Win rate" value={formatWinRate(stats.winRate)} />
        <Metric
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1.5">
              {stats.currentStreak}
              {stats.currentStreak >= 3 ? <Flame className="size-5 text-gold" aria-label="On fire" /> : null}
            </span>
          }
          detail={`Best ${stats.bestStreak}`}
        />
        <Metric
          label="Form"
          value={
            <span className="flex gap-1 pt-1">
              {stats.recentForm.length ? stats.recentForm.map((r, i) => <FormPill key={i} result={r} />) : <span className="text-base text-faint">—</span>}
            </span>
          }
        />
      </dl>
      {stats.games === 0 ? (
        <p className="relative mt-6 text-sm text-muted">No recorded games yet — statistics appear after the first match.</p>
      ) : null}
    </section>
  );
}

function Metric({ label, value, detail, gold }: { label: string; value: ReactNode; detail?: string; gold?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={`mt-1.5 tabular font-display text-3xl leading-none ${gold ? "text-gold" : "text-ivory"}`}>{value}</dd>
      {detail ? <dd className="mt-1 text-xs text-muted">{detail}</dd> : null}
    </div>
  );
}
