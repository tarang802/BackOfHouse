import type { GameTypeInfo, MatchRecord, MemberInfo } from "./types";

/** Helpers for building realistic match histories in tests. */

export const BLUFF = "game-bluff";
export const POKER = "game-poker";
export const CUSTOM = "game-rummy";

export const gameTypes: GameTypeInfo[] = [
  { id: BLUFF, slug: "bluff", name: "Bluff", kind: "bluff", countsTowardOverall: true, isArchived: false },
  { id: POKER, slug: "poker", name: "Poker", kind: "poker", countsTowardOverall: false, isArchived: false },
  { id: CUSTOM, slug: "rummy", name: "Rummy", kind: "custom", countsTowardOverall: true, isArchived: false },
];

export function member(id: string, displayName = id): MemberInfo {
  return {
    profileId: id,
    username: id.toLowerCase(),
    displayName,
    avatarUrl: null,
    emblem: "spade",
    role: "member",
    joinedAt: "2026-01-01T00:00:00Z",
  };
}

let counter = 0;

/**
 * Builds a confirmed match. `order` lists players in finishing order; nest an array to
 * express a tie, e.g. ["a", ["b", "c"], "d"].
 */
export function match(
  order: (string | string[])[],
  options: {
    game?: string;
    day?: number;
    status?: "confirmed" | "voided";
    tournamentId?: string | null;
    playedAt?: string;
  } = {},
): MatchRecord {
  counter += 1;
  const pointsFor = (position: number) => [3, 1][position - 1] ?? 0;
  const participants: MatchRecord["participants"] = [];
  let position = 1;
  for (const slot of order) {
    const group = Array.isArray(slot) ? slot : [slot];
    for (const profileId of group) {
      participants.push({ profileId, placement: position, pointsAwarded: pointsFor(position) });
    }
    position += group.length;
  }
  const day = options.day ?? counter;
  const playedAt = options.playedAt ?? new Date(Date.UTC(2026, 0, 1) + day * 3_600_000).toISOString();
  return {
    id: `m-${String(counter).padStart(4, "0")}`,
    gameTypeId: options.game ?? BLUFF,
    tournamentId: options.tournamentId ?? null,
    playedAt,
    createdAt: playedAt,
    status: options.status ?? "confirmed",
    participants,
  };
}
