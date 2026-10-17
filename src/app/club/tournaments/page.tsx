import { Crown, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { getGameTypes, getMembers, memberLookup } from "@/lib/data/club-data";
import { getTournaments, type Tournament } from "@/lib/data/competition-data";
import { requireClub } from "@/lib/data/session";
import { formatDate, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Tournaments" };

const STATUS_LABEL: Record<Tournament["status"], string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  in_progress: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

const FORMAT_LABEL = { points: "Points race", rounds: "Fixed rounds", elimination: "Knockout" } as const;

export default async function TournamentsPage() {
  const { club, isAdmin } = await requireClub();
  const [tournaments, members, games] = await Promise.all([getTournaments(club.id), getMembers(club.id), getGameTypes(club.id)]);
  const lookup = memberLookup(members);
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";
  const groups: { title: string; items: Tournament[] }[] = [
    { title: "Live & upcoming", items: tournaments.filter((t) => t.status === "in_progress" || t.status === "upcoming") },
    { title: "Drafts", items: tournaments.filter((t) => t.status === "draft") },
    { title: "Hall of champions", items: tournaments.filter((t) => t.status === "completed") },
    { title: "Cancelled", items: tournaments.filter((t) => t.status === "cancelled") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={club.name}
        title="Tournaments"
        description="Points races, fixed rounds and knockouts. Champions are only crowned when it is truly over."
        actions={
          isAdmin ? (
            <ButtonLink href="/club/tournaments/new">
              <Plus /> New tournament
            </ButtonLink>
          ) : null
        }
      />
      {tournaments.length === 0 ? (
        <EmptyState
          suit="diamond"
          title="No tournaments yet"
          action={isAdmin ? <ButtonLink href="/club/tournaments/new" size="sm">Create the first</ButtonLink> : undefined}
        >
          {isAdmin ? "Set one up for your next card night." : "Club admins can create tournaments."}
        </EmptyState>
      ) : null}
      {groups
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <section key={group.title} aria-labelledby={`group-${group.title}`}>
            <h2 id={`group-${group.title}`} className="eyebrow mb-3">
              {group.title}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.items.map((t) => {
                const champion = t.championId ? lookup(t.championId) : null;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/club/tournaments/${t.id}`}
                      className="flex h-full flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-2xl text-ivory">{t.name}</p>
                          <p className="mt-1 text-xs text-muted">
                            {gameName(t.gameTypeId)} · {FORMAT_LABEL[t.format]} · {pluralize(t.participantIds.length, "player")}
                          </p>
                        </div>
                        <Badge tone={t.status === "in_progress" ? "felt" : t.status === "completed" ? "gold" : t.status === "cancelled" ? "loss" : "neutral"}>
                          {STATUS_LABEL[t.status]}
                        </Badge>
                      </div>
                      {champion ? (
                        <div className="flex items-center gap-3 border-t border-line pt-4">
                          <Avatar name={champion.displayName} src={champion.avatarUrl} emblem={champion.emblem} size="sm" ring="gold" />
                          <span className="text-sm text-ivory-dim">
                            <Crown className="mr-1 inline size-3.5 text-gold" aria-hidden />
                            Champion <span className="text-ivory">{champion.displayName}</span>
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-faint">From {formatDate(t.startsOn)}{t.endsOn ? ` to ${formatDate(t.endsOn)}` : ""}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
