import { AppShell } from "@/components/shell/app-shell";
import { ClubSwitcher, SignOutButton } from "@/components/shell/shell-controls";
import { requireClub } from "@/lib/data/session";

export default async function ClubLayout({ children }: LayoutProps<"/club">) {
  const { profile, club, clubs } = await requireClub();
  return (
    <AppShell
      user={{
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        emblem: profile.emblem,
      }}
      club={{ id: club.id, name: club.name, role: club.role }}
      clubSwitcher={<ClubSwitcher clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} activeId={club.id} />}
      signOut={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
