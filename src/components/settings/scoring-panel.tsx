"use client";

import { LoaderCircle, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { describeScoringRule, ordinal, validateScoringRule } from "@/lib/domain/scoring";
import { updateScoringAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/utils";

export function ScoringPanel({
  current,
  history,
  canEdit,
}: {
  current: { placementPoints: number[]; participationPoints: number; version: number };
  history: { version: number; placementPoints: number[]; participationPoints: number; createdAt: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [points, setPoints] = useState<number[]>(current.placementPoints);
  const [participation, setParticipation] = useState(current.participationPoints);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const draft = { placementPoints: points, participationPoints: participation };
  const check = validateScoringRule(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify({ placementPoints: current.placementPoints, participationPoints: current.participationPoints });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Changes create scoring v{current.version + 1} and apply to matches recorded from now on. Past matches keep the points they
        were awarded.
      </p>
      <div className="flex flex-col gap-2">
        {points.map((value, index) => (
          <label key={index} className="flex items-center gap-3">
            <span className="w-24 text-sm text-ivory-dim">{ordinal(index + 1)} place</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={Number.isNaN(value) ? "" : value}
              disabled={!canEdit}
              onChange={(e) => setPoints((p) => p.map((v, i) => (i === index ? Number.parseInt(e.target.value, 10) : v)))}
              className="h-10 max-w-28"
            />
            <span className="text-xs text-muted">points</span>
          </label>
        ))}
        {canEdit ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={points.length >= 10} onClick={() => setPoints((p) => [...p, 0])}>
              <Plus /> Add a place
            </Button>
            <Button size="sm" variant="ghost" disabled={points.length <= 1} onClick={() => setPoints((p) => p.slice(0, -1))}>
              <Minus /> Remove last
            </Button>
          </div>
        ) : null}
      </div>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm text-ivory-dim">Everyone</span>
        <Input
          type="number"
          min={0}
          max={10}
          value={Number.isNaN(participation) ? "" : participation}
          disabled={!canEdit}
          onChange={(e) => setParticipation(Number.parseInt(e.target.value, 10))}
          className="h-10 max-w-28"
        />
        <span className="text-xs text-muted">bonus for taking part</span>
      </label>

      <div className="rounded-xl border border-line px-4 py-3 text-sm text-ivory-dim">
        <p className="eyebrow mb-2">Preview</p>
        {check.ok ? (
          <ul>
            {describeScoringRule(draft).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-loss">{check.message}</p>
        )}
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {saved && !changed ? <FormMessage tone="success">Scoring updated.</FormMessage> : null}
      {canEdit ? (
        <div>
          <Button
            disabled={!check.ok || !changed || pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await updateScoringAction(draft);
                if (!result.ok) return setError(result.error);
                setSaved(true);
                router.refresh();
              })
            }
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Save as v{current.version + 1}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the club owner can change scoring.</p>
      )}

      {history.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-ivory">Scoring history ({history.length} versions)</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.version} className="flex justify-between gap-3 text-ivory-dim">
                <span>
                  v{h.version}: {h.placementPoints.join(" / ")}
                  {h.participationPoints ? ` (+${h.participationPoints} each)` : ""}
                </span>
                <span className="text-xs text-faint">{formatDate(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
