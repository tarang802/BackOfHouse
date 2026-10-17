/**
 * Maps errors from Supabase / Postgres into short, safe messages for the UI.
 * Our SQL functions raise errors with a `hint` code (see raise_app_error); those
 * messages are written for players and can be shown as-is. Anything else is reported
 * generically so internal details never leak.
 */

export type ActionFailure = {
  ok: false;
  error: string;
  code?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export type ActionResult<T = null> = { ok: true; data: T } | ActionFailure;

/** Initial state for useActionState-driven forms. */
export const idle = null;
export type FormState<T = null> = ActionResult<T> | null;

type PostgrestLikeError = { message?: string; hint?: string | null; code?: string | null; details?: string | null };

const KNOWN_APP_CODES = new Set([
  "unauthenticated",
  "profile_required",
  "forbidden",
  "not_found",
  "invalid_results",
  "too_few_participants",
  "too_many_participants",
  "invalid_participant",
  "missing_placement",
  "duplicate_participant",
  "invalid_placement",
  "invalid_placement_sequence",
  "invalid_game",
  "invalid_date",
  "invalid_notes",
  "invalid_submission",
  "invalid_tournament",
  "invalid_tournament_state",
  "invalid_participants",
  "duplicate_result",
  "invalid_scoring",
  "invalid_ledger",
  "invalid_invite",
  "invalid_name",
  "invalid_tagline",
  "invalid_description",
  "invalid_format",
  "invalid_rounds",
  "invalid_reason",
  "invalid_match_state",
  "invalid_role",
  "invalid_threshold",
  "invalid_timezone",
  "duplicate_game",
  "limit_reached",
  "season_active",
  "tied_for_first",
  "not_supported",
]);

export function toAppError(error: unknown, fallback = "Something went wrong. Please try again."): {
  error: string;
  code?: string;
} {
  const e = (error ?? {}) as PostgrestLikeError;
  if (e.hint && KNOWN_APP_CODES.has(e.hint) && e.message) {
    return { error: e.message, code: e.hint };
  }
  if (e.code === "23505") {
    if (e.message?.includes("profiles_username_key")) {
      return { error: "That username is taken. Try another.", code: "username_taken" };
    }
    return { error: "That already exists.", code: "duplicate" };
  }
  if (e.code === "42501") {
    return { error: "You do not have permission to do that.", code: "forbidden" };
  }
  return { error: fallback };
}

export function fail(error: unknown, fallback?: string): ActionFailure {
  return { ok: false, ...toAppError(error, fallback) };
}

export function invalid(fieldErrors: Partial<Record<string, string>>, error = "Please fix the highlighted fields."): ActionFailure {
  return { ok: false, error, fieldErrors };
}
