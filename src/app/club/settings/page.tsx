import type { Metadata } from "next";
import { ActivityFeed } from "@/components/club/activity-feed";
import { ClubDetailsPanel } from "@/components/settings/club-details-panel";
import { GamesPanel } from "@/components/settings/games-panel";
import { InvitePanel, type InvitationView } from "@/components/settings/invite-panel";
import { MembersPanel } from "@/components/settings/members-panel";
import { ScoringPanel } from "@/components/settings/scoring-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMembers, getScoringRules, memberLookup } from "@/lib/data/club-data";
import { getActivity } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { readPublicEnv } from "@/lib/env";
import { DEFAULT_SCORING_RULE } from "@/lib/domain/scoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Club settings" };

async function getInvitations(clubId: string): Promise<InvitationView[]> {
  // RLS only returns invitations to owners and admins.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("club_invitations")
    .select("id, code, expires_at, max_uses, use_count, revoked_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    expiresAt: row.expires_at as string | null,
    maxUses: row.max_uses as number | null,
    useCount: row.use_count as number,
    revokedAt: row.revoked_at as string | null,
  }));
}

export default async function SettingsPage() {
  const { profile, club, isAdmin, isOwner } = await requireClub();
  const [members, games, rules, invitations, activity] = await Promise.all([
    getMembers(club.id),
    getGameTypes(club.id),
    getScoringRules(club.id),
    isAdmin ? getInvitations(club.id) : Promise.resolve([]),
    isAdmin ? getActivity(club.id, 40) : Promise.resolve([]),
  ]);
  const current = rules[0] ?? { ...DEFAULT_SCORING_RULE, version: 1 };
  const siteUrl = readPublicEnv()?.siteUrl ?? "";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={club.name} title="Club settings" description={`You are the ${club.role} of this club.`} />

      {isAdmin ? (
        <Card id="invite" className="scroll-mt-24">
          <CardHeader eyebrow="Grow the table" title="Invite friends" />
          <CardBody>
            <InvitePanel invitations={invitations} siteUrl={siteUrl} clubName={club.name} />
          </CardBody>
        </Card>
      ) : (
        <Card id="invite" className="scroll-mt-24">
          <CardHeader eyebrow="Grow the table" title="Invite friends" />
          <CardBody>
            <p className="text-sm text-muted">Ask the club owner or an admin for an invitation link.</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader eyebrow={`${members.length} members`} title="Members" />
        <CardBody>
          <MembersPanel
            members={members.map((m) => ({ profileId: m.profileId, displayName: m.displayName, username: m.username, avatarUrl: m.avatarUrl, emblem: m.emblem, role: m.role }))}
            myId={profile.id}
            myRole={club.role}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Leaderboard points" title="Scoring" />
          <CardBody>
            <ScoringPanel
              current={{ placementPoints: current.placementPoints, participationPoints: current.participationPoints, version: current.version }}
              history={rules.map((r) => ({ version: r.version, placementPoints: r.placementPoints, participationPoints: r.participationPoints, createdAt: r.createdAt }))}
              canEdit={isOwner}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Tables" title="Games" />
          <CardBody>
            <GamesPanel games={games} canEdit={isAdmin} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Identity" title="Club details" />
        <CardBody>
          <ClubDetailsPanel
            initial={{
              name: club.name,
              tagline: club.tagline ?? "",
              playfulTitles: club.playfulTitles,
              legendPointsThreshold: club.legendPointsThreshold,
              timezone: club.timezone,
            }}
            canEdit={isAdmin}
          />
        </CardBody>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader eyebrow="Audit trail" title="Recent administrative activity" />
          <CardBody>
            <ActivityFeed items={activity} lookup={memberLookup(members)} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
