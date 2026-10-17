// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PlayerDirectory, type DirectoryPlayer } from "./player-directory";

const player = (profileId: string, displayName: string, username: string, extra: Partial<DirectoryPlayer> = {}): DirectoryPlayer => ({
  profileId,
  displayName,
  username,
  avatarUrl: null,
  emblem: "spade",
  role: "member",
  rank: null,
  points: 0,
  games: 0,
  wins: 0,
  winRate: null,
  joinedAt: "2026-01-01T00:00:00Z",
  ...extra,
});

const players = [
  player("1", "Arjun Mehta", "arjun", { rank: 1, points: 12, games: 5, wins: 3, winRate: 0.6, role: "owner" }),
  player("2", "Bela", "bela_b", { rank: 2, points: 4, games: 4, wins: 1, winRate: 0.25 }),
  player("3", "Chirag", "chirag"),
];

describe("PlayerDirectory", () => {
  it("links every player to their profile and shows honest stats", () => {
    render(<PlayerDirectory players={players} myId="2" />);
    expect(screen.getByRole("link", { name: /arjun mehta/i })).toHaveAttribute("href", "/club/players/arjun");
    expect(screen.getByText("Unranked")).toBeInTheDocument();
    expect(screen.getByText("— wins")).toBeInTheDocument();
    expect(screen.getByText("60% wins")).toBeInTheDocument();
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("filters by display name or username", async () => {
    const user = userEvent.setup();
    render(<PlayerDirectory players={players} myId="2" />);
    await user.type(screen.getByRole("textbox", { name: /search players/i }), "bela_");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await user.clear(screen.getByRole("textbox", { name: /search players/i }));
    await user.type(screen.getByRole("textbox", { name: /search players/i }), "zzz");
    expect(screen.getByText(/no players match/i)).toBeInTheDocument();
  });
});
