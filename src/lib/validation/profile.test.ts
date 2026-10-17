import { describe, expect, it } from "vitest";
import { createClubSchema, inviteCodeSchema, profileSchema, suggestUsername, usernameSchema } from "./profile";

describe("profile validation", () => {
  it("normalises and validates usernames", () => {
    expect(usernameSchema.parse("  Card_Shark7 ")).toBe("card_shark7");
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("has space").success).toBe(false);
    expect(usernameSchema.safeParse("x".repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse("admin").success).toBe(false);
  });

  it("requires a display name and a known emblem", () => {
    expect(profileSchema.safeParse({ username: "asha", displayName: "   ", emblem: "spade" }).success).toBe(false);
    expect(profileSchema.safeParse({ username: "asha", displayName: "Asha", emblem: "joker" }).success).toBe(false);
    expect(profileSchema.parse({ username: "asha", displayName: " Asha ", emblem: "heart" })).toEqual({
      username: "asha",
      displayName: "Asha",
      emblem: "heart",
    });
  });

  it("suggests valid usernames from display names", () => {
    expect(suggestUsername("Arjun Mehta")).toBe("arjun_mehta");
    expect(suggestUsername("Zoë!")).toBe("zoe");
    expect(suggestUsername("Al")).toBe("al_player");
    expect(usernameSchema.safeParse(suggestUsername("  ")).success).toBe(true);
  });

  it("cleans invitation codes typed on a phone", () => {
    expect(inviteCodeSchema.parse(" abcd-2345 ")).toBe("ABCD2345");
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
  });

  it("validates club names", () => {
    expect(createClubSchema.safeParse({ name: "R" }).success).toBe(false);
    expect(createClubSchema.parse({ name: " Room 214 ", tagline: "Trust no one" }).name).toBe("Room 214");
  });
});
