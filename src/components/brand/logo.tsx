import Link from "next/link";
import { SuitIcon } from "@/components/ui/suit";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-9 w-7 items-center justify-center rounded-[5px] border border-gold/60 bg-ink-2",
        className,
      )}
    >
      <SuitIcon suit="spade" className="size-3.5 text-gold" />
      <span className="absolute left-[3px] top-[1px] font-display text-[8px] leading-none text-gold/80">B</span>
    </span>
  );
}

export function Logo({ href = "/", compact = false, className }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-3", className)} aria-label="The Bluff Club home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold tracking-[0.42em] text-muted">THE</span>
          <span className="font-display text-[1.35rem] font-semibold tracking-[0.08em] text-ivory">BLUFF CLUB</span>
        </span>
      )}
    </Link>
  );
}
