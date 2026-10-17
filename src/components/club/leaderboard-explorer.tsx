"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { formatWinRate } from "@/lib/domain/stats";
import { cn } from "@/lib/utils";
import { LeaderboardTable, type LeaderboardRow } from "./leaderboard-table";

export type LeaderboardView = { id: string; label: string; description: string; rows: LeaderboardRow[] };

type Sort = "rank" | "wins" | "winRate" | "games" | "name";

const sorters: Record<Exclude<Sort, "rank">, (a: LeaderboardRow, b: LeaderboardRow) => number> = {
  wins: (a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName),
  winRate: (a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || a.displayName.localeCompare(b.displayName),
  games: (a, b) => b.games - a.games || a.displayName.localeCompare(b.displayName),
  name: (a, b) => a.displayName.localeCompare(b.displayName),
};

export function LeaderboardExplorer({ views, initialView }: { views: LeaderboardView[]; initialView?: string }) {
  const [viewId, setViewId] = useState(initialView && views.some((v) => v.id === initialView) ? initialView : views[0]?.id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const view = views.find((v) => v.id === viewId) ?? views[0];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = view.rows.filter(
      (row) => !q || row.displayName.toLowerCase().includes(q) || row.username.toLowerCase().includes(q),
    );
    if (sort !== "rank") result = [...result].sort(sorters[sort]);
    return result;
  }, [view, query, sort]);

  const leader = view.rows.find((r) => r.rank === 1);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Leaderboards" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {views.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            id={`board-tab-${v.id}`}
            aria-controls="board-panel"
            aria-selected={v.id === view.id}
            tabIndex={v.id === view.id ? 0 : -1}
            onKeyDown={(event) => {
              const index = views.findIndex((x) => x.id === view.id);
              const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const target = views[(next + views.length) % views.length];
              setViewId(target.id);
              document.getElementById(`board-tab-${target.id}`)?.focus();
            }}
            onClick={() => setViewId(v.id)}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm transition-colors",
              v.id === view.id ? "border-gold/60 bg-gold/10 text-ivory" : "border-line text-muted hover:text-ivory",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${view.id}`} className="flex flex-col gap-5">
      <p className="text-sm text-muted">{view.description}</p>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <span className="sr-only">Search players</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" className="pl-11" />
        </label>
        <label>
          <span className="sr-only">Sort by</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="rank">Sort: Rank</option>
            <option value="wins">Sort: Wins</option>
            <option value="winRate">Sort: Win rate</option>
            <option value="games">Sort: Games played</option>
            <option value="name">Sort: Name</option>
          </Select>
        </label>
      </div>

      {leader && sort === "rank" && !query ? (
        <p className="text-sm text-ivory-dim">
          <span className="text-gold">{leader.displayName}</span> leads with {leader.points} points and{" "}
          {formatWinRate(leader.winRate)} wins.
        </p>
      ) : null}

      {view.rows.every((r) => r.games === 0) ? (
        <EmptyState title="Nothing recorded here yet">Results for this board will appear after the first match.</EmptyState>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No players match “{query}”.</p>
      ) : (
        <LeaderboardTable rows={rows} caption={`${view.label} leaderboard`} />
      )}
      </div>
    </div>
  );
}
