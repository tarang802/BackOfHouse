import { ArrowRight, Crown, Flame, ScrollText, Swords, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PlayingCard } from "@/components/brand/playing-card";
import { ButtonLink } from "@/components/ui/button";
import { GoldDivider } from "@/components/ui/feedback";
import { SuitIcon, type Suit } from "@/components/ui/suit";

export const metadata: Metadata = {
  title: "The Bluff Club — Trust No One. Play Your Hand.",
};

const steps: { suit: Suit; title: string; body: string }[] = [
  {
    suit: "spade",
    title: "Open your club",
    body: "Create a private room for your table. Only the people you invite can see what happens inside.",
  },
  {
    suit: "heart",
    title: "Invite the table",
    body: "Share a code or a link. Friends join from their phones in under a minute.",
  },
  {
    suit: "diamond",
    title: "Record every game",
    body: "Pick the game, tap the players in finishing order, confirm. The points are worked out for you.",
  },
  {
    suit: "club",
    title: "Crown champions",
    body: "Leaderboards, streaks, rivalries, tournaments and seasons build themselves from your results.",
  },
];

const features = [
  { icon: Trophy, title: "Living leaderboards", body: "Overall and per-game rankings with clear, configurable scoring and fair tie handling." },
  { icon: Flame, title: "Bluff & Poker rooms", body: "Dedicated pages for each game: win rates, average finish, streaks and recent form." },
  { icon: Crown, title: "Tournaments", body: "Points races, fixed rounds or knockout brackets — champions declared only when it is truly over." },
  { icon: Swords, title: "Rivalries", body: "Every head-to-head record between two players, game by game, encounter by encounter." },
  { icon: ScrollText, title: "Honest history", body: "Mistakes are corrected in the open. Voided games stay on the record with a reason." },
  { icon: Users, title: "Seasons", body: "Close a season, archive its champion, and start the next chapter without losing a single game." },
];

export default function LandingPage() {
  return (
    <div className="felt min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link href="#discover" className="hidden rounded-full px-4 py-2 text-sm text-ivory-dim transition-colors hover:text-ivory sm:inline-flex">
            Discover
          </Link>
          <Link href="/login" className="rounded-full px-4 py-2 text-sm text-ivory-dim transition-colors hover:text-ivory">
            Sign in
          </Link>
          <ButtonLink href="/club" size="sm" variant="outline">
            Enter
          </ButtonLink>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-8 md:grid-cols-[1.15fr_0.85fr] md:pt-20">
          <div className="animate-fade-up">
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-8 bg-gold/60" />
              A private card club
            </p>
            <h1 className="mt-6 font-display text-[3.4rem] font-medium leading-[0.95] tracking-[-0.01em] text-ivory sm:text-7xl lg:text-[5.5rem]">
              Trust No One.
              <br />
              <span className="italic text-gold">Play Your Hand.</span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-ivory-dim">
              Your room. Your rivals. Your leaderboard.
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              The Bluff Club keeps score for the card games you play together in person — Bluff, Poker,
              Teen Patti and your own house games.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/club" size="lg">
                Enter the Club
                <ArrowRight />
              </ButtonLink>
              <ButtonLink href="#discover" size="lg" variant="outline">
                Discover the Game
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto h-[340px] w-full max-w-[380px] sm:h-[420px]" aria-hidden>
            <div className="absolute inset-x-6 bottom-2 h-24 rounded-[50%] bg-felt/30 blur-3xl" />
            <PlayingCard
              rank="K"
              suit="club"
              className="absolute left-[4%] top-[14%] w-[46%] -rotate-[14deg] animate-rise [animation-delay:120ms]"
            />
            <PlayingCard
              rank="Q"
              suit="heart"
              tone="felt"
              className="absolute right-[4%] top-[14%] w-[46%] rotate-[14deg] animate-rise [animation-delay:220ms]"
            />
            <PlayingCard
              rank="A"
              suit="spade"
              tone="gold"
              className="absolute left-1/2 top-[4%] w-[50%] -translate-x-1/2 animate-rise [animation-delay:40ms]"
            />
          </div>
        </section>

        <GoldDivider className="mx-auto max-w-6xl px-4 sm:px-8" />

        {/* How it works */}
        <section id="discover" className="mx-auto max-w-6xl scroll-mt-10 px-4 py-24 sm:px-8">
          <div className="max-w-2xl">
            <p className="eyebrow">Discover the game</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-ivory sm:text-5xl">
              The cards stay on the table. The record lives here.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              You deal, bluff and argue in the room. Afterwards, one of you records the result on a phone in a few
              seconds, and everyone&apos;s standing updates instantly.
            </p>
          </div>

          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="group relative rounded-[var(--radius-card)] border border-line bg-surface/70 p-6 transition-colors hover:border-line-strong">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl text-gold/90">{["I", "II", "III", "IV"][index]}</span>
                  <SuitIcon suit={step.suit} className="size-4 text-faint transition-colors group-hover:text-gold/70" />
                </div>
                <h3 className="mt-8 text-lg font-semibold text-ivory">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section className="border-y border-line bg-ink-2/60">
          <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-12 px-4 py-24 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="size-5 text-gold" strokeWidth={1.5} />
                <h3 className="mt-5 font-display text-2xl text-ivory">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* House rules */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <div className="grid gap-10 rounded-[1.75rem] border border-line bg-surface p-8 sm:p-12 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="eyebrow">House rules</p>
              <h2 className="mt-4 font-display text-4xl leading-tight text-ivory">Bragging rights only.</h2>
            </div>
            <ul className="space-y-4 text-[15px] leading-relaxed text-ivory-dim">
              <li className="flex gap-3">
                <SuitIcon suit="spade" className="mt-1.5 size-3 shrink-0 text-gold/80" />
                Points are leaderboard points for friendly competition. They are not money and cannot be bought.
              </li>
              <li className="flex gap-3">
                <SuitIcon suit="spade" className="mt-1.5 size-3 shrink-0 text-gold/80" />
                No deposits, no wagering, no payments. The Bluff Club records games you play in person.
              </li>
              <li className="flex gap-3">
                <SuitIcon suit="spade" className="mt-1.5 size-3 shrink-0 text-gold/80" />
                Your club is private. Members see each other&apos;s names and results — never email addresses.
              </li>
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 pb-28 text-center sm:px-8">
          <h2 className="font-display text-5xl leading-tight text-ivory sm:text-6xl">
            Your Room. Your Rivals.
            <br />
            <span className="italic text-gold">Your Table.</span>
          </h2>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/signup" size="lg">
              Open your club
              <ArrowRight />
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-faint sm:flex-row sm:px-8">
          <Logo compact />
          <p>Trust No One. Play Your Hand.</p>
          <p>Friendly scorekeeping. No real-money play.</p>
        </div>
      </footer>
    </div>
  );
}
