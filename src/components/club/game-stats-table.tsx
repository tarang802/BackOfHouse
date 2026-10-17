import { formatWinRate, type PlayerStats } from "@/lib/domain/stats";

export function GameStatsTable({ rows }: { rows: { gameName: string; stats: PlayerStats }[] }) {
  const played = rows.filter((r) => r.stats.games > 0);
  if (played.length === 0) return <p className="text-sm text-muted">No games recorded yet.</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Statistics by game</caption>
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-faint">
          <th scope="col" className="pb-3 font-medium">Game</th>
          <th scope="col" className="pb-3 text-right font-medium">Played</th>
          <th scope="col" className="pb-3 text-right font-medium">Wins</th>
          <th scope="col" className="hidden pb-3 text-right font-medium sm:table-cell">Win %</th>
          <th scope="col" className="hidden pb-3 text-right font-medium sm:table-cell">Avg finish</th>
          <th scope="col" className="pb-3 text-right font-medium">Pts</th>
        </tr>
      </thead>
      <tbody>
        {played.map(({ gameName, stats }) => (
          <tr key={gameName} className="border-t border-line">
            <th scope="row" className="py-3 text-left font-medium text-ivory">{gameName}</th>
            <td className="py-3 text-right tabular text-ivory-dim">{stats.games}</td>
            <td className="py-3 text-right tabular text-ivory-dim">{stats.wins}</td>
            <td className="hidden py-3 text-right tabular text-ivory-dim sm:table-cell">{formatWinRate(stats.winRate)}</td>
            <td className="hidden py-3 text-right tabular text-ivory-dim sm:table-cell">
              {stats.averagePlacement ? stats.averagePlacement.toFixed(1) : "—"}
            </td>
            <td className="py-3 text-right tabular font-semibold text-ivory">{stats.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
