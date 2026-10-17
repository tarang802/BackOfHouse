import { describe, expect, it } from "vitest";
import { cn, initials, pluralize, relativeTime } from "./utils";

describe("utils", () => {
  it("merges class names, letting later Tailwind classes win", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4")).toBe("text-sm px-4");
  });

  it("builds monogram initials", () => {
    expect(initials("Arjun Mehta")).toBe("AM");
    expect(initials("  bela  ")).toBe("BE");
    expect(initials("Chirag Raj Kumar")).toBe("CK");
    expect(initials("")).toBe("?");
  });

  it("pluralizes counts", () => {
    expect(pluralize(1, "game")).toBe("1 game");
    expect(pluralize(3, "match", "matches")).toBe("3 matches");
  });

  it("describes recent times in short form", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(relativeTime("2026-10-17T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-17T11:15:00Z", now)).toBe("45m ago");
    expect(relativeTime("2026-10-17T07:00:00Z", now)).toBe("5h ago");
    expect(relativeTime("2026-10-14T12:00:00Z", now)).toBe("3d ago");
  });
});
