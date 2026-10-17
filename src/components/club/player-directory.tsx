"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { formatWinRate } from "@/lib/domain/stats";

export type DirectoryPlayer = {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emblem: string;
  role: "owner" | "admin" | "member";
  rank: number | null;
  points: number;
  games: number;
  wins: number;
  winRate: number | null;
  joinedAt: string;
};

export function PlayerDirectory({ players, myId }: { players: DirectoryPlayer[]; myId: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => !q || p.displayName.toLowerCase().includes(q) || p.username.includes(q));
  }, [players, query]);

  return (
    <div className="flex flex-col gap-5">
      <label className="relative max-w-md">
        <span className="sr-only">Search players</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or @username" className="pl-11" />
      </label>
      {filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted">No players match “{query}”.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p, index) => (
          <li key={p.profileId} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
            <Link
              href={`/club/players/${p.username}`}
              className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <Avatar name={p.displayName} src={p.avatarUrl} emblem={p.emblem} size="lg" ring={p.rank === 1 ? "gold" : undefined} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-display text-xl text-ivory">{p.displayName}</span>
                  {p.profileId === myId ? <span className="text-[11px] text-muted">you</span> : null}
                </p>
                <p className="truncate text-xs text-muted">@{p.username}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ivory-dim">
                  <span>{p.rank ? `#${p.rank}` : "Unranked"}</span>
                  <span className="tabular">{p.points} pts</span>
                  <span className="tabular">{p.games} games</span>
                  <span className="tabular">{formatWinRate(p.winRate)} wins</span>
                </p>
              </div>
              {p.role !== "member" ? <Badge tone={p.role === "owner" ? "gold" : "neutral"}>{p.role}</Badge> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
