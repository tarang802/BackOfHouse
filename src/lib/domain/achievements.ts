import { headToHead } from "./rivalry";
import { computePlayerStats, longestLosingRun } from "./stats";
import { chronological, confirmedOnly, type GameTypeInfo, type MatchRecord } from "./types";

/**
 * Achievements are derived from confirmed match records every time they are shown,
 * so voiding or correcting a match revokes or grants them consistently.
 * Playful (teasing) titles only appear when the club turns them on.
 */

export type AchievementId =
  | "first_blood"
  | "poker_face"
  | "bluff_master"
  | "on_a_roll"
  | "comeback_king"
  | "house_legend"
  | "tournament_champion"
  | "rivalry_winner"
  | "eternal_runner_up"
  | "cursed_hand";

export type AchievementDefinition = {
  id: AchievementId;
  name: string;
  description: string;
  suit: "spade" | "heart" | "diamond" | "club";
  playful: boolean;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: "first_blood", name: "First Blood", description: "Win your first recorded match.", suit: "spade", playful: false },
  { id: "poker_face", name: "Poker Face", description: "Win 5 Poker sessions.", suit: "diamond", playful: false },
  { id: "bluff_master", name: "Bluff Master", description: "Win 10 Bluff matches.", suit: "club", playful: false },
  { id: "on_a_roll", name: "On a Roll", description: "Win 5 matches in a row.", suit: "heart", playful: false },
  {
    id: "comeback_king",
    name: "Comeback King",
    description: "Win a match straight after 3 or more losses in a row.",
    suit: "spade",
    playful: false,
  },
  {
    id: "house_legend",
    name: "House Legend",
    description: "Reach the club's legend points milestone.",
    suit: "diamond",
    playful: false,
  },
  {
    id: "tournament_champion",
    name: "Tournament Champion",
    description: "Win a completed tournament.",
    suit: "spade",
    playful: false,
  },
  {
    id: "rivalry_winner",
    name: "Rivalry Winner",
    description: "Lead a rival after at least 5 head-to-head matches.",
    suit: "club",
    playful: false,
  },
  {
    id: "eternal_runner_up",
    name: "Eternal Runner-Up",
    description: "Finish second 5 times. So close.",
    suit: "heart",
    playful: true,
  },
  {
    id: "cursed_hand",
    name: "Cursed Hand",
    description: "Lose 5 matches in a row. The cards will turn.",
    suit: "club",
    playful: true,
  },
];

export type AchievementContext = {
  matches: MatchRecord[];
  gameTypes: GameTypeInfo[];
  /** Profile IDs of champions of completed tournaments, one entry per title. */
  tournamentChampions: string[];
  /** Other members the player could have a rivalry with. */
  memberIds: string[];
  legendPointsThreshold: number;
  playfulTitles: boolean;
};

export type AchievementStatus = AchievementDefinition & {
  earned: boolean;
  /** Human-readable progress, e.g. "3 / 5". */
  progress: string;
};

const RIVALRY_MIN_ENCOUNTERS = 5;
const COMEBACK_LOSSES = 3;

function hasComeback(matches: MatchRecord[], profileId: string): boolean {
  let losses = 0;
  for (const match of chronological(confirmedOnly(matches))) {
    const me = match.participants.find((p) => p.profileId === profileId);
    if (!me) continue;
    if (me.placement === 1) {
      if (losses >= COMEBACK_LOSSES) return true;
      losses = 0;
    } else {
      losses += 1;
    }
  }
  return false;
}

export function evaluateAchievements(profileId: string, ctx: AchievementContext): AchievementStatus[] {
  const kindIds = (kind: GameTypeInfo["kind"]) =>
    new Set(ctx.gameTypes.filter((g) => g.kind === kind).map((g) => g.id));
  const pokerIds = kindIds("poker");
  const bluffIds = kindIds("bluff");
  const overallIds = new Set(ctx.gameTypes.filter((g) => g.countsTowardOverall).map((g) => g.id));

  const all = computePlayerStats(ctx.matches, profileId);
  const poker = computePlayerStats(ctx.matches, profileId, (m) => pokerIds.has(m.gameTypeId));
  const bluff = computePlayerStats(ctx.matches, profileId, (m) => bluffIds.has(m.gameTypeId));
  const overall = computePlayerStats(ctx.matches, profileId, (m) => overallIds.has(m.gameTypeId));
  const titles = ctx.tournamentChampions.filter((id) => id === profileId).length;

  let bestRivalry = { lead: false, encounters: 0 };
  for (const other of ctx.memberIds) {
    if (other === profileId) continue;
    const h2h = headToHead(ctx.matches, profileId, other);
    if (h2h.encounters >= RIVALRY_MIN_ENCOUNTERS && h2h.leader === "a") {
      bestRivalry = { lead: true, encounters: h2h.encounters };
      break;
    }
    bestRivalry.encounters = Math.max(bestRivalry.encounters, h2h.encounters);
  }

  const progress = (value: number, target: number) => `${Math.min(value, target)} / ${target}`;
  const results: Record<AchievementId, { earned: boolean; progress: string }> = {
    first_blood: { earned: all.wins >= 1, progress: progress(all.wins, 1) },
    poker_face: { earned: poker.wins >= 5, progress: progress(poker.wins, 5) },
    bluff_master: { earned: bluff.wins >= 10, progress: progress(bluff.wins, 10) },
    on_a_roll: { earned: all.bestStreak >= 5, progress: progress(all.bestStreak, 5) },
    comeback_king: {
      earned: hasComeback(ctx.matches, profileId),
      progress: hasComeback(ctx.matches, profileId) ? "Done" : "Not yet",
    },
    house_legend: {
      earned: overall.points >= ctx.legendPointsThreshold,
      progress: progress(overall.points, ctx.legendPointsThreshold),
    },
    tournament_champion: { earned: titles >= 1, progress: progress(titles, 1) },
    rivalry_winner: {
      earned: bestRivalry.lead,
      progress: bestRivalry.lead ? "Done" : progress(bestRivalry.encounters, RIVALRY_MIN_ENCOUNTERS) + " games vs a rival",
    },
    eternal_runner_up: { earned: all.secondPlaces >= 5, progress: progress(all.secondPlaces, 5) },
    cursed_hand: {
      earned: longestLosingRun(ctx.matches, profileId) >= 5,
      progress: progress(longestLosingRun(ctx.matches, profileId), 5),
    },
  };

  return ACHIEVEMENTS.filter((a) => ctx.playfulTitles || !a.playful).map((definition) => ({
    ...definition,
    ...results[definition.id],
  }));
}
