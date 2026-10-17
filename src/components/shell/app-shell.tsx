"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { competitionNav, gameNav, isActive, primaryNav, recordNav, type NavItem } from "./nav-items";

export type ShellUser = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  emblem: string;
};

export type ShellClub = { id: string; name: string; role: string };

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
        active ? "bg-white/[0.05] text-ivory" : "text-muted hover:bg-white/[0.03] hover:text-ivory",
      )}
    >
      <Icon className={cn("size-[18px]", active ? "text-gold" : "text-faint group-hover:text-ivory-dim")} strokeWidth={1.6} />
      {item.label}
      {active ? <span className="ml-auto size-1.5 rounded-full bg-gold" aria-hidden /> : null}
    </Link>
  );
}

function NavSection({ title, items, pathname, onNavigate }: { title: string; items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div>
      <p className="eyebrow mb-2 px-3 text-[10px]">{title}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function AppShell({
  user,
  club,
  clubSwitcher,
  signOut,
  children,
}: {
  user: ShellUser;
  club: ShellClub;
  clubSwitcher?: ReactNode;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileTabs = [primaryNav[0], primaryNav[1], recordNav, primaryNav[2]];

  return (
    <div className="min-h-dvh bg-ink lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-ink-2/70 lg:flex">
        <div className="px-6 pb-4 pt-6">
          <Logo href="/club" />
        </div>
        <div className="mx-4 mb-4 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="eyebrow text-[10px]">Club</p>
          <p className="mt-1 truncate font-display text-xl text-ivory">{club.name}</p>
          {clubSwitcher}
        </div>
        <div className="px-4">
          <Link
            href={recordNav.href}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-ivory text-sm font-medium text-ink transition-colors hover:bg-white"
          >
            <Plus className="size-4" />
            Record a match
          </Link>
        </div>
        <nav aria-label="Club" className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6">
          <NavSection title="Club" items={primaryNav} pathname={pathname} />
          <NavSection title="Games" items={gameNav} pathname={pathname} />
          <NavSection title="Competition" items={competitionNav} pathname={pathname} />
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-5 py-4">
          <Link href={`/club/players/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl">
            <Avatar name={user.displayName} src={user.avatarUrl} emblem={user.emblem} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-ivory">{user.displayName}</span>
              <span className="block truncate text-xs text-muted">@{user.username}</span>
            </span>
          </Link>
          {signOut}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/85 px-4 backdrop-blur-md lg:hidden">
        <Logo href="/club" compact />
        <p className="mx-3 min-w-0 flex-1 truncate text-center font-display text-lg text-ivory">{club.name}</p>
        <Link href={`/club/players/${user.username}`} aria-label="Your profile">
          <Avatar name={user.displayName} src={user.avatarUrl} emblem={user.emblem} size="sm" />
        </Link>
      </header>

      <main id="main" className="min-w-0 pb-28 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Club"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {mobileTabs.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const isRecord = item.href === recordNav.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide"
              >
                {isRecord ? (
                  <span className="-mt-5 flex size-12 items-center justify-center rounded-full border border-gold/50 bg-ivory text-ink shadow-[0_10px_30px_-10px_rgb(199_169_107/0.6)]">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className={cn("size-5", active ? "text-gold" : "text-faint")} strokeWidth={1.6} />
                )}
                <span className={cn(active ? "text-ivory" : "text-muted", isRecord && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide text-muted"
            aria-haspopup="dialog"
          >
            <Menu className="size-5 text-faint" strokeWidth={1.6} />
            More
          </button>
        </div>
      </nav>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={club.name} description={`Signed in as @${user.username}`}>
        <div className="flex flex-col gap-6">
          {clubSwitcher}
          <NavSection title="Club" items={primaryNav.slice(3)} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <NavSection title="Games" items={gameNav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <NavSection title="Competition" items={competitionNav} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-line pt-4">{signOut}</div>
        </div>
      </Dialog>
    </div>
  );
}
