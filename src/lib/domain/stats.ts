import { chronological, confirmedOnly, type MatchRecord } from "./types";

/**
 * Per-player statistics derived from match records. Voided matches never count.
 *
 * - A win is a first-place finish (shared first place counts for each tied player).
 * - A loss is any other finish. Win rate = wins / games played.
 * - Streaks count consecutive wins in the order matches were played.
 */

export type FormResult = "W" | "L";

export type PlayerStats = {
  profileId: string;
  games: number;
  wins: number;
  losses: number;
  points: number;
  winRate: number | null;
  averagePlacement: number | null;
  currentStreak: number;
  bestStreak: number;
  /** Most recent first, at most 5. */
  recentForm: FormResult[];
  secondPlaces: number;
  lastPlaces: number;
};

export type MatchFilter = (match: MatchRecord) => boolean;

export function emptyStats(profileId: string): PlayerStats {
  return {
    profileId,
    games: 0,
    wins: 0,
    losses: 0,
    points: 0,
    winRate: null,
    averagePlacement: null,
    currentStreak: 0,
    bestStreak: 0,
    recentForm: [],
    secondPlaces: 0,
    lastPlaces: 0,
  };
}

export function winRate(wins: number, games: number): number | null {
  if (games <= 0) return null;
  return wins / games;
}

export function formatWinRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function computePlayerStats(
  matches: MatchRecord[],
  profileId: string,
  filter: MatchFilter = () => true,
): PlayerStats {
  const stats = emptyStats(profileId);
  let placementSum = 0;
  let running = 0;
  const form: FormResult[] = [];

  for (const match of chronological(confirmedOnly(matches).filter(filter))) {
    const me = match.participants.find((p) => p.profileId === profileId);
    if (!me) continue;
    stats.games += 1;
    stats.points += me.pointsAwarded;
    placementSum += me.placement;
    const worst = Math.max(...match.participants.map((p) => p.placement));
    if (me.placement === 2) stats.secondPlaces += 1;
    if (me.placement === worst && me.placement !== 1) stats.lastPlaces += 1;
    if (me.placement === 1) {
      stats.wins += 1;
      running += 1;
      stats.bestStreak = Math.max(stats.bestStreak, running);
      form.push("W");
    } else {
      stats.losses += 1;
      running = 0;
      form.push("L");
    }
  }

  stats.currentStreak = running;
  stats.winRate = winRate(stats.wins, stats.games);
  stats.averagePlacement = stats.games > 0 ? placementSum / stats.games : null;
  stats.recentForm = form.slice(-5).reverse();
  return stats;
}

/** Longest run of consecutive losses ending at any point. */
export function longestLosingRun(matches: MatchRecord[], profileId: string): number {
  let best = 0;
  let running = 0;
  for (const match of chronological(confirmedOnly(matches))) {
    const me = match.participants.find((p) => p.profileId === profileId);
    if (!me) continue;
    running = me.placement === 1 ? 0 : running + 1;
    best = Math.max(best, running);
  }
  return best;
}

export function matchesForPlayer(matches: MatchRecord[], profileId: string): MatchRecord[] {
  return matches.filter((match) => match.participants.some((p) => p.profileId === profileId));
}
