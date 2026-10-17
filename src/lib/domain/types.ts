/** Plain data shapes the domain functions work on. Loaded from Supabase in `lib/data`. */

export type MatchStatus = "confirmed" | "voided";
export type GameKind = "bluff" | "poker" | "teen_patti" | "custom";

export type MatchParticipant = {
  profileId: string;
  placement: number;
  pointsAwarded: number;
};

export type MatchRecord = {
  id: string;
  gameTypeId: string;
  tournamentId: string | null;
  playedAt: string;
  createdAt: string;
  status: MatchStatus;
  participants: MatchParticipant[];
};

export type GameTypeInfo = {
  id: string;
  slug: string;
  name: string;
  kind: GameKind;
  countsTowardOverall: boolean;
  isArchived: boolean;
};

export type MemberInfo = {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emblem: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
};

/** Oldest first, with stable tie-breaks so streaks are deterministic. */
export function chronological<T extends Pick<MatchRecord, "playedAt" | "createdAt" | "id">>(
  matches: T[],
): T[] {
  return [...matches].sort(
    (a, b) =>
      a.playedAt.localeCompare(b.playedAt) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function confirmedOnly<T extends Pick<MatchRecord, "status">>(matches: T[]): T[] {
  return matches.filter((match) => match.status === "confirmed");
}
