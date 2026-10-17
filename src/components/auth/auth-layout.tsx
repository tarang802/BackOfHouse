import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { PlayingCard } from "@/components/brand/playing-card";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="felt grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="animate-fade-up font-display text-[2.6rem] leading-none text-ivory">{title}</h1>
          {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-muted">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 text-sm text-muted">{footer}</div> : null}
        </main>
      </div>
      <div aria-hidden className="relative hidden overflow-hidden border-l border-line bg-ink-2 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,rgb(31_90_66/0.35),transparent_70%)]" />
        <div className="absolute left-1/2 top-1/2 h-[380px] w-[340px] -translate-x-1/2 -translate-y-1/2">
          <PlayingCard rank="J" suit="diamond" className="absolute left-0 top-10 w-[54%] -rotate-12" />
          <PlayingCard rank="A" suit="spade" tone="gold" className="absolute right-0 top-0 w-[58%] rotate-6" />
        </div>
        <p className="absolute inset-x-0 bottom-12 text-center font-display text-3xl italic text-ivory-dim">
          Trust no one. Play your hand.
        </p>
      </div>
    </div>
  );
}
