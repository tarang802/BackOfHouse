import { z } from "zod";
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, validatePlacements } from "@/lib/domain/scoring";

const uuid = z.string().uuid("Invalid id.");

const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Use an amount like 100 or 99.50.");

export const ledgerEntrySchema = z.object({
  profileId: uuid,
  buyIn: moneyAmount,
  cashOut: moneyAmount,
});

export const resultEntrySchema = z.object({
  profileId: uuid,
  placement: z.number().int().min(1).max(MAX_PARTICIPANTS),
});

export const recordMatchSchema = z
  .object({
    gameTypeId: uuid,
    submissionId: uuid,
    results: z.array(resultEntrySchema).min(MIN_PARTICIPANTS, "Pick at least two players.").max(MAX_PARTICIPANTS),
    playedAt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .nullable(),
    notes: z.string().trim().max(500, "Notes can be at most 500 characters.").optional().nullable(),
    tournamentId: uuid.optional().nullable(),
    bracketMatchId: uuid.optional().nullable(),
    ledger: z.array(ledgerEntrySchema).max(MAX_PARTICIPANTS).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const check = validatePlacements(value.results);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["results"], message: check.message });
    if (value.bracketMatchId && !value.tournamentId) {
      ctx.addIssue({ code: "custom", path: ["bracketMatchId"], message: "A bracket match needs its tournament." });
    }
    if (value.ledger) {
      const players = new Set(value.results.map((r) => r.profileId));
      const seen = new Set<string>();
      for (const entry of value.ledger) {
        if (!players.has(entry.profileId) || seen.has(entry.profileId)) {
          ctx.addIssue({ code: "custom", path: ["ledger"], message: "Ledger rows must be one per player in this session." });
          break;
        }
        seen.add(entry.profileId);
      }
    }
  });

export type RecordMatchInput = z.infer<typeof recordMatchSchema>;

export const correctMatchSchema = z
  .object({
    matchId: uuid,
    submissionId: uuid,
    reason: z.string().trim().min(3, "Give a short reason.").max(200, "Keep the reason under 200 characters."),
    results: z.array(resultEntrySchema).min(MIN_PARTICIPANTS).max(MAX_PARTICIPANTS),
  })
  .superRefine((value, ctx) => {
    const check = validatePlacements(value.results);
    if (!check.ok) ctx.addIssue({ code: "custom", path: ["results"], message: check.message });
  });

export const voidMatchSchema = z.object({
  matchId: uuid,
  reason: z.string().trim().min(3, "Give a short reason.").max(200, "Keep the reason under 200 characters."),
});

/** Shape the SQL function expects. */
export function toSqlResults(results: { profileId: string; placement: number }[]) {
  return results.map((r) => ({ profile_id: r.profileId, placement: r.placement }));
}

export function toSqlLedger(ledger: { profileId: string; buyIn: string; cashOut: string }[] | null | undefined) {
  if (!ledger || ledger.length === 0) return null;
  return ledger.map((l) => ({ profile_id: l.profileId, buy_in: l.buyIn, cash_out: l.cashOut }));
}
