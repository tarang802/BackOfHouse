/**
 * Optional friendly poker session accounting. Purely a memory aid: it never affects
 * leaderboard points. Only entries from confirmed matches count.
 */
export type LedgerRow = { matchId: string; profileId: string; buyIn: number; cashOut: number };

export type LedgerSummary = { profileId: string; sessions: number; buyIn: number; cashOut: number; net: number };

export function summarizeLedger(entries: LedgerRow[], confirmedMatchIds: Set<string>): LedgerSummary[] {
  const byPlayer = new Map<string, LedgerSummary>();
  for (const entry of entries) {
    if (!confirmedMatchIds.has(entry.matchId)) continue;
    const row = byPlayer.get(entry.profileId) ?? { profileId: entry.profileId, sessions: 0, buyIn: 0, cashOut: 0, net: 0 };
    row.sessions += 1;
    // Work in cents to avoid floating point drift.
    row.buyIn = Math.round(row.buyIn * 100 + entry.buyIn * 100) / 100;
    row.cashOut = Math.round(row.cashOut * 100 + entry.cashOut * 100) / 100;
    row.net = Math.round((row.cashOut - row.buyIn) * 100) / 100;
    byPlayer.set(entry.profileId, row);
  }
  return [...byPlayer.values()].sort((a, b) => b.net - a.net || a.profileId.localeCompare(b.profileId));
}

export function formatAmount(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
