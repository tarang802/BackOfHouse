"use client";

import { Crown, LoaderCircle, Play, CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/field";
import { completeTournamentAction, setTournamentStatusAction } from "@/lib/actions/tournaments";
import type { TournamentFormat, TournamentStatus } from "@/lib/domain/tournament";

export function TournamentControls({
  tournamentId,
  status,
  format,
  completion,
}: {
  tournamentId: string;
  status: TournamentStatus;
  format: TournamentFormat;
  /** Client-side preview of whether completion will succeed (the server decides). */
  completion: { ok: true; championName: string } | { ok: false; reason: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "complete" | "cancel">(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else {
        setConfirm(null);
        router.refresh();
      }
    });
  }

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setTournamentStatusAction({ tournamentId, status: "upcoming" }))}>
            Publish as upcoming
          </Button>
        ) : null}
        {status === "draft" || status === "upcoming" ? (
          <Button size="sm" variant="felt" disabled={pending} onClick={() => run(() => setTournamentStatusAction({ tournamentId, status: "in_progress" }))}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Play />}
            Start tournament
          </Button>
        ) : null}
        {status === "in_progress" && format !== "elimination" ? (
          <Button size="sm" variant="gold" disabled={pending} onClick={() => setConfirm("complete")}>
            <Crown /> Complete & crown champion
          </Button>
        ) : null}
        <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirm("cancel")}>
          <CircleX /> Cancel
        </Button>
      </div>
      {error && !confirm ? <FormMessage>{error}</FormMessage> : null}

      <Dialog
        open={confirm === "complete"}
        onClose={() => setConfirm(null)}
        title="Complete the tournament?"
        description="Standings freeze and no more matches can be added."
      >
        {completion && !completion.ok ? (
          <FormMessage>{completion.reason}</FormMessage>
        ) : completion?.ok ? (
          <p className="text-sm text-ivory-dim">
            <span className="text-gold">{completion.championName}</span> will be crowned champion.
          </p>
        ) : null}
        {error ? (
          <div className="mt-4">
            <FormMessage>{error}</FormMessage>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Not yet
          </Button>
          <Button variant="gold" disabled={pending || (completion !== null && !completion.ok)} onClick={() => run(() => completeTournamentAction(tournamentId))}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Crown />}
            Crown the champion
          </Button>
        </div>
      </Dialog>

      <Dialog open={confirm === "cancel"} onClose={() => setConfirm(null)} title="Cancel the tournament?" description="Matches already played stay in the club history and on the leaderboards.">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => run(() => setTournamentStatusAction({ tournamentId, status: "cancelled" }))}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Cancel tournament
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
