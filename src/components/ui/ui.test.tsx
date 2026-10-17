// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";
import { FormPill } from "./badge";
import { Button } from "./button";
import { Field, Input } from "./field";

describe("design system primitives", () => {
  it("renders a monogram avatar with an accessible name", () => {
    render(<Avatar name="Arjun Mehta" emblem="club" />);
    expect(screen.getByText("AM")).toHaveAttribute("aria-hidden");
    expect(screen.getByText("Arjun Mehta")).toHaveClass("sr-only");
  });

  it("uses the uploaded photo when there is one", () => {
    const { container } = render(<Avatar name="Bela" src="https://example.test/b.webp" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/b.webp");
  });

  it("labels win/loss pills so results never rely on colour alone", () => {
    render(
      <>
        <FormPill result="W" />
        <FormPill result="L" />
      </>,
    );
    expect(screen.getByLabelText("Win")).toHaveTextContent("W");
    expect(screen.getByLabelText("Loss")).toHaveTextContent("L");
  });

  it("defaults buttons to type=button so they never submit forms by accident", () => {
    render(<Button>Tap</Button>);
    expect(screen.getByRole("button", { name: "Tap" })).toHaveAttribute("type", "button");
  });

  it("connects field labels and announces errors", () => {
    render(
      <Field label="Username" htmlFor="u" error="That username is taken.">
        <Input id="u" aria-invalid />
      </Field>,
    );
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("That username is taken.");
  });
});
