import { describe, expect, it } from "vitest";
import { fail, invalid, toAppError } from "./errors";

describe("toAppError", () => {
  it("passes through player-facing messages from our database functions", () => {
    expect(toAppError({ message: "A player can only appear once in a match.", hint: "duplicate_participant", code: "P0001" })).toEqual({
      error: "A player can only appear once in a match.",
      code: "duplicate_participant",
    });
  });

  it("hides unknown database errors behind a generic message", () => {
    const internal = { message: 'relation "secret_table" does not exist', code: "42P01" };
    expect(toAppError(internal, "Could not save.")).toEqual({ error: "Could not save." });
    expect(toAppError({ message: "boom", hint: "something_internal" })).toEqual({ error: "Something went wrong. Please try again." });
  });

  it("maps unique and permission violations to friendly messages", () => {
    expect(toAppError({ code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_key"' })).toEqual({
      error: "That username is taken. Try another.",
      code: "username_taken",
    });
    expect(toAppError({ code: "42501", message: "permission denied for table matches" }).code).toBe("forbidden");
  });

  it("builds failure results", () => {
    expect(fail(null)).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(invalid({ email: "Required" })).toEqual({ ok: false, error: "Please fix the highlighted fields.", fieldErrors: { email: "Required" } });
  });
});
