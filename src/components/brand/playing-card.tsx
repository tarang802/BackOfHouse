import { SuitIcon, type Suit } from "@/components/ui/suit";
import { cn } from "@/lib/utils";

/** Minimal outlined playing card used as decoration. */
export function PlayingCard({
  rank,
  suit,
  className,
  tone = "ivory",
}: {
  rank: string;
  suit: Suit;
  className?: string;
  tone?: "ivory" | "gold" | "felt";
}) {
  const color = tone === "gold" ? "text-gold" : tone === "felt" ? "text-[#8cc7a8]" : "text-ivory";
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[5/7] rounded-[14px] border bg-gradient-to-b from-[#151816] to-[#0d0f0e] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]",
        tone === "gold" ? "border-gold/50" : "border-line-strong",
        className,
      )}
    >
      <div className="absolute inset-[7px] rounded-[9px] border border-white/[0.04]" />
      <div className={cn("absolute left-3 top-2.5 flex flex-col items-center leading-none", color)}>
        <span className="font-display text-2xl font-semibold">{rank}</span>
        <SuitIcon suit={suit} className="mt-1 size-3.5" />
      </div>
      <div className={cn("absolute bottom-2.5 right-3 flex rotate-180 flex-col items-center leading-none", color)}>
        <span className="font-display text-2xl font-semibold">{rank}</span>
        <SuitIcon suit={suit} className="mt-1 size-3.5" />
      </div>
      <SuitIcon suit={suit} className={cn("absolute left-1/2 top-1/2 size-[34%] -translate-x-1/2 -translate-y-1/2 opacity-90", color)} />
    </div>
  );
}
