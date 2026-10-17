import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SuitIcon, isSuit } from "@/components/ui/suit";
import { formatDate } from "@/lib/utils";

/** The hero "player card" at the top of a profile. */
export function PlayerCard({
  displayName,
  username,
  avatarUrl,
  emblem,
  role,
  joinedAt,
  actions,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  emblem: string;
  role: string;
  joinedAt: string;
  actions?: ReactNode;
}) {
  const suit = isSuit(emblem) ? emblem : "spade";
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-br from-surface-2 via-surface to-ink-2 p-6 shadow-[var(--shadow-card)] sm:p-8">
      <SuitIcon suit={suit} aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-64 text-white/[0.025]" />
      <div className="absolute inset-3 rounded-[1.35rem] border border-white/[0.03]" aria-hidden />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar name={displayName} src={avatarUrl} emblem={emblem} size="xl" ring="felt" />
        <div className="min-w-0 flex-1">
          {role !== "member" ? <Badge>{role}</Badge> : null}
          <h1 className="mt-2 truncate font-display text-[2.6rem] leading-none text-ivory sm:text-5xl">{displayName}</h1>
          <p className="mt-2 text-sm text-muted">
            @{username}
            {joinedAt ? ` · Joined ${formatDate(joinedAt)}` : ""}
          </p>
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      <p className="relative mt-8 border-t border-line pt-6 text-sm text-muted">
        No recorded games yet — statistics appear after the first match.
      </p>
    </section>
  );
}
