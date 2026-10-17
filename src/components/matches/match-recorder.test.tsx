// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCORING_RULE } from "@/lib/domain/scoring";
import { MatchRecorder } from "./match-recorder";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const ids = {
  asha: "11111111-1111-4111-8111-111111111111",
  bilal: "22222222-2222-4222-8222-222222222222",
  chen: "33333333-3333-4333-8333-333333333333",
};
const games = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "bluff", name: "Bluff", kind: "bluff" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "poker", name: "Poker", kind: "poker" },
];
const players = Object.entries(ids).map(([name, profileId]) => ({
  profileId,
  displayName: name[0].toUpperCase() + name.slice(1),
  username: name,
  avatarUrl: null,
  emblem: "spade",
}));

function setup(action = vi.fn().mockResolvedValue({ ok: true, data: { matchId: "match-1" } })) {
  const user = userEvent.setup();
  render(<MatchRecorder games={games} players={players} rule={DEFAULT_SCORING_RULE} ruleVersion={1} tournaments={[]} action={action} />);
  return { user, action };
}

const tap = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));

beforeEach(() => {
  push.mockReset();
  window.localStorage.clear();
});

describe("MatchRecorder", () => {
  it("keeps saving disabled until two players are picked", async () => {
    const { user } = setup();
    const save = screen.getByRole("button", { name: /save result/i });
    expect(save).toBeDisabled();
    await tap(user, "Asha");
    expect(save).toBeDisabled();
    await tap(user, "Bilal");
    expect(screen.getByRole("button", { name: /save result · 2 players/i })).toBeEnabled();
  });

  it("previews points from the finishing order, including ties", async () => {
    const { user } = setup();
    await tap(user, "Chen");
    await tap(user, "Asha");
    await tap(user, "Bilal");
    const check = screen.getByRole("region", { name: /check the result/i });
    expect(within(check).getAllByText("+3")).toHaveLength(1);
    expect(within(check).getAllByText("+1")).toHaveLength(1);
    expect(within(check).getAllByText("+0")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /tie bilal with the player above/i }));
    const preview = screen.getByText(/point preview/i).closest("div")!;
    expect(within(preview).getByText(/2nd · Asha/)).toBeInTheDocument();
    expect(within(preview).getByText(/2nd · Bilal/)).toBeInTheDocument();
    expect(within(preview).getAllByText("+1")).toHaveLength(2);
  });

  it("submits ids and placements only — never points — then opens the saved match", async () => {
    const { user, action } = setup();
    await tap(user, "Bilal");
    await tap(user, "Asha");
    await user.click(screen.getByRole("button", { name: /save result/i }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const input = action.mock.calls[0][0];
    expect(input).toMatchObject({
      gameTypeId: games[0].id,
      results: [
        { profileId: ids.bilal, placement: 1 },
        { profileId: ids.asha, placement: 2 },
      ],
      tournamentId: null,
      ledger: null,
    });
    expect(input.submissionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(input)).not.toMatch(/points/i);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/club/matches/match-1?recorded=1"));
  });

  it("shows the server's error and does not navigate when saving fails", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "Every player must be a member of this club." });
    const { user } = setup(action);
    await tap(user, "Asha");
    await tap(user, "Chen");
    await user.click(screen.getByRole("button", { name: /save result/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Every player must be a member of this club.");
    expect(push).not.toHaveBeenCalled();
  });

  it("reuses the same submission id when retrying after a failure", async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Network hiccup" })
      .mockResolvedValueOnce({ ok: true, data: { matchId: "match-2" } });
    const { user } = setup(action);
    await tap(user, "Asha");
    await tap(user, "Chen");
    await user.click(screen.getByRole("button", { name: /save result/i }));
    await screen.findByRole("alert");
    // Wait for the first attempt's transition to settle before retrying.
    await user.click(await screen.findByRole("button", { name: /save result · 2 players/i }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[0][0].submissionId).toBe(action.mock.calls[1][0].submissionId);
  });
});
