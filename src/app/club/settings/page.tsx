import type { Metadata } from "next";
import { InvitePanel, type InvitationView } from "@/components/settings/invite-panel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { requireClub } from "@/lib/data/session";
import { readPublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Club settings" };

export default async function SettingsPage() {
  const { club, isAdmin } = await requireClub();
  const supabase = await createSupabaseServerClient();
  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("club_memberships")
      .select("role, profile:profiles(id, username, display_name, avatar_url, emblem)")
      .eq("club_id", club.id),
    // RLS only returns invitations to owners and admins.
    supabase
      .from("club_invitations")
      .select("id, code, expires_at, max_uses, use_count, revoked_at")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false }),
  ]);
  type MemberRow = { role: string; profile: { id: string; username: string; display_name: string; avatar_url: string | null; emblem: string } };
  const members = ((memberRows ?? []) as unknown as MemberRow[]).sort((a, b) => a.profile.display_name.localeCompare(b.profile.display_name));
  const invitations: InvitationView[] = (inviteRows ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    expiresAt: row.expires_at as string | null,
    maxUses: row.max_uses as number | null,
    useCount: row.use_count as number,
    revokedAt: row.revoked_at as string | null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={club.name} title="Club settings" description={`You are the ${club.role} of this club.`} />
      <Card id="invite" className="scroll-mt-24">
        <CardHeader eyebrow="Grow the table" title="Invite friends" />
        <CardBody>
          {isAdmin ? (
            <InvitePanel invitations={invitations} siteUrl={readPublicEnv()?.siteUrl ?? ""} clubName={club.name} />
          ) : (
            <p className="text-sm text-muted">Ask the club owner or an admin for an invitation link.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader eyebrow={`${members.length} members`} title="Members" />
        <CardBody>
          <ul className="flex flex-col divide-y divide-line">
            {members.map((m) => (
              <li key={m.profile.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.profile.display_name} src={m.profile.avatar_url} emblem={m.profile.emblem} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ivory">{m.profile.display_name}</span>
                  <span className="block truncate text-xs text-muted">@{m.profile.username}</span>
                </span>
                <Badge tone={m.role === "owner" ? "gold" : "neutral"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
