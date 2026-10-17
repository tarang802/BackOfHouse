/**
 * Placement scoring. Mirrors the SQL in `record_match` exactly — the database is the
 * authority, this module powers previews and tests.
 *
 * Ties use standard competition ranking: 1, 2, 2, 4. Tied players receive the points
 * for the shared position. A shared first place is a win for each tied player.
 */

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 20;
export const MAX_PLACEMENT_SLOTS = 10;
export const MAX_POINTS_PER_PLACE = 100;
export const MAX_PARTICIPATION_POINTS = 10;

export type ScoringRule = {
  placementPoints: number[];
  participationPoints: number;
};

export const DEFAULT_SCORING_RULE: ScoringRule = {
  placementPoints: [3, 1],
  participationPoints: 0,
};

export type PlacementEntry = { profileId: string; placement: number };
export type ScoredEntry = PlacementEntry & { points: number };

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): ValidationResult => ({ ok: false, code, message });

export function validatePlacements(entries: PlacementEntry[]): ValidationResult {
  if (entries.length < MIN_PARTICIPANTS) {
    return fail("too_few_participants", `A match needs at least ${MIN_PARTICIPANTS} players.`);
  }
  if (entries.length > MAX_PARTICIPANTS) {
    return fail("too_many_participants", `A match can have at most ${MAX_PARTICIPANTS} players.`);
  }
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.profileId) return fail("invalid_participant", "Every result needs a player.");
    if (ids.has(entry.profileId)) {
      return fail("duplicate_participant", "A player can only appear once in a match.");
    }
    ids.add(entry.profileId);
    if (!Number.isInteger(entry.placement) || entry.placement < 1) {
      return fail("missing_placement", "Every player needs a finishing position.");
    }
    if (entry.placement > entries.length) {
      return fail("invalid_placement", "A finishing position cannot exceed the number of players.");
    }
  }
  // Competition ranking: a player's position is 1 + the number of players who beat them.
  for (const entry of entries) {
    const beatenBy = entries.filter((other) => other.placement < entry.placement).length;
    if (entry.placement !== beatenBy + 1) {
      return fail(
        "invalid_placement_sequence",
        "Positions must follow the finishing order — after a tie, skip the shared places (1, 2, 2, 4).",
      );
    }
  }
  return { ok: true };
}

export function validateScoringRule(rule: ScoringRule): ValidationResult {
  const { placementPoints, participationPoints } = rule;
  if (placementPoints.length < 1 || placementPoints.length > MAX_PLACEMENT_SLOTS) {
    return fail("invalid_scoring", `Award points for between 1 and ${MAX_PLACEMENT_SLOTS} places.`);
  }
  for (const points of placementPoints) {
    if (!Number.isInteger(points) || points < 0 || points > MAX_POINTS_PER_PLACE) {
      return fail("invalid_scoring", `Points per place must be whole numbers from 0 to ${MAX_POINTS_PER_PLACE}.`);
    }
  }
  for (let i = 1; i < placementPoints.length; i++) {
    if (placementPoints[i] > placementPoints[i - 1]) {
      return fail("invalid_scoring", "A lower finish cannot earn more points than a higher one.");
    }
  }
  if (placementPoints[0] === 0) {
    return fail("invalid_scoring", "First place must earn at least one point.");
  }
  if (
    !Number.isInteger(participationPoints) ||
    participationPoints < 0 ||
    participationPoints > MAX_PARTICIPATION_POINTS
  ) {
    return fail("invalid_scoring", `Participation points must be from 0 to ${MAX_PARTICIPATION_POINTS}.`);
  }
  return { ok: true };
}

export function pointsForPlacement(rule: ScoringRule, placement: number): number {
  return (rule.placementPoints[placement - 1] ?? 0) + rule.participationPoints;
}

export function scoreMatch(rule: ScoringRule, entries: PlacementEntry[]): ScoredEntry[] {
  const validation = validatePlacements(entries);
  if (!validation.ok) throw new Error(validation.message);
  return [...entries]
    .sort((a, b) => a.placement - b.placement)
    .map((entry) => ({ ...entry, points: pointsForPlacement(rule, entry.placement) }));
}

/**
 * Turns a finishing order expressed as groups (players in the same group tied) into
 * competition-ranked placements: [[a], [b, c], [d]] -> a:1, b:2, c:2, d:4.
 */
export function placementsFromGroups(groups: string[][]): PlacementEntry[] {
  const result: PlacementEntry[] = [];
  let position = 1;
  for (const group of groups) {
    if (group.length === 0) continue;
    for (const profileId of group) result.push({ profileId, placement: position });
    position += group.length;
  }
  return result;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function describeScoringRule(rule: ScoringRule): string[] {
  const lines = rule.placementPoints.map(
    (points, index) => `${ordinal(index + 1)} place: +${points} ${points === 1 ? "point" : "points"}`,
  );
  lines.push(`Other places: +0 points`);
  if (rule.participationPoints > 0) {
    lines.push(`Everyone who plays also earns +${rule.participationPoints}`);
  }
  return lines;
}
