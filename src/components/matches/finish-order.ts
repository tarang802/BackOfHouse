import { placementsFromGroups, type PlacementEntry } from "@/lib/domain/scoring";

/**
 * Finishing order as the recorder builds it: players in order, each optionally tied
 * with the player above. Pure helpers so the UI logic is easy to test.
 */
export type OrderRow = { profileId: string; tiedWithAbove: boolean };

export function toggleInOrder(order: OrderRow[], profileId: string): OrderRow[] {
  const index = order.findIndex((row) => row.profileId === profileId);
  if (index === -1) return [...order, { profileId, tiedWithAbove: false }];
  const next = order.filter((row) => row.profileId !== profileId);
  if (next.length > 0) next[0] = { ...next[0], tiedWithAbove: false };
  return next;
}

export function move(order: OrderRow[], index: number, delta: -1 | 1): OrderRow[] {
  const target = index + delta;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  next[0] = { ...next[0], tiedWithAbove: false };
  return next;
}

export function toggleTie(order: OrderRow[], index: number): OrderRow[] {
  if (index === 0) return order;
  return order.map((row, i) => (i === index ? { ...row, tiedWithAbove: !row.tiedWithAbove } : row));
}

export function orderToGroups(order: OrderRow[]): string[][] {
  const groups: string[][] = [];
  order.forEach((row, index) => {
    if (index > 0 && row.tiedWithAbove) groups[groups.length - 1].push(row.profileId);
    else groups.push([row.profileId]);
  });
  return groups;
}

export function orderToPlacements(order: OrderRow[]): PlacementEntry[] {
  return placementsFromGroups(orderToGroups(order));
}

export function orderFromPlacements(entries: PlacementEntry[]): OrderRow[] {
  const sorted = [...entries].sort((a, b) => a.placement - b.placement);
  return sorted.map((entry, index) => ({
    profileId: entry.profileId,
    tiedWithAbove: index > 0 && sorted[index - 1].placement === entry.placement,
  }));
}
