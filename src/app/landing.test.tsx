// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LandingPage from "./page";

describe("landing page", () => {
  it("leads with the brand and both calls to action", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Trust No One.Play Your Hand.");
    expect(screen.getByText("Your room. Your rivals. Your leaderboard.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /enter the club/i })).toHaveAttribute("href", "/club");
    expect(screen.getByRole("link", { name: /discover the game/i })).toHaveAttribute("href", "#discover");
    expect(document.getElementById("discover")).not.toBeNull();
  });

  it("is honest about what the product is", () => {
    render(<LandingPage />);
    expect(screen.getByText(/no deposits, no wagering, no payments/i)).toBeInTheDocument();
    // No invented social proof.
    expect(document.body.textContent).not.toMatch(/testimonial|trusted by|\d+\+? (players|users|clubs)/i);
  });
});
