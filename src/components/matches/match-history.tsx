"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MatchList, type MatchListItem } from "@/components/club/match-list";
import { Input, Select } from "@/components/ui/field";
import type { MemberInfo } from "@/lib/domain/types";

export type HistoryFilters = { game: string; tournament: string; player: string; status: "all" | "confirmed" | "voided"; query: string };

export function filterMatches(
  matches: MatchListItem[],
  filters: HistoryFilters,
  lookup: (id: string) => MemberInfo,
  gameName: (id: string) => string,
): MatchListItem[] {
  const q = filters.query.trim().toLowerCase();
  return matches.filter((m) => {
    if (filters.game && m.gameTypeId !== filters.game) return false;
    if (filters.tournament === "none" && m.tournamentId) return false;
    if (filters.tournament && filters.tournament !== "none" && m.tournamentId !== filters.tournament) return false;
    if (filters.player && !m.participants.some((p) => p.profileId === filters.player)) return false;
    if (filters.status !== "all" && m.status !== filters.status) return false;
    if (q) {
      const haystack = [gameName(m.gameTypeId), m.tournamentName ?? "", ...m.participants.map((p) => lookup(p.profileId).displayName)]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

const PAGE = 30;

export function MatchHistory({
  matches,
  members,
  games,
  tournaments,
  timeZone,
  initial,
}: {
  matches: MatchListItem[];
  members: MemberInfo[];
  games: { id: string; name: string }[];
  tournaments: { id: string; name: string }[];
  timeZone: string;
  initial?: Partial<HistoryFilters>;
}) {
  const [filters, setFilters] = useState<HistoryFilters>({ game: "", tournament: "", player: "", status: "all", query: "", ...initial });
  const [limit, setLimit] = useState(PAGE);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.profileId, m])), [members]);
  const lookup = (id: string): MemberInfo =>
    memberMap.get(id) ?? { profileId: id, username: "", displayName: "Former member", avatarUrl: null, emblem: "spade", role: "member", joinedAt: "" };
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";
  const filtered = filterMatches(matches, filters, lookup, gameName);
  const set = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(PAGE);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search matches</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input value={filters.query} onChange={(e) => set("query", e.target.value)} placeholder="Search" className="pl-11" />
        </label>
        <label>
          <span className="sr-only">Game</span>
          <Select value={filters.game} onChange={(e) => set("game", e.target.value)}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Player</span>
          <Select value={filters.player} onChange={(e) => set("player", e.target.value)}>
            <option value="">All players</option>
            {members.map((m) => (
              <option key={m.profileId} value={m.profileId}>
                {m.displayName}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Tournament</span>
          <Select value={filters.tournament} onChange={(e) => set("tournament", e.target.value)}>
            <option value="">Any match</option>
            <option value="none">Not in a tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <Select value={filters.status} onChange={(e) => set("status", e.target.value as HistoryFilters["status"])}>
            <option value="all">Confirmed & voided</option>
            <option value="confirmed">Confirmed only</option>
            <option value="voided">Voided only</option>
          </Select>
        </label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "match" : "matches"}
      </p>
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No matches fit these filters.</p>
      ) : (
        <MatchList matches={filtered.slice(0, limit)} lookup={lookup} gameName={gameName} timeZone={timeZone} />
      )}
      {filtered.length > limit ? (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mx-auto rounded-full border border-line px-5 py-2 text-sm text-ivory-dim hover:text-ivory">
          Show more
        </button>
      ) : null}
    </div>
  );
}
