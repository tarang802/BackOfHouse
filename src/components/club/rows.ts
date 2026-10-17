import type { LeaderboardEntry } from "@/lib/domain/leaderboard";
import type { LeaderboardRow } from "./leaderboard-table";

export function toLeaderboardRows(entries: LeaderboardEntry[], myId?: string): LeaderboardRow[] {
  return entries.map((entry) => ({
    profileId: entry.member.profileId,
    rank: entry.rank,
    username: entry.member.username,
    displayName: entry.member.displayName,
    avatarUrl: entry.member.avatarUrl,
    emblem: entry.member.emblem,
    points: entry.stats.points,
    wins: entry.stats.wins,
    games: entry.stats.games,
    winRate: entry.stats.winRate,
    recentForm: entry.stats.recentForm,
    isMe: entry.member.profileId === myId,
  }));
}
