import { chronological, confirmedOnly, type MatchRecord } from "./types";

/**
 * Head-to-head between two players, from every confirmed match they both played.
 * - "Ahead" means finishing in a better position than the other player in that match.
 * - Equal positions (a tie between them) count as a draw, for neither player.
 * - Outright wins count matches each player won (1st place) while the other played.
 */

export type Encounter = {
  matchId: string;
  gameTypeId: string;
  tournamentId: string | null;
  playedAt: string;
  placementA: number;
  placementB: number;
  outcome: "a" | "b" | "draw";
};

export type HeadToHead = {
  encounters: number;
  aheadA: number;
  aheadB: number;
  draws: number;
  outrightWinsA: number;
  outrightWinsB: number;
  /** Share of decided encounters where A finished ahead; null when none decided. */
  winPctA: number | null;
  byGame: Record<string, { encounters: number; aheadA: number; aheadB: number; draws: number }>;
  tournamentEncounters: number;
  /** Most recent first. */
  recent: Encounter[];
  leader: "a" | "b" | null;
};

export function headToHead(matches: MatchRecord[], profileA: string, profileB: string): HeadToHead {
  const result: HeadToHead = {
    encounters: 0,
    aheadA: 0,
    aheadB: 0,
    draws: 0,
    outrightWinsA: 0,
    outrightWinsB: 0,
    winPctA: null,
    byGame: {},
    tournamentEncounters: 0,
    recent: [],
    leader: null,
  };
  if (profileA === profileB) return result;

  const encounters: Encounter[] = [];
  for (const match of chronological(confirmedOnly(matches))) {
    const a = match.participants.find((p) => p.profileId === profileA);
    const b = match.participants.find((p) => p.profileId === profileB);
    if (!a || !b) continue;
    const outcome = a.placement < b.placement ? "a" : b.placement < a.placement ? "b" : "draw";
    encounters.push({
      matchId: match.id,
      gameTypeId: match.gameTypeId,
      tournamentId: match.tournamentId,
      playedAt: match.playedAt,
      placementA: a.placement,
      placementB: b.placement,
      outcome,
    });
    result.encounters += 1;
    if (outcome === "a") result.aheadA += 1;
    else if (outcome === "b") result.aheadB += 1;
    else result.draws += 1;
    if (a.placement === 1) result.outrightWinsA += 1;
    if (b.placement === 1) result.outrightWinsB += 1;
    if (match.tournamentId) result.tournamentEncounters += 1;
    const game = (result.byGame[match.gameTypeId] ??= { encounters: 0, aheadA: 0, aheadB: 0, draws: 0 });
    game.encounters += 1;
    if (outcome === "a") game.aheadA += 1;
    else if (outcome === "b") game.aheadB += 1;
    else game.draws += 1;
  }

  const decided = result.aheadA + result.aheadB;
  result.winPctA = decided > 0 ? result.aheadA / decided : null;
  result.leader = result.aheadA > result.aheadB ? "a" : result.aheadB > result.aheadA ? "b" : null;
  result.recent = encounters.slice(-10).reverse();
  return result;
}

/** Opponents a player has met, most frequent first. */
export function frequentOpponents(matches: MatchRecord[], profileId: string): { profileId: string; encounters: number }[] {
  const counts = new Map<string, number>();
  for (const match of confirmedOnly(matches)) {
    if (!match.participants.some((p) => p.profileId === profileId)) continue;
    for (const p of match.participants) {
      if (p.profileId !== profileId) counts.set(p.profileId, (counts.get(p.profileId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, encounters]) => ({ profileId: id, encounters }))
    .sort((a, b) => b.encounters - a.encounters || a.profileId.localeCompare(b.profileId));
}
