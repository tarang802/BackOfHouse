import type { Metadata } from "next";
import { MatchRecorder, type FixedBracket, type RecorderTournament } from "@/components/matches/match-recorder";
import { PageHeader } from "@/components/ui/feedback";
import { recordMatchAction } from "@/lib/actions/matches";
import { getCurrentScoringRule, getGameTypes, getMembers } from "@/lib/data/club-data";
import { getBracket, getTournaments } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { DEFAULT_SCORING_RULE } from "@/lib/domain/scoring";
import { roundLabel, totalRounds } from "@/lib/domain/tournament";

export const metadata: Metadata = { title: "Record a match" };

export default async function NewMatchPage({ searchParams }: PageProps<"/club/matches/new">) {
  const { club } = await requireClub();
  const params = await searchParams;
  const [members, games, rule, tournaments] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getCurrentScoringRule(club.id),
    getTournaments(club.id),
  ]);

  const live = tournaments.filter((t) => t.status === "in_progress");
  const recorderTournaments: RecorderTournament[] = live
    .filter((t) => t.format !== "elimination")
    .map((t) => ({ id: t.id, name: t.name, gameTypeId: t.gameTypeId, participantIds: t.participantIds }));

  // Recording a specific bracket pairing from the tournament page.
  let fixed: FixedBracket | null = null;
  const tournamentParam = typeof params.tournament === "string" ? params.tournament : null;
  const bracketParam = typeof params.bracket === "string" ? params.bracket : null;
  if (tournamentParam && bracketParam) {
    const tournament = live.find((t) => t.id === tournamentParam && t.format === "elimination");
    if (tournament) {
      const bracket = await getBracket(tournament.id);
      const slot = bracket.find((b) => b.id === bracketParam && !b.winnerId && b.playerA && b.playerB);
      if (slot) {
        fixed = {
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          bracketMatchId: slot.id,
          gameTypeId: tournament.gameTypeId,
          label: `${roundLabel(slot.round, totalRounds(tournament.participantIds.length))} · Match ${slot.slot}`,
          playerIds: [slot.playerA!, slot.playerB!],
        };
      }
    }
  }

  const activeGames = games.filter((g) => !g.isArchived || g.id === fixed?.gameTypeId);
  const initialTournament = tournamentParam && !fixed ? recorderTournaments.find((t) => t.id === tournamentParam) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={fixed ? "Tournament result" : "New result"}
        title="Record a match"
        description="Pick the game, tap players in the order they finished, and save. Points are worked out for you."
      />
      <MatchRecorder
        games={activeGames.map((g) => ({ id: g.id, slug: g.slug, name: g.name, kind: g.kind }))}
        players={members.map((m) => ({
          profileId: m.profileId,
          displayName: m.displayName,
          username: m.username,
          avatarUrl: m.avatarUrl,
          emblem: m.emblem,
        }))}
        rule={rule ?? DEFAULT_SCORING_RULE}
        ruleVersion={rule?.version ?? 1}
        tournaments={recorderTournaments}
        fixed={fixed}
        initialGameSlug={initialTournament ? games.find((g) => g.id === initialTournament.gameTypeId)?.slug : typeof params.game === "string" ? params.game : null}
        action={recordMatchAction}
      />
    </div>
  );
}
