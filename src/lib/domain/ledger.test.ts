import { describe, expect, it } from "vitest";
import { formatAmount, summarizeLedger } from "./ledger";

describe("summarizeLedger", () => {
  it("totals buy-ins, cash-outs and net per player from confirmed sessions only", () => {
    const entries = [
      { matchId: "m1", profileId: "a", buyIn: 100, cashOut: 250.5 },
      { matchId: "m1", profileId: "b", buyIn: 100, cashOut: 0 },
      { matchId: "m2", profileId: "a", buyIn: 0.1, cashOut: 0.2 },
      { matchId: "voided", profileId: "b", buyIn: 0, cashOut: 999 },
    ];
    const summary = summarizeLedger(entries, new Set(["m1", "m2"]));
    expect(summary).toEqual([
      { profileId: "a", sessions: 2, buyIn: 100.1, cashOut: 250.7, net: 150.6 },
      { profileId: "b", sessions: 1, buyIn: 100, cashOut: 0, net: -100 },
    ]);
  });

  it("formats signed amounts", () => {
    expect(formatAmount(150.6)).toBe("+150.6");
    expect(formatAmount(-100)).toBe("−100");
    expect(formatAmount(0)).toBe("0");
  });
});
