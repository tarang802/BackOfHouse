import type { SVGProps } from "react";

export type Suit = "spade" | "heart" | "diamond" | "club";

const paths: Record<Suit, string> = {
  spade:
    "M12 2.5c-.3 0-.6.1-.8.4C8.4 6.2 4 9.4 4 13.3 4 15.9 6 18 8.5 18c1.1 0 2.1-.4 2.8-1.1-.3 1.7-1 3-2.3 4.1h6c-1.3-1.1-2-2.4-2.3-4.1.7.7 1.7 1.1 2.8 1.1 2.5 0 4.5-2.1 4.5-4.7 0-3.9-4.4-7.1-7.2-10.4-.2-.3-.5-.4-.8-.4Z",
  heart:
    "M12 20.5c-.3 0-.5-.1-.7-.3C7.5 16.8 3.5 13.6 3.5 9.3 3.5 6.6 5.5 4.5 8 4.5c1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.5 0 4.5 2.1 4.5 4.8 0 4.3-4 7.5-7.8 10.9-.2.2-.4.3-.7.3Z",
  diamond: "M12 2.5c.3 0 .5.1.7.4l6.2 8.4c.3.4.3.9 0 1.4l-6.2 8.4c-.4.5-1 .5-1.4 0l-6.2-8.4c-.3-.5-.3-1 0-1.4l6.2-8.4c.2-.3.4-.4.7-.4Z",
  club:
    "M12 2.5a4.1 4.1 0 0 0-3.8 5.7A4.2 4.2 0 0 0 3.5 12.3 4.2 4.2 0 0 0 7.7 16.5c1.4 0 2.6-.7 3.4-1.7-.2 2.6-1 4.6-2.6 6.2h7c-1.6-1.6-2.4-3.6-2.6-6.2.8 1 2 1.7 3.4 1.7a4.2 4.2 0 0 0 4.2-4.2 4.2 4.2 0 0 0-4.7-4.1A4.1 4.1 0 0 0 12 2.5Z",
};

export const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];

export function SuitIcon({ suit, ...props }: { suit: Suit } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d={paths[suit]} />
    </svg>
  );
}

export function isSuit(value: string): value is Suit {
  return (SUITS as string[]).includes(value);
}
