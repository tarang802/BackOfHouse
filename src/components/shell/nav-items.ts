import {
  CalendarRange,
  Crown,
  ScrollText,
  House,
  Plus,
  Settings,
  Spade,
  Swords,
  Trophy,
  Users,
  Club as ClubIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const primaryNav: NavItem[] = [
  { href: "/club", label: "Dashboard", icon: House, exact: true },
  { href: "/club/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/club/matches", label: "Matches", icon: ScrollText },
  { href: "/club/players", label: "Players", icon: Users },
];

export const gameNav: NavItem[] = [
  { href: "/club/games/bluff", label: "Bluff", icon: Spade },
  { href: "/club/games/poker", label: "Poker", icon: ClubIcon },
  { href: "/club/rivalries", label: "Rivalries", icon: Swords },
];

export const competitionNav: NavItem[] = [
  { href: "/club/tournaments", label: "Tournaments", icon: Crown },
  { href: "/club/seasons", label: "Seasons", icon: CalendarRange },
  { href: "/club/settings", label: "Club settings", icon: Settings },
];

export const recordNav: NavItem = { href: "/club/matches/new", label: "Record", icon: Plus };

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/club/matches") {
    return pathname === "/club/matches" || (pathname.startsWith("/club/matches/") && pathname !== "/club/matches/new");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
