"use client";

import { ArrowDown, ArrowUp, Check, ChevronDown, Link2, LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { ordinal, pointsForPlacement, validatePlacements, type ScoringRule } from "@/lib/domain/scoring";
import type { ActionResult } from "@/lib/errors";
import { useStoredValue } from "@/lib/hooks/client-values";
import type { RecordMatchInput } from "@/lib/validation/match";
import { cn } from "@/lib/utils";
import { move, orderToPlacements, toggleInOrder, toggleTie, type OrderRow } from "./finish-order";

export type RecorderGame = { id: string; slug: string; name: string; kind: string };
export type RecorderPlayer = { profileId: string; displayName: string; username: string; avatarUrl: string | null; emblem: string };
export type RecorderTournament = { id: string; name: string; gameTypeId: string; participantIds: string[] };
export type FixedBracket = {
  tournamentId: string;
  tournamentName: string;
  bracketMatchId: string;
  gameTypeId: string;
  label: string;
  playerIds: [string, string];
};

const STORAGE_KEY = "bluffclub:last-match";

type Remembered = { gameTypeId?: string; players?: string[] };

function parseRemembered(raw: string | null): Remembered {
  try {
    return raw ? (JSON.parse(raw) as Remembered) : {};
  } catch {
    return {};
  }
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MatchRecorder({
  games,
  players,
  rule,
  ruleVersion,
  tournaments,
  fixed,
  initialGameSlug,
  action,
}: {
  games: RecorderGame[];
  players: RecorderPlayer[];
  rule: ScoringRule;
  ruleVersion: number;
  tournaments: RecorderTournament[];
  fixed?: FixedBracket | null;
  initialGameSlug?: string | null;
  action: (input: RecordMatchInput) => Promise<ActionResult<{ matchId: string }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submissionId] = useState(() => crypto.randomUUID());
  const rememberedRaw = useStoredValue(STORAGE_KEY);
  const remembered = useMemo(() => (fixed ? {} : parseRemembered(rememberedRaw)), [fixed, rememberedRaw]);
  const [chosenGame, setChosenGame] = useState<string | null>(null);
  const gameTypeId =
    fixed?.gameTypeId ??
    chosenGame ??
    games.find((g) => g.slug === initialGameSlug)?.id ??
    games.find((g) => g.id === remembered.gameTypeId)?.id ??
    games[0]?.id ??
    "";
  const [order, setOrder] = useState<OrderRow[]>(
    fixed ? fixed.playerIds.map((profileId) => ({ profileId, tiedWithAbove: false })) : [],
  );
  const [tournamentId, setTournamentId] = useState<string>(fixed?.tournamentId ?? "");
  const [notes, setNotes] = useState("");
  const [playedAt, setPlayedAt] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [ledgerOn, setLedgerOn] = useState(false);
  const [ledger, setLedger] = useState<Record<string, { buyIn: string; cashOut: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const game = games.find((g) => g.id === gameTypeId);
  const playerById = useMemo(() => new Map(players.map((p) => [p.profileId, p])), [players]);
  const gameTournaments = tournaments.filter((t) => t.gameTypeId === gameTypeId);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  const eligible = fixed
    ? players.filter((p) => fixed.playerIds.includes(p.profileId))
    : tournament
      ? players.filter((p) => tournament.participantIds.includes(p.profileId))
      : players;

  const placements = orderToPlacements(order);
  const validation = order.length >= 2 ? validatePlacements(placements) : null;
  const canSubmit = !!gameTypeId && order.length >= 2 && validation?.ok === true && !pending;
  const isPoker = game?.kind === "poker";
  const rememberedTable = (remembered.players ?? []).filter((id) => eligible.some((p) => p.profileId === id));

  function selectGame(id: string) {
    setChosenGame(id);
    if (tournament && tournament.gameTypeId !== id) setTournamentId("");
  }

  function selectTournament(id: string) {
    setTournamentId(id);
    const t = tournaments.find((x) => x.id === id);
    if (t) setOrder((current) => current.filter((row) => t.participantIds.includes(row.profileId)));
  }

  function submit() {
    if (!canSubmit) return;
    setError(null);
    const ledgerRows =
      isPoker && ledgerOn
        ? order
            .map((row) => ({ profileId: row.profileId, ...(ledger[row.profileId] ?? { buyIn: "", cashOut: "" }) }))
            .filter((row) => row.buyIn !== "" || row.cashOut !== "")
            .map((row) => ({ profileId: row.profileId, buyIn: row.buyIn || "0", cashOut: row.cashOut || "0" }))
        : null;
    const input: RecordMatchInput = {
      gameTypeId,
      submissionId,
      results: placements,
      playedAt: playedAt ? new Date(playedAt).toISOString() : null,
      notes: notes.trim() || null,
      tournamentId: tournamentId || null,
      bracketMatchId: fixed?.bracketMatchId ?? null,
      ledger: ledgerRows,
    };
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ gameTypeId, players: order.map((row) => row.profileId) } satisfies Remembered),
        );
      } catch {
        // Storage unavailable (private mode) — nothing to remember.
      }
      router.push(`/club/matches/${result.data.matchId}?recorded=1`);
    });
  }

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_340px] lg:items-start lg:pb-0">
      <div className="flex flex-col gap-6">
        {/* 1. Game */}
        <section aria-labelledby="step-game" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <StepTitle id="step-game" n={1} title="Game" />
          {fixed ? (
            <p className="mt-4 text-sm text-ivory-dim">
              {fixed.tournamentName} · <span className="text-gold">{fixed.label}</span> · {game?.name}
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="step-game" className="mt-4 flex flex-wrap gap-2">
              {games.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={g.id === gameTypeId}
                  onClick={() => selectGame(g.id)}
                  className={cn(
                    "h-11 rounded-full border px-5 text-sm transition-colors",
                    g.id === gameTypeId
                      ? "border-gold/70 bg-gold/10 text-ivory"
                      : "border-line-strong text-muted hover:border-ivory/40 hover:text-ivory",
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          {!fixed && gameTournaments.length > 0 ? (
            <div className="mt-5 max-w-sm">
              <Field label="Part of a tournament?" htmlFor="tournament">
                <Select id="tournament" value={tournamentId} onChange={(e) => selectTournament(e.target.value)}>
                  <option value="">No — a regular match</option>
                  {gameTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
        </section>

        {/* 2. Players in finishing order */}
        <section aria-labelledby="step-players" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <StepTitle id="step-players" n={2} title="Tap players in finishing order" />
            {order.length > 0 && !fixed ? (
              <button type="button" onClick={() => setOrder([])} className="flex items-center gap-1.5 text-xs text-muted hover:text-ivory">
                <RotateCcw className="size-3.5" /> Clear
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Winner first. Tap again to remove. Use <span className="text-ivory-dim">Tie</span> when players share a place.
          </p>
          {!fixed && order.length === 0 && rememberedTable.length >= 2 ? (
            <button
              type="button"
              onClick={() => setOrder(rememberedTable.map((profileId) => ({ profileId, tiedWithAbove: false })))}
              className="mt-3 text-sm text-gold underline-offset-4 hover:underline"
            >
              Same table as last time ({rememberedTable.length} players)
            </button>
          ) : null}
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {eligible.map((player) => {
              const index = order.findIndex((row) => row.profileId === player.profileId);
              const selected = index !== -1;
              return (
                <li key={player.profileId}>
                  <button
                    type="button"
                    disabled={!!fixed}
                    aria-pressed={selected}
                    onClick={() => setOrder((current) => toggleInOrder(current, player.profileId))}
                    className={cn(
                      "relative flex w-full flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors disabled:cursor-default",
                      selected ? "border-gold/60 bg-gold/[0.06]" : "border-line hover:border-line-strong",
                    )}
                  >
                    <Avatar name={player.displayName} src={player.avatarUrl} emblem={player.emblem} size="md" ring={selected ? "gold" : undefined} />
                    <span className="w-full truncate text-xs text-ivory-dim">{player.displayName}</span>
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-ink">
                        {index + 1}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {eligible.length < 2 ? (
            <p className="mt-4 text-sm text-muted">You need at least two players. Invite friends from Club settings.</p>
          ) : null}
        </section>

        {/* 3. Order + ties */}
        {order.length > 0 ? (
          <section aria-labelledby="step-order" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <StepTitle id="step-order" n={3} title="Check the result" />
            <ol className="mt-4 flex flex-col gap-2">
              {order.map((row, index) => {
                const player = playerById.get(row.profileId);
                const placement = placements.find((p) => p.profileId === row.profileId)!.placement;
                const points = pointsForPlacement(rule, placement);
                return (
                  <li key={row.profileId} className="flex items-center gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
                    <span className={cn("w-10 shrink-0 font-display text-xl tabular", placement === 1 ? "text-gold" : "text-ivory-dim")}>
                      {ordinal(placement)}
                    </span>
                    <Avatar name={player?.displayName ?? "?"} src={player?.avatarUrl} emblem={player?.emblem} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ivory">{player?.displayName}</span>
                    <span className={cn("tabular text-sm font-semibold", points > 0 ? "text-[#9fd3b8]" : "text-faint")}>+{points}</span>
                    {!fixed ? (
                      <span className="flex items-center gap-1">
                        {index > 0 ? (
                          <button
                            type="button"
                            onClick={() => setOrder((current) => toggleTie(current, index))}
                            aria-pressed={row.tiedWithAbove}
                            aria-label={`Tie ${player?.displayName} with the player above`}
                            className={cn(
                              "flex h-10 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold uppercase tracking-wider",
                              row.tiedWithAbove ? "border-gold/60 text-gold" : "border-line text-faint hover:text-ivory",
                            )}
                          >
                            <Link2 className="size-3.5" /> Tie
                          </button>
                        ) : null}
                        <IconButton label={`Move ${player?.displayName} up`} disabled={index === 0} onClick={() => setOrder((c) => move(c, index, -1))}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton
                          label={`Move ${player?.displayName} down`}
                          disabled={index === order.length - 1}
                          onClick={() => setOrder((c) => move(c, index, 1))}
                        >
                          <ArrowDown className="size-4" />
                        </IconButton>
                      </span>
                    ) : (
                      <IconButton label="Swap winner" disabled={index === 0} onClick={() => setOrder((c) => move(c, index, -1))}>
                        <ArrowUp className="size-4" />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ol>
            {validation && !validation.ok ? (
              <p role="alert" className="mt-3 text-sm text-loss">
                {validation.message}
              </p>
            ) : null}
            {fixed && order.some((r) => r.tiedWithAbove) ? (
              <p className="mt-3 text-sm text-loss">Elimination matches need a clear winner.</p>
            ) : null}

            {/* Optional details */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="mt-5 flex items-center gap-1.5 text-sm text-muted hover:text-ivory"
            >
              <ChevronDown className={cn("size-4 transition-transform", showDetails && "rotate-180")} />
              Date, notes{isPoker ? " and session accounting" : ""}
            </button>
            {showDetails ? (
              <div className="mt-4 grid gap-4">
                <Field label="Played at" htmlFor="playedAt" hint="Leave empty for right now.">
                  <Input
                    id="playedAt"
                    type="datetime-local"
                    value={playedAt}
                    max={toLocalInput(new Date())}
                    onChange={(e) => setPlayedAt(e.target.value)}
                  />
                </Field>
                <Field label="Notes" htmlFor="notes" hint="Optional — house rules, a memorable bluff.">
                  <Textarea id="notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                {isPoker ? (
                  <div className="rounded-xl border border-line p-4">
                    <label className="flex items-center gap-3 text-sm text-ivory-dim">
                      <input type="checkbox" checked={ledgerOn} onChange={(e) => setLedgerOn(e.target.checked)} className="size-4 accent-[#c7a96b]" />
                      Keep a private record of buy-ins and cash-outs
                    </label>
                    <p className="mt-2 text-xs text-muted">
                      For your own memory only. It never affects leaderboard points, and the app does not move money.
                    </p>
                    {ledgerOn ? (
                      <div className="mt-4 flex flex-col gap-3">
                        {order.map((row) => {
                          const player = playerById.get(row.profileId);
                          const entry = ledger[row.profileId] ?? { buyIn: "", cashOut: "" };
                          return (
                            <div key={row.profileId} className="grid grid-cols-[1fr_96px_96px] items-center gap-2">
                              <span className="truncate text-sm">{player?.displayName}</span>
                              <Input
                                aria-label={`${player?.displayName} buy-in`}
                                inputMode="decimal"
                                placeholder="In"
                                className="h-10 px-3"
                                value={entry.buyIn}
                                onChange={(e) => setLedger((l) => ({ ...l, [row.profileId]: { ...entry, buyIn: e.target.value } }))}
                              />
                              <Input
                                aria-label={`${player?.displayName} cash-out`}
                                inputMode="decimal"
                                placeholder="Out"
                                className="h-10 px-3"
                                value={entry.cashOut}
                                onChange={(e) => setLedger((l) => ({ ...l, [row.profileId]: { ...entry, cashOut: e.target.value } }))}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* 4. Summary + confirm (sticky on desktop, docked on mobile) */}
      <aside className="lg:sticky lg:top-10">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <p className="eyebrow">Point preview</p>
          <p className="mt-2 font-display text-2xl text-ivory">{game?.name ?? "Pick a game"}</p>
          <p className="mt-1 text-xs text-muted">
            Scoring v{ruleVersion}
            {tournament ? ` · ${tournament.name}` : ""}. The server re-checks everything before saving.
          </p>
          <div className="mt-4 flex flex-col gap-1.5 text-sm">
            {order.length === 0 ? (
              <p className="text-muted">Tap players to build the result.</p>
            ) : (
              placements.map((p) => (
                <div key={p.profileId} className="flex justify-between">
                  <span className="truncate text-ivory-dim">
                    {ordinal(p.placement)} · {playerById.get(p.profileId)?.displayName}
                  </span>
                  <span className="tabular text-ivory">+{pointsForPlacement(rule, p.placement)}</span>
                </div>
              ))
            )}
          </div>
          {error ? (
            <div className="mt-4">
              <FormMessage>{error}</FormMessage>
            </div>
          ) : null}
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-ink/95 p-3 backdrop-blur-md lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
            <Button block size="lg" onClick={submit} disabled={!canSubmit || (!!fixed && order.some((r) => r.tiedWithAbove))}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
              {pending ? "Saving…" : order.length >= 2 ? `Save result · ${order.length} players` : "Save result"}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StepTitle({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-base font-semibold text-ivory">
      <span className="flex size-6 items-center justify-center rounded-full border border-line-strong text-[11px] text-muted">{n}</span>
      {title}
    </h2>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ivory disabled:opacity-30"
    >
      {children}
    </button>
  );
}
