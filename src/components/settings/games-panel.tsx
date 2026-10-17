"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { addGameAction, updateGameAction } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/errors";

type Game = { id: string; name: string; kind: string; countsTowardOverall: boolean; isArchived: boolean };

export function GamesPanel({ games, canEdit }: { games: Game[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line">
        {games.map((g) => (
          <li key={g.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={g.isArchived ? "text-muted line-through" : "text-ivory"}>{g.name}</span>
              {g.isArchived ? <Badge>Archived</Badge> : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-ivory-dim">
              <input
                type="checkbox"
                className="size-4 accent-[#c7a96b]"
                checked={g.countsTowardOverall}
                disabled={!canEdit || pending}
                onChange={(e) => run(() => updateGameAction({ gameTypeId: g.id, countsTowardOverall: e.target.checked }))}
              />
              Counts toward overall
            </label>
            {canEdit && g.kind === "custom" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateGameAction({ gameTypeId: g.id, isArchived: !g.isArchived }))}>
                {g.isArchived ? "Restore" : "Archive"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        “Counts toward overall” decides whether a game feeds the all-time overall leaderboard. Every game always keeps its own board. For
        Poker: on = overall and Poker boards, off = Poker board only.
      </p>
      {canEdit ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addGameAction({ name, countsTowardOverall: true }), () => setName(""));
          }}
        >
          <label className="sr-only" htmlFor="new-game">
            New game name
          </label>
          <Input id="new-game" placeholder="Add a game, e.g. Rummy" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add game
          </Button>
        </form>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
