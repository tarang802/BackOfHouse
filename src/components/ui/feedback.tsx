import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SuitIcon, type Suit } from "./suit";

export function EmptyState({
  title,
  children,
  action,
  suit = "spade",
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  suit?: Suit;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex h-14 w-10 items-center justify-center rounded-md border border-line-strong">
        <SuitIcon suit={suit} className="size-4 text-gold/70" />
      </span>
      <h3 className="font-display text-xl text-ivory">{title}</h3>
      {children ? <p className="max-w-sm text-sm leading-relaxed text-muted">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-xl", className)} />;
}

export function GoldDivider({ suit = "spade", className }: { suit?: Suit; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)} aria-hidden>
      <span className="hairline-gold flex-1" />
      <SuitIcon suit={suit} className="size-3 text-gold/80" />
      <span className="hairline-gold flex-1" />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 animate-fade-up">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[2.4rem] leading-[1.02] text-ivory sm:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
