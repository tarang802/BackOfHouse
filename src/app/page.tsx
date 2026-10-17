import { Logo } from "@/components/brand/logo";
import { PlayingCard } from "@/components/brand/playing-card";
import { GoldDivider } from "@/components/ui/feedback";

export default function HomePage() {
  return (
    <main id="main" className="felt flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo />
      <PlayingCard rank="A" suit="spade" tone="gold" className="w-28" />
      <GoldDivider className="w-64" />
      <p className="font-display text-3xl italic text-ivory-dim">Trust No One. Play Your Hand.</p>
    </main>
  );
}
