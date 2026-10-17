import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameHub } from "@/components/club/game-hub";
import { getGameTypes, getMatches, getMembers, memberLookup } from "@/lib/data/club-data";
import { requireClub } from "@/lib/data/session";

export const metadata: Metadata = { title: "Bluff" };

export default async function BluffPage() {
  const { profile, club } = await requireClub();
  const [members, games, matches] = await Promise.all([getMembers(club.id), getGameTypes(club.id), getMatches(club.id)]);
  const game = games.find((g) => g.kind === "bluff");
  if (!game) notFound();
  return (
    <GameHub
      game={game}
      members={members}
      matches={matches}
      myId={profile.id}
      lookup={memberLookup(members)}
      timeZone={club.timezone}
      suit="spade"
      intro="Who empties their hand first — and who gets caught lying. Record the finishing order however your table plays it: house rules welcome."
    />
  );
}
