// @vitest-environment jsdom
import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "@/app/page";
import { LeaderboardTable } from "@/components/club/leaderboard-table";
import { PlayerDirectory } from "@/components/club/player-directory";
import { MatchRecorder } from "@/components/matches/match-recorder";
import { DEFAULT_SCORING_RULE } from "@/lib/domain/scoring";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/club" }));

/** Runs axe on the rendered tree (colour contrast needs a real browser, so it is skipped here). */
async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const players = [
  { profileId: "11111111-1111-4111-8111-111111111111", displayName: "Asha", username: "asha", avatarUrl: null, emblem: "spade" },
  { profileId: "22222222-2222-4222-8222-222222222222", displayName: "Bilal", username: "bilal", avatarUrl: null, emblem: "heart" },
];

describe("accessibility (axe)", () => {
  it("landing page", async () => {
    const { container } = render(<LandingPage />);
    expect(await violations(container)).toEqual([]);
  });

  it("match recorder", async () => {
    const { container } = render(
      <MatchRecorder
        games={[{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "bluff", name: "Bluff", kind: "bluff" }]}
        players={players}
        rule={DEFAULT_SCORING_RULE}
        ruleVersion={1}
        tournaments={[]}
        action={vi.fn()}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("leaderboard table", async () => {
    const { container } = render(
      <LeaderboardTable
        caption="Overall"
        rows={players.map((p, i) => ({ ...p, rank: i === 0 ? 1 : null, points: 3 - i * 3, wins: 1 - i, games: 1 - i, winRate: i ? null : 1, recentForm: i ? [] : ["W"] }))}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("player directory", async () => {
    const { container } = render(
      <PlayerDirectory
        myId={players[0].profileId}
        players={players.map((p) => ({ ...p, role: "member" as const, rank: null, points: 0, games: 0, wins: 0, winRate: null, joinedAt: "2026-01-01" }))}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });
});
