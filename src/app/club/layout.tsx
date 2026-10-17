import { AppShell } from "@/components/shell/app-shell";
import { SignOutButton } from "@/components/shell/shell-controls";
import { requireClub } from "@/lib/data/session";

export default async function ClubLayout({ children }: LayoutProps<"/club">) {
  const { profile, club } = await requireClub();
  return (
    <AppShell
      user={{
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        emblem: profile.emblem,
      }}
      club={{ id: club.id, name: club.name, role: club.role }}
      signOut={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
