"use client";

import { Archive, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { archiveSeasonAction, createSeasonAction } from "@/lib/actions/seasons";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function NewSeasonButton({ seasonNumber, today }: { seasonNumber: number; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Season ${ROMAN[seasonNumber - 1] ?? seasonNumber}`);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Start a season
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Start a new season" description="Seasons are a fresh leaderboard over a date range. All-time records are kept.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await createSeasonAction({ name, startsOn, endsOn });
              if (!result.ok) return setError(result.error);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Field label="Name" htmlFor="s-name" hint="e.g. Season II — Return of the Bluffers">
            <Input id="s-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" htmlFor="s-start">
              <Input id="s-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
            </Field>
            <Field label="Ends (optional)" htmlFor="s-end">
              <Input id="s-end" type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </Field>
          </div>
          {error ? <FormMessage>{error}</FormMessage> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Start season
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ArchiveSeasonButton({ seasonId, seasonName, leaderName }: { seasonId: string; seasonName: string; leaderName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
        <Archive /> End season
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`End ${seasonName}?`} description="Final standings are archived and a champion is named. Match history is never deleted.">
        <p className="text-sm text-ivory-dim">
          {leaderName ? (
            <>
              <span className="text-gold">{leaderName}</span> currently leads. If first place is shared when you end the season, no single
              champion is named and the archive records the tie.
            </>
          ) : (
            "Nobody has scored this season yet."
          )}
        </p>
        {error ? (
          <div className="mt-4">
            <FormMessage>{error}</FormMessage>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button
            variant="gold"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await archiveSeasonAction(seasonId);
                if (!result.ok) return setError(result.error);
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            End and archive
          </Button>
        </div>
      </Dialog>
    </>
  );
}
