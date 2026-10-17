import { describeScoringRule, type ScoringRule } from "@/lib/domain/scoring";

export function ScoringExplainer({ rule, version, overallGames }: { rule: ScoringRule; version: number; overallGames: string[] }) {
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
      <div>
        <p className="eyebrow mb-2">Points (scoring v{version})</p>
        <ul className="flex flex-col gap-1 text-ivory-dim">
          {describeScoringRule(rule).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="eyebrow mb-2">Ties</p>
        <p>
          Players who share a place get that place&apos;s points, and the next place is skipped (1st, 2nd, 2nd, 4th). A shared
          first place counts as a win for everyone in it.
        </p>
      </div>
      <div>
        <p className="eyebrow mb-2">Ranking</p>
        <p>Most points first. Level on points? More wins ranks higher, then better win rate. Still level? You share the rank.</p>
      </div>
      <div>
        <p className="eyebrow mb-2">What counts</p>
        <p>
          The overall board includes {overallGames.length ? overallGames.join(", ") : "no games yet"}. Every game also has its own
          board. Voided matches never count. Points are fixed when a match is recorded, so changing the rules later does not
          rewrite old results.
        </p>
      </div>
    </div>
  );
}
