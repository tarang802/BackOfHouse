import { describe, expect, it } from "vitest";
import { fieldErrors, newPasswordSchema, safeNextPath, signInSchema, signUpSchema } from "./auth";

describe("auth validation", () => {
  it("normalises emails and requires a password to sign in", () => {
    expect(signInSchema.parse({ email: "  Asha@Example.TEST ", password: "x" }).email).toBe("asha@example.test");
    const result = signInSchema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toEqual({ email: "Enter a valid email address.", password: "Enter your password." });
  });

  it("requires 8+ character passwords that match on sign-up and reset", () => {
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "short", confirmPassword: "short" }).success).toBe(false);
    const mismatch = signUpSchema.safeParse({ email: "a@b.co", password: "long-enough", confirmPassword: "different" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(fieldErrors(mismatch.error).confirmPassword).toBe("Passwords do not match.");
    expect(newPasswordSchema.safeParse({ password: "long-enough", confirmPassword: "long-enough" }).success).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("allows in-app paths", () => {
    expect(safeNextPath("/club/matches/new")).toBe("/club/matches/new");
    expect(safeNextPath("/onboarding?code=ABCD2345")).toBe("/onboarding?code=ABCD2345");
  });

  it("blocks open redirects and junk", () => {
    expect(safeNextPath("https://evil.example")).toBe("/club");
    expect(safeNextPath("//evil.example")).toBe("/club");
    expect(safeNextPath("/\\evil.example")).toBe("/club");
    expect(safeNextPath(null)).toBe("/club");
    expect(safeNextPath(["/club"], "/onboarding")).toBe("/onboarding");
  });
});
