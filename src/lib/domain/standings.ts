import type { TournamentStatus } from "./tournament";
import { confirmedOnly, type MatchRecord } from "./types";

/**
 * Points / rounds tournament standings. Mirrors public.tournament_standings and
 * public.complete_tournament in SQL, which are authoritative.
 *
 * Standings: points, then wins; equal on both shares a rank.
 * A champion can only be crowned when exactly one player leads.
 */

export type StandingRow = {
  profileId: string;
  rank: number;
  points: number;
  wins: number;
  played: number;
};

export function tournamentStandings(
  participantIds: string[],
  matches: MatchRecord[],
  tournamentId: string,
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    participantIds.map((id) => [id, { profileId: id, rank: 0, points: 0, wins: 0, played: 0 }]),
  );
  for (const match of confirmedOnly(matches)) {
    if (match.tournamentId !== tournamentId) continue;
    for (const p of match.participants) {
      const row = rows.get(p.profileId);
      if (!row) continue;
      row.points += p.pointsAwarded;
      row.played += 1;
      if (p.placement === 1) row.wins += 1;
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.profileId.localeCompare(b.profileId),
  );
  sorted.forEach((row, index) => {
    const prev = sorted[index - 1];
    row.rank = prev && prev.points === row.points && prev.wins === row.wins ? prev.rank : index + 1;
  });
  return sorted;
}

export type CompletionCheck =
  | { ok: true; championId: string }
  | { ok: false; reason: string };

export function checkPointsCompletion(input: {
  format: "points" | "rounds";
  status: TournamentStatus;
  roundCount: number | null;
  standings: StandingRow[];
  confirmedMatches: number;
}): CompletionCheck {
  if (input.status !== "in_progress") {
    return { ok: false, reason: "Only a tournament in progress can be completed." };
  }
  if (input.confirmedMatches === 0) {
    return { ok: false, reason: "Record at least one match before completing the tournament." };
  }
  if (input.format === "rounds" && input.confirmedMatches < (input.roundCount ?? 0)) {
    return {
      ok: false,
      reason: `All ${input.roundCount} rounds must be played first (${input.confirmedMatches} recorded).`,
    };
  }
  const leaders = input.standings.filter((row) => row.rank === 1);
  if (leaders.length !== 1) {
    return {
      ok: false,
      reason: "Players are tied for first on points and wins. Play a deciding match first.",
    };
  }
  return { ok: true, championId: leaders[0].profileId };
}
