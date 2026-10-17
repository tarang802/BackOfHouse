import { computePlayerStats, type MatchFilter, type PlayerStats } from "./stats";
import type { GameTypeInfo, MatchRecord, MemberInfo } from "./types";

/**
 * Ranking rules (documented in the UI on /club/leaderboard):
 * 1. More points ranks higher.
 * 2. Equal points: more wins ranks higher.
 * 3. Still equal: higher win rate ranks higher.
 * 4. Still equal: players share the rank (1, 2, 2, 4) and are listed alphabetically.
 * Players with no games in the view are listed after ranked players, unranked.
 */

export type LeaderboardEntry = {
  rank: number | null;
  member: MemberInfo;
  stats: PlayerStats;
};

export type LeaderboardSort = "rank" | "wins" | "winRate" | "games" | "name";

function compareForRank(a: PlayerStats, b: PlayerStats): number {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    (b.winRate ?? 0) - (a.winRate ?? 0)
  );
}

export function buildLeaderboard(
  matches: MatchRecord[],
  members: MemberInfo[],
  filter: MatchFilter = () => true,
): LeaderboardEntry[] {
  const rows = members.map((member) => ({
    member,
    stats: computePlayerStats(matches, member.profileId, filter),
  }));

  const ranked = rows
    .filter((row) => row.stats.games > 0)
    .sort(
      (a, b) =>
        compareForRank(a.stats, b.stats) ||
        a.member.displayName.localeCompare(b.member.displayName),
    );
  const unranked = rows
    .filter((row) => row.stats.games === 0)
    .sort((a, b) => a.member.displayName.localeCompare(b.member.displayName));

  const entries: LeaderboardEntry[] = [];
  ranked.forEach((row, index) => {
    const previous = entries[index - 1];
    const tiedWithPrevious = previous && compareForRank(previous.stats, row.stats) === 0;
    entries.push({ ...row, rank: tiedWithPrevious ? previous.rank : index + 1 });
  });
  for (const row of unranked) entries.push({ ...row, rank: null });
  return entries;
}

export function sortLeaderboard(entries: LeaderboardEntry[], sort: LeaderboardSort): LeaderboardEntry[] {
  if (sort === "rank") return entries;
  const copy = [...entries];
  const byName = (a: LeaderboardEntry, b: LeaderboardEntry) =>
    a.member.displayName.localeCompare(b.member.displayName);
  switch (sort) {
    case "wins":
      return copy.sort((a, b) => b.stats.wins - a.stats.wins || byName(a, b));
    case "winRate":
      return copy.sort((a, b) => (b.stats.winRate ?? -1) - (a.stats.winRate ?? -1) || byName(a, b));
    case "games":
      return copy.sort((a, b) => b.stats.games - a.stats.games || byName(a, b));
    case "name":
      return copy.sort(byName);
  }
}

export function searchLeaderboard(entries: LeaderboardEntry[], query: string): LeaderboardEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.member.displayName.toLowerCase().includes(q) ||
      entry.member.username.toLowerCase().includes(q),
  );
}

/** Calendar day (YYYY-MM-DD) of an instant in the given IANA time zone. */
export function localDay(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Match filters for the standard leaderboard views. */
export const leaderboardFilters = {
  overall(gameTypes: GameTypeInfo[]): MatchFilter {
    const counted = new Set(gameTypes.filter((g) => g.countsTowardOverall).map((g) => g.id));
    return (match) => counted.has(match.gameTypeId);
  },
  game(gameTypeId: string): MatchFilter {
    return (match) => match.gameTypeId === gameTypeId;
  },
  tournament(tournamentId: string): MatchFilter {
    return (match) => match.tournamentId === tournamentId;
  },
  dateRange(
    gameTypes: GameTypeInfo[],
    startsOn: string,
    endsOn: string | null,
    timeZone = "UTC",
  ): MatchFilter {
    const overall = leaderboardFilters.overall(gameTypes);
    return (match) => {
      const day = localDay(match.playedAt, timeZone);
      return overall(match) && day >= startsOn && (endsOn === null || day <= endsOn);
    };
  },
};
