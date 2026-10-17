// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScoringPanel } from "./scoring-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const updateScoringAction = vi.fn();
vi.mock("@/lib/actions/admin", () => ({ updateScoringAction: (...args: unknown[]) => updateScoringAction(...args) }));

const current = { placementPoints: [3, 1], participationPoints: 0, version: 1 };
const history = [{ ...current, createdAt: "2026-10-01T00:00:00Z" }];

describe("ScoringPanel", () => {
  it("is read-only for everyone except the owner", () => {
    render(<ScoringPanel current={current} history={history} canEdit={false} />);
    expect(screen.getByText(/only the club owner can change scoring/i)).toBeInTheDocument();
    for (const input of screen.getAllByRole("spinbutton")) expect(input).toBeDisabled();
  });

  it("blocks invalid rules before they reach the server", async () => {
    const user = userEvent.setup();
    render(<ScoringPanel current={current} history={history} canEdit />);
    const [first, second] = screen.getAllByRole("spinbutton");
    await user.clear(second);
    await user.type(second, "5");
    expect(screen.getByText(/lower finish cannot earn more/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as v2/i })).toBeDisabled();

    await user.clear(first);
    await user.type(first, "5");
    await user.clear(second);
    await user.type(second, "2");
    expect(screen.getByText("2nd place: +2 points")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as v2/i })).toBeEnabled();
  });

  it("sends the new table and reports success", async () => {
    updateScoringAction.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    render(<ScoringPanel current={current} history={history} canEdit />);
    await user.click(screen.getByRole("button", { name: /add a place/i }));
    const third = screen.getAllByRole("spinbutton")[2];
    await user.clear(third);
    await user.type(third, "1");
    await user.click(screen.getByRole("button", { name: /save as v2/i }));
    expect(updateScoringAction).toHaveBeenCalledWith({ placementPoints: [3, 1, 1], participationPoints: 0 });
  });
});
