import { z } from "zod";
import { isValidBracketSize, MAX_TOURNAMENT_PLAYERS, MIN_TOURNAMENT_PLAYERS } from "@/lib/domain/tournament";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const createTournamentSchema = z
  .object({
    name: z.string().trim().min(2, "Name it (2+ characters).").max(80, "Keep the name under 80 characters."),
    description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
    gameTypeId: z.string().uuid("Choose a game."),
    format: z.enum(["points", "rounds", "elimination"]),
    startsOn: isoDate,
    endsOn: isoDate.optional().or(z.literal("")),
    roundCount: z.number().int().min(1).max(50).optional().nullable(),
    participantIds: z
      .array(z.string().uuid())
      .min(MIN_TOURNAMENT_PLAYERS, "Pick at least two players.")
      .max(MAX_TOURNAMENT_PLAYERS, `At most ${MAX_TOURNAMENT_PLAYERS} players.`),
    status: z.enum(["draft", "upcoming"]),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.participantIds).size !== value.participantIds.length) {
      ctx.addIssue({ code: "custom", path: ["participantIds"], message: "A player can only be registered once." });
    }
    if (value.format === "elimination" && !isValidBracketSize(value.participantIds.length)) {
      ctx.addIssue({ code: "custom", path: ["participantIds"], message: "Elimination brackets need 2, 4, 8, 16 or 32 players." });
    }
    if (value.format === "rounds" && !value.roundCount) {
      ctx.addIssue({ code: "custom", path: ["roundCount"], message: "Set the number of rounds." });
    }
    if (value.endsOn && value.endsOn < value.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "The end date must be on or after the start." });
    }
  });

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
