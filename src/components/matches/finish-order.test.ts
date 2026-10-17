import { describe, expect, it } from "vitest";
import { validatePlacements } from "@/lib/domain/scoring";
import { move, orderFromPlacements, orderToGroups, orderToPlacements, toggleInOrder, toggleTie } from "./finish-order";

describe("finish order builder", () => {
  it("adds players in tap order and removes them on a second tap", () => {
    let order = toggleInOrder([], "a");
    order = toggleInOrder(order, "b");
    order = toggleInOrder(order, "c");
    expect(order.map((r) => r.profileId)).toEqual(["a", "b", "c"]);
    order = toggleInOrder(order, "b");
    expect(order.map((r) => r.profileId)).toEqual(["a", "c"]);
  });

  it("never leaves the first row tied with a non-existent player above", () => {
    let order = ["a", "b", "c"].reduce((o, id) => toggleInOrder(o, id), [] as ReturnType<typeof toggleInOrder>);
    order = toggleTie(order, 1); // b tied with a
    order = toggleInOrder(order, "a"); // remove a: b becomes first
    expect(order[0]).toEqual({ profileId: "b", tiedWithAbove: false });
    expect(toggleTie(order, 0)).toBe(order);
  });

  it("turns ties into competition-ranked placements", () => {
    let order = ["a", "b", "c", "d"].reduce((o, id) => toggleInOrder(o, id), [] as ReturnType<typeof toggleInOrder>);
    order = toggleTie(order, 2); // c tied with b
    expect(orderToGroups(order)).toEqual([["a"], ["b", "c"], ["d"]]);
    const placements = orderToPlacements(order);
    expect(placements.map((p) => p.placement)).toEqual([1, 2, 2, 4]);
    expect(validatePlacements(placements)).toEqual({ ok: true });
  });

  it("moves players up and down within bounds", () => {
    const order = ["a", "b", "c"].reduce((o, id) => toggleInOrder(o, id), [] as ReturnType<typeof toggleInOrder>);
    expect(move(order, 2, -1).map((r) => r.profileId)).toEqual(["a", "c", "b"]);
    expect(move(order, 0, -1)).toBe(order);
    expect(move(order, 2, 1)).toBe(order);
  });

  it("round-trips an existing result for corrections", () => {
    const placements = [
      { profileId: "d", placement: 4 },
      { profileId: "a", placement: 1 },
      { profileId: "c", placement: 2 },
      { profileId: "b", placement: 2 },
    ];
    const order = orderFromPlacements(placements);
    expect(order.map((r) => [r.profileId, r.tiedWithAbove])).toEqual([
      ["a", false],
      ["c", false],
      ["b", true],
      ["d", false],
    ]);
    expect(orderToPlacements(order).sort((x, y) => x.profileId.localeCompare(y.profileId))).toEqual(
      [...placements].sort((x, y) => x.profileId.localeCompare(y.profileId)),
    );
  });
});
