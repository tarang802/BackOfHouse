"use client";

import { Ban, LoaderCircle, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { correctMatchAction, voidMatchAction } from "@/lib/actions/matches";
import { ordinal, validatePlacements } from "@/lib/domain/scoring";
import { move, orderFromPlacements, orderToPlacements, toggleTie, type OrderRow } from "./finish-order";

type Player = { profileId: string; displayName: string; avatarUrl: string | null; emblem: string };

/**
 * Admin-only corrections. Voiding keeps the match in history; correcting voids it and
 * records a replacement linked to the original. Both are audited server-side.
 */
export function MatchAdmin({
  matchId,
  participants,
  players,
  locked,
}: {
  matchId: string;
  participants: { profileId: string; placement: number }[];
  players: Player[];
  locked: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "void" | "correct">(null);
  const [reason, setReason] = useState("");
  const [order, setOrder] = useState<OrderRow[]>(() => orderFromPlacements(participants));
  const [submissionId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(players.map((p) => [p.profileId, p]));
  const placements = orderToPlacements(order);
  const valid = validatePlacements(placements);

  const close = () => {
    setMode(null);
    setError(null);
  };

  if (locked) return <p className="text-xs text-muted">{locked}</p>;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setMode("correct")}>
        <PencilLine /> Correct result
      </Button>
      <Button variant="danger" size="sm" onClick={() => setMode("void")}>
        <Ban /> Void match
      </Button>

      <Dialog
        open={mode !== null}
        onClose={close}
        title={mode === "void" ? "Void this match?" : "Correct the result"}
        description={
          mode === "void"
            ? "It stays in history marked as voided and stops counting everywhere."
            : "The original is voided and a corrected copy is recorded with the same scoring rules."
        }
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result =
                mode === "void"
                  ? await voidMatchAction({ matchId, reason })
                  : await correctMatchAction({ matchId, submissionId, reason, results: placements });
              if (!result.ok) return setError(result.error);
              close();
              if (mode === "correct" && result.data && "matchId" in result.data) router.push(`/club/matches/${result.data.matchId}`);
              else router.refresh();
            });
          }}
        >
          {mode === "correct" ? (
            <ol className="flex flex-col gap-2">
              {order.map((row, index) => {
                const player = byId.get(row.profileId);
                const placement = placements.find((p) => p.profileId === row.profileId)!.placement;
                return (
                  <li key={row.profileId} className="flex items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 py-2">
                    <span className="w-10 font-display text-lg tabular text-ivory-dim">{ordinal(placement)}</span>
                    <Avatar name={player?.displayName ?? "?"} src={player?.avatarUrl} emblem={player?.emblem} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">{player?.displayName ?? "Former member"}</span>
                    {index > 0 ? (
                      <button
                        type="button"
                        aria-pressed={row.tiedWithAbove}
                        onClick={() => setOrder((o) => toggleTie(o, index))}
                        className={`rounded-lg border px-2 py-1 text-[11px] uppercase ${row.tiedWithAbove ? "border-gold/60 text-gold" : "border-line text-faint"}`}
                      >
                        Tie
                      </button>
                    ) : null}
                    <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => setOrder((o) => move(o, index, -1))} className="rounded-lg border border-line px-2 py-1 text-xs disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === order.length - 1}
                      onClick={() => setOrder((o) => move(o, index, 1))}
                      className="rounded-lg border border-line px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {mode === "correct" && !valid.ok ? <p className="text-sm text-loss">{valid.message}</p> : null}
          <Field label="Reason" htmlFor="admin-reason" hint="Shown in the match history and audit trail.">
            <Input id="admin-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Second and third were swapped" required />
          </Field>
          {error ? <FormMessage>{error}</FormMessage> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "void" ? "danger" : "primary"} disabled={pending || reason.trim().length < 3 || (mode === "correct" && !valid.ok)}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {mode === "void" ? "Void match" : "Save correction"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
