"use client";

import { LoaderCircle, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { isValidBracketSize, type TournamentFormat } from "@/lib/domain/tournament";
import type { ActionResult } from "@/lib/errors";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { cn } from "@/lib/utils";

type Player = { profileId: string; displayName: string; avatarUrl: string | null; emblem: string };

const FORMATS: { id: TournamentFormat; title: string; body: string }[] = [
  { id: "points", title: "Points race", body: "Play as many matches as you like. Most points when you call it wins." },
  { id: "rounds", title: "Fixed rounds", body: "A set number of matches. Most points after the last round wins." },
  { id: "elimination", title: "Knockout", body: "One-on-one bracket. Lose once and you are out. 2, 4, 8, 16 or 32 players." },
];

export function TournamentForm({
  games,
  players,
  today,
  action,
}: {
  games: { id: string; name: string }[];
  players: Player[];
  today: string;
  action: (input: CreateTournamentInput) => Promise<ActionResult<{ tournamentId: string }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameTypeId, setGameTypeId] = useState(games[0]?.id ?? "");
  const [format, setFormat] = useState<TournamentFormat>("points");
  const [roundCount, setRoundCount] = useState(5);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const shuffle = () => setSelected((s) => [...s].sort(() => Math.random() - 0.5));
  const bracketProblem = format === "elimination" && selected.length > 0 && !isValidBracketSize(selected.length);

  function submit(status: "draft" | "upcoming") {
    setError(null);
    startTransition(async () => {
      const result = await action({
        name,
        description,
        gameTypeId,
        format,
        startsOn,
        endsOn,
        roundCount: format === "rounds" ? roundCount : null,
        participantIds: selected,
        status,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/club/tournaments/${result.data.tournamentId}`);
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("upcoming");
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tournament name" htmlFor="t-name" className="sm:col-span-2">
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="The Midnight Invitational" required />
        </Field>
        <Field label="Description (optional)" htmlFor="t-desc" className="sm:col-span-2">
          <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>
        <Field label="Game" htmlFor="t-game">
          <Select id="t-game" value={gameTypeId} onChange={(e) => setGameTypeId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="t-start">
            <Input id="t-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </Field>
          <Field label="Ends (optional)" htmlFor="t-end">
            <Input id="t-end" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium text-ivory-dim">Format</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <label
              key={f.id}
              className={cn(
                "cursor-pointer rounded-2xl border p-4 transition-colors",
                format === f.id ? "border-gold/60 bg-gold/[0.06]" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="sr-only" />
              <span className="block font-semibold text-ivory">{f.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{f.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {format === "rounds" ? (
        <Field label="Number of rounds" htmlFor="t-rounds" hint="Each round is one recorded match.">
          <Input id="t-rounds" type="number" min={1} max={50} value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value))} className="max-w-32" />
        </Field>
      ) : null}

      <fieldset>
        <div className="flex items-center justify-between">
          <legend className="text-[13px] font-medium text-ivory-dim">
            Players <span className="text-muted">· {selected.length} selected</span>
          </legend>
          {format === "elimination" && selected.length > 1 ? (
            <button type="button" onClick={shuffle} className="flex items-center gap-1.5 text-xs text-muted hover:text-ivory">
              <Shuffle className="size-3.5" /> Shuffle seeds
            </button>
          ) : null}
        </div>
        {format === "elimination" ? (
          <p className="mt-1 text-xs text-muted">Tap order sets the seeds: first tapped is seed 1. Top seeds meet as late as possible.</p>
        ) : null}
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {players.map((p) => {
            const index = selected.indexOf(p.profileId);
            return (
              <li key={p.profileId}>
                <button
                  type="button"
                  aria-pressed={index !== -1}
                  onClick={() => toggle(p.profileId)}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-2 rounded-2xl border px-2 py-3",
                    index !== -1 ? "border-gold/60 bg-gold/[0.06]" : "border-line hover:border-line-strong",
                  )}
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} emblem={p.emblem} size="md" />
                  <span className="w-full truncate text-xs text-ivory-dim">{p.displayName}</span>
                  {index !== -1 && format === "elimination" ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-ink">{index + 1}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {bracketProblem ? <p className="mt-2 text-sm text-loss">Knockouts need 2, 4, 8, 16 or 32 players (you have {selected.length}).</p> : null}
      </fieldset>

      {error ? <FormMessage>{error}</FormMessage> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={pending} onClick={() => submit("draft")}>
          Save as draft
        </Button>
        <Button type="submit" disabled={pending || bracketProblem || selected.length < 2 || !name.trim()}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Create tournament
        </Button>
      </div>
    </form>
  );
}
