import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/club/player-card";
import { ButtonLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireClub } from "@/lib/data/session";

export async function generateMetadata({ params }: PageProps<"/club/players/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PlayerProfilePage({ params }: PageProps<"/club/players/[username]">) {
  const { username } = await params;
  const { profile, club } = await requireClub();
  const supabase = await createSupabaseServerClient();
  // RLS limits this to members of the same club; anyone else is "not found".
  const { data } = await supabase
    .from("club_memberships")
    .select("role, joined_at, profile:profiles!inner(id, username, display_name, avatar_url, emblem)")
    .eq("club_id", club.id)
    .eq("profile.username", username.toLowerCase())
    .maybeSingle();
  type Row = { role: string; joined_at: string; profile: { id: string; username: string; display_name: string; avatar_url: string | null; emblem: string } };
  const member = data as unknown as Row | null;
  if (!member) notFound();

  return (
    <PlayerCard
      displayName={member.profile.display_name}
      username={member.profile.username}
      avatarUrl={member.profile.avatar_url}
      emblem={member.profile.emblem}
      role={member.role}
      joinedAt={member.joined_at}
      actions={
        member.profile.id === profile.id ? (
          <ButtonLink href="/club/profile" variant="outline" size="sm">
            <Pencil /> Edit profile
          </ButtonLink>
        ) : null
      }
    />
  );
}
