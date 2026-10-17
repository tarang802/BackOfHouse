import { tournamentStandings } from "./standings";
import type { TournamentFormat } from "./tournament";
import type { MatchRecord } from "./types";

/**
 * A player's finishing position in a completed tournament.
 * - points / rounds: their rank in the final standings.
 * - elimination: champion = 1, final loser = 2, semi-final losers share 3, and so on
 *   (losing in round r of R places you 2^(R-r) + 1).
 */
export type CompletedTournament = {
  id: string;
  name: string;
  format: TournamentFormat;
  participantIds: string[];
  championId: string | null;
  bracket?: { round: number; playerA: string | null; playerB: string | null; winnerId: string | null }[];
};

export function tournamentFinish(t: CompletedTournament, profileId: string, matches: MatchRecord[]): number | null {
  if (!t.participantIds.includes(profileId)) return null;
  if (t.championId === profileId) return 1;
  if (t.format === "elimination") {
    const bracket = t.bracket ?? [];
    const rounds = Math.max(0, ...bracket.map((b) => b.round));
    const lost = bracket.find(
      (b) => b.winnerId && b.winnerId !== profileId && (b.playerA === profileId || b.playerB === profileId),
    );
    if (!lost || rounds === 0) return null;
    return 2 ** (rounds - lost.round) + 1;
  }
  return tournamentStandings(t.participantIds, matches, t.id).find((row) => row.profileId === profileId)?.rank ?? null;
}

export function bestTournamentFinish(
  tournaments: CompletedTournament[],
  profileId: string,
  matches: MatchRecord[],
): { place: number; tournamentName: string; tournamentId: string } | null {
  let best: { place: number; tournamentName: string; tournamentId: string } | null = null;
  for (const t of tournaments) {
    const place = tournamentFinish(t, profileId, matches);
    if (place !== null && (best === null || place < best.place)) {
      best = { place, tournamentName: t.name, tournamentId: t.id };
    }
  }
  return best;
}
