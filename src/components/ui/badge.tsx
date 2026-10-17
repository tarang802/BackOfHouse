import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        neutral: "border-line-strong text-muted",
        felt: "border-felt-bright/50 bg-felt-deep/60 text-[#9fd3b8]",
        gold: "border-gold/50 text-gold",
        loss: "border-loss/50 text-loss",
        ivory: "border-ivory/30 text-ivory",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** W / L pill. Always shows the letter so results never rely on colour alone. */
export function FormPill({ result }: { result: "W" | "L" }) {
  return (
    <span
      aria-label={result === "W" ? "Win" : "Loss"}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md border text-[11px] font-bold",
        result === "W" ? "border-felt-bright/60 bg-felt/40 text-[#b8e3cc]" : "border-line-strong text-muted",
      )}
    >
      {result}
    </span>
  );
}
