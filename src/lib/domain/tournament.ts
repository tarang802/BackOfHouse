/**
 * Tournament rules. Mirrors the SQL in the tournament migrations, which is authoritative.
 *
 * Formats
 * - points: any number of matches; standings by total points.
 * - rounds: exactly `roundCount` matches; standings by total points.
 * - elimination: single-elimination bracket of 1-v-1 matches, 2/4/8/16/32 players,
 *   seeded so the top seeds can only meet late.
 *
 * Standings and completion live in ./standings.ts.
 */

export type TournamentFormat = "points" | "rounds" | "elimination";
export type TournamentStatus = "draft" | "upcoming" | "in_progress" | "completed" | "cancelled";

export const MIN_TOURNAMENT_PLAYERS = 2;
export const MAX_TOURNAMENT_PLAYERS = 32;

// ---------------------------------------------------------------------------
// Elimination brackets
// ---------------------------------------------------------------------------

export function isValidBracketSize(n: number): boolean {
  return n >= 2 && n <= MAX_TOURNAMENT_PLAYERS && (n & (n - 1)) === 0;
}

export function totalRounds(n: number): number {
  return Math.log2(n);
}

/** Standard seed order, e.g. 8 -> [1, 8, 4, 5, 2, 7, 3, 6]. */
export function bracketSeedOrder(n: number): number[] {
  if (!isValidBracketSize(n)) throw new Error("Bracket size must be a power of two from 2 to 32.");
  let order = [1, 2];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

export type BracketPairing = { round: number; slot: number; playerA: string | null; playerB: string | null };

/** First-round pairings from participants ordered by seed (index 0 = seed 1). */
export function firstRoundPairings(seededIds: string[]): BracketPairing[] {
  const order = bracketSeedOrder(seededIds.length);
  const pairings: BracketPairing[] = [];
  for (let i = 0; i < order.length; i += 2) {
    pairings.push({
      round: 1,
      slot: i / 2 + 1,
      playerA: seededIds[order[i] - 1],
      playerB: seededIds[order[i + 1] - 1],
    });
  }
  return pairings;
}

export type BracketSlot = BracketPairing & { winnerId: string | null };

/** Winners of slots 2k-1 and 2k meet in slot k of the next round. */
export function nextRoundPairings(round: BracketSlot[]): BracketPairing[] {
  if (round.length < 2) return [];
  if (round.some((slot) => !slot.winnerId)) {
    throw new Error("Every match in the round needs a winner before the next round.");
  }
  const sorted = [...round].sort((a, b) => a.slot - b.slot);
  const next: BracketPairing[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    next.push({
      round: sorted[i].round + 1,
      slot: i / 2 + 1,
      playerA: sorted[i].winnerId,
      playerB: sorted[i + 1].winnerId,
    });
  }
  return next;
}

export function roundLabel(round: number, rounds: number): string {
  const remaining = rounds - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semi-finals";
  if (remaining === 2) return "Quarter-finals";
  return `Round ${round}`;
}

export const STATUS_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["upcoming", "in_progress", "cancelled"],
  upcoming: ["in_progress", "cancelled"],
  in_progress: ["cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
