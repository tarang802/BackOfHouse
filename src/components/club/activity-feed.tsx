import { CalendarRange, Crown, Gamepad2, ShieldCheck, Swords, Undo2, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import type { ActivityItem } from "@/lib/data/competition-data";
import type { MemberInfo } from "@/lib/domain/types";
import { relativeTime } from "@/lib/utils";

type Described = { icon: LucideIcon; text: string };

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Turns an audit entry into a short sentence. Unknown actions are skipped. */
export function describeActivity(item: ActivityItem, lookup: (id: string) => MemberInfo): Described | null {
  const actor = item.actorId ? lookup(item.actorId).displayName : "Someone";
  const d = item.details;
  switch (item.action) {
    case "club.created":
      return { icon: ShieldCheck, text: `${actor} opened the club` };
    case "member.joined":
      return { icon: UserPlus, text: `${actor} joined the club` };
    case "member.left":
      return { icon: UserMinus, text: `${actor} left the club` };
    case "member.removed":
      return { icon: UserMinus, text: `${actor} removed ${item.entityId ? lookup(item.entityId).displayName : "a member"}` };
    case "member.role_changed":
      return { icon: ShieldCheck, text: `${actor} made ${item.entityId ? lookup(item.entityId).displayName : "a member"} ${str(d.role) === "admin" ? "an admin" : "a member"}` };
    case "match.recorded": {
      const winners = Array.isArray(d.winner_ids) ? (d.winner_ids as string[]).map((id) => lookup(id).displayName) : [];
      return { icon: Gamepad2, text: `${winners.join(" & ") || "Someone"} won a game of ${str(d.game) || "cards"}` };
    }
    case "match.corrected":
      return { icon: Undo2, text: `${actor} corrected a ${str(d.game) || ""} result` };
    case "match.voided":
      return { icon: Undo2, text: `${actor} voided a match` };
    case "tournament.created":
      return { icon: Crown, text: `${actor} created ${str(d.name) || "a tournament"}` };
    case "tournament.in_progress":
      return { icon: Swords, text: `${str(d.name) || "A tournament"} is under way` };
    case "tournament.completed": {
      const champ = typeof d.champion_id === "string" ? lookup(d.champion_id).displayName : "A champion";
      return { icon: Crown, text: `${champ} won ${str(d.name) || "a tournament"}` };
    }
    case "tournament.cancelled":
      return { icon: Crown, text: `${str(d.name) || "A tournament"} was cancelled` };
    case "season.started":
      return { icon: CalendarRange, text: `${str(d.name) || "A new season"} began` };
    case "season.archived": {
      const champ = typeof d.champion_id === "string" ? `${lookup(d.champion_id).displayName} took` : "Closed";
      return { icon: CalendarRange, text: `${champ} ${str(d.name) || "the season"}` };
    }
    case "scoring.updated":
      return { icon: ShieldCheck, text: `${actor} updated the scoring rules` };
    case "game.added":
      return { icon: Gamepad2, text: `${actor} added ${str(d.name) || "a game"}` };
    default:
      return null;
  }
}

export function ActivityFeed({ items, lookup }: { items: ActivityItem[]; lookup: (id: string) => MemberInfo }) {
  const described = items
    .map((item) => ({ item, described: describeActivity(item, lookup) }))
    .filter((entry): entry is { item: ActivityItem; described: Described } => entry.described !== null);
  if (described.length === 0) return <p className="text-sm text-muted">Nothing has happened yet.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {described.map(({ item, described: { icon: Icon, text } }) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line">
            <Icon className="size-3.5 text-muted" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ivory-dim">{text}</span>
            <time dateTime={item.createdAt} className="text-xs text-faint">
              {relativeTime(item.createdAt)}
            </time>
          </span>
        </li>
      ))}
    </ol>
  );
}
